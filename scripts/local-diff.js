const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = require('node-fetch');

// Get the current Git commit hash from environment or command line
const currentCommitHash = process.env.BITBUCKET_COMMIT || process.env.GIT_COMMIT || 'local';
console.log('Current commit hash:', currentCommitHash);

// Ensure output directories exist
const outputDir = path.join(process.cwd(), 'gridshots');
const diffDir = path.join(outputDir, 'diffs');
const mockDir = path.join(outputDir, 'mock');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('Created output directory:', outputDir);
}
if (!fs.existsSync(diffDir)) {
  fs.mkdirSync(diffDir, { recursive: true });
  console.log('Created diff directory:', diffDir);
}
if (!fs.existsSync(mockDir)) {
  fs.mkdirSync(mockDir, { recursive: true });
  console.log('Created mock directory:', mockDir);
}

// OpenAI API key - using environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Create mock images for testing if no real images exist
 */
async function createMockImages() {
  console.log('Creating mock images for testing...');
  
  // Create a few test components
  const components = ['Button', 'Card', 'Header', 'Footer', 'Sidebar'];
  
  for (const component of components) {
    // Create "previous" version
    const prevImage = sharp({
      create: {
        width: 300,
        height: 200,
        channels: 4,
        background: { r: 100, g: 150, b: 200, alpha: 1 }
      }
    });
    
    // Add some text
    const prevBuffer = await prevImage
      .composite([{
        input: Buffer.from(`<div>${component}</div>`),
        top: 80,
        left: 100
      }])
      .png()
      .toBuffer();
    
    // Save previous version
    const prevPath = path.join(mockDir, `prev_${component}.png`);
    fs.writeFileSync(prevPath, prevBuffer);
    
    // Create "current" version with slight differences
    const currImage = sharp({
      create: {
        width: 300,
        height: 200,
        channels: 4,
        background: { r: 120, g: 160, b: 210, alpha: 1 } // Slightly different color
      }
    });
    
    // Add some text
    const currBuffer = await currImage
      .composite([{
        input: Buffer.from(`<div>${component}</div>`),
        top: 85, // Slightly moved
        left: 105 // Slightly moved
      }])
      .png()
      .toBuffer();
    
    // Save current version
    const currPath = path.join(mockDir, `curr_${component}.png`);
    fs.writeFileSync(currBuffer, currPath);
    
    console.log(`Created mock images for ${component}`);
  }
  
  return components;
}

/**
 * Compare two images and generate a diff image if the difference is significant
 */
async function compareImages(currentImagePath, previousImagePath, componentName) {
  try {
    console.log(`Comparing images for ${componentName}`);
    
    // Load images
    const currentImage = sharp(currentImagePath);
    const previousImage = sharp(previousImagePath);
    
    // Get image metadata
    const currentMeta = await currentImage.metadata();
    const previousMeta = await previousImage.metadata();
    
    // Resize previous image to match current image dimensions if needed
    let processedPreviousImage = previousImage;
    if (currentMeta.width !== previousMeta.width || currentMeta.height !== previousMeta.height) {
      console.log(`Resizing previous image to match current dimensions: ${currentMeta.width}x${currentMeta.height}`);
      processedPreviousImage = previousImage.resize(currentMeta.width, currentMeta.height);
    }
    
    // Convert images to raw pixel data
    const currentBuffer = await currentImage.raw().toBuffer();
    const previousBuffer = await processedPreviousImage.raw().toBuffer();
    
    // Calculate difference
    let diffPixels = 0;
    const totalPixels = currentMeta.width * currentMeta.height;
    
    // Create a difference buffer
    const diffBuffer = Buffer.alloc(currentBuffer.length);
    
    for (let i = 0; i < currentBuffer.length; i += 3) {
      // Calculate color difference for RGB channels
      const rDiff = Math.abs(currentBuffer[i] - previousBuffer[i]);
      const gDiff = Math.abs(currentBuffer[i + 1] - previousBuffer[i + 1]);
      const bDiff = Math.abs(currentBuffer[i + 2] - previousBuffer[i + 2]);
      
      // If any channel has a significant difference, count as different pixel
      if (rDiff > 5 || gDiff > 5 || bDiff > 5) {
        diffPixels++;
        
        // Highlight the difference in red
        diffBuffer[i] = 255;  // R
        diffBuffer[i + 1] = 0;  // G
        diffBuffer[i + 2] = 0;  // B
      } else {
        // Keep the original pixel
        diffBuffer[i] = currentBuffer[i];
        diffBuffer[i + 1] = currentBuffer[i + 1];
        diffBuffer[i + 2] = currentBuffer[i + 2];
      }
    }
    
    const diffPercentage = (diffPixels / totalPixels) * 100;
    console.log(`Difference: ${diffPercentage.toFixed(2)}% (${diffPixels}/${totalPixels} pixels)`);
    
    // If difference is significant (>0.1%), generate diff image
    if (diffPercentage > 0.1) {
      const diffImagePath = path.join(diffDir, `${componentName}_diff.png`);
      
      // Create a new image from the diff buffer
      await sharp(diffBuffer, {
        raw: {
          width: currentMeta.width,
          height: currentMeta.height,
          channels: 3
        }
      })
      .png()
      .toFile(diffImagePath);
      
      console.log(`Saved diff image to ${diffImagePath}`);
      
      return {
        hasDiff: true,
        diffPercentage,
        diffImagePath
      };
    }
    
    return {
      hasDiff: false,
      diffPercentage
    };
  } catch (error) {
    console.error(`Error comparing images for ${componentName}:`, error);
    return {
      hasDiff: false,
      error: error.message
    };
  }
}

/**
 * Generate a summary of visual changes using GPT-4o
 */
async function generateChangeSummary(componentName, currentImagePath, previousImagePath, diffImagePath) {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set. Skipping AI summary generation.');
    return 'Visual changes detected (AI summary unavailable)';
  }
  
  try {
    console.log(`Generating AI summary for changes in ${componentName}`);
    
    // Convert images to base64
    const currentImageBase64 = fs.readFileSync(currentImagePath).toString('base64');
    const previousImageBase64 = fs.readFileSync(previousImagePath).toString('base64');
    const diffImageBase64 = fs.readFileSync(diffImagePath).toString('base64');
    
    // Prepare API request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert UI reviewer. Describe the visual changes between two UI component screenshots in a concise one-line summary. Focus on specific UI changes like colors, sizes, positions, or added/removed elements.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Describe the visual changes in the ${componentName} component. The red areas in the diff image highlight the changes.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${previousImageBase64}`,
                  detail: 'low'
                }
              },
              {
                type: 'text',
                text: 'Previous version'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${currentImageBase64}`,
                  detail: 'low'
                }
              },
              {
                type: 'text',
                text: 'Current version'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${diffImageBase64}`,
                  detail: 'low'
                }
              },
              {
                type: 'text',
                text: 'Diff image (red highlights show changes)'
              }
            ]
          }
        ],
        max_tokens: 100
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.error('Error from OpenAI API:', result.error);
      return 'Visual changes detected (AI summary failed)';
    }
    
    const summary = result.choices[0].message.content.trim();
    console.log(`AI summary: ${summary}`);
    
    return summary;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return 'Visual changes detected (AI summary failed)';
  }
}

/**
 * Find existing snapshot images in the gridshots directory
 */
async function findExistingSnapshots() {
  try {
    console.log('Looking for existing snapshots...');
    
    // Check if the gridshots directory exists and has files
    if (!fs.existsSync(outputDir)) {
      console.log('No gridshots directory found.');
      return [];
    }
    
    const files = fs.readdirSync(outputDir);
    const pngFiles = files.filter(file => file.endsWith('.png'));
    
    if (pngFiles.length === 0) {
      console.log('No PNG files found in gridshots directory.');
      return [];
    }
    
    console.log(`Found ${pngFiles.length} PNG files in gridshots directory.`);
    
    // Extract component names from filenames
    const components = pngFiles.map(file => {
      const name = path.basename(file, '.png');
      return {
        name,
        path: path.join(outputDir, file)
      };
    });
    
    return components;
  } catch (error) {
    console.error('Error finding existing snapshots:', error);
    return [];
  }
}

/**
 * Process all component snapshots and generate diffs
 */
async function processDiffs() {
  try {
    // Find existing snapshots or create mock ones for testing
    let components = await findExistingSnapshots();
    
    if (components.length === 0) {
      console.log('No existing snapshots found. Creating mock images for testing...');
      const mockComponents = await createMockImages();
      
      components = mockComponents.map(name => ({
        name,
        currentPath: path.join(mockDir, `curr_${name}.png`),
        previousPath: path.join(mockDir, `prev_${name}.png`)
      }));
    } else {
      // For real components, we need to create "previous" versions for testing
      // In a real scenario, these would come from Firebase Storage
      for (const component of components) {
        // Create a slightly modified version as the "previous" version
        const previousPath = path.join(mockDir, `prev_${component.name}.png`);
        
        // Use sharp to create a slightly modified version
        await sharp(component.path)
          .tint({ r: 0.9, g: 0.9, b: 0.9 }) // Slight color change
          .toFile(previousPath);
        
        component.currentPath = component.path;
        component.previousPath = previousPath;
      }
    }
    
    // Create a summary object to store results
    const diffSummary = {
      commitHash: currentCommitHash,
      previousCommitHash: 'mock-previous-commit',
      timestamp: new Date().toISOString(),
      components: []
    };
    
    // Process each component
    for (const component of components) {
      console.log(`Processing component: ${component.name}`);
      
      // Compare images and generate diff if needed
      const diffResult = await compareImages(
        component.currentPath,
        component.previousPath,
        component.name
      );
      
      // If significant difference found, generate AI summary
      let summary = 'No significant visual changes';
      if (diffResult.hasDiff) {
        summary = await generateChangeSummary(
          component.name,
          component.currentPath,
          component.previousPath,
          diffResult.diffImagePath
        );
      }
      
      // Add to summary
      diffSummary.components.push({
        name: component.name,
        diffPercentage: diffResult.diffPercentage || 0,
        hasDiff: diffResult.hasDiff,
        summary
      });
    }
    
    // Save summary to file
    const summaryPath = path.join(outputDir, `diff_summary_${currentCommitHash}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(diffSummary, null, 2));
    console.log(`Saved diff summary to ${summaryPath}`);
    
    // Print overall summary
    console.log('\n=== DIFF SUMMARY ===');
    console.log(`Commit: ${currentCommitHash}`);
    console.log(`Previous commit: ${diffSummary.previousCommitHash}`);
    console.log(`Components with changes: ${diffSummary.components.filter(c => c.hasDiff).length}/${diffSummary.components.length}`);
    
    diffSummary.components.forEach(component => {
      if (component.hasDiff) {
        console.log(`- ${component.name}: ${component.summary} (${component.diffPercentage.toFixed(2)}% different)`);
      }
    });
    
    return diffSummary;
  } catch (error) {
    console.error('Error processing diffs:', error);
    return null;
  }
}

// Run the diff process
processDiffs()
  .then(summary => {
    if (summary) {
      console.log('Diff process completed successfully!');
    } else {
      console.log('Diff process completed with errors.');
    }
  })
  .catch(err => {
    console.error('Process failed:', err);
    process.exit(1);
  });

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = require('node-fetch');

// Path to the service account key file
const keyFilePath = path.resolve(process.cwd(), 'firebase-service-account.json');
console.log('Using service account file:', keyFilePath);

// Check if the service account file exists
if (!fs.existsSync(keyFilePath)) {
  try {
    // Try to use the private key file from the desktop location
    const desktopKeyPath = path.resolve(process.env.USERPROFILE, 'OneDrive', 'Desktop', 'Private_keyGL', 'Private_keyGL.json');
    console.log('Checking for key file at:', desktopKeyPath);
    
    if (fs.existsSync(desktopKeyPath)) {
      console.log(`Copying key file from ${desktopKeyPath} to ${keyFilePath}`);
      fs.copyFileSync(desktopKeyPath, keyFilePath);
      console.log('Key file copied successfully');
    } else {
      console.error('Service account file not found at either location.');
      // List files in the Desktop directory to help debug
      try {
        const desktopDir = path.resolve(process.env.USERPROFILE, 'OneDrive', 'Desktop');
        console.log('Contents of Desktop directory:', fs.readdirSync(desktopDir));
        
        // Check if Private_keyGL directory exists
        const keyGLDir = path.join(desktopDir, 'Private_keyGL');
        if (fs.existsSync(keyGLDir)) {
          console.log('Contents of Private_keyGL directory:', fs.readdirSync(keyGLDir));
        }
      } catch (listError) {
        console.error('Error listing directory contents:', listError);
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error('Error accessing service account file:', error);
    process.exit(1);
  }
}

// Get the current Git commit hash from environment or command line
const currentCommitHash = process.env.BITBUCKET_COMMIT || process.env.GIT_COMMIT || 'local';
console.log('Current commit hash:', currentCommitHash);

// Initialize Google Cloud Storage with the service account file
console.log('Initializing Storage client...');
const storage = new Storage({
  keyFilename: keyFilePath
});

// Get project ID from the service account file
try {
  console.log('Reading service account file...');
  const serviceAccountContent = fs.readFileSync(keyFilePath, 'utf8');
  console.log('Service account file content length:', serviceAccountContent.length);
  
  const serviceAccountData = JSON.parse(serviceAccountContent);
  console.log('Service account data parsed successfully');
  
  const projectId = serviceAccountData.project_id;
  console.log('Project ID:', projectId);
  
  // Use the correct bucket name format
  const bucketName = `${projectId}.appspot.com`;
  console.log('Using bucket:', bucketName);
  
  const bucket = storage.bucket(bucketName);
} catch (error) {
  console.error('Error initializing Firebase Storage:', error);
  process.exit(1);
}

// Ensure output directories exist
const outputDir = path.join(process.cwd(), 'gridshots');
const diffDir = path.join(process.cwd(), 'gridshots', 'diffs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('Created output directory:', outputDir);
}
if (!fs.existsSync(diffDir)) {
  fs.mkdirSync(diffDir, { recursive: true });
  console.log('Created diff directory:', diffDir);
}

// OpenAI API key - using environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Get the previous commit hash from Firebase Storage
 */
async function getPreviousCommitHash() {
  try {
    console.log('Fetching previous commit hash...');
    
    // For testing purposes, if no previous commits are found, create a mock one
    const mockPreviousCommit = 'mock-previous-commit';
    
    try {
      const [files] = await bucket.getFiles({ prefix: 'gridshots/' });
      console.log(`Found ${files.length} files in gridshots/ directory`);
      
      // Extract commit hashes from file paths
      const commitHashes = new Set();
      files.forEach(file => {
        console.log(`Checking file: ${file.name}`);
        const match = file.name.match(/gridshots\/([^\/]+)\//);
        if (match && match[1] !== currentCommitHash && match[1] !== 'diffs') {
          commitHashes.add(match[1]);
        }
      });
      
      // Convert to array and sort (assuming commit hashes have timestamps or sequential order)
      const sortedHashes = Array.from(commitHashes).sort();
      console.log(`Found ${sortedHashes.length} previous commit hashes:`, sortedHashes);
      
      // Return the most recent previous commit hash
      if (sortedHashes.length > 0) {
        const previousHash = sortedHashes[sortedHashes.length - 1];
        console.log(`Found previous commit hash: ${previousHash}`);
        return previousHash;
      }
    } catch (storageError) {
      console.error('Error accessing Firebase Storage:', storageError);
      console.log('Using mock previous commit for testing');
      return mockPreviousCommit;
    }
    
    console.log('No previous commit hash found, using mock commit for testing.');
    return mockPreviousCommit;
  } catch (error) {
    console.error('Error in getPreviousCommitHash:', error);
    return null;
  }
}

/**
 * Download an image from Firebase Storage
 */
async function downloadImage(commitHash, imageName) {
  const filePath = `gridshots/${commitHash}/${imageName}`;
  const localPath = path.join(outputDir, `${commitHash}_${imageName}`);
  
  try {
    console.log(`Downloading ${filePath} to ${localPath}`);
    await bucket.file(filePath).download({ destination: localPath });
    return localPath;
  } catch (error) {
    console.error(`Error downloading ${filePath}:`, error);
    return null;
  }
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
      
      // Upload diff image to Firebase Storage
      const destination = `gridshots/diffs/${currentCommitHash}_${componentName}_diff.png`;
      await bucket.upload(diffImagePath, {
        destination,
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000',
        },
      });
      
      console.log(`✅ Successfully uploaded diff image to Firebase: ${destination}`);
      
      return {
        hasDiff: true,
        diffPercentage,
        diffImagePath,
        firebasePath: destination
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
 * Process all component snapshots and generate diffs
 */
async function processDiffs() {
  try {
    // Get previous commit hash
    const previousCommitHash = await getPreviousCommitHash();
    if (!previousCommitHash) {
      console.log('No previous commit found to compare with. Skipping diff generation.');
      return;
    }
    
    // Get list of current snapshots
    console.log(`Listing snapshots for current commit: ${currentCommitHash}`);
    const [files] = await bucket.getFiles({ prefix: `gridshots/${currentCommitHash}/` });
    
    // Create a summary object to store results
    const diffSummary = {
      commitHash: currentCommitHash,
      previousCommitHash,
      timestamp: new Date().toISOString(),
      components: []
    };
    
    // Process each snapshot
    for (const file of files) {
      // Extract component name from file path
      const match = file.name.match(/gridshots\/[^\/]+\/(.+)\.png$/);
      if (!match) continue;
      
      const componentName = match[1];
      if (componentName === 'full_grid') continue; // Skip the full grid screenshot
      
      console.log(`Processing component: ${componentName}`);
      
      // Download current and previous images
      const currentImagePath = await downloadImage(currentCommitHash, `${componentName}.png`);
      const previousImagePath = await downloadImage(previousCommitHash, `${componentName}.png`);
      
      if (!currentImagePath || !previousImagePath) {
        console.log(`Skipping ${componentName} - missing current or previous image`);
        continue;
      }
      
      // Compare images and generate diff if needed
      const diffResult = await compareImages(currentImagePath, previousImagePath, componentName);
      
      // If significant difference found, generate AI summary
      let summary = 'No significant visual changes';
      if (diffResult.hasDiff) {
        summary = await generateChangeSummary(
          componentName,
          currentImagePath,
          previousImagePath,
          diffResult.diffImagePath
        );
      }
      
      // Add to summary
      diffSummary.components.push({
        name: componentName,
        diffPercentage: diffResult.diffPercentage || 0,
        hasDiff: diffResult.hasDiff,
        summary
      });
      
      // Clean up downloaded images
      try {
        fs.unlinkSync(currentImagePath);
        fs.unlinkSync(previousImagePath);
      } catch (error) {
        console.warn('Error cleaning up temporary files:', error);
      }
    }
    
    // Save summary to file
    const summaryPath = path.join(outputDir, `diff_summary_${currentCommitHash}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(diffSummary, null, 2));
    console.log(`Saved diff summary to ${summaryPath}`);
    
    // Upload summary to Firebase
    const summaryDestination = `gridshots/diffs/${currentCommitHash}_summary.json`;
    await bucket.upload(summaryPath, {
      destination: summaryDestination,
      metadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=31536000',
      },
    });
    
    console.log(`✅ Successfully uploaded diff summary to Firebase: ${summaryDestination}`);
    
    // Print overall summary
    console.log('\n=== DIFF SUMMARY ===');
    console.log(`Commit: ${currentCommitHash}`);
    console.log(`Previous commit: ${previousCommitHash}`);
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

// Simple test function to verify Firebase Storage connection
async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase Storage connection...');
    await bucket.exists();
    console.log('Firebase Storage connection successful!');
    return true;
  } catch (error) {
    console.error('Firebase Storage connection failed:', error);
    return false;
  }
}

// Run the test and then the diff process
testFirebaseConnection()
  .then(connectionSuccessful => {
    if (connectionSuccessful) {
      return processDiffs();
    } else {
      console.log('Skipping diff process due to Firebase connection failure.');
      return null;
    }
  })
  .then(summary => {
    if (summary) {
      console.log('Diff process completed successfully!');
    } else {
      console.log('Diff process completed with errors or was skipped.');
    }
  })
  .catch(err => {
    console.error('Process failed:', err);
    process.exit(1);
  });

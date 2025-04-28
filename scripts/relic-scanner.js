const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('fast-glob');

// Get environment variables
const BITBUCKET_REPO_OWNER = process.env.BITBUCKET_REPO_OWNER || 'sharedpath';
const BITBUCKET_REPO_SLUG = process.env.BITBUCKET_REPO_SLUG || 'gridlabs';
const BITBUCKET_PR_ID = process.env.BITBUCKET_PR_ID;
const BITBUCKET_ACCESS_TOKEN = process.env.BITBUCKET_ACCESS_TOKEN;
const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
const BITBUCKET_COMMIT = process.env.BITBUCKET_COMMIT || 'local';

// Helper function to create Bitbucket auth header
const createAuthHeader = () => {
  return `Bearer ${BITBUCKET_ACCESS_TOKEN}`;
};

// Path to Vite's dependency graph file (created during build)
const VITE_STATS_PATH = path.join(process.cwd(), 'node_modules', '.vite', 'deps-manifest.json');
// Path to GridLabs component map
const GRIDLABS_MAP_PATH = path.join(process.cwd(), 'dist', 'gridlabs-map.json');

/**
 * Calculate file hash to identify duplicates
 */
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Check if file should be ignored
 */
function shouldIgnoreFile(filePath, fileContent) {
  // Check for gridlabs-ignore comment
  return fileContent.includes('// gridlabs-ignore') || 
         fileContent.includes('/* gridlabs-ignore */') ||
         fileContent.includes('<!-- gridlabs-ignore -->');
}

/**
 * Find unused and duplicate files in the codebase
 */
async function scanForRelics() {
  try {
    console.log('Starting relic file scanner...');
    
    // Find all source files
    const sourceFiles = await glob(['src/**/*.{tsx,ts,jsx,js}'], {
      cwd: process.cwd(),
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**']
    });
    
    console.log(`Found ${sourceFiles.length} source files`);
    
    // Load Vite dependency graph if available
    let viteDepGraph = {};
    try {
      if (fs.existsSync(VITE_STATS_PATH)) {
        viteDepGraph = JSON.parse(fs.readFileSync(VITE_STATS_PATH, 'utf8'));
        console.log('Loaded Vite dependency graph');
      } else {
        console.log('Vite dependency graph not found, will rely on imports analysis');
      }
    } catch (error) {
      console.warn('Error loading Vite dependency graph:', error);
    }
    
    // Load GridLabs component map if available
    let gridlabsMap = {};
    try {
      if (fs.existsSync(GRIDLABS_MAP_PATH)) {
        gridlabsMap = JSON.parse(fs.readFileSync(GRIDLABS_MAP_PATH, 'utf8'));
        console.log('Loaded GridLabs component map');
      } else {
        console.log('GridLabs component map not found');
      }
    } catch (error) {
      console.warn('Error loading GridLabs component map:', error);
    }
    
    // Track file usage and hashes
    const fileUsage = new Map(); // file path -> used status
    const fileHashes = new Map(); // file hash -> file path
    const duplicates = []; // array of duplicate file groups
    const unused = []; // array of unused files
    
    // Initialize all files as unused
    sourceFiles.forEach(file => {
      fileUsage.set(file, false);
    });
    
    // Mark files in Vite dependency graph as used
    Object.keys(viteDepGraph).forEach(dep => {
      const resolvedPath = path.resolve(process.cwd(), dep);
      if (fileUsage.has(resolvedPath)) {
        fileUsage.set(resolvedPath, true);
      }
    });
    
    // Mark entry points as used
    const entryPoints = [
      path.resolve(process.cwd(), 'src/main.tsx'),
      path.resolve(process.cwd(), 'src/App.tsx')
    ];
    
    entryPoints.forEach(entry => {
      if (fileUsage.has(entry)) {
        fileUsage.set(entry, true);
      }
    });
    
    // Mark files in GridLabs component map as used
    if (gridlabsMap.components) {
      gridlabsMap.components.forEach(component => {
        const resolvedPath = path.resolve(process.cwd(), component.path);
        if (fileUsage.has(resolvedPath)) {
          fileUsage.set(resolvedPath, true);
        }
      });
    }
    
    // Analyze imports in each file to find more used files
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Skip files with gridlabs-ignore comment
      if (shouldIgnoreFile(file, content)) {
        fileUsage.set(file, true); // Mark as used to avoid reporting
        continue;
      }
      
      // Calculate file hash for duplicate detection
      const hash = calculateFileHash(file);
      
      // Check for duplicates
      if (fileHashes.has(hash)) {
        const existingFile = fileHashes.get(hash);
        duplicates.push({
          files: [existingFile, file],
          hash
        });
      } else {
        fileHashes.set(hash, file);
      }
      
      // Simple regex to find imports and requires
      const importMatches = content.matchAll(/(?:import\s+.*\s+from\s+|require\()['"]([\.\/@][^'"]+)['"];?/g);
      for (const match of importMatches) {
        const importPath = match[1];
        
        // Skip node_modules imports
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          continue;
        }
        
        // Resolve the import path
        let resolvedImport;
        try {
          // Handle relative imports
          if (importPath.startsWith('.')) {
            resolvedImport = path.resolve(path.dirname(file), importPath);
          } else {
            resolvedImport = path.resolve(process.cwd(), importPath.startsWith('/') ? importPath.slice(1) : importPath);
          }
          
          // Add extensions if needed
          if (!path.extname(resolvedImport)) {
            for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
              const withExt = `${resolvedImport}${ext}`;
              if (fs.existsSync(withExt) && fileUsage.has(withExt)) {
                fileUsage.set(withExt, true);
                break;
              }
              
              // Check for index files
              const indexFile = path.join(resolvedImport, `index${ext}`);
              if (fs.existsSync(indexFile) && fileUsage.has(indexFile)) {
                fileUsage.set(indexFile, true);
                break;
              }
            }
          } else if (fs.existsSync(resolvedImport) && fileUsage.has(resolvedImport)) {
            fileUsage.set(resolvedImport, true);
          }
        } catch (error) {
          console.warn(`Error resolving import ${importPath} in ${file}:`, error);
        }
      }
    }
    
    // Collect unused files
    for (const [file, isUsed] of fileUsage.entries()) {
      if (!isUsed) {
        // Double-check with gridlabs-ignore comment
        const content = fs.readFileSync(file, 'utf8');
        if (!shouldIgnoreFile(file, content)) {
          unused.push(file);
        }
      }
    }
    
    // Prepare results
    return {
      unused: unused.map(file => path.relative(process.cwd(), file)),
      duplicates: duplicates.map(dup => ({
        files: dup.files.map(file => path.relative(process.cwd(), file))
      }))
    };
  } catch (error) {
    console.error('Error scanning for relic files:', error);
    return {
      unused: [],
      duplicates: []
    };
  }
}

/**
 * Format the relic scanner results for PR comment
 */
function formatRelicResults(results) {
  if (results.unused.length === 0 && results.duplicates.length === 0) {
    return '';
  }
  
  let comment = `\n\n## 🧹 Unused / duplicate files\n\n`;
  
  if (results.unused.length > 0) {
    results.unused.forEach(file => {
      comment += `• \`${file}\` (unused)\n`;
    });
  }
  
  if (results.duplicates.length > 0) {
    results.duplicates.forEach(dup => {
      comment += `• \`${dup.files[0]}\` ↔ \`${dup.files[1]}\` (duplicate content)\n`;
    });
  }
  
  comment += `\nFix the orphans on your branch—or ignore with \`// gridlabs-ignore\`—and the warning disappears on the next push.`;
  
  return comment;
}

/**
 * Append relic scanner results to an existing PR comment
 */
async function appendToPRComment(relicResults) {
  if (!BITBUCKET_REPO_OWNER || !BITBUCKET_REPO_SLUG || !BITBUCKET_PR_ID || !BITBUCKET_ACCESS_TOKEN) {
    console.error('Missing required Bitbucket environment variables. Cannot update PR comment.');
    return false;
  }
  
  try {
    // Format the relic results
    const relicComment = formatRelicResults(relicResults);
    if (!relicComment) {
      console.log('No relic issues found. Nothing to append to PR comment.');
      return true;
    }
    
    // Get existing comments on the PR
    const url = `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_REPO_OWNER}/${BITBUCKET_REPO_SLUG}/pullrequests/${BITBUCKET_PR_ID}/comments`;
    
    // Use the auth header creation function
    
    const response = await fetch(url, {
      headers: {
        'Authorization': createAuthHeader()
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get PR comments: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Find the GridLabs build report comment
    const buildReportComment = data.values.find(comment => 
      comment.content.raw.includes('GridLabs Build Report')
    );
    
    if (!buildReportComment) {
      console.log('GridLabs build report comment not found. Creating a new comment with relic results.');
      
      // Create a new comment with just the relic results
      const newCommentUrl = `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_REPO_OWNER}/${BITBUCKET_REPO_SLUG}/pullrequests/${BITBUCKET_PR_ID}/comments`;
      
      const newCommentResponse = await fetch(newCommentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': createAuthHeader()
        },
        body: JSON.stringify({
          content: {
            raw: `## 🧹 GridLabs Relic Scanner Results${relicComment}`
          }
        })
      });
      
      if (!newCommentResponse.ok) {
        throw new Error(`Failed to create new comment: ${newCommentResponse.status} ${newCommentResponse.statusText}`);
      }
      
      console.log('Successfully created new comment with relic results');
      return true;
    }
    
    // Update the existing comment with relic results
    const updatedContent = buildReportComment.content.raw.includes('Unused / duplicate files')
      ? buildReportComment.content.raw.replace(/\n\n## 🧹 Unused \/ duplicate files[\s\S]*$/, relicComment)
      : buildReportComment.content.raw + relicComment;
    
    const updateUrl = `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_REPO_OWNER}/${BITBUCKET_REPO_SLUG}/pullrequests/${BITBUCKET_PR_ID}/comments/${buildReportComment.id}`;
    
    // Use the auth header creation function
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': createAuthHeader()
      },
      body: JSON.stringify({
        content: {
          raw: updatedContent
        }
      })
    });
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update comment: ${updateResponse.status} ${updateResponse.statusText}`);
    }
    
    console.log('Successfully updated PR comment with relic results');
    return true;
  } catch (error) {
    console.error('Error appending to PR comment:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Scan for relic files
    const relicResults = await scanForRelics();
    
    // Log the results
    console.log('\n=== RELIC SCANNER RESULTS ===');
    console.log(`Unused files: ${relicResults.unused.length}`);
    console.log(`Duplicate file groups: ${relicResults.duplicates.length}`);
    
    if (relicResults.unused.length > 0) {
      console.log('\nUnused files:');
      relicResults.unused.forEach(file => {
        console.log(`- ${file}`);
      });
    }
    
    if (relicResults.duplicates.length > 0) {
      console.log('\nDuplicate file groups:');
      relicResults.duplicates.forEach(dup => {
        console.log(`- ${dup.files[0]} ↔ ${dup.files[1]}`);
      });
    }
    
    // Check if we're in a PR context
    if (!BITBUCKET_PR_ID) {
      console.log('\nNot running in a PR context. Skipping relic scanner PR comment.');
      return;
    }
    
    // Append results to PR comment
    await appendToPRComment(relicResults);
  } catch (error) {
    console.error('Error in relic scanner:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

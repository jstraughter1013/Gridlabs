#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import archiver from 'archiver';
import ora from 'ora';
import chalk from 'chalk';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';
// @ts-ignore - Import adm-zip module (will be installed via npm)
import AdmZip from 'adm-zip';

// Load environment variables from .env.local if available
function loadEnvFromFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.replace(/^"(.*)"$/, '$1');
          }
        }
      }
    }
  }
}

// Load environment variables
loadEnvFromFile();

// Configuration
const API_ENDPOINT = process.env.GRIDLABS_API_ENDPOINT || 'https://api.gridlabs.app';
const API_TOKEN = process.env.GRIDLABS_API_TOKEN;

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'gl-artifacts-prod';

// CLI program setup
program
  .name('gridlabs upload')
  .description('Upload a build to GridLabs Cloud')
  .requiredOption('--org <organization>', 'Organization name')
  .requiredOption('--repo <repository>', 'Repository name')
  .requiredOption('--branch <branch>', 'Branch name')
  .requiredOption('--sha <commit-sha>', 'Commit SHA')
  .option('--watch', 'Watch for changes and re-upload on rebuild')
  .option('--debug', 'Enable debug mode with verbose logging')
  .option('--retry <count>', 'Number of upload retry attempts', '3')
  .parse(process.argv);

const options = program.opts();
const debug = options.debug;
const retryCount = parseInt(options.retry, 10) || 3;

// Debug logging function
function debugLog(...args: any[]) {
  if (debug) {
    console.log(chalk.gray('[DEBUG]'), ...args);
  }
}

// Initialize S3 client for R2
function createS3Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error(chalk.red('Error: Missing required R2 configuration. Check environment variables.'));
    console.error(chalk.yellow('Required environment variables:'));
    console.error(chalk.yellow('- R2_ACCOUNT_ID'));
    console.error(chalk.yellow('- R2_ACCESS_KEY_ID'));
    console.error(chalk.yellow('- R2_SECRET_ACCESS_KEY'));
    process.exit(1);
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

async function main() {
  try {
    const { org, repo, branch, sha, watch } = options;
    
    // Validate inputs
    if (!org || !repo || !branch || !sha) {
      console.error(chalk.red('Error: Missing required parameters'));
      process.exit(1);
    }

    if (!API_TOKEN) {
      console.warn(chalk.yellow('Warning: GRIDLABS_API_TOKEN environment variable not set. Authentication may fail.'));
      console.warn(chalk.yellow('To fix this, run the generate-token.js script and set the token in your .env.local file.'));
    }

    debugLog('Using API endpoint:', API_ENDPOINT);
    debugLog('API token is set:', !!API_TOKEN);

    // Check if dist directory exists, if not run build
    const distDir = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) {
      const spinner = ora('Dist directory not found. Running build...').start();
      try {
        execSync('npm run build', { stdio: 'inherit' });
        spinner.succeed('Build completed successfully');
      } catch (error) {
        spinner.fail('Build failed');
        console.error(error);
        process.exit(1);
      }
    }

    // Create a zip file of the dist directory
    const spinner = ora('Creating zip archive of dist directory...').start();
    const zipPath = path.resolve(process.cwd(), 'dist.zip');
    
    await createZipArchive(distDir, zipPath);
    spinner.succeed('Zip archive created successfully');

    // Get object key and public URL from API
    spinner.text = 'Getting upload information from GridLabs API...';
    spinner.start();
    
    debugLog('Making API request to:', `${API_ENDPOINT}/uploads`);
    debugLog('Request body:', { org, repo, branch, sha, keyCount: 1 });
    
    const presignResponse = await fetch(`${API_ENDPOINT}/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({
        org,
        repo,
        branch,
        sha,
        keyCount: 1 // Just one file for now (the zip)
      })
    });

    if (!presignResponse.ok) {
      spinner.fail('Failed to get upload information');
      console.error(chalk.red(`API Error: ${presignResponse.status} ${presignResponse.statusText}`));
      const errorData = await presignResponse.text();
      console.error(errorData);
      
      // Provide helpful troubleshooting tips
      console.log('\nTroubleshooting tips:');
      console.log('1. Check that your API token is valid');
      console.log('2. Verify that the API endpoint is correct');
      console.log('3. Verify that your environment variables are set correctly');
      console.log('\nTo generate a new token, run:');
      console.log('  node generate-token.js');
      
      process.exit(1);
    }

    // Define the expected response type
    interface PresignResponse {
      requestId: string;
      uploadUrls: Array<{ key: string; uploadUrl: string }>;
      publicUrl: string;
      expiresAt: string;
    }
    
    const responseData = await presignResponse.json() as PresignResponse;
    const { uploadUrls, publicUrl, requestId } = responseData;
    
    spinner.succeed('Got upload information successfully');
    
    debugLog('Upload URLs:', uploadUrls);
    debugLog('Public URL:', publicUrl);
    debugLog('Request ID:', requestId);

    if (!uploadUrls || !uploadUrls.length || !uploadUrls[0].key) {
      spinner.fail('Invalid upload information received from API');
      console.error(chalk.red('Error: The API did not return valid upload information'));
      process.exit(1);
    }
    
    const objectKey = uploadUrls[0].key;
    debugLog('Object key for upload:', objectKey);
    
    // Upload the zip file directly using AWS SDK
    spinner.text = 'Uploading build to GridLabs Cloud...';
    spinner.start();
    
    try {
      // Extract the zip file contents
      spinner.text = 'Extracting zip archive...';
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      
      debugLog(`Found ${zipEntries.length} files in zip archive`);
      
      // Initialize S3 client
      const s3Client = createS3Client();
      
      // Track upload success
      let failedUploads = 0;
      const totalUploads = zipEntries.length;
      
      // Upload each file individually
      spinner.text = `Uploading ${totalUploads} files to GridLabs Cloud...`;
      
      for (const entry of zipEntries) {
        if (entry.isDirectory) {
          debugLog(`Skipping directory: ${entry.entryName}`);
          continue;
        }
        
        // Normalize the entry path for Windows/Unix compatibility
        const normalizedPath = entry.entryName.replace(/\\/g, '/');
        
        // Construct the object key for this file
        const fileObjectKey = `${org}/${repo}/${branch}/${sha}/${normalizedPath}`;
        
        // Determine content type based on file extension
        const contentType = getContentType(normalizedPath);
        
        // Get the file data
        const fileData = entry.getData();
        
        debugLog(`Uploading file: ${normalizedPath} (${fileData.length} bytes) as ${contentType}`);
        
        // Implement retry logic for transient network issues
        let uploadSuccess = false;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= retryCount; attempt++) {
          try {
            if (attempt > 1) {
              debugLog(`Retrying upload for ${normalizedPath} (attempt ${attempt}/${retryCount})...`);
            }
            
            const command = new PutObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: fileObjectKey,
              Body: fileData,
              ContentType: contentType,
            });
            
            const response = await s3Client.send(command);
            debugLog(`Upload success for ${normalizedPath}:`, response.ETag);
            
            uploadSuccess = true;
            break; // Exit retry loop on success
          } catch (err: any) {
            lastError = err;
            debugLog(`Upload attempt ${attempt} for ${normalizedPath} failed:`, err.message);
            
            // Wait before retry (exponential backoff)
            if (attempt < retryCount) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }
        
        if (!uploadSuccess) {
          failedUploads++;
          console.error(chalk.red(`Failed to upload ${normalizedPath}: ${lastError ? lastError.message : 'Unknown error'}`));
        }
        
        // Update spinner text to show progress
        spinner.text = `Uploading files to GridLabs Cloud... (${zipEntries.indexOf(entry) + 1}/${totalUploads})`;
      }
      
      if (failedUploads > 0) {
        if (failedUploads === totalUploads) {
          throw new Error('All file uploads failed');
        } else {
          console.warn(chalk.yellow(`Warning: ${failedUploads} out of ${totalUploads} files failed to upload.`));
        }
      }

      spinner.succeed('Build uploaded successfully');
    } catch (error: any) {
      spinner.fail('Error uploading build');
      console.error(chalk.red('Upload error:'), error.message);
      
      // Provide more detailed error information
      if (error && typeof error === 'object') {
        if ('code' in error && error.code === 'ENOTFOUND') {
          console.error(chalk.red('DNS resolution error: Could not resolve the hostname.'));
          console.error(chalk.red('This might indicate an issue with network connectivity.'));
        } else if ('$metadata' in error) {
          console.error(chalk.red('AWS SDK Error:'));
          console.error(chalk.red(`- Request ID: ${error.$metadata?.requestId || 'N/A'}`));
          console.error(chalk.red(`- HTTP Status: ${error.$metadata?.httpStatusCode || 'N/A'}`));
        }
      }
      
      console.log('\nTroubleshooting tips:');
      console.log('1. Verify that your R2 credentials are correct');
      console.log('2. Check that the R2 bucket exists and is accessible');
      console.log('3. Make sure your network connection is stable');
      
      process.exit(1);
    }
    
    // Clean up the zip file
    fs.unlinkSync(zipPath);

    // Display success message with the public URL
    console.log('\n' + chalk.green('✓') + ' Upload complete!');
    console.log('\nYour build is now available at:');
    console.log(chalk.blue.bold(publicUrl));
    console.log('\nThis link can be shared with anyone and will work immediately.');

    // Watch for changes if --watch flag is provided
    if (watch) {
      console.log('\n' + chalk.yellow('Watching for changes...'));
      // Implementation for watch mode would go here
      // This would involve setting up file watchers on the dist directory
      // and triggering a re-upload when changes are detected
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// Helper function to create a zip archive
function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Helper function to determine content type based on file extension
function getContentType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject',
    'txt': 'text/plain',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'gz': 'application/gzip',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav'
  };
  
  return contentTypes[extension || ''] || 'application/octet-stream';
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

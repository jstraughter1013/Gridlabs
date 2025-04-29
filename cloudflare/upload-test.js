// R2 Test Upload Script
// This script uploads a test HTML file to the R2 bucket to test the Edge Router

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '../.env.local');
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

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'gl-artifacts-prod';

// Test configuration
const org = 'test-repo';
const repo = 'test-repo';
const branch = 'main';
const sha = 'test123';
const filePath = 'index.html';

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Construct the object key
const objectKey = `${org}/${repo}/${branch}/${sha}/${filePath}`;

// Read the test HTML file
const testFilePath = path.join(__dirname, 'test-index.html');
const fileContent = fs.readFileSync(testFilePath);

async function uploadTestFile() {
  console.log('R2 Upload Test');
  console.log('--------------');
  console.log(`Account ID: ${R2_ACCOUNT_ID ? R2_ACCOUNT_ID.substring(0, 4) + '...' : 'not set'}`);
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Object Key: ${objectKey}`);
  
  try {
    // Upload the file to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      Body: fileContent,
      ContentType: 'text/html',
    });
    
    console.log('Uploading test file to R2...');
    const response = await s3Client.send(command);
    
    console.log('Upload successful!');
    console.log('Response:', response);
    
    // Generate the public URL
    const publicUrl = `https://${branch}--${repo}.gridlabs.app/${sha}/`;
    console.log('\nTest file is now available at:');
    console.log(publicUrl);
    console.log('\nTry accessing this URL to test the Edge Router.');
    
  } catch (error) {
    console.error('Error uploading test file:');
    console.error(`- Error message: ${error.message}`);
    console.error(`- Error code: ${error.code || 'N/A'}`);
    console.error(`- Error name: ${error.name || 'N/A'}`);
    
    // Log additional AWS SDK metadata if available
    if (error.$metadata) {
      console.error('AWS SDK Metadata:');
      console.error(`- Request ID: ${error.$metadata.requestId || 'N/A'}`);
      console.error(`- HTTP Status: ${error.$metadata.httpStatusCode || 'N/A'}`);
      console.error(`- Attempts: ${error.$metadata.attempts || 'N/A'}`);
      console.error(`- Total retry delay: ${error.$metadata.totalRetryDelay || 'N/A'}ms`);
    }
  }
}

// Run the upload function
uploadTestFile();

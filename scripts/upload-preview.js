// scripts/upload-preview.js
import fs from "node:fs";

// Use async function with dynamic import
async function main() {
  try {
    // Debug output for environment variables
    console.log('Environment variables for debugging:');
    console.log('CF_ACCOUNT_ID:', process.env.CF_ACCOUNT_ID);
    console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID);
    console.log('R2_BUCKET:', process.env.R2_BUCKET);
    console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
    console.log('R2_USE_DIRECT:', process.env.R2_USE_DIRECT);
    
    // Clean any trailing periods from account ID
    if (process.env.CF_ACCOUNT_ID && process.env.CF_ACCOUNT_ID.endsWith('.')) {
      console.log('WARNING: Trailing period detected in CF_ACCOUNT_ID, fixing it.');
      process.env.CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID.replace(/\.+$/, '');
      console.log('Sanitized CF_ACCOUNT_ID:', process.env.CF_ACCOUNT_ID);
    }
    
    const commit = process.env.GITHUB_SHA ?? "local";
    const shortCommit = commit.substring(0, 7);
    const date = new Date().toLocaleString();
    
    // Create a better looking HTML preview with styled components
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GridLabs Preview - ${shortCommit}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: #f5f8fa;
      color: #24292e;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    .header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e1e4e8;
    }
    .preview-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      background-color: #2ea44f;
      color: white;
      border-radius: 20px;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .commit-info {
      background-color: #f6f8fa;
      padding: 1rem;
      border-radius: 6px;
      margin-top: 2rem;
      font-family: monospace;
    }
    .footer {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #6a737d;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="preview-badge">Preview Build</div>
      <h1>GridLabs UI Preview</h1>
      <p>This is an automatically generated preview of your changes</p>
    </div>
    
    <div class="content">
      <h2>Ready to Review</h2>
      <p>This preview was created to help you visualize your changes before merging.</p>
      
      <div class="commit-info">
        <p>Commit: <strong>${shortCommit}</strong></p>
        <p>Generated: <strong>${date}</strong></p>
      </div>
    </div>
    
    <div class="footer">
      <p>GridLabs CI/CD Pipeline - Powered by GitHub Actions</p>
    </div>
  </div>
</body>
</html>`;
    
    // structured path that's consistent across all upload methods
    const org    = process.env.GITHUB_REPOSITORY_OWNER;
    const repo   = process.env.GITHUB_REPOSITORY?.split('/')[1] || "Gridlabs";
    const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "branch";
    const sha    = commit.slice(0,7);
    const key    = `${org}/${repo}/smoke/${sha}/index.html`;
    console.log(`Using structured key: ${key} for the upload path`);
    
    // Variable to track the actual uploaded URL
    let actualUploadedUrl = null;
    
    // Set default fallback URL (used by PR comment script)
    process.env.R2_UPLOAD_URL = `https://preview-gridlabs.app/${org}/${repo}/smoke/${sha}/index.html`;
    console.log(`Default preview URL set to: ${process.env.R2_UPLOAD_URL}`);
    
    // Always try the direct uploader first if it's available,
    // regardless of R2_USE_DIRECT flag to solve SSL issues in CI
    try {
      console.log('Attempting direct R2 upload method first');
      const { uploadToR2 } = await import('./r2-upload.js');
      
      // Generate a unique test key with org/repo structure but in a test directory
      // This ensures we don't conflict with the normal path but maintain structure
      const testKey = `${org}/${repo}/test-upload/${sha}/index.html`;
      
      const result = await uploadToR2({
        accountId: process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || 'gl-artifacts-prod',
        key: testKey, // Use test key first to verify connectivity
        body: Buffer.from('Test file'),
        contentType: 'text/plain'
      });
      
      if (result && result.success) {
        console.log("Test upload successful, proceeding with main upload");
        
        // Now upload the actual content to the correct path
        const mainResult = await uploadToR2({
          accountId: process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          bucket: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || 'gl-artifacts-prod',
          key,
          body: Buffer.from(html),
          contentType: 'text/html'
        });
        
        console.log("Successfully uploaded preview using direct method:", key);
        
        // Save the actual URL that worked for the PR comment script
        actualUploadedUrl = `https://preview-gridlabs.app/${key}`;
        process.env.R2_UPLOAD_URL = actualUploadedUrl;
        console.log(`Setting preview URL to: ${actualUploadedUrl}`);
        
        return; // Exit since upload was successful
      }
    } catch (directError) {
      console.error("Direct R2 upload failed, will try AWS SDK method:", directError);
      // Continue to AWS SDK method as fallback
    }
    
    // Try the AWS SDK method
    try {
      console.log('Using AWS SDK R2 upload method');
      // Dynamically import the module
      const r2Client = await import("../dist/api/r2-client.js");
      const { putPreview } = r2Client;
      
      await putPreview(key, Buffer.from(html));
      console.log("Successfully uploaded preview using AWS SDK:", key);
    } catch (sdkError) {
      console.error("AWS SDK upload method failed:", sdkError);
      
      // Try the direct uploader as a fallback if not already tried
      if (process.env.R2_USE_DIRECT !== 'true') {
        try {
          console.log('Falling back to direct R2 upload method');
          const { uploadToR2 } = await import('./r2-upload.js');
          
          const result = await uploadToR2({
            accountId: process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            bucket: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || 'gl-artifacts-prod',
            key,
            body: Buffer.from(html),
            contentType: 'text/html'
          });
          
          console.log("Successfully uploaded preview using fallback direct method:", key);
        } catch (fallbackError) {
          console.error("All upload methods failed. Original error:", sdkError);
          console.error("Fallback error:", fallbackError);
          throw new Error("All R2 upload methods failed");
        }
      } else {
        throw sdkError; // Re-throw if we already tried direct method
      }
    }
  } catch (error) {
    console.error("Error uploading preview:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unhandled error during upload:", error);
  process.exit(1);
});
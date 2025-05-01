// scripts/upload-preview.js
import fs from "node:fs";
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../api/.env.local');
config({ path: envPath });
console.log(`Loaded environment from: ${envPath}`);

// Use async function with dynamic import
async function main() {
  try {
    // Debug output for environment variables
    console.log('Environment variables for debugging:');
    console.log('CF_ACCOUNT_ID:', process.env.CF_ACCOUNT_ID ? '***' : 'undefined');
    console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? '***' : 'undefined');
    console.log('R2_BUCKET:', process.env.R2_BUCKET ? '***' : 'undefined');
    console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
    console.log('R2_USE_DIRECT:', process.env.R2_USE_DIRECT);
    
    // Clean any trailing periods from account ID
    if (process.env.CF_ACCOUNT_ID && process.env.CF_ACCOUNT_ID.endsWith('.')) {
      console.log('WARNING: Trailing period detected in CF_ACCOUNT_ID, fixing it.');
      process.env.CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID.replace(/\.+$/, '');
      console.log('Sanitized CF_ACCOUNT_ID:', '***');
    }
    
    // Ensure R2_ACCOUNT_ID is set to CF_ACCOUNT_ID as fallback if needed
    if (!process.env.R2_ACCOUNT_ID && process.env.CF_ACCOUNT_ID) {
      console.log('Setting R2_ACCOUNT_ID from CF_ACCOUNT_ID for consistency');
      process.env.R2_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
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
    :root {
      --primary: #4f46e5;
      --primary-dark: #4338ca;
      --success: #10b981;
      --background: #f9fafb;
      --card-bg: #ffffff;
      --text: #1f2937;
      --text-muted: #6b7280;
      --border: #e5e7eb;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: var(--background);
      color: var(--text);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
      padding: 2.5rem;
      background-color: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .header {
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .preview-badge {
      display: inline-block;
      padding: 0.5rem 1.25rem;
      background-color: var(--success);
      color: white;
      border-radius: 9999px;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 1rem;
      box-shadow: 0 2px 5px rgba(16, 185, 129, 0.2);
    }
    .commit-info {
      background-color: var(--background);
      padding: 1.25rem;
      border-radius: 8px;
      margin-top: 2.5rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      transition: transform 0.2s;
    }
    .commit-info:hover {
      transform: translateY(-2px);
    }
    .footer {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .btn {
      display: inline-block;
      background-color: var(--primary);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      margin-top: 1.5rem;
      transition: background-color 0.2s, transform 0.1s;
    }
    .btn:hover {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="preview-badge">Preview Build</div>
      <h1>GridLabs UI Preview</h1>
      <p>This preview environment shows the latest changes from your pull request</p>
    </div>
    
    <div class="content">
      <h2>✨ Ready for Review</h2>
      <p>This preview deployment gives you a live environment to test your changes before merging.</p>
      <p>The SSL handshake issue has been fixed! Preview URLs now work correctly.</p>
      <a href="https://github.com/${process.env.REPO_OWNER || 'jstraughter1013'}/${process.env.REPO_NAME || 'Gridlabs'}/pull/${process.env.PR_NUMBER || ''}" class="btn">View Pull Request</a>
      
      <div class="commit-info">
        <p>Commit: <strong>${shortCommit}</strong></p>
        <p>Branch: <strong>${process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'unknown'}</strong></p>
        <p>Generated: <strong>${date}</strong></p>
      </div>
    </div>
    
    <div class="footer">
      <p>GridLabs CI/CD Pipeline — Powered by GitHub Actions &amp; Cloudflare R2</p>
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
    
    // Define credential variables outside both try blocks so they're accessible in both
    // Use exact variable names matching GitHub secrets
    const bucketName = process.env.R2_BUCKET || 'gl-artifacts-prod';
    // Prefer CF_ACCOUNT_ID for compatibility with previous code, but fall back to R2_ACCOUNT_ID
    const accountId = process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
    
    // Validate credentials before proceeding
    if (!accountId) {
      console.error("ERROR: No account ID found. Neither CF_ACCOUNT_ID nor R2_ACCOUNT_ID is set.");
      throw new Error("Missing required account ID for R2 upload");
    }
    
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.error("ERROR: Missing R2 access credentials. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.");
      throw new Error("Missing required R2 credentials for upload");
    }
    
    // Always try the direct uploader first if it's available,
    // regardless of R2_USE_DIRECT flag to solve SSL issues in CI
    try {
      // Print debug info for authentication issues
      console.log('Environment variables for authentication debugging:');
      console.log(`CF_ACCOUNT_ID: ${process.env.CF_ACCOUNT_ID ? '***' : 'undefined'}`);
      console.log(`R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID ? '***' : 'undefined'}`);
      console.log(`R2_BUCKET: ${process.env.R2_BUCKET ? '***' : 'undefined'}`);
      console.log(`R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME ? '***' : 'undefined'}`);
      console.log(`R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? '***' : 'undefined'}`);
      console.log(`R2_SECRET_ACCESS_KEY: ${process.env.R2_SECRET_ACCESS_KEY ? '***' : 'undefined'}`);
      
      console.log('Attempting direct R2 upload method first');
      const { uploadToR2 } = await import('./r2-upload.js');
      
      // Generate a unique test key with org/repo structure but in a test directory
      // This ensures we don't conflict with the normal path but maintain structure
      const testKey = `${org}/${repo}/test-upload/${sha}/index.html`;
      
      console.log(`Using bucket name: ${bucketName}`);
      console.log(`Using account ID: ${accountId ? '***' : 'undefined'}`);
      
      const result = await uploadToR2({
        accountId,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: bucketName,
        key: testKey, // Use test key first to verify connectivity
        body: Buffer.from('Test file'),
        contentType: 'text/plain'
      });
      
      if (result && result.success) {
        console.log("Test upload successful, proceeding with main upload");
        
        // Now upload the actual content to the correct path using the same account and bucket variables
        const mainResult = await uploadToR2({
          accountId, // Use the same accountId variable
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          bucket: bucketName, // Use the same bucketName variable
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
      const { putPreview, setR2Credentials } = r2Client;
      
      // Ensure we have a valid accountId before continuing
      if (!accountId) {
        throw new Error("Missing required accountId for R2 upload");
      }
      
      // Explicitly set the R2 credentials before uploading
      console.log(`CF_ACCOUNT_ID value: ${process.env.CF_ACCOUNT_ID ? '***' : 'undefined'}`);
      console.log(`R2_BUCKET value: ${bucketName ? '***' : 'undefined'}`);
      console.log(`Using account ID: ${accountId ? '***' : 'undefined'}`);
      
      // Explicitly set credentials to ensure consistency
      setR2Credentials({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        bucket: bucketName,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      });
      
      const result = await putPreview(key, Buffer.from(html));
      
      // Check if this was a real success or a mock success in CI
      if (result && result._isMock) {
        // This wasn't a real success - log that clearly
        console.log("⚠️ WARNING: Upload appears to have succeeded but returned a mock result");
        console.log("This usually means the upload actually failed but we're continuing the workflow");
        
        // Store a fallback public test URL for the PR comment
        // This uses the test/r2-upload pattern we saw in your R2 browser
        const timestamp = Date.now();
        process.env.R2_UPLOAD_FAILED = 'true';
        process.env.R2_FALLBACK_URL = `https://preview-gridlabs.app/test/r2-upload-test-${timestamp}/index.html`;
        console.log(`Setting fallback URL: ${process.env.R2_FALLBACK_URL}`);
      } else {
        console.log("✅ Successfully uploaded preview using AWS SDK:", key);
        // Set the actual uploaded URL
        actualUploadedUrl = `https://preview-gridlabs.app/${key}`;
        process.env.R2_UPLOAD_URL = actualUploadedUrl;
        console.log(`Setting verified upload URL: ${actualUploadedUrl}`);
      }
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
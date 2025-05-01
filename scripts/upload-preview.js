// scripts/upload-preview.js
import fs from "node:fs";

// Use async function with dynamic import
async function main() {
  try {
    // Debug output for environment variables
    console.log('Environment variables for debugging:');
    console.log('CF_ACCOUNT_ID:', process.env.CF_ACCOUNT_ID);
    console.log('R2_BUCKET:', process.env.R2_BUCKET);
    console.log('R2_USE_SDK:', process.env.R2_USE_SDK);
    
    // Clean any trailing periods from account ID
    if (process.env.CF_ACCOUNT_ID && process.env.CF_ACCOUNT_ID.endsWith('.')) {
      console.log('WARNING: Trailing period detected in CF_ACCOUNT_ID, fixing it.');
      process.env.CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID.replace(/\.+$/, '');
      console.log('Sanitized CF_ACCOUNT_ID:', process.env.CF_ACCOUNT_ID);
    }
    
    // Dynamically import the module
    const r2Client = await import("../dist/api/r2-client.js");
    const { putPreview } = r2Client;
    
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
    
    // Use proper path structure to match what the PR comment expects
    const repo = process.env.GITHUB_REPOSITORY ?? "owner/repo";
    const branch = process.env.GITHUB_REF_NAME ?? "branch";
    const key = `${repo}/${branch}/${commit}/index.html`;

    await putPreview(key, Buffer.from(html));
    console.log("Uploaded preview:", key);
  } catch (error) {
    console.error("Error uploading preview:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unhandled error during upload:", error);
  process.exit(1);
});
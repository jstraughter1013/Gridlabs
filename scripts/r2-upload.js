// scripts/r2-upload.js
import fs from 'node:fs';
import https from 'node:https';
import { createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Direct R2 uploader that bypasses AWS SDK
 * Uses Node.js native fetch API with TLS 1.2/1.3 configuration
 */
export async function uploadToR2(options) {
  const {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    key,
    body,
    contentType = 'text/html',
  } = options;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !key || !body) {
    throw new Error('Missing required parameters for R2 upload');
  }

  console.log(`[R2 Upload] Starting direct upload to R2 for ${key}`);
  console.log(`[R2 Upload] Content length: ${body.length} bytes`);
  
  // Create a simplified HTTPS agent with basic TLS configuration for testing
  // NOTE: Temporarily removed explicit ciphers and secureProtocol for diagnostic testing
  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 25,
    rejectUnauthorized: true, // Enable SSL verification
    minVersion: 'TLSv1.2',    // Only use TLS 1.2 or higher
    maxVersion: 'TLSv1.3',    // Support up to TLS 1.3
    // ciphers and secureProtocol removed for testing
  });

  try {
    // Format the endpoint URL properly
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${bucket}/${key}`;
    
    // Current timestamp in ISO format
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    // Generate the AWS v4 signature
    const region = 'auto';
    const service = 's3';
    
    // Step 1: Create canonical request
    const httpMethod = 'PUT';
    const canonicalUri = `/${bucket}/${key}`;
    const canonicalQueryString = '';
    const payloadHash = createHash('sha256').update(body).digest('hex');
    
    const canonicalHeaders = 
      `content-length:${body.length}\n` +
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    
    const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = [
      httpMethod,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    // Step 2: Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    
    // Step 3: Calculate signature
    const getSignatureKey = (key, dateStamp, regionName, serviceName) => {
      const kDate = createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
      const kRegion = createHmac('sha256', kDate).update(regionName).digest();
      const kService = createHmac('sha256', kRegion).update(serviceName).digest();
      const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
      return kSigning;
    };
    
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    // Step 4: Create authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    // Log the request details (careful not to log the signature or secret key)
    console.log(`[R2 Upload] Sending request to: ${endpoint}`);
    console.log(`[R2 Upload] Request method: ${httpMethod}`);
    console.log(`[R2 Upload] Headers prepared with signature`);
    
    // Prepare fetch options
    const fetchOptions = {
      method: httpMethod,
      headers: {
        'Content-Type': contentType,
        'Content-Length': body.length,
        'Host': host,
        'X-Amz-Content-Sha256': payloadHash,
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader
      },
      body,
      // Use custom agent with specific TLS settings
      agent: httpsAgent,
    };
    
    // Perform the upload using fetch
    const response = await fetch(endpoint, fetchOptions);
    
    // Check response status
    if (!response.ok) {
      const text = await response.text();
      console.error(`[R2 Upload] Request failed with status ${response.status}: ${text}`);
      throw new Error(`Upload failed with status ${response.status}`);
    }
    
    console.log(`[R2 Upload] Successfully uploaded to R2: ${key}`);
    return {
      success: true,
      key,
      url: `https://preview-gridlabs.app/${key}`
    };
  } catch (error) {
    console.error(`[R2 Upload] Error in direct upload:`, error);
    throw error;
  }
}

/**
 * Main entry point for CLI usage
 */
export async function main() {
  try {
    // Extract environment variables with better fallbacks
    const accountId = process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || 'gl-artifacts-prod';
    
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials not found in environment variables');
    }
    
    // Clean any trailing periods from account ID
    const sanitizedAccountId = accountId.replace(/\.+$/, '');
    
    // Prepare the file path and object key
    const commit = process.env.GITHUB_SHA ?? "local";
    const org = process.env.GITHUB_REPOSITORY_OWNER;
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || "Gridlabs";
    const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "branch";
    const sha = commit.slice(0,7);
    
    // Use the consistent key format
    const key = `${org}/${repo}/smoke/${sha}/index.html`;
    
    // Generate HTML content (copied from upload-preview.js)
    const shortCommit = commit.substring(0, 7);
    const date = new Date().toLocaleString();
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
    
    // Perform the upload
    console.log(`[R2 Upload] Using key: ${key}`);
    const result = await uploadToR2({
      accountId: sanitizedAccountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      key,
      body: Buffer.from(html),
      contentType: 'text/html'
    });
    
    console.log(`[R2 Upload] Success! Preview URL: https://preview-gridlabs.app/${key}`);
    return result;
  } catch (error) {
    console.error('[R2 Upload] Upload failed:', error);
    process.exit(1);
  }
}

// Run main function if directly executed
if (process.argv[1] === import.meta.url) {
  main().catch(error => {
    console.error('[R2 Upload] Unhandled error:', error);
    process.exit(1);
  });
}

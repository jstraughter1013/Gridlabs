/**
 * Simple GitHub Webhook Test Script
 * 
 * This script tests connectivity to your GitHub webhook endpoint by
 * sending a simulated webhook POST request.
 */

const crypto = require('crypto');
const https = require('https');

// Configuration
const WEBHOOK_URL = 'https://gridlabs-presign.fly.dev/api/github/webhook';
const WEBHOOK_SECRET = 'c14501a44d0c614d788e4ef2e8731698c2bb1a27'; // From your .env.local file
const GITHUB_EVENT = 'ping'; // Simple test event

// Sample payload - a simplified version of a GitHub push event
const payload = {
  zen: "Testing is good for the soul",
  hook_id: 12345,
  hook: {
    type: "App",
    id: 12345,
    name: "web",
    active: true,
    events: ["push", "pull_request"],
    config: {
      content_type: "json",
      insecure_ssl: "0",
      url: WEBHOOK_URL
    }
  },
  repository: {
    id: 975236620,
    name: "Gridlabs",
    full_name: "jstraughter1013/Gridlabs"
  },
  sender: {
    login: "jstraughter1013"
  }
};

/**
 * Generate a SHA-256 signature for the webhook payload
 */
function generateSignature(payloadStr, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('hex');
  return `sha256=${signature}`;
}

/**
 * Send a simulated webhook request
 */
function sendWebhook() {
  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    console.log(`Sending ${GITHUB_EVENT} webhook to ${WEBHOOK_URL}...`);
    
    // Generate signature
    const signature = generateSignature(payloadStr, WEBHOOK_SECRET);
    
    // Parse URL
    const url = new URL(WEBHOOK_URL);
    
    // Prepare request options
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr),
        'User-Agent': 'GitHub-Hookshot/Test',
        'X-GitHub-Event': GITHUB_EVENT,
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature
      }
    };
    
    // Send the request
    const req = https.request(options, (res) => {
      console.log(`StatusCode: ${res.statusCode}`);
      console.log(`Headers: ${JSON.stringify(res.headers)}`);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Body:', responseData);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });
    
    req.on('error', (error) => {
      console.error('Error sending webhook:', error.message);
      reject(error);
    });
    
    // Write payload to request body
    req.write(payloadStr);
    req.end();
  });
}

// Run the test
async function main() {
  try {
    console.log('Testing webhook connectivity...');
    const result = await sendWebhook();
    console.log(`Test completed with status code: ${result.statusCode}`);
    
    if (result.statusCode >= 200 && result.statusCode < 300) {
      console.log('SUCCESS: Webhook endpoint is accessible and responding correctly!');
    } else {
      console.log(`WARNING: Webhook endpoint returned status code ${result.statusCode}.`);
    }
  } catch (error) {
    console.error('FAILED: Could not connect to webhook endpoint.');
    console.error(error);
  }
}

main();

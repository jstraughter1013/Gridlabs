const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Get environment variables
const BITBUCKET_REPO_OWNER = process.env.BITBUCKET_REPO_OWNER || 'sharedpath';
const BITBUCKET_REPO_SLUG = process.env.BITBUCKET_REPO_SLUG || 'gridlabs';
const BITBUCKET_PR_ID = process.env.BITBUCKET_PR_ID;
const BITBUCKET_ACCESS_TOKEN = process.env.BITBUCKET_ACCESS_TOKEN;
const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
const BITBUCKET_COMMIT = process.env.BITBUCKET_COMMIT || 'local';
const VERCEL_DEPLOYMENT_URL = process.env.VERCEL_DEPLOYMENT_URL || 'https://gridlabs.vercel.app';

// Path to the diff summary file
const diffSummaryPath = path.join(process.cwd(), 'gridshots', `diff_summary_${BITBUCKET_COMMIT}.json`);

/**
 * Format the PR comment with build info and component changes
 */
function formatPRComment(diffSummary) {
  // Get components with changes
  const changedComponents = diffSummary.components.filter(c => c.hasDiff);
  
  // Format the comment
  let comment = `## 🚀 GridLabs Build Report\n\n`;
  comment += `### [View this build in GridLabs](${VERCEL_DEPLOYMENT_URL}/__grid?sha=${BITBUCKET_COMMIT})\n\n`;
  
  // Add component changes section if there are any
  if (changedComponents.length > 0) {
    comment += `### 🔄 Visual Changes (${changedComponents.length} components)\n\n`;
    comment += `| Component | Change | Diff % |\n`;
    comment += `| --------- | ------ | ------ |\n`;
    
    changedComponents.forEach(component => {
      comment += `| \`${component.name}\` | ${component.summary} | ${component.diffPercentage.toFixed(2)}% |\n`;
    });
  } else {
    comment += `### ✅ No visual changes detected\n\n`;
  }
  
  return comment;
}

/**
 * Post a comment to the Bitbucket PR
 */
async function postPRComment(comment) {
  if (!BITBUCKET_REPO_OWNER || !BITBUCKET_REPO_SLUG || !BITBUCKET_PR_ID || !BITBUCKET_ACCESS_TOKEN) {
    console.error('Missing required Bitbucket environment variables. Cannot post PR comment.');
    return false;
  }
  
  try {
    const url = `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_REPO_OWNER}/${BITBUCKET_REPO_SLUG}/pullrequests/${BITBUCKET_PR_ID}/comments`;
    
    console.log(`Posting comment to PR ${BITBUCKET_PR_ID} in ${BITBUCKET_REPO_OWNER}/${BITBUCKET_REPO_SLUG}`);
    console.log(`Using access token: ${BITBUCKET_ACCESS_TOKEN.substring(0, 10)}...`);
    
    // For Bitbucket Cloud, use Bearer token authentication
    const authHeader = `Bearer ${BITBUCKET_ACCESS_TOKEN}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        content: {
          raw: comment
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to post PR comment: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    console.log('Successfully posted comment to PR');
    return true;
  } catch (error) {
    console.error('Error posting PR comment:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if we're in a PR context
    if (!BITBUCKET_PR_ID) {
      console.log('Not running in a PR context. Skipping PR comment.');
      // For testing purposes, you can uncomment the line below to override
      // BITBUCKET_PR_ID = '1'; // Use a valid PR ID for testing
      return;
    }
    
    // Check if diff summary exists
    if (!fs.existsSync(diffSummaryPath)) {
      console.error(`Diff summary file not found at ${diffSummaryPath}`);
      return;
    }
    
    // Read the diff summary
    const diffSummary = JSON.parse(fs.readFileSync(diffSummaryPath, 'utf8'));
    
    // Format the PR comment
    const comment = formatPRComment(diffSummary);
    
    // Post the comment to the PR
    await postPRComment(comment);
  } catch (error) {
    console.error('Error in PR comment bot:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

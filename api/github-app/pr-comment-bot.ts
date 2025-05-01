/**
 * Pull Request Comment Bot
 * 
 * Handles creating and updating comments on GitHub Pull Requests
 */

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import config from './config.js';
import { getGitHubPrivateKey } from './key-utils.js';

/**
 * Create a GitHub API client authenticated as the GitHub App
 * 
 * @returns Authenticated Octokit instance
 */
async function createGitHubClient(): Promise<Octokit> {
  try {
    const privateKey = getGitHubPrivateKey();
    
    // Create app authentication using the direct approach
    const auth = createAppAuth({
      appId: config.appId,
      privateKey: privateKey,
    });
    
    // Generate auth token and use it directly
    const authResponse = await auth({ type: 'app' });
    
    return new Octokit({
      auth: authResponse.token
    });
  } catch (error) {
    console.error('Error creating GitHub client:', error);
    throw new Error('Failed to create GitHub client');
  }
}

/**
 * Post a comment on a pull request
 * 
 * @param owner - Repository owner (org or user)
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param body - Comment body
 * @returns Comment URL if successful
 */
export async function postPrComment(
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<string> {
  const octokit = await createGitHubClient();
  
  try {
    const response = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    
    // Log successful comment creation
    console.log(`Posted comment to ${owner}/${repo}#${prNumber}`);
    
    // Handle response data safely regardless of structure
    const id = response.data && typeof response.data === 'object' && 'id' in response.data ? 
      response.data.id as number : 
      0;
      
    const htmlUrl = response.data && typeof response.data === 'object' && 'html_url' in response.data ?
      String(response.data.html_url) : 
      '';
      
    return htmlUrl || `https://github.com/${owner}/${repo}/pull/${prNumber}#issuecomment-${id}`;
  } catch (error) {
    console.error(`Error posting comment to ${owner}/${repo}#${prNumber}:`, error);
    process.exit(1); // Exit with error code to fail CI
  }
}

/**
 * Update an existing comment on a pull request
 * 
 * @param owner - Repository owner (org or user)
 * @param repo - Repository name
 * @param commentId - Comment ID to update
 * @param body - New comment body
 * @returns Comment URL if successful
 */
export async function updatePrComment(
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<string> {
  const octokit = await createGitHubClient();
  
  try {
    const response = await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body,
    });
    
    // Log successful comment update
    console.log(`Updated comment ${commentId} in ${owner}/${repo}`);
    
    // Handle response data safely regardless of structure
    const id = response.data && typeof response.data === 'object' && 'id' in response.data ? 
      response.data.id as number : 
      commentId;
      
    const htmlUrl = response.data && typeof response.data === 'object' && 'html_url' in response.data ?
      String(response.data.html_url) : 
      '';
      
    return htmlUrl || `https://github.com/${owner}/${repo}/pull/comments/${id}`;
  } catch (error) {
    console.error(`Error updating comment ${commentId} in ${owner}/${repo}:`, error);
    process.exit(1); // Exit with error code to fail CI
  }
}

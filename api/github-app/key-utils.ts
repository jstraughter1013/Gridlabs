/**
 * GitHub App Key Utilities
 * 
 * Provides functions for retrieving the GitHub App private key
 * with support for both file-based and environment variable configurations.
 * Also provides standardized Octokit authentication options.
 */

import * as fs from 'fs';
import defaultConfig from './config.js';

/**
 * Get the GitHub App private key from either environment variable or file
 * Prioritizes GITHUB_PRIVATE_KEY environment variable if available
 */
export function getGitHubPrivateKey(): string {
  try {
    // Use environment variable if available, otherwise read from file
    const privateKey = 
      process.env.GITHUB_PRIVATE_KEY ?? 
      fs.readFileSync(defaultConfig.privateKeyPath, 'utf8');
    
    return privateKey;
  } catch (error) {
    console.error('Error reading GitHub private key:', error);
    throw new Error('Failed to load GitHub App private key');
  }
}

/**
 * Get standardized Octokit authentication options with GitHub App credentials
 * Used by all app components that need to authenticate with GitHub
 */
export function getOctokitAuthOptions() {
  return {
    appId: Number(process.env.GITHUB_APP_ID) || Number(defaultConfig.appId),
    privateKey: getGitHubPrivateKey(),
    clientId: process.env.GITHUB_CLIENT_ID || defaultConfig.clientId,
    clientSecret: process.env.GITHUB_CLIENT_SECRET || defaultConfig.clientSecret,
  };
}

/**
 * R2 Client for Cloudflare R2 Storage
 * 
 * This module provides functions for generating presigned URLs for uploading to
 * Cloudflare R2 Storage, directly uploading content, and generating public URLs
 * for accessing uploaded content.
 */

// Load environment variables from .env.local
import path from 'path';

// Use require for dotenv since it's more reliable in mixed module environments
const dotenv = require('dotenv');

// Get directory name using __dirname directly since this isn't an ES module
const envPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envPath });
console.log(`Loaded environment from: ${envPath}`);

// Import S3 SDK for presigned URL generation
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import https from 'node:https';
import tls from 'node:tls';

// Force modern TLS only - this prevents the SSLv3 handshake failures
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';
tls.DEFAULT_MAX_VERSION = 'TLSv1.3';

// R2 Configuration with default values - use exact names from GitHub secrets
let CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
let R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
let R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
let R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
let R2_BUCKET = process.env.R2_BUCKET || 'gl-artifacts-prod';
let R2_REGION = 'auto';
let R2_ENDPOINT = `https://${CF_ACCOUNT_ID || R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
let PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || 'https://preview-gridlabs.app';

/**
 * Set R2 credentials explicitly - useful for ensuring consistency
 * across different upload methods
 */
export function setR2Credentials(config: {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}) {
  if (config.endpoint) {
    R2_ENDPOINT = config.endpoint;
    // Extract account ID from endpoint if provided
    const match = R2_ENDPOINT.match(/https:\/\/([^.]+).r2.cloudflarestorage.com/);
    if (match && match[1]) {
      CF_ACCOUNT_ID = match[1];
    }
  }
  
  if (config.region) R2_REGION = config.region;
  if (config.bucket) R2_BUCKET = config.bucket;
  if (config.accessKeyId) R2_ACCESS_KEY_ID = config.accessKeyId;
  if (config.secretAccessKey) R2_SECRET_ACCESS_KEY = config.secretAccessKey;
  
  console.log(`R2 credentials updated: endpoint=${R2_ENDPOINT}, bucket=${R2_BUCKET}`);
}

// Create an S3 client configured for Cloudflare R2
// First, let's log what we're working with
console.log('CF_ACCOUNT_ID value:', CF_ACCOUNT_ID);
console.log('R2_BUCKET value:', R2_BUCKET);

// Check if CF_ACCOUNT_ID is empty/falsy
if (!CF_ACCOUNT_ID || CF_ACCOUNT_ID.trim() === '') {
  console.log('WARNING: CF_ACCOUNT_ID is empty! Using a placeholder for now.');
}

// Apply fallback and sanitize - prefer R2_ACCOUNT_ID if CF_ACCOUNT_ID is empty
const accountId = CF_ACCOUNT_ID || R2_ACCOUNT_ID || '';
if (!accountId || accountId.trim() === '') {
  console.error('ERROR: Both CF_ACCOUNT_ID and R2_ACCOUNT_ID are empty or undefined!');
  throw new Error('Missing required account ID for R2 client configuration');
}

const sanitizedAccountId = accountId.replace(/\.+$/, '');
console.log('Using account ID:', sanitizedAccountId);

// Build endpoint URL with sanitized account ID
// Make sure we don't include R2_BUCKET in the hostname
// Use r2.cloudflarestorage.com endpoint with forcePathStyle: true to prevent 500 errors
const endpoint = `https://${sanitizedAccountId}.r2.cloudflarestorage.com`;
console.log('R2 endpoint URL:', endpoint);

// Check if we're in CI environment
const isCI = process.env.CI === 'true';

// Create custom HTTPS agent with standardized TLS settings
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: true,  // Always validate certificates
  minVersion: 'TLSv1.2',     // Minimum TLS version
  maxVersion: 'TLSv1.3',     // Maximum TLS version
});

// Create a more robust S3 client with explicit node-http-handler settings
export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  // Try to use path style addressing which can be more reliable
  forcePathStyle: true,
  // Configure special options to help with SSL issues
  requestHandler: {
    connectionTimeout: 10000, // Increased timeout
    socketTimeout: 15000,     // Increased timeout
    httpsAgent,
  },
  // More aggressive retry strategy
  maxAttempts: 5,
  // Log request details for debugging
  logger: console,
});

/**
 * Generate a presigned URL for uploading content to R2
 * 
 * @param key - The object key (path) in the bucket
 * @param contentType - The content type of the file being uploaded
 * @param expirationSeconds - URL expiration time in seconds
 * @returns A presigned URL for uploading
 */
export async function generatePresignedUrl(key: string, contentType: string, expirationSeconds: number = 1800): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  try {
    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: expirationSeconds });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}

// All imports moved to the top of the file

/**
 * Upload content to R2 storage directly using AWS SDK with recommended settings
 * 
 * @param key - The object key (path) in the bucket
 * @param body - The content to upload as a Buffer
 * @returns Object metadata if successful
 * @throws Error if upload fails
 */
export async function putPreview(key: string, body: Buffer): Promise<any> {
  try {
    console.log(`Uploading ${key} to R2 bucket ${R2_BUCKET}...`);
    console.log(`Upload size: ${body.length} bytes`);
    
    // Log connection details
    console.log('Connection details:', {
      endpoint: endpoint,
      region: 'auto',
      bucket: R2_BUCKET,
      hasCredentials: !!R2_ACCESS_KEY_ID && !!R2_SECRET_ACCESS_KEY,
    });
    
    // Create PutObjectCommand with ContentLength to prevent 500 errors
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'text/html',
      ContentLength: body.length // Add ContentLength to prevent 500 errors
    });
    
    console.log('Sending PutObjectCommand...');
    
    try {
      // Send the command to upload the file
      const result = await r2.send(putCommand);
      console.log(`Successfully uploaded ${key} to R2:`, {
        etag: result.ETag,
      });
      return result;
    } catch (uploadError) {
      console.error('Error in PutObjectCommand:', uploadError);
      throw uploadError;
    }
  } catch (error) {
    console.error(`Failed to upload ${key} to R2:`, error);
    
    // In CI, treat this as a soft failure
    if (process.env.CI === 'true') {
      console.warn('Running in CI environment, treating R2 upload failure as non-fatal');
      return { _isMock: true, message: 'R2 upload failed but continuing CI' };
    }
    
    throw error; // Rethrow in non-CI environments
  }
}

/**
 * Generate a public URL for accessing uploaded content
 * 
 * @param {string} org - GitHub organization name
 * @param {string} repo - GitHub repository name
 * @param {string} branch - Git branch name
 * @param {string} sha - Git commit SHA
 * @returns {string} A public URL for accessing the content
 */
export function generatePublicUrl(org: string, repo: string, branch: string, sha: string): string {
  // Always use the public preview domain now that it's available
  return `${PUBLIC_URL_BASE}/${org}/${repo}/${branch}/${sha}/index.html`;
}
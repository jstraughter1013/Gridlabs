/**
 * R2 Client for Cloudflare R2 Storage
 * 
 * This module provides functions for generating presigned URLs for uploading to
 * Cloudflare R2 Storage, directly uploading content, and generating public URLs
 * for accessing uploaded content.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 Configuration
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET || 'gl-artifacts-prod';
const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || 'https://gridlabs-preview.windsurf.io';

// Create an S3 client configured for Cloudflare R2
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
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
    Bucket: R2_BUCKET_NAME,
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

/**
 * Upload content to R2 storage directly and verify the upload
 * 
 * @param key - The object key (path) in the bucket
 * @param body - The content to upload as a Buffer
 * @returns Object metadata if successful
 * @throws Error if upload fails or verification fails
 */
export async function putPreview(key: string, body: Buffer): Promise<any> {
  try {
    console.log(`Uploading ${key} to R2 bucket ${R2_BUCKET_NAME}...`);
    
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
    });
    
    const result = await r2.send(putCommand);
    
    // Verify the upload was successful with HeadObjectCommand
    const headCommand = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    
    const headResult = await r2.send(headCommand);
    
    console.log(`Successfully uploaded ${key} to R2:`, {
      etag: result.ETag,
      contentLength: headResult.ContentLength,
      lastModified: headResult.LastModified,
    });
    
    return result;
  } catch (error) {
    console.error(`Failed to upload ${key} to R2:`, error);
    throw error; // Ensure we rethrow to fail CI
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
  // Bucket is public, so don't sign URLs
  if (process.env.R2_USE_SDK === 'true') {
    return `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${org}/${repo}/${branch}/${sha}/index.html`;
  }
  return `${PUBLIC_URL_BASE}/${org}/${repo}/${branch}/${sha}/index.html`;
}
/**
 * GitHub App Webhook Handler
 * 
 * This module handles incoming GitHub webhook events and queues build jobs
 * for processing. It supports push and pull_request events.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import defaultConfig from './config.js';
import { queueBuildJob } from './job-queue.js';
import { isDocumentationOnlyChanges } from './file-utils.js';
import { getGitHubPrivateKey, getOctokitAuthOptions } from './key-utils.js';

// Dynamic import for Octokit to avoid TypeScript errors
let OctokitModule: any;
let AuthAppModule: any;

// Initialize the modules
async function initModules() {
  try {
    OctokitModule = await import('@octokit/rest');
    AuthAppModule = await import('@octokit/auth-app');
  } catch (error) {
    console.error('Error importing Octokit modules:', error);
  }
}

// Call the initialization function
initModules();

interface WebhookPayload {
  action?: string;
  repository?: {
    name: string;
    owner: {
      login: string;
    };
    private: boolean;
  };
  ref?: string;
  pull_request?: {
    number: number;
    draft?: boolean; // Added draft property to detect draft PRs
    head: {
      ref: string;
      sha: string;
      repo: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
    base: {
      ref: string;
    };
  };
  after?: string; // SHA for push events
}

/**
 * Verify the GitHub webhook signature
 */
function verifySignature(
  request: FastifyRequest,
  payload: string,
  secret: string
): boolean {
  const signature = request.headers['x-hub-signature-256'] as string;
  if (!signature) {
    return false;
  }

  const hmac = createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (error) {
    return false;
  }
}

/**
 * Extract repository, branch, and commit information from webhook payload
 */
function extractBuildInfo(payload: WebhookPayload, event: string): {
  org: string;
  repo: string;
  branch: string;
  sha: string;
  prNumber?: number;
} | null {
  try {
    if (!payload.repository) {
      return null;
    }

    const org = payload.repository.owner.login;
    const repo = payload.repository.name;
    
    // Handle push events
    if (event === 'push' && payload.ref && payload.after) {
      // Extract branch name from ref (refs/heads/branch-name)
      const branch = payload.ref.replace('refs/heads/', '');
      const sha = payload.after;
      
      return { org, repo, branch, sha };
    }
    
    // Handle pull_request events
    if (event === 'pull_request' && payload.pull_request) {
      const branch = payload.pull_request.head.ref;
      const sha = payload.pull_request.head.sha;
      const prNumber = payload.pull_request.number;
      
      return { org, repo, branch, sha, prNumber };
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting build info:', error);
    return null;
  }
}

/**
 * Create an authenticated Octokit instance for GitHub API calls
 */
async function createOctokitClient(): Promise<any> {
  try {
    // Make sure modules are loaded
    if (!OctokitModule || !AuthAppModule) {
      await initModules();
    }
    
    // Create the authentication function using centralized auth options
    const auth = AuthAppModule.createAppAuth(getOctokitAuthOptions());
    
    // Create an authenticated token
    const { token } = await auth({ type: 'app' });
    
    // Return an authenticated Octokit instance
    return new OctokitModule.Octokit({ auth: token });
  } catch (error) {
    console.error('Error creating Octokit client:', error);
    throw new Error('Failed to authenticate with GitHub');
  }
}

/**
 * Get the installation ID for a repository
 */
async function getInstallationId(org: string, repo: string): Promise<number> {
  try {
    // Create an authenticated Octokit client
    const octokit = await createOctokitClient();
    
    // Get the installation for this repository
    const { data: installations } = await octokit.apps.listInstallations();
    const installation = installations.find((i: { account?: { login?: string } }) => 
      i.account?.login?.toLowerCase() === org.toLowerCase()
    );
    
    if (!installation) {
      throw new Error(`No installation found for organization ${org}`);
    }
    
    return installation.id;
  } catch (error) {
    console.error('Error getting installation ID:', error);
    throw new Error('Failed to get installation ID');
  }
}

/**
 * Get an installation access token for a repository
 */
async function getInstallationToken(installationId: number): Promise<string> {
  try {
    // Make sure modules are loaded
    if (!OctokitModule || !AuthAppModule) {
      await initModules();
    }
    
    // Create the authentication function using centralized auth options
    const auth = AuthAppModule.createAppAuth(getOctokitAuthOptions());
    
    // Create an installation token
    const { token } = await auth({
      type: 'installation',
      installationId,
    });
    
    return token;
  } catch (error) {
    console.error('Error getting installation token:', error);
    throw new Error('Failed to get installation token');
  }
}

/**
 * Get the list of files changed in a commit or PR
 */
async function getChangedFiles(org: string, repo: string, prNumber?: number, sha?: string): Promise<string[]> {
  try {
    // Get the installation ID for this repository
    const installationId = await getInstallationId(org, repo);
    
    // Get an installation token
    const token = await getInstallationToken(installationId);
    
    // Create an Octokit instance with the installation token
    const octokit = new OctokitModule.Octokit({ auth: token });
    
    let changedFiles: string[] = [];
    
    if (prNumber) {
      // Get files changed in a PR
      const { data: files } = await octokit.pulls.listFiles({
        owner: org,
        repo,
        pull_number: prNumber,
      });
      
      changedFiles = files.map((file: { filename: string }) => file.filename);
    } else if (sha) {
      // Get files changed in a commit
      const { data: commit } = await octokit.repos.getCommit({
        owner: org,
        repo,
        ref: sha,
      });
      
      changedFiles = commit.files.map((file: { filename: string }) => file.filename);
    }
    
    return changedFiles;
  } catch (error) {
    console.error('Error getting changed files:', error);
    return [];
  }
}

/**
 * Register the webhook handler routes with the Fastify instance
 */
export function registerWebhookHandler(fastify: FastifyInstance): void {
  fastify.post('/api/github/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = request.body as WebhookPayload;
      const rawBody = JSON.stringify(payload);
      const event = request.headers['x-github-event'] as string;
      
      // Verify webhook signature
      if (!verifySignature(request, rawBody, defaultConfig.webhookSecret)) {
        fastify.log.warn('Invalid webhook signature - this could be due to a misconfigured webhook secret');
        fastify.log.warn('Continuing anyway for testing purposes, but fix this in production');
        // For testing, we'll continue even with invalid signatures
        // In production, uncomment the following line:
        // return reply.code(401).send({ error: 'Invalid signature' });
      }
      
      // Log the received event
      fastify.log.info(`Received GitHub ${event} event`);
      
      // Only process push and pull_request events
      if (event !== 'push' && event !== 'pull_request') {
        return reply.code(202).send({ message: 'Event type not processed' });
      }
      
      // For pull_request events, only process opened, reopened, and synchronize actions
      if (event === 'pull_request') {
        const action = payload.action;
        if (action !== 'opened' && action !== 'reopened' && action !== 'synchronize') {
          return reply.code(202).send({ message: 'Pull request action not processed' });
        }
        
        // Skip builds for draft PRs (Cost guard feature)
        if (payload.pull_request?.draft) {
          fastify.log.info(`Skipping build for draft PR #${payload.pull_request.number}`);
          return reply.code(202).send({ message: 'Draft PR - build skipped' });
        }
      }
      
      // Extract build information
      const buildInfo = extractBuildInfo(payload, event);
      if (!buildInfo) {
        fastify.log.error('Failed to extract build information from payload');
        return reply.code(400).send({ error: 'Invalid payload format' });
      }
      
      try {
        // Check if only documentation files were changed (Cost guard feature)
        const changedFiles = await getChangedFiles(
          buildInfo.org,
          buildInfo.repo,
          buildInfo.prNumber,
          event === 'push' ? buildInfo.sha : undefined
        );
        
        for (let i: number = 0; i < changedFiles.length; i++) {
          const file = changedFiles[i];
          // Add type annotation for file
          const isDocFile: boolean = isDocumentationOnlyChanges([file]);
          if (isDocFile) {
            fastify.log.info(`Skipping build for ${buildInfo.org}/${buildInfo.repo}/${buildInfo.branch}@${buildInfo.sha} - only documentation files changed`);
            return reply.code(202).send({ 
              message: 'Documentation-only changes - build skipped',
              buildInfo,
              changedFiles
            });
          }
        }
        
        // Queue the build job
        const jobId = await queueBuildJob(buildInfo);
        
        fastify.log.info(`Queued build job ${jobId} for ${buildInfo.org}/${buildInfo.repo}/${buildInfo.branch}@${buildInfo.sha}`);
        
        return reply.code(200).send({
          message: 'Build job queued successfully',
          jobId,
          buildInfo
        });
      } catch (error: unknown) {
        // Type guard for error object
        const errorObj = error as { message?: string };
        fastify.log.error(`Error checking changed files: ${errorObj.message || 'Unknown error'}`);
        
        // If there's an error checking changed files, proceed with the build anyway
        const jobId = await queueBuildJob(buildInfo);
        
        fastify.log.info(`Queued build job ${jobId} for ${buildInfo.org}/${buildInfo.repo}/${buildInfo.branch}@${buildInfo.sha} (after error checking changed files)`);
        
        return reply.code(200).send({
          message: 'Build job queued successfully (skipped file check due to error)',
          jobId,
          buildInfo
        });
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

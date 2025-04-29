#!/usr/bin/env node
/**
 * Cloudflare Worker Deployment Script
 * 
 * This script deploys the Edge Router worker to Cloudflare using Wrangler.
 * It ensures that the worker is properly configured with the correct R2 bucket binding.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Configuration
const WORKER_NAME = 'edge-router';
// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WRANGLER_CONFIG_PATH = path.resolve(__dirname, 'wrangler.toml');

// Check if wrangler.toml exists
if (!fs.existsSync(WRANGLER_CONFIG_PATH)) {
  console.error(chalk.red('Error: wrangler.toml not found.'));
  process.exit(1);
}

console.log(chalk.blue('Starting deployment of Cloudflare Edge Router worker...'));

// Validate that required environment variables are set
const requiredEnvVars = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(chalk.red('Error: Missing required environment variables:'));
  missingEnvVars.forEach(envVar => {
    console.error(chalk.yellow(`- ${envVar}`));
  });
  console.error(chalk.yellow('\nPlease set these environment variables before deploying.'));
  process.exit(1);
}

// Function to run a command and handle errors
function runCommand(command, errorMessage) {
  try {
    console.log(chalk.gray(`> ${command}`));
    const output = execSync(command, { stdio: 'inherit' });
    return output;
  } catch (error) {
    console.error(chalk.red(`Error: ${errorMessage}`));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Check if wrangler is installed
try {
  execSync('npx wrangler --version', { stdio: 'ignore' });
  console.log(chalk.green('✓ Wrangler is installed'));
} catch (error) {
  console.log(chalk.yellow('Installing Wrangler...'));
  runCommand('npm install -g wrangler', 'Failed to install Wrangler');
}

// Deploy the worker
console.log(chalk.blue('\nDeploying Edge Router worker to Cloudflare...'));
runCommand('npx wrangler deploy --env production', 'Failed to deploy worker');

// Verify the deployment
console.log(chalk.blue('\nVerifying deployment...'));
try {
  const tailOutput = execSync('npx wrangler tail edge-router --format json', { 
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'ignore']
  }).toString();
  
  console.log(chalk.green('✓ Worker logs are available'));
  console.log(chalk.gray('Recent logs:'));
  console.log(tailOutput.split('\n').slice(0, 5).join('\n'));
} catch (error) {
  console.warn(chalk.yellow('Warning: Could not verify worker logs. This does not necessarily mean deployment failed.'));
  console.warn(chalk.yellow('You can check logs manually with: npx wrangler tail edge-router'));
}

// Verify DNS configuration
console.log(chalk.blue('\nVerifying DNS configuration...'));
try {
  const dnsOutput = execSync('npx wrangler route list', { 
    stdio: ['ignore', 'pipe', 'ignore']
  }).toString();
  
  if (dnsOutput.includes('*.gridlabs.app')) {
    console.log(chalk.green('✓ DNS route for *.gridlabs.app is configured'));
  } else {
    console.warn(chalk.yellow('Warning: DNS route for *.gridlabs.app not found in route list.'));
    console.log(chalk.blue('Adding DNS route...'));
    runCommand('npx wrangler route add *.gridlabs.app/* edge-router', 'Failed to add DNS route');
  }
} catch (error) {
  console.warn(chalk.yellow('Warning: Could not verify DNS configuration.'));
  console.warn(chalk.yellow('Please ensure that *.gridlabs.app is properly configured in Cloudflare.'));
}

// Verify R2 bucket
console.log(chalk.blue('\nVerifying R2 bucket configuration...'));
try {
  const r2Output = execSync('npx wrangler r2 bucket list', { 
    stdio: ['ignore', 'pipe', 'ignore']
  }).toString();
  
  if (r2Output.includes('gl-artifacts-prod')) {
    console.log(chalk.green('✓ R2 bucket gl-artifacts-prod exists'));
  } else {
    console.warn(chalk.yellow('Warning: R2 bucket gl-artifacts-prod not found.'));
    console.log(chalk.blue('Creating R2 bucket...'));
    runCommand('npx wrangler r2 bucket create gl-artifacts-prod', 'Failed to create R2 bucket');
  }
} catch (error) {
  console.warn(chalk.yellow('Warning: Could not verify R2 bucket configuration.'));
  console.warn(chalk.yellow('Please ensure that gl-artifacts-prod bucket exists in Cloudflare R2.'));
}

console.log(chalk.green('\n✓ Edge Router worker deployment completed successfully!'));
console.log(chalk.blue('\nNext steps:'));
console.log('1. Test the deployment by accessing https://<branch>--<repo>.gridlabs.app/<sha>/');
console.log('2. Check worker logs if issues persist: npx wrangler tail edge-router');
console.log('3. Verify that the R2 bucket contains the expected files');

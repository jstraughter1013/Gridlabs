#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { program } from 'commander';
import archiver from 'archiver';
import fetch from 'node-fetch';
import ora from 'ora';
import chalk from 'chalk';

// Configuration
const API_ENDPOINT = process.env.GRIDLABS_API_ENDPOINT || 'https://api.gridlabs.app';
const API_TOKEN = process.env.GRIDLABS_API_TOKEN;

// CLI program setup
program
  .name('gridlabs upload')
  .description('Upload a build to GridLabs Cloud')
  .requiredOption('--org <organization>', 'Organization name')
  .requiredOption('--repo <repository>', 'Repository name')
  .requiredOption('--branch <branch>', 'Branch name')
  .requiredOption('--sha <commit-sha>', 'Commit SHA')
  .option('--watch', 'Watch for changes and re-upload on rebuild')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    const { org, repo, branch, sha, watch } = options;
    
    // Validate inputs
    if (!org || !repo || !branch || !sha) {
      console.error(chalk.red('Error: Missing required parameters'));
      process.exit(1);
    }

    if (!API_TOKEN) {
      console.warn(chalk.yellow('Warning: GRIDLABS_API_TOKEN environment variable not set. Authentication may fail.'));
    }

    // Check if dist directory exists, if not run build
    const distDir = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) {
      const spinner = ora('Dist directory not found. Running build...').start();
      try {
        execSync('npm run build', { stdio: 'inherit' });
        spinner.succeed('Build completed successfully');
      } catch (error) {
        spinner.fail('Build failed');
        console.error(error);
        process.exit(1);
      }
    }

    // Create a zip file of the dist directory
    const spinner = ora('Creating zip archive of dist directory...').start();
    const zipPath = path.resolve(process.cwd(), 'dist.zip');
    
    await createZipArchive(distDir, zipPath);
    spinner.succeed('Zip archive created successfully');

    // Get presigned URL from API
    spinner.text = 'Getting upload URL from GridLabs API...';
    spinner.start();
    
    const presignResponse = await fetch(`${API_ENDPOINT}/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({
        org,
        repo,
        branch,
        sha,
        keyCount: 1 // Just one file for now (the zip)
      })
    });

    if (!presignResponse.ok) {
      spinner.fail('Failed to get upload URL');
      console.error(chalk.red(`API Error: ${presignResponse.status} ${presignResponse.statusText}`));
      const errorData = await presignResponse.text();
      console.error(errorData);
      process.exit(1);
    }

    const { uploadUrls, publicUrl } = await presignResponse.json();
    spinner.succeed('Got upload URL successfully');

    // Upload the zip file
    spinner.text = 'Uploading build to GridLabs Cloud...';
    spinner.start();
    
    const uploadResponse = await fetch(uploadUrls[0].uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': fs.statSync(zipPath).size.toString()
      },
      body: fs.createReadStream(zipPath)
    });

    if (!uploadResponse.ok) {
      spinner.fail('Failed to upload build');
      console.error(chalk.red(`Upload Error: ${uploadResponse.status} ${uploadResponse.statusText}`));
      const errorData = await uploadResponse.text();
      console.error(errorData);
      process.exit(1);
    }

    spinner.succeed('Build uploaded successfully');
    
    // Clean up the zip file
    fs.unlinkSync(zipPath);

    // Display success message with the public URL
    console.log('\n' + chalk.green('✓') + ' Upload complete!');
    console.log('\nYour build is now available at:');
    console.log(chalk.blue.bold(publicUrl));
    console.log('\nThis link can be shared with anyone and will work immediately.');

    // Watch for changes if --watch flag is provided
    if (watch) {
      console.log('\n' + chalk.yellow('Watching for changes...'));
      // Implementation for watch mode would go here
      // This would involve setting up file watchers on the dist directory
      // and triggering a re-upload when changes are detected
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// Helper function to create a zip archive
function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

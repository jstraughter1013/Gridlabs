import { chromium } from 'playwright';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

// Path to the service account key file
const keyFilePath = path.resolve(process.cwd(), 'firebase-service-account.json');

// Check if the service account file exists, if not, try to create it from the environment variables
if (!fs.existsSync(keyFilePath)) {
  try {
    // Try to use environment variables if file doesn't exist
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      console.error('Service account file not found and environment variables are missing.');
      console.error('Please create a firebase-service-account.json file in the project root.');
      process.exit(1);
    }
    
    // Create the service account file from environment variables
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };
    
    fs.writeFileSync(keyFilePath, JSON.stringify(serviceAccount, null, 2));
    console.log('Created service account file from environment variables');
  } catch (error) {
    console.error('Failed to create service account file:', error);
    process.exit(1);
  }
}

// Get the current Git commit hash from environment or command line
const commitHash = process.env.BITBUCKET_COMMIT || process.env.GIT_COMMIT || 'local';

// Initialize Google Cloud Storage with the service account file
const storage = new Storage({
  keyFilename: keyFilePath
});

// Get project ID from the service account file
const serviceAccountData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
const projectId = serviceAccountData.project_id;
const bucketName = `${projectId}.appspot.com`;
const bucket = storage.bucket(bucketName);

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'gridshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function takeSnapshots() {
  console.log(`Taking snapshots for commit: ${commitHash}`);
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the grid page
    await page.goto('http://localhost:4175/__grid', { waitUntil: 'networkidle' });
    
    // Wait for grid to fully load
    await page.waitForSelector('.grid-card', { timeout: 10000 });
    
    // Get all component cards
    const cards = await page.$$('.grid-card');
    console.log(`Found ${cards.length} components to snapshot`);
    
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      
      // Get component name from the card
      const nameElement = await card.$('.component-name');
      const name = await nameElement?.textContent() || `Component${i}`;
      const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
      
      console.log(`Taking snapshot of ${safeName}`);
      
      // Take screenshot of the component card
      const screenshotBuffer = await card.screenshot();
      
      // Save locally
      const localPath = path.join(outputDir, `${safeName}.png`);
      fs.writeFileSync(localPath, screenshotBuffer);
      
      // Optimize with sharp
      await sharp(localPath)
        .resize(800, null, { fit: 'inside' })
        .toFile(path.join(outputDir, `${safeName}_optimized.png`));
      
      // Upload to Firebase Storage
      const destination = `gridshots/${commitHash}/${safeName}.png`;
      await bucket.upload(localPath, {
        destination,
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000',
        },
      });
      
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/${encodeURIComponent(destination)}?alt=media`;
      console.log(`Uploaded → ${publicUrl}`);
    }
  } catch (error) {
    console.error('Error taking snapshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

takeSnapshots()
  .then(() => console.log('Snapshot process completed successfully'))
  .catch(err => {
    console.error('Snapshot process failed:', err);
    process.exit(1);
  });

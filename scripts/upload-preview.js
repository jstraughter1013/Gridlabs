// scripts/upload-preview.js
import fs from "node:fs";

// Use async function with dynamic import
async function main() {
  try {
    // Debug output for environment variables
    console.log('Environment variables for debugging:');
    console.log('CF_ACCOUNT_ID:', process.env.CF_ACCOUNT_ID);
    console.log('R2_BUCKET:', process.env.R2_BUCKET);
    
    // Dynamically import the module
    const r2Client = await import("../dist/api/r2-client.js");
    const { putPreview } = r2Client;
    
    const commit = process.env.GITHUB_SHA ?? "local";
    const html = `<html><body><h1>CI smoke ${commit}</h1></body></html>`;
    const key = `${commit}.html`;

    await putPreview(key, Buffer.from(html));
    console.log("Uploaded preview:", key);
  } catch (error) {
    console.error("Error uploading preview:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unhandled error during upload:", error);
  process.exit(1);
});
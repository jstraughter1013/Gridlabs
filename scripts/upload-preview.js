// scripts/upload-preview.js
import fs from "node:fs";
import { putPreview } from "../dist/api/r2-client.js";

// Use async function wrapper since top-level await requires ES modules
async function main() {
  const commit = process.env.GITHUB_SHA ?? "local";
  const html = `<html><body><h1>CI smoke ${commit}</h1></body></html>`;
  const key = `${commit}.html`;

  try {
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
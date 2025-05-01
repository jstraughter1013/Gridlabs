// scripts/upload-preview.ts
import fs from "node:fs";
import { putPreview } from '../api/r2-client.js';

const commit = process.env.GITHUB_SHA ?? "local";
const html = `<html><body><h1>CI smoke ${commit}</h1></body></html>`;
const key = `${commit}.html`;

await putPreview(key, Buffer.from(html));
console.log("Uploaded preview:", key);

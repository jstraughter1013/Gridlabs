// scripts/upload-preview.ts
import fs from "node:fs";
// change extension to .ts so the loader can resolve it
import { putPreview } from "../api/r2-client.ts";

const commit = process.env.GITHUB_SHA ?? "local";
const html = `<html><body><h1>CI smoke ${commit}</h1></body></html>`;
const key = `${commit}.html`;

await putPreview(key, Buffer.from(html));
console.log("Uploaded preview:", key);

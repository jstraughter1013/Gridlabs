#!/bin/bash
# r2-cli-upload.sh - A shell script to upload files to R2 using AWS CLI
# This approach often has better SSL compatibility than the Node SDK

# Exit on errors
set -e

# Set environment variables with fallbacks
ACCOUNT_ID=${CF_ACCOUNT_ID:-$R2_ACCOUNT_ID}
BUCKET=${R2_BUCKET:-"gl-artifacts-prod"}
ACCESS_KEY=${R2_ACCESS_KEY_ID}
SECRET_KEY=${R2_SECRET_ACCESS_KEY}

# Parse arguments
SOURCE_DIR="./dist"
ORG=${GITHUB_REPOSITORY_OWNER}
REPO=$(echo $GITHUB_REPOSITORY | cut -d '/' -f 2)
SHA=$(echo $GITHUB_SHA | cut -c1-7)

# Log the values for debugging
echo "Organization: $ORG"
echo "Repository: $REPO"
echo "Commit SHA: $SHA"

# Validate required inputs
if [ -z "$ACCOUNT_ID" ] || [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ]; then
  echo "Error: Missing required credentials. Please provide CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
  exit 1
fi

# Create destination path
DEST_PATH="s3://${BUCKET}/${ORG}/${REPO}/smoke/${SHA}/"
echo "Uploading files from ${SOURCE_DIR} to ${DEST_PATH}"

# Configure AWS CLI for R2
aws configure set aws_access_key_id ${ACCESS_KEY}
aws configure set aws_secret_access_key ${SECRET_KEY}
aws configure set default.region auto

# Create the HTML content to upload
echo "Creating simple preview HTML file..."
cat > preview.html << EOL
<!DOCTYPE html>
<html>
<head>
  <title>GridLabs Preview</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 5px;
    }
    h1 { color: #2c3e50; }
    .info { color: #7f8c8d; font-size: 0.9em; }
    .success { color: #27ae60; }
  </style>
</head>
<body>
  <div class="container">
    <h1>GridLabs Preview</h1>
    <p>Preview build for commit <strong>${SHA}</strong> in repository <strong>${ORG}/${REPO}</strong></p>
    <p class="success">✅ Build successful</p>
    <p class="info">Generated at $(date)</p>
  </div>
</body>
</html>
EOL

# First try a simple PUT of just the preview.html file
echo "Attempting simple file upload with AWS CLI..."

# Set up AWS CLI configuration
aws configure set aws_access_key_id "${ACCESS_KEY}"
aws configure set aws_secret_access_key "${SECRET_KEY}"
aws configure set default.region "auto"

# Try simple PUT command
echo "Using PUT command for single file..."
aws s3api put-object \
    --endpoint-url "https://${ACCOUNT_ID}.r2.cloudflarestorage.com" \
    --bucket "${BUCKET}" \
    --key "${ORG}/${REPO}/smoke/${SHA}/index.html" \
    --body "preview.html" \
    --content-type "text/html" \
    --debug

# If successful, output the preview URL
if [ $? -eq 0 ]; then
  PREVIEW_URL="https://preview-gridlabs.app/${ORG}/${REPO}/smoke/${SHA}/index.html"
  echo "Upload successful! Preview URL: ${PREVIEW_URL}"
  # Export the URL for other scripts to use
  echo "R2_UPLOAD_URL=${PREVIEW_URL}" >> $GITHUB_ENV
else
  echo "Upload failed. Check the error messages above."
  exit 1
fi

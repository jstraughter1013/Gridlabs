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
SOURCE_DIR=${1:-"./dist"}
ORG=${2:-$(echo $GITHUB_REPOSITORY_OWNER)}
REPO=${3:-$(echo $GITHUB_REPOSITORY | cut -d '/' -f 2)}
SHA=${4:-$(echo $GITHUB_SHA | cut -c1-7)}

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

# Attempt the upload with explicit parameters to avoid SSL issues
echo "Starting upload with AWS CLI..."
aws s3 cp --endpoint-url "https://${ACCOUNT_ID}.r2.cloudflarestorage.com" \
    --no-verify-ssl \
    "${SOURCE_DIR}/" \
    "${DEST_PATH}" \
    --recursive

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

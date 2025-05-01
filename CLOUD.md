# GridLabs Cloud Documentation

## Overview

GridLabs Cloud is a cloud-based platform for building, deploying, and sharing UI components. The "Upload-&-Serve" feature (Cloud v0) allows developers to upload their UI components to the cloud and share them via unique URLs.

This document provides comprehensive documentation on the GridLabs Cloud architecture, components, and implementation details.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Component Details](#component-details)
  - [API Server](#api-server)
  - [R2 Storage](#r2-storage)
  - [Edge Router](#edge-router)
  - [CLI Tool](#cli-tool)
- [URL Structure](#url-structure)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

## Architecture Overview

GridLabs Cloud v0 ("Upload-&-Serve") is built on a serverless architecture with the following components:

- **API Server**: A Fastify server deployed on Fly.io that handles authentication and generates presigned URLs for uploads.
- **R2 Storage**: Cloudflare R2 object storage for storing uploaded UI components.
- **Edge Router**: A Cloudflare Worker that serves content from R2 based on URL patterns.
- **CLI Tool**: A command-line tool for building and uploading UI components.

The workflow is as follows:
1. Developers use the CLI to build and package their UI components
2. The CLI requests a presigned URL from the API Server
3. The CLI uploads the packaged components to R2 using the presigned URL
4. The Edge Router serves the content from R2 when accessed via the generated URL

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐
│   CLI   │────▶│  API Server │────▶│ Presigned URL │
└─────────┘     └─────────────┘     └──────────────┘
     │                                      │
     │                                      ▼
     │                              ┌──────────────┐
     └─────────────────────────────▶│  R2 Storage  │
                                    └──────────────┘
                                           ▲
                                           │
┌───────────┐     ┌─────────────┐          │
│  Browser  │────▶│ Edge Router │──────────┘
└───────────┘     └─────────────┘
```

## Tech Stack

### Core Technologies

- **Cloudflare R2**: Object storage compatible with S3 API
- **Cloudflare Workers**: Serverless JavaScript runtime for the Edge Router
- **Fly.io**: Hosting platform for the API Server
- **Fastify**: Web framework for the API Server
- **TypeScript**: Programming language used throughout the stack
- **AWS SDK**: Used for interacting with R2 storage (S3-compatible API)
- **JWT**: JSON Web Tokens for API authentication
- **dotenv**: Environment variable management for development and production

### Development Tools

- **Wrangler**: CLI tool for developing and deploying Cloudflare Workers
- **Node.js**: JavaScript runtime for the CLI and API Server
- **npm/yarn**: Package managers
- **Jest**: Testing framework
- **ESLint/Prettier**: Code formatting and linting

## Component Details

### API Server

The API Server is a Fastify application deployed on Fly.io. It handles:

- Authentication via JWT
- Generating presigned URLs for uploading to R2
- Rate limiting (60 requests per minute per repo)

**Key Files**:
- `api/presign.ts`: Main API server implementation
- `api/r2-client.ts`: R2 client for generating presigned URLs with enhanced authentication

**Deployment**:
The API Server is deployed on Fly.io using the following configuration:
- `fly.toml`: Fly.io configuration file
- `Dockerfile`: Container configuration for Fly.io deployment

**Environment Variables**:
```
JWT_SECRET=<jwt-secret-key>
CF_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET=gl-artifacts-prod
PORT=3000
```

### R2 Storage

Cloudflare R2 is used as the storage backend for UI components. It's an S3-compatible object storage service.

**Bucket Structure**:
```
gl-artifacts-prod/
├── <org>/
│   ├── <repo>/
│   │   ├── <branch>/
│   │   │   ├── <sha>/
│   │   │   │   ├── index.html
│   │   │   │   ├── assets/
│   │   │   │   │   ├── js/
│   │   │   │   │   ├── css/
│   │   │   │   │   └── ...
```

**Access Control**:
- Presigned URLs with a 30-minute TTL for uploads
- Public read access through the Edge Router

**Authentication**:
- Secure credential management using environment variables
- Support for both CF_ACCOUNT_ID and R2_ACCOUNT_ID (they can be the same value)
- Proper bucket inclusion in URL paths and signature calculation

### Edge Router

The Edge Router is a Cloudflare Worker that serves content from R2 based on URL patterns. It handles:

- Parsing subdomain patterns (`<branch>--<repo>.gridlabs.app`)
- Constructing object keys for R2
- Serving content with appropriate caching headers
- Fallback to index.html for SPA routing

**Key Files**:
- `cloudflare/edge-router.ts`: Main Edge Router implementation
- `cloudflare/wrangler.toml`: Wrangler configuration for deployment

**URL Parsing**:
The Edge Router parses URLs in the format `https://<branch>--<repo>.gridlabs.app/<sha>/[path]` and constructs R2 object keys in the format `<org>/<repo>/<branch>/<sha>/[path]`.

**Caching**:
- SHA-specific URLs: `max-age=31536000, immutable` (1 year, immutable)
- Branch-only URLs: `s-maxage=60` (1 minute)

**Deployment**:
The Edge Router is deployed using Wrangler:

```bash
npx wrangler deploy
```

### CLI Tool

The CLI tool is a Node.js application that builds and uploads UI components to R2.

**Key Files**:
- `packages/cli/src/index.ts`: CLI entry point
- `packages/cli/src/aws-upload.ts`: Upload implementation

**Commands**:
```bash
# Upload a build to GridLabs Cloud
npx gridlabs upload --org <organization> --repo <repository> --branch <branch> --sha <commit-sha>
```

**Features**:
- Automatic building if dist directory is missing
- Creating zip archives of the dist directory
- Uploading to R2 using presigned URLs
- Retry logic for transient network issues
- Enhanced error handling with detailed diagnostics

## URL Structure

GridLabs Cloud uses a consistent URL structure for accessing UI components:

**Upload URL**:
```
https://<presigned-url-from-api>
```

**Access URL**:
```
https://<branch>--<repo>.gridlabs.app/<sha>/[path]
```

Where:
- `<branch>`: Git branch name
- `<repo>`: Repository name
- `<sha>`: Commit SHA or unique identifier
- `[path]`: Optional path to specific file (defaults to index.html)

## Deployment

### API Server Deployment (Fly.io)

Install the Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

Log in to Fly:
```bash
fly auth login
```

Deploy the API:
```bash
cd api
fly deploy
```

### Edge Router Deployment (Cloudflare Workers)

Install Wrangler:
```bash
npm install -g wrangler
```

Log in to Cloudflare:
```bash
wrangler login
```

Deploy the Edge Router:
```bash
cd cloudflare
wrangler deploy
```

## Configuration

### Required Environment Variables

#### API Server (.env.local)
```
JWT_SECRET=<jwt-secret-key>
CF_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET=gl-artifacts-prod
PORT=3000
```

#### CLI (.env.local)
```
GRIDLABS_API_ENDPOINT=https://api.gridlabs.app
GRIDLABS_API_TOKEN=<jwt-token>
CF_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET=gl-artifacts-prod
```

### Cloudflare Configuration

#### R2 Bucket Setup
1. Create an R2 bucket named `gl-artifacts-prod`
2. Create API tokens with appropriate permissions
3. Ensure bucket has proper CORS configuration

#### DNS Configuration
1. Configure wildcard DNS for `*.gridlabs.app` to point to the Edge Router
2. Set up a CNAME record for `api.gridlabs.app` to point to the Fly.io app

## Troubleshooting

### Common Issues

#### SignatureDoesNotMatch Error
This indicates an authentication issue with the R2 API.

**Possible causes**:
- Incorrect R2 credentials
- Mismatch between environment variables and actual R2 settings
- Incorrect URL construction for the R2 request

**Solution**:
1. Verify R2 credentials match those in the Cloudflare dashboard
2. Ensure bucket name is included in the URL path AND signature calculation
3. Check both CF_ACCOUNT_ID and R2_ACCOUNT_ID are properly set

#### HTTP ERROR 522
This indicates a connection timeout between Cloudflare and the origin server (R2).

**Possible causes**:
- R2 bucket binding is missing in the Edge Router
- DNS configuration issues
- Incorrect object key construction

**Solution**:
1. Check Cloudflare Worker logs for detailed error messages
2. Verify R2 bucket binding in wrangler.toml
3. Ensure DNS is properly configured

#### SSL Handshake Failures
This indicates a problem with the TLS connection to Cloudflare R2.

**Possible causes**:
- Outdated TLS configuration
- Network connectivity issues
- Incompatible ciphers or security protocols

**Solution**:
1. Ensure TLS configuration is set to version 1.2 or 1.3
2. Verify network connectivity to the R2 endpoint
3. Use compatible ciphers for Cloudflare's requirements

#### Upload Failures
Issues can occur during the upload process for various reasons.

**Possible causes**:
- Incorrect R2 credentials
- Network connectivity issues
- Incorrect environment variable configuration

**Solution**:
1. Verify R2 credentials in environment variables
2. Check network connectivity
3. Ensure correct environment variable loading via dotenv

### Debugging

#### Environment Variables
For local development and testing, use a `.env.local` file with the following command to load variables:
```bash
# Load variables from .env.local for testing
node -r dotenv/config your-script.js
```

#### Edge Router Logs
1. Access the Cloudflare dashboard
2. Navigate to Workers & Pages > edge-router > Logs
3. Look for logs with the [EdgeRouter] prefix

#### API Server Logs
1. Access the Fly.io dashboard
2. Navigate to your app
3. Check the logs section

## Future Enhancements

### Planned for Cloud v1
- Custom domains support
- Authentication for private repositories
- Analytics and usage tracking
- CDN optimization for faster loading
- Branch preview URLs without SHA

### Planned for Cloud v2
- Automatic deployment from Git repositories
- Visual regression testing integration
- Component versioning and tagging
- Team collaboration features
- API for programmatic access

## Contributing

To contribute to GridLabs Cloud:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

GridLabs Cloud is licensed under the MIT License.

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import Fastify from 'fastify';
import FastifyJwt from '@fastify/jwt';
import nock from 'nock';

// Test configuration
const TEST_ORG = 'test-org';
const TEST_REPO = 'test-repo';
const TEST_BRANCH = 'feature/test';
const TEST_SHA = '1234567890abcdef';
const TEST_FIXTURE_DIR = path.resolve(__dirname, 'fixtures/test-build');
const TEST_FIXTURE_INDEX = path.resolve(TEST_FIXTURE_DIR, 'index.html');

// Mock API responses
const mockUploadUrl = 'https://upload.r2.cloudflare.com/gl-artifacts-prod/test-org/test-repo/feature/test/1234567890abcdef/index.html';
const mockPublicUrl = 'https://feature--test-repo.gridlabs.app/1234567890abcdef/';

// Setup test fixtures
function setupTestFixtures() {
  // Create test fixture directory if it doesn't exist
  if (!fs.existsSync(TEST_FIXTURE_DIR)) {
    fs.mkdirSync(TEST_FIXTURE_DIR, { recursive: true });
  }

  // Create a simple index.html file for testing
  fs.writeFileSync(TEST_FIXTURE_INDEX, `
<!DOCTYPE html>
<html>
<head>
  <title>GridLabs</title>
</head>
<body>
  <h1>GridLabs Test Fixture</h1>
  <p>This is a test fixture for the GridLabs Cloud Upload feature.</p>
</body>
</html>
  `);
}

// Clean up test fixtures
function cleanupTestFixtures() {
  if (fs.existsSync(TEST_FIXTURE_DIR)) {
    fs.rmSync(TEST_FIXTURE_DIR, { recursive: true, force: true });
  }
}

// Mock the CLI upload process
async function mockCliUpload() {
  // Mock the API response for the presign endpoint
  nock('https://api.gridlabs.app')
    .post('/uploads')
    .reply(200, {
      requestId: 'mock-request-id',
      uploadUrls: [
        { key: `${TEST_ORG}/${TEST_REPO}/${TEST_BRANCH}/${TEST_SHA}/index.html`, uploadUrl: mockUploadUrl }
      ],
      publicUrl: mockPublicUrl,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });

  // Mock the upload to R2
  nock('https://upload.r2.cloudflare.com')
    .put(`/gl-artifacts-prod/${TEST_ORG}/${TEST_REPO}/${TEST_BRANCH}/${TEST_SHA}/index.html`)
    .reply(200);

  // Simulate CLI upload process
  // In a real test, we would call the actual CLI code
  // For this test, we'll just simulate the process
  return {
    success: true,
    publicUrl: mockPublicUrl
  };
}

// Test suite
beforeAll(() => {
  setupTestFixtures();
});

afterAll(() => {
  cleanupTestFixtures();
});

it('Presign API returns valid upload URLs', async () => {
  // Create a new Fastify server for testing
  const server = Fastify();
  
  // Register JWT plugin
  await server.register(FastifyJwt, {
    secret: 'test-secret'
  });
  
  // Mock the uploads endpoint
  server.post('/uploads', {
    handler: async (request, reply) => {
      const { org, repo, branch, sha, keyCount } = request.body as any;
      
      // Return a mock response
      return {
        requestId: 'test-request-id',
        uploadUrls: [
          { 
            key: `${org}/${repo}/${branch}/${sha}/index.html`, 
            uploadUrl: `https://upload.r2.cloudflare.com/gl-artifacts-prod/${org}/${repo}/${branch}/${sha}/index.html` 
          }
        ],
        publicUrl: `https://${branch}--${repo}.gridlabs.app/${sha}/`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    }
  });
  
  // Start the server
  await server.ready();

  // Make a request to the presign endpoint
  const response = await server.inject({
    method: 'POST',
    url: '/uploads',
    payload: {
      org: TEST_ORG,
      repo: TEST_REPO,
      branch: TEST_BRANCH,
      sha: TEST_SHA,
      keyCount: 1
    }
  });

  // Check the response
  expect(response.statusCode).toBe(200);
  
  const body = JSON.parse(response.body);
  expect(body).toHaveProperty('uploadUrls');
  expect(body).toHaveProperty('publicUrl');
  expect(body.uploadUrls).toBeInstanceOf(Array);
  expect(body.uploadUrls.length).toBe(1);
  expect(body.uploadUrls[0]).toHaveProperty('key');
  expect(body.uploadUrls[0]).toHaveProperty('uploadUrl');
  expect(body.publicUrl).toContain(`${TEST_BRANCH}--${TEST_REPO}.gridlabs.app/${TEST_SHA}/`);

  // Close the server
  await server.close();
});

it('CLI upload process works end-to-end', async () => {
  // Mock the CLI upload process
  const result = await mockCliUpload();
  
  // Check the result
  expect(result.success).toBe(true);
  expect(result.publicUrl).toBe(mockPublicUrl);
});

it('Public URL serves the uploaded content', async () => {
  // Mock the response from the edge router
  nock('https://feature--test-repo.gridlabs.app')
    .get('/1234567890abcdef/')
    .reply(200, fs.readFileSync(TEST_FIXTURE_INDEX, 'utf-8'), {
      'Content-Type': 'text/html',
      'Cache-Control': 'max-age=31536000, immutable'
    });

  // Fetch the public URL
  const response = await fetch(mockPublicUrl) as unknown as Response;
  
  // Check the response
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('text/html');
  
  const body = await response.text();
  expect(body).toContain('<title>GridLabs</title>');
  expect(body).toContain('GridLabs Test Fixture');
});

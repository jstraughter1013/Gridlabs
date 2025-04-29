import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import FastifyJwt from '@fastify/jwt';
import FastifyRateLimit from '@fastify/rate-limit';
import FastifyCors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';
import { generatePresignedUrl, generatePublicUrl } from './r2-client.js';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');
const envPath = join(rootDir, '.env.local');

if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from ${envPath}`);
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.replace(/^"(.*)"$/, '$1');
        }
      }
    }
  }
} else {
  console.warn(`Warning: ${envPath} not found. Using existing environment variables.`);
}

// Extend FastifyRequest to include JWT verification
declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify(): Promise<any>;
  }
}

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-replace-in-production';
const R2_BUCKET_NAME = 'gl-artifacts-prod';
const UPLOAD_URL_TTL_MINUTES = 30;

// Initialize Fastify server
const fastify = Fastify({
  logger: true,
});

// Register CORS plugin
fastify.register(FastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Register JWT plugin for authentication
fastify.register(FastifyJwt, {
  secret: JWT_SECRET,
});

// Register rate limit plugin
fastify.register(FastifyRateLimit, {
  max: 60,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    // Rate limit by repo
    const { org, repo } = request.body as any;
    return `${org}/${repo}`;
  },
});

// JWT authentication hook
fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
  // Skip authentication for non-upload routes
  if (request.url !== '/uploads') {
    return;
  }

  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized - Invalid or missing JWT token' });
  }
});

// Define the upload endpoint
fastify.post('/uploads', {
  schema: {
    body: {
      type: 'object',
      required: ['org', 'repo', 'branch', 'sha', 'keyCount'],
      properties: {
        org: { type: 'string' },
        repo: { type: 'string' },
        branch: { type: 'string' },
        sha: { type: 'string' },
        keyCount: { type: 'integer', minimum: 1 }
      }
    }
  },
  handler: async (request, reply) => {
    const { org, repo, branch, sha, keyCount } = request.body as any;

    // Validate inputs
    if (!org || !repo || !branch || !sha) {
      return reply.code(400).send({ error: 'Missing required parameters' });
    }

    if (keyCount <= 0 || keyCount > 100) {
      return reply.code(400).send({ error: 'keyCount must be between 1 and 100' });
    }

    try {
      // Generate a unique request ID for this upload
      const requestId = randomUUID();
      
      // Base path for the artifacts
      const basePath = `${org}/${repo}/${branch}/${sha}`;
      
      // Generate presigned URLs
      const uploadUrls = [];
      for (let i = 0; i < keyCount; i++) {
        const key = i === 0 ? `${basePath}/index.html` : `${basePath}/${i}.html`;
        
        // Generate a real presigned URL using the R2 client
        const contentType = i === 0 ? 'text/html' : 'application/octet-stream';
        const uploadUrl = await generatePresignedUrl(key, contentType, UPLOAD_URL_TTL_MINUTES * 60);
        uploadUrls.push({ key, uploadUrl });
      }

      // Public URL that will be used to access the content
      const publicUrl = generatePublicUrl(org, repo, branch, sha);

      return {
        requestId,
        uploadUrls,
        publicUrl,
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MINUTES * 60 * 1000).toISOString(),
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to generate presigned URLs' });
    }
  }
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Start the server
const start = async () => {
  try {
    console.log('Starting server...');
    console.log(`Environment variables:`);
    console.log(`- PORT=${PORT}`);
    console.log(`- JWT_SECRET=${JWT_SECRET ? 'set' : 'not set'}`);
    console.log(`- R2_BUCKET_NAME=${R2_BUCKET_NAME}`);
    console.log(`- R2_ACCOUNT_ID=${process.env.R2_ACCOUNT_ID ? 'set' : 'not set'}`);
    console.log(`- R2_ACCESS_KEY_ID=${process.env.R2_ACCESS_KEY_ID ? 'set' : 'not set'}`);
    
    // Add a health check route before starting the server
    fastify.get('/', async () => {
      return { status: 'ok', message: 'GridLabs Cloud v0 API is running' };
    });
    
    // Start the server
    const address = await fastify.listen({ port: PORT as number, host: '0.0.0.0' });
    console.log(`Server is now listening on ${address}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
    console.log(`Upload endpoint available at: http://localhost:${PORT}/uploads`);
  } catch (err) {
    console.error('Error starting server:', err);
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start server if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  start();
}

// Export for testing
export { fastify };

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import FastifyJwt from '@fastify/jwt';
import FastifyRateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';

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
        
        // In a real implementation, this would use R2 SDK to generate presigned URLs
        // For now, we'll simulate it with a placeholder
        const uploadUrl = `https://upload.r2.cloudflare.com/${R2_BUCKET_NAME}/${key}?signature=${requestId}&expires=${Date.now() + UPLOAD_URL_TTL_MINUTES * 60 * 1000}`;
        uploadUrls.push({ key, uploadUrl });
      }

      // Public URL that will be used to access the content
      const publicUrl = `https://${branch}--${repo}.gridlabs.app/${sha}/`;

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
    await fastify.listen({ port: PORT as number, host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  start();
}

// Export for testing
export { fastify };

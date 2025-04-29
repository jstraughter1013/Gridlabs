/**
 * GridLabs Edge Router
 * 
 * This Cloudflare Worker handles routing for the GridLabs Cloud platform.
 * It parses the subdomain pattern <branch>--<repo>.gridlabs.app and serves
 * content from the R2 bucket.
 */

// Configuration
const R2_BUCKET_NAME = 'gl-artifacts-prod';
const DEFAULT_CACHE_CONTROL = 'max-age=31536000, immutable'; // 1 year for immutable content
const BRANCH_CACHE_CONTROL = 's-maxage=60'; // 1 minute for branch-only routes
const DEBUG = true; // Enable detailed logging

interface Env {
  ARTIFACTS: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      
      // Enhanced logging for debugging
      if (DEBUG) {
        console.log(`[EdgeRouter] Request received for ${url.toString()}`);
        console.log(`[EdgeRouter] Hostname: ${hostname}`);
        console.log(`[EdgeRouter] Path: ${url.pathname}`);
        console.log(`[EdgeRouter] Headers:`, Object.fromEntries([...request.headers.entries()]));
      }
      
      // Parse the hostname to extract branch and repo
      // Format: <branch>--<repo>.gridlabs.app
      const hostnameParts = hostname.split('.');
      if (DEBUG) {
        console.log(`[EdgeRouter] Hostname parts:`, hostnameParts);
      }
      
      if (hostnameParts.length < 3 || !hostnameParts[0].includes('--')) {
        console.error(`[EdgeRouter] Invalid hostname format: ${hostname}`);
        return new Response('Invalid URL format. Expected: <branch>--<repo>.gridlabs.app', {
          status: 400,
          headers: {
            'Content-Type': 'text/plain',
            'X-GridLabs-Error': 'invalid-hostname-format'
          }
        });
      }
      
      const [branchRepo] = hostnameParts;
      const [branch, repo] = branchRepo.split('--');
      
      if (DEBUG) {
        console.log(`[EdgeRouter] Parsed branch: ${branch}`);
        console.log(`[EdgeRouter] Parsed repo: ${repo}`);
      }
      
      if (!branch || !repo) {
        console.error(`[EdgeRouter] Missing branch or repo in hostname: ${hostname}`);
        return new Response('Invalid URL format. Expected: <branch>--<repo>.gridlabs.app', {
          status: 400,
          headers: {
            'Content-Type': 'text/plain',
            'X-GridLabs-Error': 'missing-branch-or-repo'
          }
        });
      }
      
      // Parse the path to extract the SHA and file path
      // Format: /<sha>/[path/to/file]
      const pathParts = url.pathname.split('/').filter(Boolean);
      const sha = pathParts[0];
      const filePath = pathParts.slice(1).join('/') || 'index.html';
      
      if (DEBUG) {
        console.log(`[EdgeRouter] Path parts:`, pathParts);
        console.log(`[EdgeRouter] SHA: ${sha}`);
        console.log(`[EdgeRouter] File path: ${filePath}`);
      }
      
      // Construct the object key
      // Format: /<org>/<repo>/<branch>/<sha>/[path/to/file]
      // Note: We don't have the org in the URL, so we need to derive it from repo or use a default
      // For now, we'll use the repo name as the org name
      const org = repo;
      const objectKey = `${org}/${repo}/${branch}/${sha}/${filePath}`;
      
      if (DEBUG) {
        console.log(`[EdgeRouter] Using organization: ${org}`);
        console.log(`[EdgeRouter] Constructed object key: ${objectKey}`);
        console.log(`[EdgeRouter] Bucket name: ${R2_BUCKET_NAME}`);
      }
      
      // Fetch the object from R2
      if (DEBUG) {
        console.log(`[EdgeRouter] Attempting to fetch object from R2: ${objectKey}`);
      }
      
      // Check if the ARTIFACTS binding exists
      if (!env.ARTIFACTS) {
        console.error('[EdgeRouter] R2 bucket binding is missing. Check Worker configuration.');
        return new Response('Server configuration error: R2 bucket binding is missing', {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            'X-GridLabs-Error': 'missing-r2-binding'
          }
        });
      }
      
      let object;
      try {
        object = await env.ARTIFACTS.get(objectKey);
        if (DEBUG) {
          console.log(`[EdgeRouter] R2 get result: ${object ? 'Object found' : 'Object not found'}`);
          if (object) {
            console.log(`[EdgeRouter] Object size: ${object.size} bytes`);
            console.log(`[EdgeRouter] Object type: ${object.httpMetadata?.contentType || 'unknown'}`);
          }
        }
      } catch (r2Error) {
        console.error(`[EdgeRouter] R2 error fetching object:`, r2Error);
        return new Response(`Error accessing storage: ${r2Error.message}`, {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            'X-GridLabs-Error': 'r2-access-error',
            'X-GridLabs-Error-Details': r2Error.message
          }
        });
      }
      
      if (!object) {
        if (DEBUG) {
          console.log(`[EdgeRouter] Object not found: ${objectKey}`);
        }
        
        // If the specific file is not found, try index.html
        if (filePath !== 'index.html') {
          const indexKey = `${org}/${repo}/${branch}/${sha}/index.html`;
          if (DEBUG) {
            console.log(`[EdgeRouter] Trying index fallback: ${indexKey}`);
          }
          
          let indexObject;
          try {
            indexObject = await env.ARTIFACTS.get(indexKey);
            if (DEBUG) {
              console.log(`[EdgeRouter] Index fallback result: ${indexObject ? 'Found' : 'Not found'}`);
            }
          } catch (r2Error) {
            console.error(`[EdgeRouter] R2 error fetching index fallback:`, r2Error);
            return new Response(`Error accessing storage: ${r2Error.message}`, {
              status: 500,
              headers: {
                'Content-Type': 'text/plain',
                'X-GridLabs-Error': 'r2-access-error-index-fallback',
                'X-GridLabs-Error-Details': r2Error.message
              }
            });
          }
          
          if (indexObject) {
            // Determine content type based on the file extension
            const contentType = 'text/html';
            
            // Determine cache control header based on whether SHA is present
            const cacheControl = sha ? DEFAULT_CACHE_CONTROL : BRANCH_CACHE_CONTROL;
            
            // Return the object with appropriate headers
            return new Response(indexObject.body, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': cacheControl,
                'X-GridLabs-Router': 'index-fallback'
              }
            });
          }
        }
        
        return new Response('Not Found', { status: 404 });
      }
      
      // Determine content type based on the file extension
      const contentType = getContentType(filePath);
      
      // Determine cache control header based on whether SHA is present
      const cacheControl = sha ? DEFAULT_CACHE_CONTROL : BRANCH_CACHE_CONTROL;
      
      // Return the object with appropriate headers
      return new Response(object.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'X-GridLabs-Router': 'direct-hit'
        }
      });
    } catch (error) {
      console.error('[EdgeRouter] Unhandled error:', error);
      
      // Detailed error response with debugging information
      const errorDetails = {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace available',
        name: error.name || 'Error',
        code: error.code || 'UNKNOWN_ERROR'
      };
      
      if (DEBUG) {
        console.error('[EdgeRouter] Error details:', JSON.stringify(errorDetails));
      }
      
      return new Response('Internal Server Error', { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'X-GridLabs-Error': 'internal-server-error',
          'X-GridLabs-Error-Details': error.message || 'Unknown error'
        }
      });
    }
  }
};

// Helper function to determine content type based on file extension
function getContentType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject',
    'txt': 'text/plain',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'gz': 'application/gzip',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav'
  };
  
  return contentTypes[extension || ''] || 'application/octet-stream';
}

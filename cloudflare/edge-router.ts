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

interface Env {
  ARTIFACTS: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      
      // Parse the hostname to extract branch and repo
      // Format: <branch>--<repo>.gridlabs.app
      const hostnameParts = hostname.split('.');
      if (hostnameParts.length < 3 || !hostnameParts[0].includes('--')) {
        return new Response('Invalid URL format. Expected: <branch>--<repo>.gridlabs.app', {
          status: 400
        });
      }
      
      const [branchRepo] = hostnameParts;
      const [branch, repo] = branchRepo.split('--');
      
      if (!branch || !repo) {
        return new Response('Invalid URL format. Expected: <branch>--<repo>.gridlabs.app', {
          status: 400
        });
      }
      
      // Parse the path to extract the SHA and file path
      // Format: /<sha>/[path/to/file]
      const pathParts = url.pathname.split('/').filter(Boolean);
      const sha = pathParts[0];
      const filePath = pathParts.slice(1).join('/') || 'index.html';
      
      // Construct the object key
      // Format: /<org>/<repo>/<branch>/<sha>/[path/to/file]
      // Note: We don't have the org in the URL, so we need to derive it from repo or use a default
      // For now, we'll use the repo name as the org name
      const org = repo;
      const objectKey = `${org}/${repo}/${branch}/${sha}/${filePath}`;
      
      // Fetch the object from R2
      const object = await env.ARTIFACTS.get(objectKey);
      
      if (!object) {
        // If the specific file is not found, try index.html
        if (filePath !== 'index.html') {
          const indexKey = `${org}/${repo}/${branch}/${sha}/index.html`;
          const indexObject = await env.ARTIFACTS.get(indexKey);
          
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
      console.error('Error in edge router:', error);
      return new Response('Internal Server Error', { status: 500 });
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

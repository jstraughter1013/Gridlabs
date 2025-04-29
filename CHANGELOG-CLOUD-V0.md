# 🚀 GridLabs Cloud v0 Release

**Date:** April 28, 2025

We're excited to announce the release of GridLabs Cloud v0, a major milestone in our roadmap that delivers on our zero-configuration promise!

## What's New

GridLabs Cloud v0 introduces "Upload-&-Serve" preview links, allowing you to share UI components with anyone without requiring them to set up or install anything.

```bash
$ npx gridlabs upload \
      --org acme \
      --repo ui \
      --branch feature/header \
      --sha $(git rev-parse HEAD)
```

This command:
1. Runs `vite build` (if `/dist` is missing)
2. Zips `/dist` → uploads to Cloudflare R2
3. Returns a link like `https://feature--ui.gridlabs.app/1b2c3d4/` that anyone can open immediately

## Why This Matters

This release addresses one of our critical missing features identified in the feature map analysis. Previously, users had to set up their own Vercel and Firebase accounts, which contradicted our zero-configuration philosophy. With GridLabs Cloud, we now provide a fully managed platform that aligns with our core promise.

## Technical Details

- **Cloudflare R2 Storage**: Secure, scalable storage for build artifacts
- **Edge Router**: Cloudflare Worker that serves content from `*.gridlabs.app` domains
- **Presign API**: Generates secure upload URLs with JWT authentication
- **CLI Tool**: Handles building, zipping, and uploading

## Next Steps

With Cloud v0 complete, we're now moving on to the next priorities in our roadmap:
1. GitHub App Auto-Trigger for zero-touch previews
2. Context Auto-Mocker for better component rendering
3. Smart-Default Props to reduce blank components

## Try It Out

```bash
npm install -g gridlabs
gridlabs upload --org <your-org> --repo <your-repo> --branch <your-branch>
```

Documentation is available in the README. For any questions or feedback, please reach out to the GridLabs team!

---

*This feature was implemented by Jamal Straughter*

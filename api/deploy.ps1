# GridLabs Presign API Deployment Script for Fly.io
$ErrorActionPreference = "Stop"

# Make sure we're in the right directory
Set-Location $PSScriptRoot

# Set secrets
Write-Host "Setting secrets for gridlabs-presign..." -ForegroundColor Cyan
& "$env:USERPROFILE\.fly\bin\flyctl" secrets set -a gridlabs-presign `
  CF_ACCOUNT_ID=xxxxxxxx `
  CF_R2_ACCESS_KEY=xxxxxxxx `
  CF_R2_SECRET_KEY=xxxxxxxx `
  JWT_SECRET=supersecret

# Deploy with remote builder, free shared IP
Write-Host "Deploying with remote builder (answer 'n' when asked about $2 dedicated IPv4)..." -ForegroundColor Cyan
& "$env:USERPROFILE\.fly\bin\flyctl" deploy -a gridlabs-presign --remote-only

# Add custom domain and certificate
Write-Host "Adding custom domain certificate..." -ForegroundColor Cyan
& "$env:USERPROFILE\.fly\bin\flyctl" certs add api.gridlabs.app -a gridlabs-presign

# Check certificate status
Write-Host "Checking certificate status (run this repeatedly until Verified)..." -ForegroundColor Cyan
& "$env:USERPROFILE\.fly\bin\flyctl" certs check api.gridlabs.app -a gridlabs-presign

# Smoke test
Write-Host "Performing smoke test..." -ForegroundColor Cyan
Write-Host "Run this when certificate is verified: curl.exe -I https://api.gridlabs.app/health" -ForegroundColor Yellow
Write-Host "Expected result: HTTP/2 200" -ForegroundColor Yellow

Write-Host "Deployment process completed!" -ForegroundColor Green
Write-Host "Remember to update your CLI's GRIDLABS_API_URL once the health check returns 200." -ForegroundColor Yellow

# GitHub Actions Secrets Required

To enable automatic Docker builds and deployment to JDC, add these secrets to your GitHub repository:

## Settings → Secrets and variables → Actions

### Aliyun ACR (Container Registry)
- `ALIYUN_ACR_USERNAME` - Your Aliyun Container Registry username
- `ALIYUN_ACR_PASSWORD` - Your Aliyun Container Registry password

### JDC SSH Deployment
- `JDC_SSH_KEY` - SSH private key for accessing JDC (must have access to `jdc` or `192.168.100.1`)

## How to set up:

1. Go to your GitHub repo
2. Settings → Secrets and variables → Actions
3. Click "New repository secret" for each secret above

## Workflow triggers:

The workflow runs automatically on:
- Push to `master` or `release` branches
- Manual trigger via "Run workflow" button

## What it does:

1. **Build & Push Job**: Builds ARM64 Docker image on native ARM64 GitHub runner
2. **Deploy to JDC Job**: SSHes to your JDC server and deploys the new image

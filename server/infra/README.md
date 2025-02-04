# POE2 Trade Alert Infrastructure

This directory contains the Pulumi infrastructure code for deploying the POE2 Trade Alert service to Google Cloud Platform.

## Prerequisites

1. Install Pulumi CLI: https://www.pulumi.com/docs/install/
2. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
3. Configure gcloud authentication:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
4. Install Node.js dependencies:
   ```bash
   pnpm install
   ```

## Configuration

1. Make sure you have a `.env.production` file in the `server` directory with your environment variables
2. Configure Pulumi stack:
   ```bash
   pulumi stack init dev  # or prod for production
   pulumi config set gcp:project YOUR_PROJECT_ID
   pulumi config set gcp:region us-central1  # or your preferred region
   ```

## Deployment

To deploy the infrastructure:

```bash
# Preview changes
pnpm run preview

# Deploy changes
pnpm run deploy
```

This will:
1. Build and push the Docker image to Google Container Registry
2. Deploy the service to Cloud Run
3. Set up the API Gateway
4. Configure IAM policies

## Cleanup

To destroy all resources:

```bash
pnpm run destroy
```

## Architecture

The deployment consists of:
- Google Cloud Run service running the application
- Google API Gateway for routing and management
- IAM policies for access control
- Docker container registry for image storage

## Outputs

After deployment, Pulumi will output:
- Cloud Run URL
- API Gateway URL 
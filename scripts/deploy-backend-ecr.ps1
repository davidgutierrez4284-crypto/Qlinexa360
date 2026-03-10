# Build and push backend Docker image to ECR
# Requires: Docker, AWS CLI configured

$ErrorActionPreference = "Stop"
$ECR_REGISTRY = "268675503474.dkr.ecr.us-east-2.amazonaws.com"
$IMAGE_NAME = "qlinexa360-backend"
$IMAGE_TAG = "prod"
$REGION = "us-east-2"

Write-Host "=== Backend ECR Build & Push ===" -ForegroundColor Cyan

# Login to ECR
Write-Host "`nAuthenticating with ECR..." -ForegroundColor Yellow
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
if ($LASTEXITCODE -ne 0) { throw "ECR login failed" }

# Build
Write-Host "`nBuilding Docker image..." -ForegroundColor Yellow
Push-Location $PSScriptRoot\..\backend
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Docker build failed" }

# Tag
Write-Host "`nTagging image..." -ForegroundColor Yellow
docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

# Push
Write-Host "`nPushing to ECR..." -ForegroundColor Yellow
docker push "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Docker push failed" }

Pop-Location
Write-Host "`nDone. Image: ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" -ForegroundColor Green

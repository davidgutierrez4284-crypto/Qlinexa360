# Build and push backend Docker image to ECR
# Requires: Docker, AWS CLI configured

$ErrorActionPreference = "Stop"
$ECR_REGISTRY = "268675503474.dkr.ecr.us-east-2.amazonaws.com"
$IMAGE_NAME = "qlinexa360-backend"
$IMAGE_TAG = "prod"
$REGION = "us-east-2"

function Invoke-DockerCli {
    param(
        [Parameter(Mandatory = $true)][string[]]$Args,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )
    # Docker escribe progreso a stderr; en PS 5.1 eso dispara ErrorAction Stop aunque exit code sea 0.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker @Args
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($exitCode -ne 0) { throw $FailureMessage }
}

Write-Host "=== Backend ECR Build & Push ===" -ForegroundColor Cyan

# Login to ECR
Write-Host "`nAuthenticating with ECR..." -ForegroundColor Yellow
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
$loginExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($loginExit -ne 0) { throw "ECR login failed" }

# Build
Write-Host "`nBuilding Docker image..." -ForegroundColor Yellow
Push-Location $PSScriptRoot\..\backend
Invoke-DockerCli -Args @("build", "-t", "${IMAGE_NAME}:${IMAGE_TAG}", ".") -FailureMessage "Docker build failed"

# Tag
Write-Host "`nTagging image..." -ForegroundColor Yellow
Invoke-DockerCli -Args @("tag", "${IMAGE_NAME}:${IMAGE_TAG}", "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}") -FailureMessage "Docker tag failed"

# Push
Write-Host "`nPushing to ECR..." -ForegroundColor Yellow
Invoke-DockerCli -Args @("push", "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}") -FailureMessage "Docker push failed"

Pop-Location
Write-Host "`nDone. Image: ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" -ForegroundColor Green

# Build frontend and deploy to S3
# Requiere: AWS CLI, bucket S3 y opcionalmente CloudFront
# Para PROD: VITE_API_URL=https://api.qlinexa360.com

$ErrorActionPreference = "Stop"
$BUCKET_NAME = "qlinexa360"
$REGION = "us-east-2"
$CLOUDFRONT_DIST_ID = "E2Z7077D2HRTFW"  # CloudFront distribution para invalidar cache

Write-Host "=== Frontend S3 Deploy ===" -ForegroundColor Cyan

# Cargar .env.production (OBLIGATORIO para PROD - PayPal Live, no Sandbox)
$envFile = Join-Path $PSScriptRoot "..\frontend\.env.production"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: No existe frontend/.env.production. Crealo con credenciales PayPal LIVE." -ForegroundColor Red
    throw "Falta .env.production"
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim(); $val = $matches[2].Trim() -replace '[\r\n]+$', ''
        Set-Item -Path "Env:$key" -Value $val -Force
    }
}
# Fallback si no hay .env.production
if (-not $env:VITE_API_URL) { $env:VITE_API_URL = "https://api.qlinexa360.com" }
# PayPal: usa credenciales LIVE (obtener en developer.paypal.com -> Apps -> Live)
if (-not $env:VITE_PAYPAL_CLIENT_ID) {
    Write-Host "AVISO: VITE_PAYPAL_CLIENT_ID no definido. Define con credenciales LIVE de PayPal." -ForegroundColor Yellow
    Write-Host "  Ejemplo: `$env:VITE_PAYPAL_CLIENT_ID = 'tu-client-id-live'" -ForegroundColor Yellow
}
if (-not $env:VITE_PAYPAL_PLAN_ID) {
    Write-Host "AVISO: VITE_PAYPAL_PLAN_ID no definido. Crea un plan de suscripcion en PayPal Live." -ForegroundColor Yellow
}
$paypalPreview = if ($env:VITE_PAYPAL_CLIENT_ID) { $env:VITE_PAYPAL_CLIENT_ID.Substring(0, [Math]::Min(20, $env:VITE_PAYPAL_CLIENT_ID.Length)) + "..." } else { "NO DEFINIDO" }
Write-Host "`nBuilding frontend (VITE_API_URL=$env:VITE_API_URL, PayPal: $paypalPreview)..." -ForegroundColor Yellow
Push-Location $PSScriptRoot\..\frontend
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend build failed" }

# Sync a S3 (SIN --delete: el bucket qlinexa360 también almacena archivos de usuario
# como doctor-profile-photos, prescription_request, recipes, etc. Usar --delete borraría
# esos archivos en cada deploy. Solo subimos/actualizamos el frontend, sin eliminar nada.)
Write-Host "`nUploading to S3..." -ForegroundColor Yellow
aws s3 sync dist/ "s3://$BUCKET_NAME/" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 sync failed" }

# Invalidar cache de CloudFront (opcional)
if ($CLOUDFRONT_DIST_ID) {
    Write-Host "`nInvalidating CloudFront cache..." -ForegroundColor Yellow
    aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"
}

Pop-Location
Write-Host "`nDone. Frontend deployed to s3://$BUCKET_NAME" -ForegroundColor Green

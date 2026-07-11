# Build frontend and deploy to S3
# Requiere: AWS CLI, bucket S3 y opcionalmente CloudFront
# Para PROD: VITE_API_URL=https://api.qlinexa360.com

$ErrorActionPreference = "Stop"
$BUCKET_NAME = "qlinexa360"
$REGION = "us-east-2"
$CLOUDFRONT_DIST_ID = "E2Z7077D2HRTFW"  # CloudFront distribution para invalidar cache

function Invoke-NpmCli {
    param(
        [Parameter(Mandatory = $true)][string[]]$Args,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & npm @Args
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($exitCode -ne 0) { throw $FailureMessage }
}

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
Invoke-NpmCli -Args @("run", "build") -FailureMessage "Frontend build failed"

# Sync a S3 (SIN --delete: el bucket qlinexa360 también almacena archivos de usuario
# como doctor-profile-photos, prescription_request, recipes, etc. Usar --delete borraría
# esos archivos en cada deploy. Solo subimos/actualizamos el frontend, sin eliminar nada.)
Write-Host "`nUploading to S3..." -ForegroundColor Yellow
aws s3 sync dist/ "s3://$BUCKET_NAME/" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 sync failed" }

# Rutas /benefits, /aviso-privacidad y /terminos (sin .html): CloudFront+S3 usan la clave exacta del path.
# Sin esto, 404 -> respuesta de error personalizada -> index.html de la SPA (view-source solo muestra <div id="root">).
# Los HTML completos estan en dist/*/index.html (build Vite MPA + strip-pwa).
$legalCt = "text/html; charset=utf-8"
$benefitsSrc = Join-Path (Get-Location) "dist\benefits\index.html"
$avisoSrc = Join-Path (Get-Location) "dist\aviso-privacidad\index.html"
$terminosSrc = Join-Path (Get-Location) "dist\terminos\index.html"
if (-not (Test-Path $benefitsSrc)) { Pop-Location; throw "Falta dist/benefits/index.html (npm run build)" }
if (-not (Test-Path $avisoSrc)) { Pop-Location; throw "Falta dist/aviso-privacidad/index.html (npm run build)" }
if (-not (Test-Path $terminosSrc)) { Pop-Location; throw "Falta dist/terminos/index.html (npm run build)" }

Write-Host "`nPublishing public static HTML at exact URI keys (OAuth / view-source)..." -ForegroundColor Yellow
aws s3 cp $benefitsSrc "s3://$BUCKET_NAME/benefits" --content-type $legalCt --cache-control "public,max-age=300" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 cp benefits failed" }
aws s3 cp $avisoSrc "s3://$BUCKET_NAME/aviso-privacidad" --content-type $legalCt --cache-control "public,max-age=300" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 cp aviso-privacidad failed" }
aws s3 cp $terminosSrc "s3://$BUCKET_NAME/terminos" --content-type $legalCt --cache-control "public,max-age=300" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 cp terminos failed" }
aws s3api put-object --bucket $BUCKET_NAME --key "benefits/" --body $benefitsSrc --content-type $legalCt --cache-control "public,max-age=300" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 put-object benefits/ failed" }
aws s3api put-object --bucket $BUCKET_NAME --key "aviso-privacidad/" --body $avisoSrc --content-type $legalCt --cache-control "public,max-age=300" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 put-object aviso-privacidad/ failed" }
aws s3api put-object --bucket $BUCKET_NAME --key "terminos/" --body $terminosSrc --content-type $legalCt --cache-control "public,max-age=300" --region $REGION
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 put-object terminos/ failed" }

Write-Host "`nVerifying static objects in S3 (head-object)..." -ForegroundColor Yellow
aws s3api head-object --bucket $BUCKET_NAME --key "benefits" --region $REGION | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 missing key benefits" }
aws s3api head-object --bucket $BUCKET_NAME --key "aviso-privacidad" --region $REGION | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 missing key aviso-privacidad" }
aws s3api head-object --bucket $BUCKET_NAME --key "terminos" --region $REGION | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "S3 missing key terminos" }

# Invalidar cache de CloudFront (opcional)
if ($CLOUDFRONT_DIST_ID) {
    Write-Host "`nInvalidating CloudFront cache..." -ForegroundColor Yellow
    aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/benefits" "/benefits/" "/aviso-privacidad" "/aviso-privacidad/" "/terminos" "/terminos/" "/*"
}

Pop-Location
Write-Host "`nDone. Frontend deployed to s3://$BUCKET_NAME" -ForegroundColor Green
Write-Host "If view-source still shows SPA shell, attach aws/cloudfront-function-viewer-request-spa-except-legal.js to the distribution (see aws/OAUTH_STATIC_LEGAL_PAGES.txt)." -ForegroundColor Gray

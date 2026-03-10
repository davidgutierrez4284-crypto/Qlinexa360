# Seed de plantillas de formularios especiales en BD de producción
# Requiere: AWS CLI configurado y acceso a RDS (VPN, bastion o RDS público)

$ErrorActionPreference = "Stop"

Write-Host "Cargando plantillas de formularios en BD de produccion..." -ForegroundColor Cyan

$secret = aws secretsmanager get-secret-value `
    --secret-id qlinexa360-prod-database-url `
    --region us-east-2 `
    --query SecretString `
    --output text

if (-not $secret) {
    Write-Host "Error: No se pudo obtener DATABASE_URL de Secrets Manager" -ForegroundColor Red
    exit 1
}

$env:DATABASE_URL = $secret
Push-Location $PSScriptRoot\..\backend
try {
    npm run db:seed:forms
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "`nPlantillas cargadas correctamente. Refresca la pagina de Nueva Consulta." -ForegroundColor Green
} finally {
    Pop-Location
}

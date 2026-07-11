# Qlinexa360 - Despliegue completo a PROD (un solo script)
#
# Uso (desde la raiz del repo):
#   .\scripts\deploy-prod.ps1
#   .\scripts\deploy-prod.ps1 -Force
#   .\scripts\deploy-prod.ps1 -SkipFrontend
#   .\scripts\deploy-prod.ps1 -RunPrismaMigrateLocal
#
# SEGURIDAD DE DATOS (PROD tiene usuarios y pacientes reales):
#   - SOLO ejecuta "prisma migrate deploy" (ALTER/CREATE incremental; no borra filas).
#   - Las migraciones se aplican al arrancar el contenedor ECS (docker-entrypoint.js).
#   - NUNCA ejecuta: db:seed, seed:*, migrate:dev-to-prod, migrate reset, db push --force-reset.
#   - S3 sync del frontend SIN --delete (no borra uploads de usuarios en el bucket).
#
# Requisitos: Docker en ejecucion, AWS CLI configurado, frontend/.env.production

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipEcsUpdate,
    [switch]$RunPrismaMigrateLocal,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Region = "us-east-2"
$Cluster = "qlinexa360-prod-cluster"
$Service = "qlinexa360-prod-backend"
$SecretId = "qlinexa360-prod-database-url"

function Write-Step([string]$Msg) {
    Write-Host ""
    Write-Host ">>> $Msg" -ForegroundColor Yellow
}

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando requerido no encontrado: $Name"
    }
}

Write-Host ""
Write-Host "=== Qlinexa360 - Deploy PROD (incremental, sin borrar datos) ===" -ForegroundColor Cyan
Write-Host "Repo: $Root" -ForegroundColor Gray

Write-Step "Pre-vuelo: herramientas y archivos"
Assert-Command "aws"
Assert-Command "docker"
Assert-Command "npm"
Assert-Command "npx"

$envProd = Join-Path $Root "frontend\.env.production"
if (-not (Test-Path $envProd)) {
    throw "Falta frontend/.env.production (PayPal LIVE, planes _REF, VITE_ENABLE_REFERRALS)."
}

$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
Write-Host "AWS account: $($identity.Account)  user/role: $($identity.Arn)" -ForegroundColor Gray

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker no responde. Inicia Docker Desktop." }

$migrationsDir = Join-Path $Root "backend\prisma\migrations"
$recentMigrations = Get-ChildItem $migrationsDir -Directory | Sort-Object Name | Select-Object -Last 8
Write-Host ""
Write-Host "Ultimas migraciones incluidas en esta imagen:" -ForegroundColor Gray
$recentMigrations | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "Politica de datos PROD:" -ForegroundColor Green
Write-Host "  + prisma migrate deploy (solo esquema incremental)" -ForegroundColor Green
Write-Host "  + build backend + push ECR + ECS rolling update" -ForegroundColor Green
Write-Host "  + build frontend + s3 sync (sin --delete)" -ForegroundColor Green
Write-Host "  - NO seeds, NO migrate:dev-to-prod, NO reset" -ForegroundColor Red

if (-not $Force) {
    Write-Host ""
    $answer = Read-Host "Continuar despliegue a PROD? (escribe SI)"
    if ($answer -ne "SI") {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

if ($RunPrismaMigrateLocal) {
    Write-Step "Prisma migrate deploy (desde tu PC contra RDS PROD)"
    Write-Host "Solo usar si DATABASE_URL alcanza RDS. Si falla, omiti este flag: ECS aplicara migraciones al arrancar." -ForegroundColor Gray
    Push-Location (Join-Path $Root "backend")
    try {
        $secretJson = aws secretsmanager get-secret-value --secret-id $SecretId --region $Region --query SecretString --output text
        if ($LASTEXITCODE -ne 0) { throw "No se pudo leer $SecretId" }
        $env:DATABASE_URL = $secretJson.Trim()
        npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy fallo" }
        Write-Host "Migraciones aplicadas desde local." -ForegroundColor Green
    }
    finally {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
        Pop-Location
    }
}
else {
    Write-Host ""
    Write-Host "Migraciones: se aplicaran al iniciar la nueva tarea ECS (docker-entrypoint.js)." -ForegroundColor Cyan
}

if (-not $SkipBackend) {
    Write-Step "Backend: compilacion TypeScript (validacion local)"
    Push-Location (Join-Path $Root "backend")
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm run build fallo" }
    Pop-Location

    Write-Step "Backend: Docker build + push ECR"
    & (Join-Path $PSScriptRoot "deploy-backend-ecr.ps1")

    if (-not $SkipEcsUpdate) {
        Write-Step "ECS: registrar task definition + despliegue rolling"
        $taskDefPath = (Resolve-Path (Join-Path $Root "aws\ecs-task-def.json")).Path
        $fileUri = "file://" + $taskDefPath.Replace("\", "/")
        $regResult = aws ecs register-task-definition --cli-input-json $fileUri --region $Region | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw "aws ecs register-task-definition fallo" }
        $newTaskDef = $regResult.taskDefinition.taskDefinitionArn
        Write-Host "Task definition registrada: $newTaskDef" -ForegroundColor Gray

        aws ecs update-service `
            --cluster $Cluster `
            --service $Service `
            --task-definition $newTaskDef `
            --force-new-deployment `
            --region $Region | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "aws ecs update-service fallo" }

        Write-Host "Esperando estabilidad del servicio (max ~10 min)..." -ForegroundColor Gray
        aws ecs wait services-stable --cluster $Cluster --services $Service --region $Region
        if ($LASTEXITCODE -ne 0) {
            Write-Host "AVISO: services-stable no confirmo a tiempo. Revisa consola ECS / logs." -ForegroundColor Yellow
        }
        else {
            Write-Host "Servicio ECS estable." -ForegroundColor Green
        }
    }
}

if (-not $SkipFrontend) {
    Write-Step "Frontend: build + S3 + CloudFront"
    & (Join-Path $PSScriptRoot "deploy-frontend-s3.ps1")
}

Write-Step "Verificacion post-deploy"
try {
    $health = Invoke-RestMethod -Uri "https://api.qlinexa360.com/health" -TimeoutSec 45
    Write-Host ($health | ConvertTo-Json -Compress) -ForegroundColor Green
}
catch {
    Write-Host "Health check fallo (revisa ECS si el rollout sigue en curso): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Deploy PROD finalizado ===" -ForegroundColor Green
Write-Host "Verifica manualmente:" -ForegroundColor Gray
Write-Host "  - https://www.qlinexa360.com/login" -ForegroundColor Gray
Write-Host "  - Registro doctor / codigo afiliado si lo probais en caliente" -ForegroundColor Gray
Write-Host "  - Admin Afiliados / Facturacion (nuevas tablas)" -ForegroundColor Gray
Write-Host ""
Write-Host "Datos existentes intactos. Solo se anadieron tablas/columnas via migrate deploy." -ForegroundColor Cyan

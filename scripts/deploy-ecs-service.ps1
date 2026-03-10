# Register ECS task definition and create/update service
# Requires: AWS CLI configured, cluster and ALB target group must exist
# Ajusta las variables segun tu configuracion en AWS

$ErrorActionPreference = "Stop"
$REGION = "us-east-2"
$CLUSTER_NAME = "qlinexa360-prod-cluster"
$SERVICE_NAME = "qlinexa360-prod-backend"
$TASK_FAMILY = "qlinexa360-prod-backend"

# Target group ARN del ALB - OBLIGATORIO: reemplaza con el ARN real
$TARGET_GROUP_ARN = "arn:aws:elasticloadbalancing:us-east-2:268675503474:targetgroup/qlinexa360-prod-tg/XXXX"
# Subnets (privadas) para Fargate - al menos 2, separadas por coma
$SUBNETS = @("subnet-xxx", "subnet-yyy")
# Security group que permite trafico del ALB
$SECURITY_GROUPS = @("sg-xxx")

Write-Host "=== ECS Service Deploy ===" -ForegroundColor Cyan

# 1. Registrar task definition (file:// evita que PowerShell interprete -f, ||, etc. del healthcheck)
# En Windows: file:// con 2 barras + path con forward slashes (file://C:/path/to/file.json)
Write-Host "`nRegistering task definition..." -ForegroundColor Yellow
$taskDefPath = (Resolve-Path "$PSScriptRoot\..\aws\ecs-task-def.json").Path
$fileUri = "file://" + $taskDefPath.Replace("\", "/")
$result = aws ecs register-task-definition --cli-input-json $fileUri --region $REGION
if ($LASTEXITCODE -ne 0) { throw "Task definition registration failed" }
Write-Host "Task definition registered." -ForegroundColor Green

# 2. Crear o actualizar service
Write-Host "`nUpdating service..." -ForegroundColor Yellow
$subnetStr = ($SUBNETS | ForEach-Object { "`"$_`"" }) -join ","
$sgStr = ($SECURITY_GROUPS | ForEach-Object { "`"$_`"" }) -join ","
$netConfig = "awsvpcConfiguration={subnets=[$subnetStr],securityGroups=[$sgStr],assignPublicIp=DISABLED}"
$serviceExists = aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION 2>$null
if ($LASTEXITCODE -eq 0 -and ($serviceExists | ConvertFrom-Json).services.Count -gt 0) {
    aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment --region $REGION
} else {
    aws ecs create-service `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --task-definition $TASK_FAMILY `
        --desired-count 1 `
        --launch-type FARGATE `
        --network-configuration $netConfig `
        --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=qlinexa360-prod-backend,containerPort=3000" `
        --region $REGION
}
if ($LASTEXITCODE -ne 0) { throw "Service update failed" }
Write-Host "`nDone. Service: $SERVICE_NAME on cluster $CLUSTER_NAME" -ForegroundColor Green

# Ayuda para OAuth Mercado Pago en desarrollo con ngrok.
# Uso: .\scripts\mp-dev-ngrok.ps1
#      .\scripts\mp-dev-ngrok.ps1 -NgrokUrl "https://xxxx.ngrok-free.app"

param(
    [string]$NgrokUrl = ""
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $Root "backend\.env"

Write-Host ""
Write-Host "=== Mercado Pago — desarrollo local con ngrok ===" -ForegroundColor Cyan
Write-Host ""

if (-not $NgrokUrl) {
    Write-Host "1. En otra terminal ejecuta:  ngrok http 3000" -ForegroundColor Yellow
    Write-Host "2. Copia la URL HTTPS (Forwarding) y vuelve a correr:" -ForegroundColor Yellow
    Write-Host "   .\scripts\mp-dev-ngrok.ps1 -NgrokUrl `"https://TU-ID.ngrok-free.app`"" -ForegroundColor White
    Write-Host ""
    exit 0
}

$NgrokUrl = $NgrokUrl.Trim().TrimEnd("/")
if (-not $NgrokUrl.StartsWith("https://")) {
    throw "NgrokUrl debe empezar con https://"
}

$Callback = "$NgrokUrl/api/payments/mercadopago/callback"

Write-Host "Redirect URL para Mercado Pago (Editar aplicacion -> Configuracion avanzada):" -ForegroundColor Green
Write-Host "  $Callback" -ForegroundColor White
Write-Host ""
Write-Host "Variables para backend/.env:" -ForegroundColor Green
Write-Host "  MERCADOPAGO_REDIRECT_URI=$Callback"
Write-Host "  BASE_URL=$NgrokUrl"
Write-Host "  FRONTEND_URL=http://localhost:5173"
Write-Host "  MERCADOPAGO_ENV=sandbox"
Write-Host ""
Write-Host "Luego: reinicia backend, abre http://localhost:5173/dashboard/profile y Conectar Mercado Pago" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $EnvFile) {
    $apply = Read-Host "¿Actualizar backend/.env automaticamente? (SI/no)"
    if ($apply -eq "SI") {
        $content = Get-Content $EnvFile -Raw
        function Set-EnvLine([string]$name, [string]$value) {
            $pattern = "(?m)^$name=.*$"
            $line = "$name=$value"
            if ($content -match $pattern) {
                $script:content = $content -replace $pattern, $line
            } else {
                $script:content = $content.TrimEnd() + "`n$line`n"
            }
        }
        Set-EnvLine "MERCADOPAGO_REDIRECT_URI" $Callback
        Set-EnvLine "BASE_URL" $NgrokUrl
        Set-EnvLine "FRONTEND_URL" "http://localhost:5173"
        Set-EnvLine "MERCADOPAGO_ENV" "sandbox"
        Set-Content -Path $EnvFile -Value $content -NoNewline
        Write-Host "backend/.env actualizado." -ForegroundColor Green
    }
}

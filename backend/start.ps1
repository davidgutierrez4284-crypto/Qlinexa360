Write-Host "Verificando puerto 3000..." -ForegroundColor Yellow

# Buscar procesos usando el puerto 3000
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess

if ($processes) {
    Write-Host "Encontrados procesos usando puerto 3000:" -ForegroundColor Red
    foreach ($processId in $processes) {
        try {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            Write-Host "   PID: $processId - Nombre: $($process.ProcessName)" -ForegroundColor Red
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Write-Host "   Proceso terminado" -ForegroundColor Green
        } catch {
            Write-Host "   Error al terminar proceso $processId" -ForegroundColor Red
        }
    }
    Write-Host "Esperando 2 segundos..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
} else {
    Write-Host "Puerto 3000 esta libre" -ForegroundColor Green
}

Write-Host "Iniciando servidor..." -ForegroundColor Green
npm run dev

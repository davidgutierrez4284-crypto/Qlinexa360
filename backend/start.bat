@echo off
echo Liberando puerto 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Terminando proceso PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)
echo Puerto 3000 liberado.
echo Iniciando servidor...
npm run dev

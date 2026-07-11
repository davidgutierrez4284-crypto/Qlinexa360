/**
 * Windows: intenta terminar procesos node.exe cuya línea de comando indique
 * el backend medilink360 (nodemon, ts-node, etc.) para liberar el DLL de Prisma.
 * En Linux/macOS no hace nada.
 */
const { execFileSync } = require('child_process');

function main() {
  if (process.platform !== 'win32') {
    console.log('[prisma-unlock] Omitido (no es Windows).');
    return;
  }

  const ps =
    "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | " +
    "Where-Object { $_.CommandLine -and ($_.CommandLine -like '*medilink360*backend*') } | " +
    "ForEach-Object { Write-Host ('[prisma-unlock] Cerrando PID ' + $_.ProcessId); " +
    "Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; " +
    'Start-Sleep -Seconds 2';

  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      stdio: 'inherit',
      windowsHide: true,
    });
    console.log('[prisma-unlock] Listo.');
  } catch (e) {
    console.warn('[prisma-unlock] Aviso:', (e && e.message) || e);
  }
}

main();

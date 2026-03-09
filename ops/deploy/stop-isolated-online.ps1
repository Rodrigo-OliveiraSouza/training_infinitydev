param(
  [int]$Port = 8300
)

$ErrorActionPreference = 'Stop'

$runtimeDir = Join-Path $PSScriptRoot '.isolated-online'
$backendPidFile = Join-Path $runtimeDir 'backend.pid'
$tunnelPidFile = Join-Path $runtimeDir 'tunnel.pid'

foreach ($pidFile in @($backendPidFile, $tunnelPidFile)) {
  if (-not (Test-Path $pidFile)) {
    continue
  }

  $pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($pidValue)) {
    continue
  }

  $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "Processo finalizado: $($process.ProcessName) ($($process.Id))" -ForegroundColor Green
  }
}

$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "Processo da porta $Port finalizado: $($process.ProcessName) ($($process.Id))" -ForegroundColor Green
  }
}

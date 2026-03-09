param()

$ErrorActionPreference = 'Stop'

$runtimeDir = Join-Path $PSScriptRoot '.training-domain'
$tunnelPidFile = Join-Path $runtimeDir 'tunnel.pid'

if (Test-Path $tunnelPidFile) {
  $pidValue = Get-Content $tunnelPidFile -ErrorAction SilentlyContinue
  if (-not [string]::IsNullOrWhiteSpace($pidValue)) {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $process.Id -Force
      Write-Host "Tunnel finalizado: $($process.ProcessName) ($($process.Id))" -ForegroundColor Green
    }
  }
}

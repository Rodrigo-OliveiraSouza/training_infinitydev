param(
  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$runBackendScript = Join-Path $PSScriptRoot 'run-backend.ps1'
$runTunnelScript = Join-Path $PSScriptRoot 'run-cloudflared.ps1'
if (-not (Test-Path $runBackendScript)) {
  throw "Script nao encontrado: $runBackendScript"
}
if (-not (Test-Path $runTunnelScript)) {
  throw "Script nao encontrado: $runTunnelScript"
}

$startupDir = [Environment]::GetFolderPath('Startup')
$launcherPath = Join-Path $startupDir 'TrainingInfinityDev.cmd'

$launcherContent = @"
@echo off
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$runBackendScript"
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$runTunnelScript"
"@

Set-Content -Path $launcherPath -Value $launcherContent -Encoding ASCII

if ($StartNow) {
  Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runBackendScript) -WindowStyle Minimized
  Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runTunnelScript) -WindowStyle Minimized
}

Write-Host "Inicializacao automatica instalada em: $launcherPath" -ForegroundColor Green

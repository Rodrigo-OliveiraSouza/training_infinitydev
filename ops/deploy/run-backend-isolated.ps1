param(
  [int]$Port = 8300
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $projectRoot 'backend'

if (-not (Test-Path $backendDir)) {
  throw "Diretorio backend nao encontrado: $backendDir"
}

Set-Location $backendDir
$env:PORT = "$Port"

while ($true) {
  Write-Host ("[{0}] Subindo app isolada na porta {1}..." -f (Get-Date -Format 's'), $Port) -ForegroundColor Cyan
  node src/index.js
  $exit = $LASTEXITCODE
  Write-Host ("[{0}] App isolada parou (exit {1}). Reiniciando em 3s." -f (Get-Date -Format 's'), $exit) -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}

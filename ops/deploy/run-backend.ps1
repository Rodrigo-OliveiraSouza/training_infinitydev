param(
  [switch]$InstallDependencies
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $projectRoot 'backend'

if (-not (Test-Path $backendDir)) {
  throw "Diretorio backend nao encontrado: $backendDir"
}

Set-Location $backendDir

if ($InstallDependencies) {
  Write-Host 'Instalando dependencias do backend...' -ForegroundColor Cyan
  npm install --omit=dev --no-audit --no-fund
}

Write-Host 'Aplicando migracoes...' -ForegroundColor Cyan
npm run migrate

Write-Host 'Aplicando seed...' -ForegroundColor Cyan
npm run seed

while ($true) {
  Write-Host ("[{0}] Subindo backend na porta 3000..." -f (Get-Date -Format 's')) -ForegroundColor Cyan
  node src/index.js
  $exit = $LASTEXITCODE
  Write-Host ("[{0}] Backend parou (exit {1}). Reiniciando em 3s." -f (Get-Date -Format 's'), $exit) -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}

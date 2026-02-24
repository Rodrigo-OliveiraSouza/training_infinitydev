param(
  [string]$TunnelName = 'training-infinity-dev',
  [string]$ConfigPath = "$HOME\.cloudflared\config.yml"
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared nao encontrado no PATH.'
}

if (-not (Test-Path $ConfigPath)) {
  throw "Arquivo de config nao encontrado: $ConfigPath"
}

while ($true) {
  Write-Host ("[{0}] Iniciando cloudflared tunnel..." -f (Get-Date -Format 's')) -ForegroundColor Cyan
  cloudflared tunnel --config $ConfigPath run $TunnelName
  $exit = $LASTEXITCODE
  Write-Host ("[{0}] cloudflared parou (exit {1}). Reiniciando em 3s." -f (Get-Date -Format 's'), $exit) -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}

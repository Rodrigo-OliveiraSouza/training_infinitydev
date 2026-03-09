param(
  [int]$Port = 8300,
  [string]$TunnelName = 'training-infinity-site',
  [string]$Hostname = 'training.infinity.dev.br'
)

$ErrorActionPreference = 'Stop'

$cloudflaredDir = Join-Path $PSScriptRoot '.cloudflared-training-site'
$configPath = Join-Path $cloudflaredDir 'config.yml'
$credentialsPath = Join-Path $HOME '.cloudflared\b6b77611-c1ac-49ab-b08b-1b98e1e4c5c4.json'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared nao encontrado no PATH.'
}

if (-not (Test-Path $credentialsPath)) {
  throw "Credenciais do tunnel nao encontradas: $credentialsPath"
}

New-Item -ItemType Directory -Path $cloudflaredDir -Force | Out-Null

$configContent = @"
tunnel: b6b77611-c1ac-49ab-b08b-1b98e1e4c5c4
credentials-file: $credentialsPath

ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$Port
  - service: http_status:404
"@

Set-Content -Path $configPath -Value $configContent -Encoding ASCII

while ($true) {
  Write-Host ("[{0}] Iniciando tunnel nomeado {1} para {2}..." -f (Get-Date -Format 's'), $TunnelName, $Hostname) -ForegroundColor Cyan
  cloudflared tunnel --config $configPath run $TunnelName
  $exit = $LASTEXITCODE
  Write-Host ("[{0}] Tunnel nomeado parou (exit {1}). Reiniciando em 3s." -f (Get-Date -Format 's'), $exit) -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}

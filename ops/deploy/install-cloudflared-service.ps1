param(
  [string]$TokenFile = '.\ops\deploy\.cloudflared-token.txt'
)

$ErrorActionPreference = 'Stop'

function Resolve-Service {
  $candidates = @('cloudflared', 'Cloudflared')
  foreach ($name in $candidates) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($service) {
      return $service
    }
  }
  return $null
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared nao encontrado. Instale e tente novamente.'
}

if (-not (Test-Path $TokenFile)) {
  throw "Arquivo de token nao encontrado: $TokenFile"
}

$token = (Get-Content $TokenFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
  throw 'Token vazio no arquivo informado.'
}

Write-Host 'Instalando servico cloudflared...' -ForegroundColor Cyan
& cloudflared service install $token

$service = Resolve-Service
if (-not $service) {
  throw 'Servico cloudflared nao encontrado apos instalacao.'
}

if ($service.Status -ne 'Running') {
  Start-Service -Name $service.Name
}

Write-Host "Servico cloudflared ativo: $($service.Name)" -ForegroundColor Green

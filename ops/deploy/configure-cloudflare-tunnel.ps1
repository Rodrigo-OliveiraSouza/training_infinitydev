param(
  [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN,
  [string]$Domain = 'infinity.dev.br',
  [string]$Subdomain = 'training',
  [string]$TunnelName = 'training-infinity-dev',
  [string]$OriginUrl = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-CfApi {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE')][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null,
    [hashtable]$Headers
  )

  $uri = "https://api.cloudflare.com/client/v4$Path"
  if ($null -ne $Body) {
    $payload = $Body | ConvertTo-Json -Depth 50 -Compress
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -Body $payload
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
}

if ([string]::IsNullOrWhiteSpace($ApiToken)) {
  throw 'Defina CLOUDFLARE_API_TOKEN ou passe -ApiToken.'
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared nao encontrado. Instale e tente novamente.'
}

$hostname = "$Subdomain.$Domain"
$headers = @{
  Authorization = "Bearer $ApiToken"
  'Content-Type' = 'application/json'
}

Write-Step "Buscando zona DNS para $Domain"
$zoneResponse = Invoke-CfApi -Method 'GET' -Path "/zones?name=$Domain&status=active&per_page=1&page=1" -Headers $headers
if (-not $zoneResponse.success -or $zoneResponse.result.Count -eq 0) {
  throw "Zona '$Domain' nao encontrada para o token informado."
}
$zone = $zoneResponse.result[0]
$zoneId = $zone.id
$accountId = $zone.account.id
if ([string]::IsNullOrWhiteSpace($accountId)) {
  throw 'Nao foi possivel identificar account_id pela zona.'
}

Write-Step "Procurando tunnel '$TunnelName'"
$tunnelListResponse = Invoke-CfApi -Method 'GET' -Path "/accounts/$accountId/cfd_tunnel?is_deleted=false&per_page=1000&page=1" -Headers $headers
if (-not $tunnelListResponse.success) {
  throw 'Falha ao listar tunnels.'
}
$tunnel = $tunnelListResponse.result | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1

if (-not $tunnel) {
  Write-Step 'Criando tunnel novo'
  $secretBytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($secretBytes)
  $rng.Dispose()
  $secret = [Convert]::ToBase64String($secretBytes)

  $createBody = @{
    name = $TunnelName
    config_src = 'cloudflare'
    tunnel_secret = $secret
  }

  $createResponse = Invoke-CfApi -Method 'POST' -Path "/accounts/$accountId/cfd_tunnel" -Body $createBody -Headers $headers
  if (-not $createResponse.success) {
    throw 'Falha ao criar tunnel.'
  }
  $tunnel = $createResponse.result
}

$tunnelId = $tunnel.id
if ([string]::IsNullOrWhiteSpace($tunnelId)) {
  throw 'Tunnel ID invalido.'
}

Write-Step "Aplicando configuracao de ingress para $hostname -> $OriginUrl"
$configBody = @{
  config = @{
    ingress = @(
      @{
        hostname = $hostname
        service = $OriginUrl
      },
      @{
        service = 'http_status:404'
      }
    )
  }
}

$configResponse = Invoke-CfApi -Method 'PUT' -Path "/accounts/$accountId/cfd_tunnel/$tunnelId/configurations" -Body $configBody -Headers $headers
if (-not $configResponse.success) {
  throw 'Falha ao configurar ingress do tunnel.'
}

Write-Step "Ajustando DNS CNAME $hostname -> $tunnelId.cfargotunnel.com"
$dnsResponse = Invoke-CfApi -Method 'GET' -Path "/zones/$zoneId/dns_records?name=$hostname&per_page=100&page=1" -Headers $headers
if (-not $dnsResponse.success) {
  throw 'Falha ao consultar DNS.'
}

$dnsBody = @{
  type = 'CNAME'
  name = $hostname
  content = "$tunnelId.cfargotunnel.com"
  proxied = $true
  ttl = 1
}

if ($dnsResponse.result.Count -eq 0) {
  $dnsCreateResponse = Invoke-CfApi -Method 'POST' -Path "/zones/$zoneId/dns_records" -Body $dnsBody -Headers $headers
  if (-not $dnsCreateResponse.success) {
    throw 'Falha ao criar registro DNS.'
  }
} else {
  $first = $dnsResponse.result[0]
  $dnsUpdateResponse = Invoke-CfApi -Method 'PUT' -Path "/zones/$zoneId/dns_records/$($first.id)" -Body $dnsBody -Headers $headers
  if (-not $dnsUpdateResponse.success) {
    throw 'Falha ao atualizar registro DNS.'
  }

  $extraRecords = $dnsResponse.result | Select-Object -Skip 1
  foreach ($record in $extraRecords) {
    [void](Invoke-CfApi -Method 'DELETE' -Path "/zones/$zoneId/dns_records/$($record.id)" -Headers $headers)
  }
}

Write-Step 'Solicitando token do tunnel'
$tokenResponse = Invoke-CfApi -Method 'GET' -Path "/accounts/$accountId/cfd_tunnel/$tunnelId/token" -Headers $headers
if (-not $tokenResponse.success) {
  throw 'Falha ao obter token do tunnel.'
}

$tunnelToken = $tokenResponse.result
if ($tunnelToken -isnot [string]) {
  if ($tunnelToken.token) {
    $tunnelToken = $tunnelToken.token
  } else {
    throw 'Formato inesperado de token retornado pela API.'
  }
}

$tokenPath = Join-Path $PSScriptRoot '.cloudflared-token.txt'
Set-Content -Path $tokenPath -Value $tunnelToken -Encoding ASCII -NoNewline

Write-Host ''
Write-Host 'Cloudflare configurado com sucesso:' -ForegroundColor Green
Write-Host "Hostname : $hostname"
Write-Host "Tunnel ID: $tunnelId"
Write-Host "Token    : salvo em $tokenPath"
Write-Host ''
Write-Host 'Proximo passo para publicar de forma persistente:'
Write-Host ".\\ops\\deploy\\install-cloudflared-service.ps1"

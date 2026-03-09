param(
  [int]$Port = 8300
)

$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
  return Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

function Wait-HttpOk {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 750
      continue
    }
  }
  return $false
}

function Wait-QuickTunnelUrl {
  param(
    [Parameter(Mandatory = $true)][string[]]$Files,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $pattern = 'https://[-a-z0-9]+\.trycloudflare\.com'

  while ((Get-Date) -lt $deadline) {
    foreach ($file in $Files) {
      if (-not (Test-Path $file)) {
        continue
      }

      $match = Select-String -Path $file -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue
      if ($match) {
        return $match.Matches[0].Value
      }
    }
    Start-Sleep -Milliseconds 750
  }

  return $null
}

$projectRoot = Get-ProjectRoot
$runBackendScript = Join-Path $PSScriptRoot 'run-backend-isolated.ps1'
$runtimeDir = Join-Path $PSScriptRoot '.isolated-online'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared nao encontrado no PATH.'
}

if (-not (Test-Path $runBackendScript)) {
  throw "Script nao encontrado: $runBackendScript"
}

$existingPort = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingPort) {
  throw "A porta $Port ja esta em uso pelo PID $($existingPort.OwningProcess)."
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$backendOut = Join-Path $runtimeDir 'backend.out.log'
$backendErr = Join-Path $runtimeDir 'backend.err.log'
$tunnelOut = Join-Path $runtimeDir 'tunnel.out.log'
$tunnelErr = Join-Path $runtimeDir 'tunnel.err.log'
$backendPidFile = Join-Path $runtimeDir 'backend.pid'
$tunnelPidFile = Join-Path $runtimeDir 'tunnel.pid'
$publicUrlFile = Join-Path $runtimeDir 'public-url.txt'
$cloudflaredHome = Join-Path $runtimeDir 'cloudflared-home'

Remove-Item $backendOut, $backendErr, $tunnelOut, $tunnelErr, $publicUrlFile -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $cloudflaredHome '.cloudflared') -Force | Out-Null

$backend = Start-Process powershell.exe `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runBackendScript, '-Port', $Port) `
  -WorkingDirectory $projectRoot `
  -WindowStyle Minimized `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -PassThru

Set-Content -Path $backendPidFile -Value $backend.Id -Encoding ASCII -NoNewline

if (-not (Wait-HttpOk -Url "http://127.0.0.1:$Port/api/health" -TimeoutSeconds 30)) {
  throw "Backend nao respondeu em http://127.0.0.1:$Port/api/health"
}

$tunnelCommand = @'
$env:HOME = '{0}'
$env:USERPROFILE = '{0}'
cloudflared tunnel --url http://127.0.0.1:{1}
'@ -f $cloudflaredHome, $Port

$tunnel = Start-Process powershell.exe `
  -ArgumentList @('-NoProfile', '-Command', $tunnelCommand) `
  -WorkingDirectory $projectRoot `
  -WindowStyle Minimized `
  -RedirectStandardOutput $tunnelOut `
  -RedirectStandardError $tunnelErr `
  -PassThru

Set-Content -Path $tunnelPidFile -Value $tunnel.Id -Encoding ASCII -NoNewline

$publicUrl = Wait-QuickTunnelUrl -Files @($tunnelOut, $tunnelErr) -TimeoutSeconds 45
if (-not $publicUrl) {
  throw "Quick tunnel nao informou URL publica. Veja logs em $runtimeDir"
}

Set-Content -Path $publicUrlFile -Value $publicUrl -Encoding ASCII -NoNewline

Write-Host "Backend PID : $($backend.Id)" -ForegroundColor Green
Write-Host "Tunnel PID  : $($tunnel.Id)" -ForegroundColor Green
Write-Host "Local       : http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Publico     : $publicUrl" -ForegroundColor Green
Write-Host "API Health  : $publicUrl/api/health" -ForegroundColor Green

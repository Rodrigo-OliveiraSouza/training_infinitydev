param(
  [int]$Port = 8300
)

$ErrorActionPreference = 'Stop'

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

$runtimeDir = Join-Path $PSScriptRoot '.training-domain'
$runTunnelScript = Join-Path $PSScriptRoot 'run-cloudflared-training-site.ps1'
$tunnelOut = Join-Path $runtimeDir 'tunnel.out.log'
$tunnelErr = Join-Path $runtimeDir 'tunnel.err.log'
$tunnelPidFile = Join-Path $runtimeDir 'tunnel.pid'

if (-not (Test-Path $runTunnelScript)) {
  throw "Script nao encontrado: $runTunnelScript"
}

if (-not (Wait-HttpOk -Url "http://127.0.0.1:$Port/api/health" -TimeoutSeconds 30)) {
  throw "Backend nao respondeu em http://127.0.0.1:$Port/api/health"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Remove-Item $tunnelOut, $tunnelErr -Force -ErrorAction SilentlyContinue

$tunnel = Start-Process powershell.exe `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runTunnelScript, '-Port', $Port) `
  -WorkingDirectory (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) `
  -WindowStyle Minimized `
  -RedirectStandardOutput $tunnelOut `
  -RedirectStandardError $tunnelErr `
  -PassThru

Set-Content -Path $tunnelPidFile -Value $tunnel.Id -Encoding ASCII -NoNewline

Write-Host "Tunnel PID  : $($tunnel.Id)" -ForegroundColor Green
Write-Host "Hostname    : https://training.infinity.dev.br/" -ForegroundColor Green

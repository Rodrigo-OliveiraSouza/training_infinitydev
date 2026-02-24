param(
  [string]$Hostname = 'training.infinity.dev.br'
)

$ErrorActionPreference = 'Stop'

function Check-Url {
  param([string]$Url)

  try {
    $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    return @{
      ok = $true
      status = $res.StatusCode
      body = $res.Content
    }
  } catch {
    return @{
      ok = $false
      status = $null
      body = $_.Exception.Message
    }
  }
}

$local = Check-Url -Url 'http://127.0.0.1:3000/api/health'
$public = Check-Url -Url "https://$Hostname/api/health"

Write-Host 'Local   : ' -NoNewline
if ($local.ok) {
  Write-Host "OK ($($local.status))" -ForegroundColor Green
} else {
  Write-Host "FALHA ($($local.body))" -ForegroundColor Red
}

Write-Host 'Publico : ' -NoNewline
if ($public.ok) {
  Write-Host "OK ($($public.status))" -ForegroundColor Green
} else {
  Write-Host "FALHA ($($public.body))" -ForegroundColor Red
}

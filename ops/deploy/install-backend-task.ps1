param(
  [string]$TaskName = 'TrainingInfinityDevBackend',
  [switch]$StartNow,
  [switch]$UseCurrentUser
)

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'run-backend.ps1'
if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$taskTrigger = if ($UseCurrentUser) { New-ScheduledTaskTrigger -AtLogOn } else { New-ScheduledTaskTrigger -AtStartup }
$taskPrincipal = if ($UseCurrentUser) {
  $userId = "$env:USERDOMAIN\$env:USERNAME"
  New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
} else {
  New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
}
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

try {
  Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings | Out-Null
} catch {
  if (-not $UseCurrentUser) {
    throw "Falha sem permissao de admin. Execute novamente com -UseCurrentUser para registrar no contexto do usuario atual."
  }
  throw
}

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
}

if ($UseCurrentUser) {
  Write-Host "Task '$TaskName' criada para usuario atual (inicia no logon)." -ForegroundColor Green
} else {
  Write-Host "Task '$TaskName' criada no boot do sistema." -ForegroundColor Green
}

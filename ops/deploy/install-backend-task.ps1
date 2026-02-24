param(
  [string]$TaskName = 'TrainingInfinityDevBackend',
  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'run-backend.ps1'
if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings | Out-Null

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
}

Write-Host "Task '$TaskName' criada com sucesso." -ForegroundColor Green

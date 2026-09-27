param(
  [string]$InstallDir = "C:\gwar\laya-server",
  [int]$Port = 8787,
  [string]$CascadeKey = "",
  [double]$Threshold = 0.8
)
$ErrorActionPreference = "Stop"

function Need-Node {
  $v = (& node --version) 2>$null
  if (-not $v) { return $true }
  $parts = $v.TrimStart("v").Split(".")
  return ([int]$parts[0] -lt 20) -or (([int]$parts[0] -eq 20) -and ([int]$parts[1] -lt 6))
}

if (Need-Node) {
  Write-Host "Instalando Node.js LTS..."
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$zip = Join-Path $env:TEMP "laya-server.zip"
Invoke-WebRequest -Uri "https://github.com/criguex/laya-server/archive/refs/heads/main.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $env:TEMP -Force
Copy-Item -Path (Join-Path $env:TEMP "laya-server-main\*") -Destination $InstallDir -Recurse -Force
Set-Location $InstallDir
npm install --omit=dev

$envFile = Join-Path $InstallDir ".env"
if (-not (Test-Path $envFile)) {
  $token = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
  $lines = @("HOST=0.0.0.0", "PORT=$Port", "LAYA_TOKEN=$token", "CASCADE_THRESHOLD=$Threshold", "MAX_LOCAL_CHARS=1500")
  if ($CascadeKey) { $lines += @("CASCADE_URL=https://ai-gateway.vercel.sh/typesafe/v1/systemone", "CASCADE_KEY=$CascadeKey") }
  Set-Content -Path $envFile -Value $lines -Encoding ascii
}

$run = Join-Path $InstallDir "run.cmd"
Set-Content -Path $run -Encoding ascii -Value @(
  "@echo off",
  "cd /d $InstallDir",
  "node --env-file=.env src\server.mjs >> laya-server.log 2>&1"
)

$ruleName = "laya-server (Tailscale only)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -RemoteAddress "100.64.0.0/10" -Action Allow | Out-Null
}

$task = "laya-server"
Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$run`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest | Out-Null
Start-ScheduledTask -TaskName $task

Write-Host "Esperando el modelo (la primera vez descarga ~1.7 GB)..."
for ($i = 0; $i -lt 180; $i++) {
  try { $h = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 2; break } catch { Start-Sleep -Seconds 5 }
}
if ($h) {
  Write-Host "OK laya-server en http://$((Get-NetIPAddress -InterfaceAlias 'Tailscale*' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress):$Port"
  Write-Host "Token (LAYA_TOKEN) guardado en $envFile"
} else {
  Write-Host "No respondio todavia. Revisa $InstallDir\laya-server.log"
}

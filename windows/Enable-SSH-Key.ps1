param([Parameter(Mandatory=$true)][string]$PublicKey)
$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
  $file = "C:\ProgramData\ssh\administrators_authorized_keys"
  Add-Content -Path $file -Value $PublicKey
  icacls $file /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F" | Out-Null
} else {
  $dir = Join-Path $env:USERPROFILE ".ssh"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Add-Content -Path (Join-Path $dir "authorized_keys") -Value $PublicKey
}
Restart-Service sshd
Write-Host "Llave agregada para $env:USERNAME"

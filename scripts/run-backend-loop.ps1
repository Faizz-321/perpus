param(
    [string]$NodeExe,
    [string]$BackendDir,
    [string]$LogFile,
    [string]$PidFile,
    [string]$StopFlag
)

$ErrorActionPreference = "Continue"
$PID | Set-Content -Path $PidFile -Force
Set-Location $BackendDir

while (-not (Test-Path $StopFlag)) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] Menjalankan Backend API (server.js) di port 5000..."
    & $NodeExe "server.js" *>> $LogFile
    if (Test-Path $StopFlag) { break }
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] Backend berhenti. Menyalakan ulang otomatis dalam 3 detik..."
    Start-Sleep -Seconds 3
}


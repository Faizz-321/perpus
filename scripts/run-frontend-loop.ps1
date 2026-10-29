param(
    [string]$NodeExe,
    [string]$RootDir,
    [string]$LogFile,
    [string]$PidFile,
    [string]$StopFlag
)

$ErrorActionPreference = "Continue"
$PID | Set-Content -Path $PidFile -Force
Set-Location $RootDir
$ViteBin = Join-Path $RootDir "node_modules\vite\bin\vite.js"

while (-not (Test-Path $StopFlag)) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] Menjalankan Frontend Vite di port 5173..."
    & $NodeExe $ViteBin "--host" "--port" "5173" "--strictPort" *>> $LogFile
    if (Test-Path $StopFlag) { break }
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] Frontend berhenti. Menyalakan ulang otomatis dalam 3 detik..."
    Start-Sleep -Seconds 3
}


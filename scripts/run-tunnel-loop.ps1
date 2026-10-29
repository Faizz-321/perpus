param(
    [string]$CloudflaredExe,
    [string]$Mode,
    [string]$ArgValue,
    [string]$LogFile,
    [string]$PidFile,
    [string]$StopFlag
)

$ErrorActionPreference = "Continue"
$PID | Set-Content -Path $PidFile -Force

while (-not (Test-Path $StopFlag)) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] Menjalankan Cloudflare Tunnel ($Mode)..."
    if ($Mode -eq "token") {
        & $CloudflaredExe "tunnel" "run" "--token" $ArgValue *>> $LogFile
    } elseif ($Mode -eq "config") {
        & $CloudflaredExe "--config" $ArgValue "tunnel" "run" *>> $LogFile
    } else {
        & $CloudflaredExe "tunnel" "run" *>> $LogFile
    }
    if (Test-Path $StopFlag) { break }
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] Cloudflare Tunnel berhenti. Menyalakan ulang dalam 5 detik..."
    Start-Sleep -Seconds 5
}


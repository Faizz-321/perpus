@echo off
cd /d "%~dp0"
echo ========================================================
echo   SETUP AUTO-START SERVER WEBSITE PERPUSTAKAAN PAREPARE
echo ========================================================

REM 0. Otomatis install library jika baru saja git clone di PC baru
if not exist "%~dp0node_modules" (
    echo [..] Menginstal paket Frontend ^(npm install^)...
    call npm install
)
if not exist "%~dp0backend\node_modules" (
    echo [..] Menginstal paket Backend ^(npm install^)...
    pushd "%~dp0backend"
    call npm install
    popd
)

REM 1. Daftarkan Startup User & nyalakan semua layanan sekarang juga
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action autostart-user

REM 2. Daftarkan Task Scheduler ONSTART (agar jalan otomatis walau belum login Windows)
net session >nul 2>&1
if %errorLevel% == 0 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action autostart-system
) else (
    echo.
    echo Meminta izin Administrator untuk mendaftarkan Task Scheduler ^(ONSTART^)...
    powershell.exe -NoProfile -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\server-manager.ps1\" -Action autostart-system' -Verb RunAs -Wait"
)

echo.
echo Selesai! Sekarang setiap kali PC/Server mati lalu menyala kembali,
echo MySQL + Backend + Frontend + Cloudflare Tunnel akan menyala otomatis.
pause

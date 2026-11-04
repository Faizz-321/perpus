@echo off
cd /d "%~dp0"
echo Menghapus Auto-Start dan menghentikan server di PC ini...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action remove-autostart
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    powershell.exe -NoProfile -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\server-manager.ps1\" -Action remove-autostart' -Verb RunAs -Wait"
)
echo Selesai! PC ini tidak lagi menjalankan server otomatis.
pause

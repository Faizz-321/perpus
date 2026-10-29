@echo off
cd /d "%~dp0"
echo Menghapus Auto-Start dan menghentikan server di PC ini...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action stop
net session >nul 2>&1
if %errorLevel% == 0 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action remove-autostart
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action remove-autostart
    powershell.exe -NoProfile -Command "Start-Process schtasks.exe -ArgumentList '/Delete /TN PerpustakaanParepareServer /F' -Verb RunAs -Wait"
)
echo Selesai! PC ini tidak lagi menjalankan server otomatis.
pause


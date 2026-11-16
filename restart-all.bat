@echo off
cd /d "%~dp0"
echo Menghentikan seluruh server lama...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action stop
timeout /t 2 /nobreak >nul
echo Menyalakan ulang server dengan kode terbaru...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action start
echo.
echo Server berhasil di-restart!
pause


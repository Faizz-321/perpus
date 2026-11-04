@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action stop
netstat -ano | findstr ":5000 :5173" | findstr "LISTENING" >nul 2>&1
if %errorLevel% == 0 goto :elevate
tasklist /FI "IMAGENAME eq cloudflared.exe" | find /I "cloudflared.exe" >nul 2>&1
if %errorLevel% == 0 goto :elevate
goto :done

:elevate
echo Meminta izin Administrator untuk menghentikan proses server yang berjalan sebagai Admin...
powershell.exe -NoProfile -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\server-manager.ps1\" -Action stop' -Verb RunAs -Wait"

:done

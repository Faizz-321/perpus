@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server-manager.ps1" -Action stop


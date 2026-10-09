@echo off
powershell.exe -NoProfile -STA -ExecutionPolicy RemoteSigned -File "%~dp0Setup.ps1"
if errorlevel 1 pause

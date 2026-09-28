@echo off
chcp 65001 >nul
echo Deteniendo Actividapp...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3100 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo Actividapp detenido.
timeout /t 2 >nul

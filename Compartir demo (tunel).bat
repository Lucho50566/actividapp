@echo off
chcp 65001 >nul
title Actividapp - Demo publica (link para compartir)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Falta Node.js. Instalalo desde https://nodejs.org y volve a intentar.
  echo.
  pause
  exit /b 1
)
if not exist "web\dist\index.html" (
  echo  Primera vez: instalando y compilando (puede tardar unos minutos)...
  call Instalar.bat
)
echo.
echo  ============================================================
echo   ACTIVIDAPP - DEMO PUBLICA (link para pasar por WhatsApp)
echo  ============================================================
echo.
echo  Paso 1: levantando el servidor local (puerto 3100)...
powershell -NoProfile -Command "if(-not (Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue)){ Start-Process cmd -ArgumentList '/c','npm start' -WorkingDirectory '%CD%' -WindowStyle Hidden }" >nul 2>nul
timeout /t 4 >nul

echo  Paso 2: abriendo el tunel publico con Cloudflare...
echo.
echo  >>> Cuando abajo aparezca una linea como:
echo          https://algo-aleatorio.trycloudflare.com
echo      ESE es tu LINK para compartir (copialo y mandalo).
echo.
echo  Deja ESTA VENTANA ABIERTA mientras la demo este en uso.
echo  Para cerrar la demo: cerra esta ventana (o Ctrl+C).
echo  ============================================================
echo.

"%~dp0cloudflared.exe" tunnel --url http://localhost:3100 --no-autoupdate

echo.
echo  La demo se cerro.
pause

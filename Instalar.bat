@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Actividapp - Instalacion (primera vez)
echo ============================================
echo.
echo [1/2] Instalando dependencias...
call npm install
if errorlevel 1 goto err
echo.
echo [2/2] Compilando la aplicacion...
call npm run build
if errorlevel 1 goto err
echo.
echo  Listo. Ya podes abrir Actividapp con el acceso directo.
echo.
pause
exit /b 0
:err
echo.
echo  Hubo un error. Revisa que Node.js este instalado (node -v).
echo.
pause
exit /b 1

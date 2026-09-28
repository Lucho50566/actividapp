@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Creando acceso directo en el Escritorio...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Actividapp.lnk');" ^
  "$lnk.TargetPath = 'C:\Windows\System32\wscript.exe';" ^
  "$lnk.Arguments = '\"%~dp0Actividapp.vbs\"';" ^
  "$lnk.WorkingDirectory = '%~dp0';" ^
  "$lnk.IconLocation = '%~dp0app.ico';" ^
  "$lnk.Description = 'Actividapp - resolver actividades';" ^
  "$lnk.Save()"
echo.
echo  Listo: tenes "Actividapp" en el Escritorio. Doble clic y se abre como app.
echo.
pause

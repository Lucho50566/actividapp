' ===== Actividapp - Lanzador tipo app (Windows) =====
' Doble clic: arranca el servidor (oculto) y abre Actividapp en una
' ventana de app (sin barra del navegador). Si ya estaba corriendo, solo abre.
Option Explicit
Dim shell, fso, appDir, url, i
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
' Usamos 127.0.0.1 (IPv4) y no "localhost": en Windows localhost puede
' resolver a IPv6 (::1) y el servidor escucha en IPv4, lo que daría error.
url = "http://127.0.0.1:3100"
shell.CurrentDirectory = appDir

' Primera vez: si falta la compilación, instalar y compilar (visible).
If Not fso.FileExists(appDir & "\web\dist\index.html") Then
  MsgBox "Primera vez: voy a instalar y compilar Actividapp." & vbCrLf & _
         "Puede tardar unos minutos. Se abrirá una ventana de progreso.", 64, "Actividapp"
  shell.Run "cmd /c """ & appDir & "\Instalar.bat""", 1, True
End If

' Iniciar el servidor si no está activo (ventana oculta).
If Not IsUp() Then
  shell.Run "cmd /c npm start", 0, False
  For i = 1 To 90
    WScript.Sleep 500
    If IsUp() Then Exit For
  Next
End If

' Abrir en modo app (ventana propia, sin barra del navegador).
Dim edge, edge2, chrome, browser, udd
edge   = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
edge2  = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
browser = ""
If fso.FileExists(edge) Then
  browser = edge
ElseIf fso.FileExists(edge2) Then
  browser = edge2
ElseIf fso.FileExists(chrome) Then
  browser = chrome
End If

udd = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\ActividappApp"

If browser <> "" Then
  shell.Run """" & browser & """ --app=" & url & " --user-data-dir=""" & udd & """", 1, False
Else
  ' Sin navegador Chromium: abrir en el navegador por defecto.
  shell.Run url, 1, False
End If

' --- Devuelve True si el servidor responde ---
Function IsUp()
  On Error Resume Next
  Dim h
  Set h = CreateObject("MSXML2.XMLHTTP")
  h.Open "GET", url & "/api/health", False
  h.Send
  IsUp = (Err.Number = 0) And (h.Status = 200)
  On Error GoTo 0
End Function

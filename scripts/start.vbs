Set FSO = CreateObject("Scripting.FileSystemObject")
strFolder = FSO.GetParentFolderName(WScript.ScriptFullName)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = strFolder

' Önce 3000 portunda çalışan varsa kapat
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -aon ^| findstr "":3000"" ^| findstr ""LISTENING""') do taskkill /PID %a /F", 0, True

' Sunucuyu başlat (pencere gösterme)
WshShell.Run "cmd /c node src\server.js", 0, False

Set FSO = CreateObject("Scripting.FileSystemObject")
strFolder = FSO.GetParentFolderName(WScript.ScriptFullName)

Set WshShell = CreateObject("WScript.Shell")

' Masaüstü kısayolu
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShortcut = WshShell.CreateShortcut(strDesktop & "\Eczane App.lnk")
oShortcut.TargetPath = strFolder & "\start.vbs"
oShortcut.WorkingDirectory = strFolder
oShortcut.Description = "Eczane Ilac Fiyat Karsilastirma"
oShortcut.IconLocation = "shell32.dll,172"
oShortcut.Save

' Startup kısayolu
strStartup = WshShell.SpecialFolders("Startup")
Set oStartup = WshShell.CreateShortcut(strStartup & "\Eczane App.lnk")
oStartup.TargetPath = strFolder & "\start.vbs"
oStartup.WorkingDirectory = strFolder
oStartup.Description = "Eczane App Otomatik Baslat"
oStartup.IconLocation = "shell32.dll,172"
oStartup.Save

WScript.Echo "Kisayollar olusturuldu!"

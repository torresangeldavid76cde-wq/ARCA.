Option Explicit
Dim shell, files, root, command, result
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
command = Chr(34) & "C:\Program Files\nodejs\node.exe" & Chr(34) & " " & Chr(34) & root & "\server\desktop.js" & Chr(34)
result = shell.Run(command, 0, True)
If result <> 0 Then
  MsgBox "No se pudo abrir ARCA. Consulta runtime\desktop-error.log dentro de la carpeta del proyecto.", 48, "ARCA"
End If

$ErrorActionPreference='Stop'
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=$OutputEncoding
Add-Type -AssemblyName System.Windows.Forms
$dialog=New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description='选择 Steam 库、Wallpaper Engine 安装目录或壁纸图库'
$dialog.ShowNewFolderButton=$false
try{if($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){[pscustomobject]@{path=$dialog.SelectedPath}|ConvertTo-Json -Compress}else{'{"cancelled":true}'}}finally{$dialog.Dispose()}

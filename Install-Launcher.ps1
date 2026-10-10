param([string[]]$DestinationDirectories=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs')))
$ErrorActionPreference='Stop'
$shell=New-Object -ComObject WScript.Shell
foreach($directory in $DestinationDirectories){
  if(-not [IO.Path]::IsPathRooted($directory)){throw 'Shortcut destination must be absolute'}
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $file=Join-Path $directory 'Codex（自动换肤）.lnk'
  if((Test-Path -LiteralPath $file) -and -not(Test-Path -LiteralPath ($file+'.before-wallpaper'))){Copy-Item -LiteralPath $file -Destination ($file+'.before-wallpaper')}
  $link=$shell.CreateShortcut($file)
  $link.TargetPath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $link.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+(Join-Path $PSScriptRoot 'Start-Desktop.ps1')+'"'
  $link.WorkingDirectory=$PSScriptRoot;$link.Description='打开 Codex 并自动加载壁纸与外观设置'
  $package=Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if($package){$icon=Join-Path $package.InstallLocation 'app\ChatGPT.exe';if(Test-Path -LiteralPath $icon){$link.IconLocation=$icon+',0'}}
  $link.Save()
  $readback=$shell.CreateShortcut($file)
  if($readback.Arguments -ne $link.Arguments -or $readback.TargetPath -ne $link.TargetPath){throw 'Shortcut verification failed'}
  Write-Output $file
}
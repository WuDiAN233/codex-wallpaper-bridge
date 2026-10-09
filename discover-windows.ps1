$ErrorActionPreference='Stop'
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=$OutputEncoding
$steam=@();$engines=@()
foreach($key in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam')){
  if(Test-Path -LiteralPath $key){$entry=Get-ItemProperty -LiteralPath $key;foreach($name in @('SteamPath','InstallPath')){if($entry.$name){$steam+=[string]$entry.$name}}}
}
foreach($base in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall')){
  $key=Join-Path $base 'Steam App 431960'
  if(Test-Path -LiteralPath $key){$entry=Get-ItemProperty -LiteralPath $key;if($entry.InstallLocation){$engines+=[string]$entry.InstallLocation}}
}
foreach($base in @(${env:ProgramFiles(x86)},$env:ProgramFiles)){if($base){$candidate=Join-Path $base 'Steam';if(Test-Path -LiteralPath $candidate -PathType Container){$steam+=$candidate}}}
foreach($name in @('wallpaper64','wallpaper32')){
  foreach($process in @(Get-Process -Name $name -ErrorAction SilentlyContinue)){
    if($process.Path){$engines+=Split-Path -Parent $process.Path}
  }
}
[pscustomobject]@{steamRoots=@($steam|Select-Object -Unique);wallpaperEngineDirectories=@($engines|Select-Object -Unique)}|ConvertTo-Json -Compress

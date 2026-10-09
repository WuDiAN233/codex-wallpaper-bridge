param([switch]$RestartExisting)
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath
$root=Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$engine=Join-Path $root 'engine'
if(-not(Test-Path -LiteralPath (Join-Path $engine 'runtime\node\node.exe'))){throw 'Run Setup.cmd first to install the required wallpaper engine helper.'}
$pidFile=Join-Path $PSScriptRoot 'picker.pid'
if(Test-Path -LiteralPath $pidFile){
  $savedPid=0
  if([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(),[ref]$savedPid)){
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid"
    $bridgePath=Join-Path $PSScriptRoot 'bridge.mjs'
    if($process -and $process.CommandLine -and $process.CommandLine.Contains($bridgePath)){Write-Output 'Wallpaper Bridge is already running.';return}
  }
  Remove-Item -LiteralPath $pidFile -Force
}
& (Join-Path $PSScriptRoot 'Apply-Compatibility.ps1')
if(-not $?){throw 'Compatibility check failed; the picker was not launched.'}
$parameters=@{}
if($RestartExisting){$parameters.RestartExisting=$true}
& (Join-Path $engine 'scripts\start-dream-skin.ps1') @parameters
if(-not $?){throw 'Codex skin startup failed; picker was not launched.'}
$node=Join-Path $engine 'runtime\node\node.exe'
Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $PSScriptRoot 'bridge.mjs')+'"') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'bridge.log') -RedirectStandardError (Join-Path $PSScriptRoot 'bridge-error.log') | Out-Null

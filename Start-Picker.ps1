param([switch]$RestartExisting)
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath
$root=Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$engine=Join-Path $root 'engine'
if(-not(Test-Path -LiteralPath (Join-Path $engine 'runtime\node\node.exe'))){throw 'Run Setup.cmd first.'}
$mutex=New-Object Threading.Mutex($false,'Local\CodexWallpaperBridgeLaunch')
$owned=$false
try {
  try{$owned=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owned=$true}
  if(-not $owned){Write-Output 'Wallpaper startup is already in progress.';return}
  $pidFile=Join-Path $PSScriptRoot 'picker.pid'
  $bridgePath=Join-Path $PSScriptRoot 'bridge.mjs'
  $existing=$null;$oldBrowser=$null
  if(Test-Path -LiteralPath $pidFile){
    $savedPid=0
    if([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(),[ref]$savedPid)){
      $candidate=Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid"
      if($candidate -and $candidate.CommandLine -and $candidate.CommandLine.Contains($bridgePath)){$existing=$candidate}
    }
    if(-not $existing){Remove-Item -LiteralPath $pidFile}
  }
  $stateFile=Join-Path $root 'state.json'
  if(Test-Path -LiteralPath $stateFile){$oldBrowser=(Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json).browserId}
  # Always validate/start the skin: a live bridge PID does not prove the app or
  # injector survived an update. The upstream launcher discovers current packages.
  & (Join-Path $PSScriptRoot 'Apply-Compatibility.ps1')
  if(-not $?){throw 'Compatibility check failed.'}
  $parameters=@{}
  if($RestartExisting){$parameters.RestartExisting=$true}
  & (Join-Path $engine 'scripts\start-dream-skin.ps1') @parameters
  if(-not $?){throw 'Codex skin startup failed.'}
  $newState=Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json
  if($existing){
    $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($existing.ProcessId)"
    if($current -and $current.CreationDate -eq $existing.CreationDate -and $current.CommandLine.Contains($bridgePath)){
      if($oldBrowser -eq $newState.browserId){Write-Output 'Codex skin and wallpaper bridge are running.';return}
      Stop-Process -Id $current.ProcessId
    }
    if(Test-Path -LiteralPath $pidFile){Remove-Item -LiteralPath $pidFile}
  }
  $node=Join-Path $engine 'runtime\node\node.exe'
  Start-Process -FilePath $node -ArgumentList ('"'+$bridgePath+'"') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'bridge.log') -RedirectStandardError (Join-Path $PSScriptRoot 'bridge-error.log') | Out-Null
} finally {if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
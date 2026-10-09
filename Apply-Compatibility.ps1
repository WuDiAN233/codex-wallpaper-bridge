$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath
$stateRoot=Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$engine=Join-Path $stateRoot 'engine'
. (Join-Path $engine 'scripts\common-windows.ps1')
. (Join-Path $engine 'scripts\theme-windows.ps1')
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'compat-manifest.json') -Raw | ConvertFrom-Json
if((Get-Content -LiteralPath (Join-Path $engine 'VERSION') -Raw).Trim() -ne '1.6.2'){throw 'The installed skin version changed; compatibility patch requires fresh validation.'}
$lock=Enter-DreamSkinOperationLock
$changed=@()
try {
  foreach($file in $manifest.files){
    $target=Join-Path $engine $file.path
    $source=Join-Path (Join-Path $PSScriptRoot 'compat-runtime') $file.path
    Assert-DreamSkinNoReparseComponents -Path $target
    Assert-DreamSkinNoReparseComponents -Path $source
    $hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    if($hash -notin @($file.originalHash,$file.patchedHash,$file.previousHash)){throw "Skin file changed unexpectedly: $($file.path)"}
    if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $file.patchedHash){throw 'Compatibility payload integrity check failed.'}
  }
  $needsPatch=@($manifest.files | Where-Object {(Get-FileHash -LiteralPath (Join-Path $engine $_.path) -Algorithm SHA256).Hash -ne $_.patchedHash})
  if($needsPatch.Count -eq 0){Write-Output 'Compatibility patch already verified.';return}
  $null=Set-DreamSkinPaused -Paused $true
  $state=Read-DreamSkinState -Path (Join-Path $stateRoot 'state.json')
  if(-not (Stop-DreamSkinRecordedInjector -State $state)){throw 'The recorded injector identity could not be verified; no engine file was changed.'}
  foreach($file in $needsPatch){
    $target=Join-Path $engine $file.path
    $source=Join-Path (Join-Path $PSScriptRoot 'compat-runtime') $file.path
    $backup=Join-Path (Join-Path $PSScriptRoot 'engine-backup') $file.path
    New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
    if(Test-Path -LiteralPath $backup){if((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $file.originalHash){throw 'Original engine backup integrity check failed.'}}
    else {Copy-Item -LiteralPath $target -Destination $backup}
    $stage=$target+'.compat-'+[guid]::NewGuid().ToString('N')
    Copy-Item -LiteralPath $source -Destination $stage
    $atomicBackup=$target+'.before-compat-'+[guid]::NewGuid().ToString('N')
    [IO.File]::Replace($stage,$target,$atomicBackup)
    $changed+=@([pscustomobject]@{target=$target;backup=$backup})
  }
  Write-Output 'Compatibility patch installed; original engine files retained in engine-backup.'
} catch {
  $failure=$_
  foreach($file in $changed){Copy-Item -LiteralPath $file.backup -Destination $file.target -Force}
  throw $failure
} finally {Exit-DreamSkinOperationLock -Mutex $lock}

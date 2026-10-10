param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$engine=Join-Path $env:LOCALAPPDATA 'CodexDreamSkin\engine'
$required=@('bridge.mjs','snapshot-cache.mjs','catalog-delivery.mjs','theme-backup.mjs','runtime-lease.ps1','verify-static.mjs','theme-worker.mjs','picker-ui.js','config.example.json','compat-manifest.json','Start-Picker.ps1','Start-Desktop.ps1','Install-Launcher.ps1','thumbnails.ps1','discover-windows.ps1')
foreach($file in $required){if(-not(Test-Path -LiteralPath (Join-Path $PSScriptRoot $file) -PathType Leaf)){throw "Package is incomplete: $file"}}
if($CheckOnly){[pscustomobject]@{PackageComplete=$true;EngineInstalled=(Test-Path -LiteralPath (Join-Path $engine 'runtime\node\node.exe'));RequiresEngineVersion='1.6.2'}|ConvertTo-Json;exit}
if(-not(Test-Path -LiteralPath (Join-Path $engine 'runtime\node\node.exe'))){
  $vendor=Join-Path $PSScriptRoot 'vendor';New-Item -ItemType Directory -Path $vendor -Force|Out-Null
  $installer=Join-Path $vendor 'CodexDreamSkin-Setup-v1.6.2.exe'
  $digest='99F37519B8D9888093914ECCD22E0A48D606FB1E6FF0C09F16CD6F7BF38D785B'
  if(-not(Test-Path -LiteralPath $installer)){
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    Write-Host 'Downloading the required Codex Dynamic Skin v1.6.2 installer...'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/CCDawn/Codex-Dynamic-Skin/releases/download/v1.6.2/CodexDreamSkin-Setup-v1.6.2.exe' -OutFile ($installer+'.partial') -TimeoutSec 180
    if((Get-FileHash -LiteralPath ($installer+'.partial') -Algorithm SHA256).Hash -ne $digest){throw 'Dependency checksum mismatch; installer was not executed.'}
    Move-Item -LiteralPath ($installer+'.partial') -Destination $installer
  }
  if((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne $digest){throw 'Dependency checksum mismatch; installer was not executed.'}
  $process=Start-Process -FilePath $installer -PassThru -Wait
  if($process.ExitCode -ne 0 -or -not(Test-Path -LiteralPath (Join-Path $engine 'runtime\node\node.exe'))){throw 'Dependency installation was not completed.'}
}
if((Get-Content -LiteralPath (Join-Path $engine 'VERSION') -Raw).Trim() -ne '1.6.2'){throw 'This release requires Codex Dynamic Skin v1.6.2. Existing newer versions will not be downgraded.'}
& (Join-Path $PSScriptRoot 'Install-Launcher.ps1')
& (Join-Path $PSScriptRoot 'Start-Picker.ps1')
if(-not $?){throw 'Wallpaper bridge startup failed.'}

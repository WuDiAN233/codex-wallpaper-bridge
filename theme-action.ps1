param([ValidateSet('Apply','Opacity','Restore','Palette')][string]$Action,[string]$MediaPath,[string]$Title,[ValidateRange(0,100)][int]$Reveal=65,[string]$PaletteJson)
$ErrorActionPreference='Stop'
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=$OutputEncoding
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath
$engine=Join-Path $env:LOCALAPPDATA 'CodexDreamSkin\engine'
. (Join-Path $engine 'scripts\common-windows.ps1')
. (Join-Path $engine 'scripts\theme-windows.ps1')
. (Join-Path $PSScriptRoot 'runtime-lease.ps1')
$lock=Enter-DreamSkinOperationLock
try {
  if($Action -eq 'Restore') { $null=Set-DreamSkinPaused -Paused $true; exit 0 }
  if($Action -eq 'Opacity') { $null=Set-DreamSkinActiveThemeMediaOpacity -Opacity ($Reveal/100); exit 0 }
  $theme=[pscustomobject]@{
    schemaVersion=1; id='codex-wallpaper-library'; name=$Title; appearance='auto'
    art=[pscustomobject]@{focusX=0.5;focusY=0.5;safeArea='auto';taskMode='ambient'}
    colors=[pscustomobject]@{background='#181818';panel='#202020';panelAlt='#282828';accent='#339cff';accentAlt='#77bbff';secondary='#777777';highlight='#339cff';text='#f3f3f3';muted='#aaaaaa';line='rgba(255,255,255,.12)'}
    media=[pscustomobject]@{type=if([IO.Path]::GetExtension($MediaPath) -in @('.mp4','.webm')){'video'}else{'image'};playbackRate=1;opacity=$Reveal/100}
  }
  if($Action -eq 'Palette'){
    $theme=Get-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'CodexDreamSkin\active-theme\theme.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  }
  if($PaletteJson){
    $colors=$PaletteJson | ConvertFrom-Json
    foreach($key in @('background','panel','panelAlt','accent','accentAlt','secondary','highlight','text','muted','line')){
      if($colors.$key -notmatch '^#[0-9a-fA-F]{6}$'){throw 'Invalid wallpaper palette.'}
    }
    $theme.colors=$colors
  }
  if($Action -eq 'Palette'){
    if(-not $PaletteJson){throw 'Wallpaper palette is required.'}
    $paths=Get-DreamSkinThemePaths
    Write-DreamSkinTheme -ThemeDirectory $paths.Active -Theme $theme
    exit 0
  }
  Invoke-WithPinnedWallpaperRuntime -RuntimePath (Join-Path $engine 'runtime\node\node.exe') -Action {
  if($theme.media.type -eq 'video' -and $MediaPath -match '[\\/]steamapps[\\/]workshop[\\/]content[\\/]431960[\\/]\d+[\\/]') {
    $null=Set-DreamSkinActiveWallpaperEngineTheme -MediaPath $MediaPath -Name $Title -Theme $theme
  } else { $null=Set-DreamSkinActiveTheme -ImagePath $MediaPath -Theme $theme -Name $Title }
  }
  $null=Set-DreamSkinPaused -Paused $false
} finally { Exit-DreamSkinOperationLock -Mutex $lock }

param([string]$OutputDirectory=(Join-Path $PSScriptRoot 'dist'))
$ErrorActionPreference='Stop'
$version=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw|ConvertFrom-Json).version
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid version'}
if(git -C $PSScriptRoot status --porcelain --untracked-files=no){throw 'Commit tracked changes before packaging'}
New-Item -ItemType Directory -Path $OutputDirectory -Force|Out-Null
$archive=Join-Path $OutputDirectory "CodexWallpaperBridge-v$version-windows.zip"
git -C $PSScriptRoot archive --format=zip "--prefix=CodexWallpaperBridge-v$version/" "--output=$archive" HEAD
if($LASTEXITCODE -ne 0){throw 'Git archive failed'}
$hash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'SHA256SUMS.txt'),($hash+'  '+[IO.Path]::GetFileName($archive)+"`n"),(New-Object Text.UTF8Encoding($false)))
Get-Item -LiteralPath $archive|Select-Object Name,Length

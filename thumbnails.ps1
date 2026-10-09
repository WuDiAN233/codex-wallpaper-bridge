param([string]$InputFile,[string]$OutputDirectory)
$ErrorActionPreference='Stop'
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=$OutputEncoding
Add-Type -AssemblyName System.Drawing
$jobs=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8|ConvertFrom-Json
$failed=@()
foreach($job in $jobs){
  $image=$null;$bitmap=$null;$graphics=$null
  try{
    if($job.key -notmatch '^[a-f0-9]{64}$'){throw 'Invalid thumbnail identity'}
    if((Get-Item -LiteralPath $job.source).Length -gt 12582912){throw 'Preview too large'}
    $image=[Drawing.Image]::FromFile($job.source)
    if([long]$image.Width*$image.Height -gt 32000000){throw 'Preview dimensions too large'}
    $scale=[Math]::Min(280.0/$image.Width,160.0/$image.Height)
    $width=[Math]::Max(1,[int]($image.Width*$scale));$height=[Math]::Max(1,[int]($image.Height*$scale))
    $bitmap=New-Object Drawing.Bitmap($width,$height)
    $graphics=[Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.Color]::FromArgb(32,32,32))
    $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $graphics.DrawImage($image,0,0,$width,$height)
    $target=Join-Path $OutputDirectory ($job.key+'.jpg')
    $bitmap.Save(($target+'.tmp'),[Drawing.Imaging.ImageFormat]::Jpeg)
    Move-Item -LiteralPath ($target+'.tmp') -Destination $target -Force
  }catch{$failed+=$job.key}
  finally{if($graphics){$graphics.Dispose()};if($bitmap){$bitmap.Dispose()};if($image){$image.Dispose()}}
}
[pscustomobject]@{failed=@($failed)}|ConvertTo-Json -Compress

function Invoke-WithPinnedWallpaperRuntime {
  param(
    [Parameter(Mandatory=$true)][string]$RuntimePath,
    [Parameter(Mandatory=$true)][scriptblock]$Action
  )
  $candidate=[IO.Path]::GetFullPath($RuntimePath)
  # Deny writes and replacement while reusing the full upstream validation.
  # This lease exists for one operation only; failures never cache a runtime.
  $lease=[IO.File]::Open($candidate,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try {
    $validated=Get-DreamSkinNodeRuntime
    if([IO.Path]::GetFullPath($validated.Path) -ine $candidate){throw 'Validated runtime does not match the locked executable.'}
    function Get-DreamSkinNodeRuntime {
      param([int]$MinimumMajor=22)
      if($validated.Major -lt $MinimumMajor){throw "Node.js $MinimumMajor or newer is required."}
      return $validated
    }
    $metadataCommand=Get-Command Get-DreamSkinValidatedImageMetadata -ErrorAction SilentlyContinue
    if($metadataCommand){
      $metadataValidator=$metadataCommand.ScriptBlock
      $validatedImages=@{}
      function Get-DreamSkinValidatedImageMetadata {
        param([Parameter(Mandatory=$true)][string]$Path)
        # Source, staging, active and archive are byte-identical copies. Run
        # the original strict parser once per content, under a read-only lease.
        $imageLease=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        try {
          $hasher=[Security.Cryptography.SHA256]::Create()
          try{$digest=[BitConverter]::ToString($hasher.ComputeHash($imageLease))}finally{$hasher.Dispose()}
          $key=[IO.Path]::GetExtension($Path).ToLowerInvariant()+':'+$digest
          if(-not $validatedImages.ContainsKey($key)){
            & $metadataValidator -Path $Path
            $validatedImages[$key]=$true
          }
        } finally { $imageLease.Dispose() }
      }
    }
    & $Action
  } finally { $lease.Dispose() }
}

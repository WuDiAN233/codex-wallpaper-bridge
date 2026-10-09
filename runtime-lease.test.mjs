import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('operation runtime lease validates once, blocks replacement, and releases on every exit',{skip:process.platform!=='win32'},async()=>{
 const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'codex-runtime-lease-'));
 try{
  const script=path.join(root,'check.ps1');await fs.writeFile(script,`param($Helper,$Root)
$ErrorActionPreference='Stop'
. $Helper
$script:checks=0
$script:runtime=Join-Path $Root 'runtime.exe'
[IO.File]::WriteAllText($script:runtime,'test fixture')
function Get-DreamSkinNodeRuntime { $script:checks++;return [pscustomobject]@{Path=$script:runtime;Major=22;Version='22.0.0'} }
$script:imageChecks=0
function Get-DreamSkinValidatedImageMetadata {param($Path);$script:imageChecks++;if([IO.File]::ReadAllText($Path) -eq 'invalid'){throw 'invalid image'}}
Invoke-WithPinnedWallpaperRuntime -RuntimePath $script:runtime -Action {
 for($i=0;$i -lt 6;$i++){ $null=Get-DreamSkinNodeRuntime }
 if($script:checks -ne 1){throw 'Repeated upstream validation'}
 $blocked=$false;try{[IO.File]::WriteAllText($script:runtime,'unexpected')}catch{$blocked=$true};if(-not $blocked){throw 'Runtime was writable'}
 $blocked=$false;try{[IO.File]::Move($script:runtime,$script:runtime+'.moved')}catch{$blocked=$true};if(-not $blocked){throw 'Runtime was replaceable'}
 $blocked=$false;try{$null=Get-DreamSkinNodeRuntime -MinimumMajor 23}catch{$blocked=$true};if(-not $blocked){throw 'Version constraint bypassed'}
 $image=Join-Path $Root 'image.png';$copy=Join-Path $Root 'copy.png'
 [IO.File]::WriteAllText($image,'valid');[IO.File]::Copy($image,$copy)
 Get-DreamSkinValidatedImageMetadata -Path $image;Get-DreamSkinValidatedImageMetadata -Path $copy
 if($script:imageChecks -ne 1){throw 'Identical image copies were revalidated'}
 [IO.File]::WriteAllText($copy,'new');Get-DreamSkinValidatedImageMetadata -Path $copy
 if($script:imageChecks -ne 2){throw 'Changed image reused old validation'}
 [IO.File]::WriteAllText($copy,'invalid');for($i=0;$i -lt 2;$i++){try{Get-DreamSkinValidatedImageMetadata -Path $copy;throw 'bad success'}catch{if($_.Exception.Message -ne 'invalid image'){throw}}}
 if($script:imageChecks -ne 4){throw 'Failed image validation was cached'}
}
[IO.File]::WriteAllText($script:runtime,'released')
$null=Get-DreamSkinNodeRuntime
if($script:checks -ne 2){throw 'Original validator was not restored'}
$failed=$false;try{Invoke-WithPinnedWallpaperRuntime -RuntimePath $script:runtime -Action {throw 'action failure'}}catch{$failed=$_.Exception.Message -eq 'action failure'}
if(-not $failed){throw 'Action failure was hidden'}
[IO.File]::WriteAllText($script:runtime,'released after failure')
function Get-DreamSkinNodeRuntime {throw 'untrusted runtime'}
$failed=$false;try{Invoke-WithPinnedWallpaperRuntime -RuntimePath $script:runtime -Action {throw 'must not run'}}catch{$failed=$_.Exception.Message -eq 'untrusted runtime'}
if(-not $failed){throw 'Validator failure was bypassed'}
[IO.File]::WriteAllText($script:runtime,'released after validation failure')
function Get-DreamSkinNodeRuntime {return [pscustomobject]@{Path=($script:runtime+'.other');Major=22}}
$failed=$false;try{Invoke-WithPinnedWallpaperRuntime -RuntimePath $script:runtime -Action {throw 'must not run'}}catch{$failed=$_.Exception.Message -like '*does not match*'}
if(-not $failed){throw 'Identity mismatch was bypassed'}
'runtime lease checks passed'
`);
  const {stdout}=await exec(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-ExecutionPolicy','RemoteSigned','-File',script,fileURLToPath(new URL('./runtime-lease.ps1',import.meta.url)),root],{windowsHide:true,timeout:20000});
  assert.match(stdout,/runtime lease checks passed/);
 }finally{assert.equal(path.dirname(await fs.realpath(root)),parent);assert.ok(path.basename(root).startsWith('codex-runtime-lease-'));await fs.rm(root,{recursive:true,force:true})}
});

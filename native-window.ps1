param([ValidateSet('Open','Find','Close','Park')][string]$Action,[string]$EnginePath,[string]$ProjectPath,[string]$WindowName)
$ErrorActionPreference='Stop'
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=$OutputEncoding
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath
if($WindowName -notmatch '^CodexWallpaper-[a-f0-9]{24}$'){throw 'Invalid managed wallpaper window name'}
if(-not (Test-Path -LiteralPath $EnginePath -PathType Leaf) -or [IO.Path]::GetFileName($EnginePath) -notin @('wallpaper32.exe','wallpaper64.exe')){throw 'Wallpaper Engine executable unavailable'}
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeWallpaperWindow {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string name);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
 [StructLayout(LayoutKind.Sequential)] public struct RECT {public int left,top,right,bottom;}
 [DllImport("user32.dll",SetLastError=true)] static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll",SetLastError=true)] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr h,int index,IntPtr value);
 public static IntPtr Find(string name){return FindWindow(null,name);}
 public static void HideTaskbarEntry(IntPtr h){long ex=GetWindowLongPtr(h,-20).ToInt64();SetWindowLongPtr(h,-20,new IntPtr((ex|0x80|0x08000000)&~0x40000));}
 public static void Park(IntPtr h){RECT r;if(!GetWindowRect(h,out r))throw new System.ComponentModel.Win32Exception();int left=GetSystemMetrics(76);int x=left-Math.Max(r.right-r.left,960)-64;if(!SetWindowPos(h,IntPtr.Zero,x,GetSystemMetrics(77),0,0,0x15))throw new System.ComponentModel.Win32Exception();if(!GetWindowRect(h,out r)||r.right>left)throw new Exception("Wallpaper render window remained on screen");}
}
'@
function Get-OwnedWindow {
 $handle=[NativeWallpaperWindow]::Find($WindowName)
 if($handle -eq [IntPtr]::Zero){return $null}
 $ownerId=[uint32]0
 [void][NativeWallpaperWindow]::GetWindowThreadProcessId($handle,[ref]$ownerId)
 $owner=Get-Process -Id $ownerId -ErrorAction Stop
 if($owner.Path -ine $EnginePath){throw 'Wallpaper window belongs to an unexpected process'}
 return [pscustomobject]@{handle=$handle.ToInt64();processId=$ownerId;windowName=$WindowName}
}
if($Action -eq 'Close'){
 if(Get-OwnedWindow){Start-Process -FilePath $EnginePath -ArgumentList ('-control closeWallpaper -location "'+$WindowName+'"') -WindowStyle Hidden -Wait}
 '{"closed":true}';exit
}
if($Action -eq 'Open'){
 if(-not (Test-Path -LiteralPath $ProjectPath -PathType Leaf)){throw 'Wallpaper project unavailable'}
 $running=Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($EnginePath)) -ErrorAction SilentlyContinue | Where-Object {$_.Path -ieq $EnginePath}
 if(-not $running){throw '请先启动 Wallpaper Engine，再应用动态场景。'}
 $x=[NativeWallpaperWindow]::GetSystemMetrics(76)-1500
 $y=[NativeWallpaperWindow]::GetSystemMetrics(77)-1000
 $arguments='-control openWallpaper -file "'+$ProjectPath+'" -playInWindow "'+$WindowName+'" -width 960 -height 540 -x '+$x+' -y '+$y+' -borderless true'
 Start-Process -FilePath $EnginePath -ArgumentList $arguments -WindowStyle Hidden -Wait
 $deadline=[DateTime]::UtcNow.AddSeconds(15)
 do {$window=Get-OwnedWindow;if($window){break};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow -lt $deadline)
 if(-not $window){throw 'Wallpaper Engine 未创建场景窗口。'}
 [NativeWallpaperWindow]::HideTaskbarEntry([IntPtr]$window.handle)
 [NativeWallpaperWindow]::Park([IntPtr]$window.handle)
 Start-Process -FilePath $EnginePath -ArgumentList ('-control applyProperties -properties RAW~({"volume":0})~END -location "'+$WindowName+'"') -WindowStyle Hidden -Wait
}else{$window=Get-OwnedWindow}
if(-not $window){throw 'Managed wallpaper render window is no longer available'}
if($Action -eq 'Park'){[NativeWallpaperWindow]::HideTaskbarEntry([IntPtr]$window.handle);[NativeWallpaperWindow]::Park([IntPtr]$window.handle)}
$window | ConvertTo-Json -Compress

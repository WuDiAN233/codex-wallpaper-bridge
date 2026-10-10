$ErrorActionPreference='Stop'
try { & (Join-Path $PSScriptRoot 'Start-Picker.ps1') }
catch {
  $_ | Out-String | Add-Content -LiteralPath (Join-Path $PSScriptRoot 'startup-error.log') -Encoding UTF8
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(('换肤启动未完成。若 Codex 已经打开，请先正常退出，再使用此入口启动。不会自动中断正在执行的任务。'+"`n`n"+$_.Exception.Message),'Codex 自动换肤','OK','Warning') | Out-Null
  exit 1
}
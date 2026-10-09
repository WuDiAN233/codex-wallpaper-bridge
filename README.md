# Codex Wallpaper Bridge

在 Windows 的 Codex 桌面应用内浏览 Wallpaper Engine 图库，切换动态场景、视频和图片，并让界面配色跟随壁纸。

## 下载和启动

1. 从 [Releases](https://github.com/WuDiAN233/codex-wallpaper-bridge/releases) 下载 `CodexWallpaperBridge-v0.1.0-windows.zip`，解压到你有写入权限的固定目录。支持中文、空格和不同盘符。
2. 首次安装前关闭 Codex，双击 `Setup.cmd`。缺少基础组件时，会下载并校验 [Codex Dynamic Skin v1.6.2](https://github.com/CCDawn/Codex-Dynamic-Skin/releases/tag/v1.6.2) 的原版安装程序，然后显示安装向导；安装位置由你选择。
3. 启动 Wallpaper Engine，再通过桌面的 **Codex Wallpaper Bridge** 快捷方式或 `Start-Picker.cmd` 打开 Codex。
4. 点击右下角 **壁纸**。正常安装的 Steam / Wallpaper Engine 会被自动发现；未识别时点击 **选择图库目录**。

如果 Windows 提示下载的 PowerShell 脚本没有签名，请先在下载 ZIP 的属性中勾选“解除锁定”，重新解压后运行。不要关闭系统安全软件或修改全局执行策略。

## 图库路径

自动读取 Steam 注册表位置、`libraryfolders.vdf`、Wallpaper Engine 安装信息和正在运行的进程位置，扫描所有已发现的 Steam 库及默认/自建壁纸目录，不固定 C: 或 D:。

“选择图库目录”接受 Steam 库根目录、包含 `wallpaper64.exe` / `wallpaper32.exe` 的安装目录、包含多个壁纸项目的文件夹，或单个含 `project.json` 的项目。也可复制 `config.example.json` 为 `config.json` 后填入本机绝对路径。重复目录会去重，新增壁纸通常在下载完成后约 5–10 秒出现。

## 使用

- 点击卡片后“应用壁纸”。准备出有效画面后才报告成功，失败时保留或恢复原主题。
- 拖动“背景可见度”会立即预览，松手自动保存。100% 会去掉对话区的背景暗色遮罩，消息和输入框仍保留自己的背景。
- 点击面板外或按 Esc 收起；关闭面板会释放缩略图元素。
- 预览图在本机转换为静态小缩略图，不上传图片或壁纸。暂时没有可用预览的项目显示类型文字。
- “恢复原生外观”隐藏壁纸并恢复首次接入前的原生颜色；备份保留在本机。

场景/大视频由 Wallpaper Engine 在一个屏幕外的受管窗口中渲染，Codex 只采集该窗口，不录制整个桌面、不采集音频。后台窗口不能直接删除，否则动态场景会停止；切换普通视频或恢复外观时会关闭它。采集上限 960×540、15 fps，偏重资源节省，放大细节清晰度有限。

## 兼容范围

- Windows 10/11、已安装的 Codex 桌面应用和 Wallpaper Engine；动态场景需保持 Wallpaper Engine 运行。
- 实机验证的 Codex 包版本：**26.1002.7124.0**。内部页面结构和外观接口可能随升级改变，其他 Codex 版本尚未验证。
- 基础皮肤组件固定 **v1.6.2**，不会自动覆盖或降级未知版本。不修改官方 Codex 应用包、签名或权限。
- 网页壁纸和独立程序壁纸目前只识别，不开放应用。缺失项目文件的目录会标为待完成。
- 这是独立扩展，首次发布仅验证了当前 Windows 主机，尚未完成第二台干净机器的全新安装验收。

## 开发与验证

Node.js 22 或更新版本，无额外 npm 依赖：`npm test`。PowerShell 5.1 用于本机目录发现、选择目录、缩略图和 Wallpaper Engine 窗口控制。

自动化检查涵盖多 Steam 库、中文/空格路径、手动目录、缺少引擎、下载完成、文件变更、路径越界、链接、缓存上限、渲染失败清理和主题采样。实时验证涵盖场景/视频/图片切换、对话可见、自动发现、点击外部关闭、缩略图以及透明度。

所有个人配置、运行状态、备份、生成的缩略图、日志与截图均不包含在发行包中。故障时可查看解压目录内的 `bridge-error.log`、`status.json`；分享日志前检查个人路径。

源码采用 MIT 协议；第三方来源和许可证见 [NOTICE.md](NOTICE.md) 与 [LICENSE](LICENSE)。

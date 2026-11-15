# RTLAntigravity

为 **Antigravity App**、**Antigravity IDE** 和 **Claude Web** 提供波斯文、阿拉伯文、中文和英文的文字方向与字体设置。默认界面和主文档使用英文。本版本由 sinaojaghi 维护。[维护者](https://github.com/sinaojaghi)

[English](README.md) · [راهنمای فارسی](README.fa.md)

本项目基于 xAiPro 分发的代码，该版本源自 mmnaderi 的 MIT 开源项目 `antigravity-rtl`。原始版权声明保存在 `LICENSE` 中。[xAiPro 原始分发](https://xaipro.ir/antigravity-rtl) · [上游项目](https://github.com/mmnaderi/antigravity-rtl)

## Claude 网页聊天

使用 Node.js 22.12 或更新版本，在项目目录运行以下命令。

```sh
node bin/index.js --claude-web
```

1. 在 Chrome 打开 `chrome://extensions`，或在 Edge 打开 `edge://extensions`。
2. 启用开发者模式，点击 **Load unpacked**（加载解压缩的扩展），选择项目中的 `claude-web-extension` 文件夹。[Chrome 指南](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Edge 指南](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)
3. 刷新 Claude 标签页并打开聊天。通过 **RTL** 按钮调整文字方向、字体和行高。[Claude Web](https://claude.ai/)

扩展自动调整聊天消息和输入框的文字方向。波斯文和阿拉伯文可使用内置 Vazirmatn，中文使用系统字体。设置保存在浏览器中，扩展仅在 `https://claude.ai/*` 运行。Claude Desktop 和 Claude Code 终端使用独立的界面。

如需更改导出位置，请添加 `--path "输出文件夹"`。更新时在同一目录重新生成扩展，然后重新加载扩展和 Claude 标签页。

## 在 Claude Desktop 中阅读波斯语回复

可以在桌面应用的预览面板中从右到左阅读波斯语回复。

- **Chat。** 请 Claude 将回复制作成使用 `<html lang="fa" dir="rtl">` 的 HTML Artifact，并在对话旁打开。需要在 **Settings → Capabilities** 中开启 **Create and edit files**。旧版设置中的名称是 **Cloud code execution and file creation**。[Artifact 指南](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)
- **Code。** 在本地会话中，请 Claude 将回复保存为使用 `<html lang="fa" dir="rtl">` 的 HTML 文件，并在回复中提供文件路径。点击该路径，即可在 **Browser** 面板中打开。[Claude Code 桌面预览指南](https://code.claude.com/docs/en/desktop#preview-your-app)

请 Claude 将波斯语段落右对齐，使 `pre` 和 `code` 元素从左到右显示，并使用 `<bdi dir="ltr">` 隔离句中的英文术语和命令。这些方向设置应用于预览面板中的回复。

## Antigravity 安装前准备

- Windows、macOS 或 Linux，以及受支持的 Antigravity App 或 IDE 安装。
- Node.js **22.12 或更新版本**，包含 npm。[下载 Node.js](https://nodejs.org/en/download)
- 从 GitHub 下载时需要网络连接。
- 对目标应用的安装目录拥有写入权限。

应用或恢复补丁前，请完全退出 Antigravity。Windows 用户还应检查系统托盘，并通过 **Quit** 退出后台进程。

## 一条命令运行

在已经下载或克隆的项目目录中运行以下命令。本地运行仅需要 Node.js。

```sh
node bin/index.js
```

Windows 用户也可以通过 PowerShell 直接运行 GitHub 上的版本。

```powershell
npx.cmd --yes --package=https://github.com/sinaojaghi/RTLAntigravity/archive/refs/heads/main.tar.gz antigravity-rtl
```

macOS 和 Linux 使用以下命令。

```sh
npx --yes --package=https://github.com/sinaojaghi/RTLAntigravity/archive/refs/heads/main.tar.gz antigravity-rtl
```

这些 GitHub 命令下载 `main` 分支上已提交的版本。维护者将本地修改推送到 GitHub 后，下载命令才能获取对应更新。通过归档地址下载时无需安装 Git。

## 中文与字体设置

重新打开 Antigravity，点击 **RTL** 按钮打开设置。IDE 中的按钮位于状态栏，其他受支持布局可显示悬浮按钮。

- 自动模式下，中文和英文采用从左到右的方向，波斯文和阿拉伯文采用从右到左的方向。
- **EN/ZH Font** 用于指定电脑上已安装的英文或中文字体。留空时使用系统字体及其回退字体。
- **FA Font** 用于波斯文和阿拉伯文字体。留空时使用内置的 **Vazirmatn**。
- **Code Font**、**Font Size** 和 **Line Height** 分别控制代码字体、文字大小和行高。
- **Force RTL** 会强制对话输出采用从右到左方向。阅读中文时保持此选项关闭，以使用自动方向。

Windows 和 Linux 使用 **Alt+R**，macOS 使用 **Option+R**，可切换文字方向功能。内置 Vazirmatn 字体在安装后可离线使用，中文显示使用系统上可用的中文字体。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `node bin/index.js --check` | 检查已检测到的安装和补丁状态 |
| `node bin/index.js --app` | 为独立应用安装补丁 |
| `node bin/index.js --ide` | 为 IDE 安装补丁 |
| `node bin/index.js --path "安装目录"` | 选择自定义安装位置 |
| `node bin/index.js --restore` | 恢复检测到的应用与 IDE |
| `node bin/index.js --restore --app` | 恢复独立应用 |
| `node bin/index.js --restore --ide` | 恢复 IDE |
| `node bin/index.js --help` | 查看英文命令帮助 |

`--path` 接受安装目录、macOS 的 `.app` 包、IDE 的 `resources/app` 目录，或独立应用的 `app.asar` 文件。含空格的路径需使用引号。通过 `npx` 运行时，将同样的选项放在 `antigravity-rtl` 后面。

## 设置、备份与兼容性

设置保存在 `~/.antigravity-rtl.json`，由应用和 IDE 共用。旧版本中的有效设置会自动读取。备份和恢复状态保存在应用文件旁，请保留这些文件以便使用 `--restore`。

Antigravity 更新后，可重新运行补丁命令。恢复前会检查当前文件，以避免用旧备份覆盖更新后的程序。遇到无法识别的文件变化时，程序会显示具体错误。

如果找不到安装位置，请指定 `--path`。遇到文件占用或权限错误时，先完全退出应用并重试。安装在系统目录中的应用可能需要管理员终端。macOS 可能要求在“系统设置 → 隐私与安全性 → App 管理”中允许终端修改应用。

兼容性取决于应用文件结构、完整性校验和系统权限。当前测试覆盖临时应用与 IDE 安装、重复安装、恢复及更新场景，并使用 Windows Antigravity 2.31.2 的应用归档进行兼容性检查。macOS、Linux 原生运行及其他 Antigravity 版本仍需单独验证。报告问题时请提供操作系统、Node.js 版本、Antigravity 版本、运行命令及错误信息。[提交问题](https://github.com/sinaojaghi/RTLAntigravity/issues)

## 许可证

代码使用 MIT 许可证，包含原始版权声明。Vazirmatn 33.003 字体使用 SIL Open Font License 1.1。[MIT](LICENSE) · [字体许可证](OFL-Vazirmatn.txt) · [Vazirmatn 项目](https://github.com/rastikerdar/vazirmatn)

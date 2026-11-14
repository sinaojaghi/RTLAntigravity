# RTLAntigravity

Persian, Arabic and Hebrew text direction and typography for Antigravity App and IDE. Maintained by [sinaojaghi](https://github.com/sinaojaghi).

[راهنمای فارسی](README.md)

This fork is based on the code distributed by xAiPro. That distribution credits the MIT-licensed `antigravity-rtl` project by mmnaderi. Original copyright notices are included in `LICENSE`. [xAiPro distribution](https://xaipro.ir/antigravity-rtl) · [Upstream](https://github.com/mmnaderi/antigravity-rtl)

## Requirements

- Windows, macOS or Linux with a compatible Antigravity App or IDE installation.
- Node.js 22.12 or newer, including npm. [Download Node.js](https://nodejs.org/en/download)
- Internet access when downloading directly from GitHub.
- Write access to the selected application installation directory.

The bundled Vazirmatn font works offline after installation. Close Antigravity completely before applying or restoring a patch. On Windows, use **Quit** from the tray menu if necessary.

## One-command setup

Run this command inside a downloaded or cloned repository. Local execution uses only Node.js and needs no npm dependency installation.

```sh
node bin/index.js
```

Run a published copy directly from GitHub on Windows.

```powershell
npx.cmd --yes --package=https://github.com/sinaojaghi/RTLAntigravity/archive/refs/heads/main.tar.gz antigravity-rtl
```

On macOS or Linux use the following command.

```sh
npx --yes --package=https://github.com/sinaojaghi/RTLAntigravity/archive/refs/heads/main.tar.gz antigravity-rtl
```

The archive command downloads the version committed to GitHub's `main` branch. The maintainer must push local changes before this command can download them. Git is not required for archive URL installation.

Reopen Antigravity and open the **RTL** button to configure fonts, font size, line height, automatic direction, Force RTL and the Persian `Shift+2` fix. Use **Alt+R** on Windows/Linux or **Option+R** on macOS to toggle RTL. The IDE button appears in the status bar. A floating button is available when the expected toolbar is absent.

## Commands

| Command | Action |
| --- | --- |
| `node bin/index.js` | Detect and patch the available app and IDE |
| `node bin/index.js --app` | Patch the standalone app |
| `node bin/index.js --ide` | Patch the IDE |
| `node bin/index.js --check` | Inspect detected installations |
| `node bin/index.js --path "installation directory"` | Select a custom installation |
| `node bin/index.js --restore` | Restore detected installations |
| `node bin/index.js --restore --app` | Restore only the standalone app |
| `node bin/index.js --restore --ide` | Restore only the IDE |
| `node bin/index.js --help` | Show help |

Custom paths accept the installation directory, a macOS `.app` bundle, the IDE's `resources/app` directory, or the standalone `app.asar`. Quote paths containing spaces. Invalid arguments and failed operations produce a nonzero exit code. Append the same options after `antigravity-rtl` with `npx`.

`--check` reads application files without applying a patch. Local execution needs no npm dependency installation.

## Settings, backups and updates

Settings are stored in `~/.antigravity-rtl.json`, shared by the two editions. Valid settings from the earlier distribution are read automatically. Font fields select fonts installed on the computer. An empty Persian/Arabic font field uses bundled Vazirmatn.

Application backups and recovery state are stored beside the application files. Keep them for `--restore`. The patcher verifies current files before restoration to avoid replacing an updated installation with an older backup. After an Antigravity update, run the patcher again. Unrecognized file changes produce an explanatory error.

## Troubleshooting and compatibility

| Problem | Next step |
| --- | --- |
| Node.js is missing or too old | Install Node.js 22.12 or newer and reopen the terminal |
| npm download fails | Check the connection or proxy settings, then retry |
| Installation is not detected | Supply `--path` with the installation directory |
| Permission denied | Quit Antigravity and retry. Use an elevated terminal for system-owned installations |
| macOS refuses file changes | Allow the terminal in System Settings → Privacy & Security → App Management when required |
| App files are locked | Quit the app and its tray process, then retry |
| RTL control is absent | Fully restart the app and run `--check` against the same installation |
| Unsupported layout or integrity validation | Include the error in a compatibility issue |

Support depends on application file layout and integrity settings. The standalone patch requires a recognizable `dist/utils.js` window-loading hook. Builds enforcing embedded ASAR integrity need application-specific packaging support. macOS signing and application-management restrictions may also affect installation. [Electron ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)

Tests cover fixture app/IDE installations, repeated installation, restoration and update handling. The local Windows Antigravity 2.31.2 archive is also used for compatibility checks. Native macOS/Linux execution and other Antigravity releases require their own validation.

## Development

```sh
npm ci
npm test
npm pack --dry-run
```

`bin/index.js` provides the CLI. The app and IDE patchers manage detection, backup and restoration. A shared runtime and renderer implement settings persistence, typography and text direction. Tests use temporary application fixtures.

Include OS, Node.js version, Antigravity version, command and error output when reporting a problem. [Issue tracker](https://github.com/sinaojaghi/RTLAntigravity/issues)

## Attribution and license

The starting code was distributed by xAiPro, based on mmnaderi's `antigravity-rtl`. This fork is maintained by sinaojaghi. UI links point to the maintainer's GitHub profile. [xAiPro source](https://xaipro.ir/antigravity-rtl) · [Upstream source](https://github.com/mmnaderi/antigravity-rtl) · [Maintainer](https://github.com/sinaojaghi)

Code is distributed under the [MIT license](LICENSE), including the original copyright notice. Vazirmatn 33.003 is distributed under the [SIL Open Font License 1.1](OFL-Vazirmatn.txt). [Vazirmatn project](https://github.com/rastikerdar/vazirmatn)

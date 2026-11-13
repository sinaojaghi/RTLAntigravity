<h1 align="center">🔁 xAiPro RTL</h1>
<p align="center">
  <b>Smart Right-to-Left UI patcher for Antigravity &amp; Antigravity IDE, with Persian, Arabic and Hebrew typography support.</b>
</p>

<p align="center">
  <a href="https://microsoft.com/windows"><img src="https://img.shields.io/badge/OS-Windows-0078D6?style=flat-square" alt="OS - Windows"></a>
  <a href="https://www.linux.org"><img src="https://img.shields.io/badge/OS-Linux-FCC624?style=flat-square&logo=linux&logoColor=white" alt="OS - Linux"></a>
  <a href="https://www.apple.com/macos"><img src="https://img.shields.io/badge/OS-macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="OS - macOS"></a>
  <a href="https://xaipro.ir/antigravity-rtl"><img src="https://img.shields.io/badge/Node-22.12%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22.12+"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License - MIT"></a>
</p>

<p align="center">
  <b><a href="https://xaipro.ir/antigravity-rtl">Persian / فارسی</a></b>
</p>

---

## ✨ Features

Read and write naturally in Persian, Arabic and Hebrew — without disrupting English or code.

- **Dual target support:** Works on both **Antigravity (Standalone App)** and **Antigravity IDE (VS Code Edition)**, with smart auto-detection or interactive selection.
- **Natural text direction:** Chat, input fields and agent views adapt dynamically as you type. **Force RTL** is available when you want everything right-aligned.
- **Code &amp; terminal stay LTR:** Code blocks, the Monaco editor and the terminal remain left-to-right with customizable code fonts.
- **Typography your way:** Separate fonts for Persian/Arabic, English and code. **Vazirmatn Variable** is embedded offline — no network needed. Font size and line height adjust live.
- **Persian keyboard fix:** Maps `Shift + 2` to type `@` instead of `٬` on Persian keyboard layouts.
- **Quick controls:** Title-bar menu in the Standalone App and a UI widget in the IDE, toggleable with `⌥R` on macOS or `Alt+R` on Windows and Linux.

Settings are saved in `~/.antigravity-rtl.json` and restored when you reopen the app.

---

## 🚀 Quick Start

> **Before running the patch:** close Antigravity / Antigravity IDE completely.

### 1. Download and extract

Download [`antigravity-rtl.zip`](https://xaipro.ir/downloads/antigravity-rtl.zip) from the [xAiPro download page](https://xaipro.ir/antigravity-rtl), extract it, then enter the directory:

```bash
cd antigravity-rtl
```

### 2. Install dependencies (one time)

Node.js **22.12 or newer** is required.

```bash
npm install
```

### 3. Apply the patch

Auto-detects and patches whichever Antigravity app is installed:

```bash
node bin/index.js
```

| Platform | Command |
| :--- | :--- |
| **macOS** | `node bin/index.js` — if you see *Permission Denied*, enable **App Management** for your terminal in **System Settings → Privacy &amp; Security → App Management**, then run it again. |
| **Linux** | `node bin/index.js` — add `sudo` only when the app lives in a system directory (e.g. `/opt`). For user directories such as `~/Downloads`, no `sudo` is needed. |
| **Windows** | Open PowerShell **as Administrator** and run `node bin/index.js`. |

---

## 🧰 CLI Options &amp; Flags

| Command | Description |
| :--- | :--- |
| `node bin/index.js` | **Auto-detect &amp; patch:** patches both apps if found, or only the installed one |
| `node bin/index.js --ide` | Patch **Antigravity IDE** only |
| `node bin/index.js --app` | Patch the **Standalone App** only |
| `node bin/index.js --restore` | Revert changes and restore original backups for all detected apps |
| `node bin/index.js --restore --ide` | Restore **Antigravity IDE** only |
| `node bin/index.js --restore --app` | Restore the **Standalone App** only |
| `node bin/index.js --path "/path/to/app"` | Specify a custom installation directory or `app.asar` |
| `node bin/index.js --help` | Show the built-in help |

---

## ↩️ Uninstall / Revert the patch

Quit the app(s) and run with `--restore` (or `-r`):

```bash
node bin/index.js --restore
```

To restore only one target:

```bash
node bin/index.js --restore --ide
```

---

## 🔍 How it works

1. **Detection:** automatically locates your Antigravity `app.asar` or the Antigravity IDE `resources/app` directory.
2. **Safe backup:** creates backups (`.bak` / `.rtl-bak`) before touching any file.
3. **Smart injection:**
   - **Standalone App:** injects the RTL engine into the core logic (`utils.js`) and repacks `app.asar`.
   - **Antigravity IDE:** injects an isolated hook (`antigravity-rtl-main.js`) into `out/main.js`, targeting the workbench and agent windows.
4. **Offline font:** embeds the Vazirmatn Variable font locally.

---

## ❓ Troubleshooting

| Problem | Solution |
| :--- | :--- |
| `Could not automatically locate Antigravity` | The app is installed in a non-standard path — pass it with `--path`. |
| `Permission denied` (macOS) | Enable **App Management** for your terminal in System Settings → Privacy &amp; Security. |
| Patch applied but nothing changed | Fully quit and reopen the application. |
| Layout looks broken after an app update | Antigravity updates overwrite the patch — run `node bin/index.js` again. |
| Want the original back | `node bin/index.js --restore` |

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

> Based on [`antigravity-rtl` by mmnaderi](https://github.com/mmnaderi/antigravity-rtl), released under the MIT License. Rebranded and distributed by [xAiPro](https://xaipro.ir).

---
---

## 🔁 xAiPro RTL (فارسی)

**پچ راست‌به‌چپ و تنظیمات تایپوگرافی برای Antigravity و Antigravity IDE، با پشتیبانی کامل فارسی، عربی و عبری.**

با این ابزار می‌توانید در Antigravity فارسی بنویسید و بخوانید — **بدون** آنکه چیدمان متن انگلیسی و بلوک‌های کد به‌هم بخورد.

### امکانات

- **پشتیبانی دوگانه:** هم نسخهٔ مستقل Antigravity و هم Antigravity IDE (مبتنی بر VS Code) با شناسایی خودکار یا انتخاب دستی.
- **جهت‌دهی خودکار متن:** چیدمان چت، ورودی‌ها و پرامپت‌ها بر اساس زبان متن، راست‌چین یا چپ‌چین می‌شود.
- **کد و ترمینال چپ‌چین می‌مانند:** بلوک‌های کد، ادیتور Monaco و ترمینال با فونت دلخواه LTR باقی می‌مانند.
- **تایپوگرافی دلخواه:** فونت مجزا برای فارسی/عربی، انگلیسی و کد، همراه فونت توکار **وزیرمتن (Vazirmatn Variable)** بدون نیاز به اینترنت.
- **حل مشکل کلید `@`:** اصلاح میانبر `Shift + 2` روی کیبورد فارسی برای تایپ مستقیم `@`.
- **دسترسی سریع:** پنل تنظیمات در برنامه و کلید میانبر `⌥R` در مک یا `Alt+R` در ویندوز و لینوکس.

تنظیمات در فایل `~/.antigravity-rtl.json` ذخیره می‌شود.

### آموزش نصب و اجرا

> **قبل از اعمال پچ:** Antigravity یا Antigravity IDE را کاملاً ببندید.

**۱)** فایل [`antigravity-rtl.zip`](https://xaipro.ir/downloads/antigravity-rtl.zip) را از [صفحهٔ دانلود xAiPro](https://xaipro.ir/antigravity-rtl) دانلود و Extract کنید:

```bash
cd antigravity-rtl
```

**۲)** نصب وابستگی‌ها (فقط یک بار — نیاز به Node.js نسخهٔ ۲۲.۱۲ یا بالاتر):

```bash
npm install
```

**۳)** اعمال پچ:

```bash
node bin/index.js
```

- **مک:** اگر خطای Permission Denied گرفتید، تیک **App Management** را برای ترمینال در *System Settings → Privacy &amp; Security → App Management* فعال کنید و دوباره اجرا کنید.
- **لینوکس:** اگر اپ در مسیر سیستمی مثل `/opt` هست `sudo` اضافه کنید؛ برای مسیرهای کاربر مثل `~/Downloads` نیازی نیست.
- **ویندوز:** PowerShell را **Run as Administrator** باز کرده و اجرا کنید.

### گزینه‌ها و فلگ‌ها

| دستور | توضیحات |
| :--- | :--- |
| `node bin/index.js` | **تشخیص و پچ خودکار** هر اپ موجود |
| `node bin/index.js --ide` | فقط پچ Antigravity IDE |
| `node bin/index.js --app` | فقط پچ نسخهٔ مستقل |
| `node bin/index.js --restore` | بازگردانی همه به حالت اولیه |
| `node bin/index.js --restore --ide` | بازگردانی فقط Antigravity IDE |
| `node bin/index.js --restore --app` | بازگردانی فقط نسخهٔ مستقل |
| `node bin/index.js --path "/path/to/app"` | مشخص کردن مسیر دلخواه نصب |
| `node bin/index.js --help` | نمایش راهنمای داخلی |

### بازگردانی به حالت اولیه

برنامه‌ها را ببندید و اجرا کنید:

```bash
node bin/index.js --restore
```

### عیب‌یابی

| مشکل | راه‌حل |
| :--- | :--- |
| `Could not automatically locate Antigravity` | مسیر نصب غیراستاندارد است — با `--path` بدهید. |
| `Permission denied` (مک) | App Management را برای ترمینال فعال کنید. |
| پچ خورده ولی چیزی عوض نشده | برنامه را کامل ببندید و دوباره باز کنید. |
| بعد از آپدیت به‌هم ریخت | آپدیت Antigravity پچ را بازنویسی می‌کند — دوباره `node bin/index.js` بزنید. |
| می‌خواهید به حالت اول برگردد | `node bin/index.js --restore` |

---

**اعتباردهی:** این پروژه بر اساس [`antigravity-rtl` از mmnaderi](https://github.com/mmnaderi/antigravity-rtl) با لایسنس MIT ساخته شده و توسط [xAiPro](https://xaipro.ir) بازانتشار یافته است.

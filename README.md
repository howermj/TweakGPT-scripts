# TweakGPT Scripts

A small set of Tampermonkey / Violentmonkey userscripts to extend, declutter, and de-friction the ChatGPT UI.

![License](https://img.shields.io/badge/license-MIT-blue)  
![Status](https://img.shields.io/badge/status-in%20progress-yellow)

* * *

## Scripts

| Script | What it does | Updated | Install |
| --- | --- | ---: | --- |
| **TweakGPT – File Upload Warning** | Adds a persistent banner reminding users not to upload sensitive files. | 2025-05-31 | [Install](https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-file-upload-warning.user.js) |
| **TweakGPT – Collapse Sidebars on Load** | Auto-collapses **GPTs**, **Projects**, and **Your chats** on initial load/navigation. Also (optionally) suppresses chat list under Projects. Uses DOM observers; stops after initial collapse so it won’t fight user interaction. | 2026-01-17 | [Install](https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-collapse-sidebars-on-load.user.js) |
| **TweakGPT – Save Chat from Header** | Adds a **Save** button next to **Share** in the conversation header to download the current chat as **Markdown**. | 2026-01-17 | [Install](https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-save-chat-from-header.user.js) |
| **TweakGPT - Show Project Name in Header** | Adds Project name to header, matching CustomGPT beahvior and typography. | 2026-01-17 | [Install](https://raw.githubusercontent.com/howermj/TweakGPT-scripts/main/tweakgpt-project-name-instead-of-folder-icon.user.js) |

### Deprecated scripts (kept for history)

| Script | Why deprecated | Last updated |
| --- | --- | ---: |
| TweakGPT – Toggle Custom GPTs | Custom GPTs panel became natively collapsible (Fall 2025). | 2025-05-31 |
| TweakGPT – Toggle Projects Panel | Projects panel became natively collapsible (Fall 2025). | 2025-05-31 |
| TweakGPT – Remove “View Plans” Block | “View plans” UI element removed (Fall 2025). | 2025-05-31 |

* * *

## Install

### 1) Install a userscript manager

Pick one:

- **Tampermonkey** (Chrome/Brave/Edge/Firefox)
- **Violentmonkey** (Chrome/Brave/Edge/Firefox)

### 2) Install a script

Click an **Install** link below. Your userscript manager will open an install prompt.

### 3) Verify it’s enabled

In your userscript manager:

- Make sure the script is **Enabled**
- Confirm it matches `https://chat.openai.com/*` and/or `https://chatgpt.com/*`

### 4) Update behavior

These scripts update automatically via `@updateURL` when you refresh your browser (subject to your manager settings)

* * *

## Notes on safety + privacy

- These scripts run **only in your browser**.
- No telemetry, no remote logging.
- Scripts rely on DOM selectors that may break when ChatGPT’s UI changes—if something stops working, open an issue with:
    - browser + userscript manager version
    - a screenshot
    - relevant `outerHTML` snippets of the UI element

* * *

## Help / Support

- Questions or bug reports: use **GitHub Discussions**  
    https://github.com/howermj/TweakGPT-scripts/discussions
- For bugs, include: “expected vs actual”, and steps to reproduce.

* * *

## Contributing

PRs welcome:

- Keep changes small and well-commented.
- Prefer **defensive selectors** and **idempotent logic** (don’t fight the user).
- Avoid heavy dependencies and avoid styling that clashes with native UI.

* * *

## License

MIT

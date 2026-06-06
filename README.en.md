# Hermes Zh Switcher / Hermes Chinese UI Switcher

[简体中文](README.md) | [English](README.en.md)

Hermes Zh Switcher is an unofficial Hermes Desktop Chinese UI switcher and local installer for macOS. It adds a reversible Chinese/English UI layer to an existing Hermes app by injecting a removable renderer script into `app.asar`. It does not modify Hermes backend behavior, model requests, API keys, local memory, knowledge bases, bots, Gateway, MCP, or tool calling logic.

This is for users searching for Hermes Chinese localization, Hermes Desktop zh-CN, macOS app.asar UI patching, and reversible local i18n overlays.

![Unofficial](https://img.shields.io/badge/Hermes-unofficial-111827.svg)
![macOS](https://img.shields.io/badge/platform-macOS-2563EB.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-16A34A.svg)
![Safety](https://img.shields.io/badge/safety-backup_%2B_restore-7C3AED.svg)
![License](https://img.shields.io/badge/license-MIT-0F766E.svg)

![Hermes Chinese UI switcher install effect comparison](docs/assets/hermes-zh-switcher-before-after.svg)

Install effect comparison: after installation, settings, skills, tools, and gateway-related UI become easier to read in Chinese while keeping the `中/EN` toggle available.

## What It Solves

| Problem | What this project does |
| --- | --- |
| Hermes Desktop UI is mostly English | Adds a Chinese/English `中/EN` toggle in the renderer UI |
| There is no stable official global i18n plugin API | Uses a local, reversible `app.asar` UI injection |
| Users worry about app or data safety | Backs up `app.asar`, supports uninstall, and avoids user data and config |
| Hermes updates may overwrite local patches | Provides an update helper: uninstall patch -> run upstream update -> reinstall patch -> verify |

## 30-Second Start

This project does not distribute Hermes Desktop. Install Hermes from its official channel first. On current Hermes builds, `/Applications/Hermes.app` may be a small setup launcher on first install; open Hermes once and finish the initial setup until the desktop UI appears, then quit Hermes and run:

```bash
git clone https://github.com/flag0x369/hermes-zh-switcher.git
cd hermes-zh-switcher
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --yes
open -n /Applications/Hermes.app
```

After installation, a `中/EN` switch appears in the lower-right corner of Hermes Desktop.

## Safety Scope

| Area | Behavior |
| --- | --- |
| Hermes Desktop `app.asar` | Modified in place after backup. If `/Applications/Hermes.app` is a setup launcher, scripts automatically patch the generated app under `~/.hermes/hermes-agent/apps/desktop/release/*/Hermes.app` |
| `dist/index.html` inside `app.asar` | Receives a small script injection marker |
| `dist/hermes-zh-ui.js` inside `app.asar` | Added as the UI switcher script |
| `/Applications/Hermes.zh.app` | Not created |
| `~/.hermes`, profiles, model config, Gateway config | Not modified |
| API keys, tokens, cookies, credentials | Not read |
| Environment variables, config keys, model IDs, tool IDs | Preserved in English |
| macOS signing | Re-signed ad-hoc after local bundle modification |

Read the longer safety notes in [docs/SAFETY.md](docs/SAFETY.md).

## Commands

```bash
node scripts/verify.mjs --app /Applications/Hermes.app
node scripts/uninstall.mjs --app /Applications/Hermes.app --yes
node scripts/update-hermes.mjs --app /Applications/Hermes.app --yes
```

Uninstall removes the injection marker and `dist/hermes-zh-ui.js` from `app.asar`. It does not delete Hermes or user data.

## Verification

```bash
npm run check
node scripts/verify.mjs --app /Applications/Hermes.app
npm run safety:check
npm run audit:runtime -- --limit 220
```

Release/package checks:

```bash
npm run check
npm pack --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
```

## Translation Coverage

The UI script translates common Hermes Desktop labels, settings, setup screens, tool sections, model/provider controls, messaging connector labels, and installer/update states.

Some text intentionally remains English:

- Brand names: `OpenAI`, `Claude`, `Slack`, `WhatsApp`, `Hugging Face`
- Model/provider names and technical terms: `MCP`, `OAuth`, `Token`, `API Key`
- Commands, URLs, paths, environment variables, config keys, tool IDs, skill IDs
- User-generated content, chat messages, terminal output, code, markdown, logs

## Project Docs

- [docs/SAFETY.md](docs/SAFETY.md): write scope, backups, restore, and sensitive-data boundary.
- [docs/ROADMAP.md](docs/ROADMAP.md): supported, near-term, and not-planned work.
- [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md): public screenshot and redaction rules.
- [docs/RELEASE_TEMPLATE.md](docs/RELEASE_TEMPLATE.md): release notes template.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution scope and verification checklist.

## GitHub Metadata

Suggested description:

```text
Unofficial Chinese UI switcher and reversible local app.asar patcher for Hermes Desktop on macOS.
```

Suggested topics:

```text
hermes-desktop, zh-cn, i18n, localization, macos, electron, app-asar, developer-tools
```

## Long-Term Stability

This project cannot guarantee compatibility with every future Hermes Desktop version. Hermes may change frontend bundle names, `index.html` shape, Electron packaging, or update behavior. The installer and verifier should fail loudly when structure does not match instead of guessing.

The best long-term solution is official Hermes Desktop i18n support.

## License

MIT

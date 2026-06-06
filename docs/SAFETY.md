# Safety

Hermes Zh Switcher is an unofficial local UI patcher for Hermes Desktop on macOS. It is designed to be narrow, reversible, and explicit about its limits.

## What It Changes

The installer patches the resolved Hermes Desktop app in place. On newer Hermes installers, `/Applications/Hermes.app` can be a setup launcher; in that case the scripts automatically patch the generated desktop app under `~/.hermes/hermes-agent/apps/desktop/release/*/Hermes.app`.

| Target | Change |
| --- | --- |
| Resolved Hermes Desktop `Contents/Resources/app.asar` | Repacked after backup |
| `dist/index.html` inside `app.asar` | Adds the `hermes-zh-switcher` injection marker |
| `dist/hermes-zh-ui.js` inside `app.asar` | Adds the Chinese/English UI switcher script |
| macOS code signature | Re-signs ad-hoc after local bundle modification |

## What It Does Not Change

- It does not create `/Applications/Hermes.zh.app`.
- It does not modify `~/.hermes` profiles, model config, Gateway config, credentials, or user data.
- It does not modify profiles, model configuration, Gateway configuration, MCP config, tools, bots, knowledge bases, memories, or update branch config.
- It does not read API keys, tokens, cookies, private keys, or passwords.
- It does not translate environment variable names, config keys, model IDs, provider IDs, command names, URL examples, tool IDs, or skill IDs.
- It does not distribute Hermes Desktop.

## Backup And Rollback

Before install, the current `app.asar` is backed up under:

```text
~/Library/Application Support/hermes-zh-switcher/backups/
```

If install or uninstall fails during write, signing, or injection verification, the script attempts to restore the previous `app.asar`.

## Dry Run First

```bash
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/uninstall.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
```

## Restore / Uninstall

```bash
node scripts/uninstall.mjs --app /Applications/Hermes.app --yes
```

Uninstall removes the UI injection from `app.asar`. It does not delete Hermes Desktop or user data.

## macOS Signing Note

Modifying `app.asar` changes the app bundle. Hermes Zh Switcher re-signs the selected app ad-hoc so it can launch locally. Apple notarization is not preserved after local patching.

## Public Screenshot Safety

Do not publish screenshots containing account names, local paths, profile names, tokens, workspace names, chat content, terminal logs, or private connector settings. See [SCREENSHOTS.md](SCREENSHOTS.md).

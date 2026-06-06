# Contributing

Thanks for improving Hermes Zh Switcher.

## Scope

Good contributions include:

- Safer install, uninstall, verify, rollback, or update behavior.
- Better Chinese UI translations for Hermes Desktop labels.
- Runtime audit improvements that reduce false positives.
- Documentation, screenshots, and troubleshooting improvements.
- Compatibility notes for new Hermes Desktop versions.

Out of scope by default:

- Redistributing Hermes Desktop.
- Creating a second public Hermes app bundle.
- Reading or modifying user credentials.
- Changing Hermes backend behavior, model routing, Gateway, MCP, tools, profiles, or user data.
- Adding heavy dependencies without a clear safety or verification benefit.

## Local Verification

```bash
npm run check
npm pack --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
```

For a real local app check, quit Hermes first and run:

```bash
node scripts/install.mjs --app /Applications/Hermes.app --yes
node scripts/verify.mjs --app /Applications/Hermes.app
npm run safety:check
node scripts/uninstall.mjs --app /Applications/Hermes.app --yes
```

## Pull Requests

Please include:

- What changed.
- Why it is safe.
- Verification commands and outputs.
- Whether the change touches `app.asar`, signing, rollback, translations, docs, or package metadata.
- Confirmation that no tokens, cookies, account names, private paths, or raw screenshots were included.

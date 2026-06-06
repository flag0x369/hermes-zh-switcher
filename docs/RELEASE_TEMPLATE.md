# Release Notes Template

Use this template for GitHub releases.

## v0.x.x

### What Changed

- Improved ...
- Added ...
- Fixed ...

### Try It

```bash
git clone https://github.com/flag0x369/hermes-zh-switcher.git
cd hermes-zh-switcher
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --yes
```

### Verify

```bash
node scripts/verify.mjs --app /Applications/Hermes.app
npm run safety:check
```

### Safety Notes

- Unofficial local UI patcher for Hermes Desktop.
- Does not distribute Hermes Desktop.
- Does not read credentials or modify user data.
- Backs up `app.asar` before install.
- Re-signs the local app bundle ad-hoc after patching.

### Known Limits

- Future Hermes Desktop versions may change frontend bundle structure.
- Apple notarization is not preserved after local `app.asar` patching.
- Some brand names, technical IDs, commands, and user-generated content intentionally remain English.

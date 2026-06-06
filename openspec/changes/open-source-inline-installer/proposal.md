## Why

The current package was optimized for a private `/Applications/Hermes.zh.app` copy, which is useful for local testing but not ideal for open-source reuse. Public users need a predictable installer that patches their existing Hermes Desktop install without creating a second app or blocking the upstream Hermes update workflow.

## What Changes

- **BREAKING**: make in-place patching of the user's existing Hermes app the supported install path.
- Remove copy-app installation from public scripts and documentation.
- Add update-safe workflows: uninstall the UI patch before Hermes updates, run the upstream update, then reinstall the patch.
- Add rollback protection so failed patch, uninstall, signature, or injection verification steps restore the previous `app.asar`.
- Preserve Hermes identifiers, bundle metadata, runtime data, backend configuration, update branch settings, API keys, and gateway state.
- Keep the Chinese/English toggle fully reversible and uninstallable.
- Update validation scripts so open-source users can verify install state, signature state, toggle behavior, and upstream update readiness.

## Capabilities

### New Capabilities

- `inline-patch-installer`: installs, verifies, uninstalls, and updates the Chinese UI patch on an existing Hermes Desktop app without creating a duplicate app.

### Modified Capabilities

## Impact

- Affected files: `README.md`, `LICENSE`, `package.json`, `scripts/install.mjs`, `scripts/uninstall.mjs`, `scripts/verify.mjs`, `scripts/safety-check.mjs`, `scripts/audit-bundle.mjs`, `scripts/audit-runtime.mjs`, `dist/hermes-zh-ui.js`.
- New helper script: update workflow wrapper for uninstalling the patch, running upstream Hermes update, reinstalling the patch, and validating the result.
- No production dependencies are added.

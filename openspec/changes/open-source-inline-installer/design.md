## Context

Hermes Desktop does not currently expose a stable global i18n plugin API for replacing all UI strings. The existing package injects a small renderer-side script into `app.asar`, then rewrites visible UI text at runtime while preserving technical identifiers and Hermes behavior.

The private workflow created `/Applications/Hermes.zh.app` so the original `/Applications/Hermes.app` stayed untouched. For public reuse, that creates two problems: users now have two apps with the same bundle identifier, and Hermes self-update can target the copied app rather than the real install. The open-source workflow must instead patch the user's existing app and provide a safe update path.

## Goals / Non-Goals

**Goals:**

- Patch the user's selected Hermes `.app` in place.
- Never create a second Hermes `.app` as part of the default installer.
- Keep uninstall idempotent and reversible at the UI patch level.
- Restore the previous `app.asar` automatically if install or uninstall cannot complete cleanly.
- Provide an update helper that removes the UI patch, runs upstream `hermes update`, then reinstalls the UI patch.
- Avoid changing Hermes backend files, `~/.hermes` data, profiles, gateway settings, API keys, update branch config, bundle identifier, or model/tool IDs.
- Keep validation usable on other Macs.

**Non-Goals:**

- Implement official Hermes i18n support.
- Preserve Apple notarization after modifying `app.asar`; local patching requires re-signing the app bundle.
- Bundle or redistribute Hermes Desktop itself.
- Guarantee future Hermes versions will keep the same frontend structure.

## Decisions

1. **Use in-place patching as the public workflow.**
   - Rationale: it avoids duplicate apps and keeps Hermes updater targeting the same app the user runs.
   - Alternative considered: keep `/Applications/Hermes.zh.app`; rejected because it can confuse updater target selection and Dock/app identity.

2. **Keep the patch limited to `dist/index.html` and `dist/hermes-zh-ui.js` inside `app.asar`.**
   - Rationale: this preserves Hermes backend behavior and makes uninstall straightforward.
   - Alternative considered: rewrite bundled JS assets; rejected because it has higher regression risk.

3. **Use ad-hoc re-signing after patch or uninstall.**
   - Rationale: macOS requires the modified bundle to have a valid code signature after `app.asar` changes.
   - Trade-off: Gatekeeper notarization is not preserved for locally modified apps.

4. **Add a wrapper update workflow rather than trying to intercept Hermes updater internals.**
   - Rationale: the safest update sequence is explicit: remove patch, let Hermes update itself, reinstall patch.
   - Alternative considered: patch Hermes updater logic; rejected because it risks breaking core update behavior.

5. **Rollback the current `app.asar` on failed patch operations.**
   - Rationale: public users need the installer to leave the selected app in its previous state when write, sign, or verification fails.
   - Trade-off: rollback can only restore files this patcher modifies; it cannot repair an already-broken upstream Hermes install.

## Risks / Trade-offs

- Local patching changes the app signature -> re-sign ad-hoc and document Gatekeeper implications.
- Hermes upstream may change bundle structure -> verify script and install script fail loudly instead of guessing.
- Hermes update overwrites `app.asar` -> update helper reinstalls patch after update.
- Users may run native Hermes update without the helper -> patch may disappear after update, but Hermes functionality remains intact and users can reinstall the patch.

## Migration Plan

1. Replace copy-first commands in README and package scripts with in-place commands.
2. Remove public copy-install behavior from the installer.
3. Add rollback around install/uninstall mutation steps.
4. Add an update helper for `uninstall -> hermes update -> install -> verify`.
5. Validate on the existing app and with runtime audits.
6. Publish as an open-source installer package that never includes Hermes binaries.

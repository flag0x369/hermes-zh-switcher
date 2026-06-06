# Roadmap

## Supported

- In-place Hermes Desktop UI patching.
- Chinese/English `中/EN` renderer toggle.
- Backup before install.
- Rollback on failed install/uninstall mutation.
- Uninstall command.
- Update helper for `uninstall -> hermes update -> install -> verify`.
- Syntax and dictionary checks.
- Runtime audit helpers for visible untranslated UI candidates.
- Safety documentation and public screenshot rules.

## Near Term

- Add sanitized before/after screenshots for README.
- Expand translation coverage for newly discovered Hermes Desktop screens.
- Add compatibility notes by Hermes Desktop version.
- Reduce runtime audit false positives for provider names and technical identifiers.

## Not Planned

- Redistributing Hermes Desktop.
- Creating a second public Hermes app bundle.
- Preserving Apple notarization after local `app.asar` patching.
- Modifying Hermes backend, model routing, Gateway, MCP, tool behavior, user data, or credentials.
- Guaranteeing compatibility with every future Hermes Desktop build.

## Long-Term Direction

The best long-term path is official Hermes Desktop i18n support. Until then, this project stays focused on a narrow, reversible, local UI overlay.

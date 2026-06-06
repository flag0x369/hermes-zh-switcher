# Screenshots

Use this guide for public README screenshots and release assets.

## Recommended Shots

- The generated UI effect comparison graphic in `docs/assets/hermes-zh-switcher-before-after.svg`.
- Before/after Hermes Desktop settings page.
- Before/after Skills & Tools page.
- The `中/EN` switch in the lower-right corner.
- A verification terminal showing `node scripts/verify.mjs --app /Applications/Hermes.app` with private paths removed.

## Redaction Rules

Do not publish raw screenshots. Remove or crop:

- Account names, avatars, profile names, and workspace names.
- Local filesystem paths and terminal prompts.
- Tokens, API keys, cookies, private connector settings, webhook URLs, or OAuth details.
- Chat content, private task names, model usage details, or logs.
- Sidebars or panels that reveal unrelated projects.

## File Guidance

- Prefer PNG or WebP.
- SVG comparison graphics are acceptable when they avoid private UI content.
- Keep README image width around 1200-1600px.
- Use descriptive names, for example `docs/assets/hermes-settings-zh.png`.
- Do not commit original raw screenshots.

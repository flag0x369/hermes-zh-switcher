# Hermes Zh Switcher / Hermes 中文 UI 切换器

[简体中文](README.md) | [English](README.en.md)

Hermes Zh Switcher 是一个非官方的 Hermes Desktop 中文 UI 切换器和本地安装器，用来给 macOS 上已有的 Hermes app 增加可关闭的中文界面层。它只向 Hermes Desktop 前端 `app.asar` 注入可卸载的 UI 脚本，不修改 Hermes 后端、模型请求、API Key、本地记忆、知识库、机器人、Gateway、MCP 或工具调用逻辑。

适合搜索 Hermes 中文化、Hermes Desktop zh-CN、macOS app.asar UI patching 和 reversible local i18n overlay 的用户。

![Unofficial](https://img.shields.io/badge/Hermes-unofficial-111827.svg)
![macOS](https://img.shields.io/badge/platform-macOS-2563EB.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-16A34A.svg)
![Safety](https://img.shields.io/badge/safety-backup_%2B_restore-7C3AED.svg)
![License](https://img.shields.io/badge/license-MIT-0F766E.svg)

![Hermes 中文 UI 切换器安装效果对比](docs/assets/hermes-zh-switcher-before-after.svg)

安装后效果对比：设置、技能、工具和网关相关界面从英文扫读变成中文可读，并保留 `中/EN` 切换入口。

## 解决什么问题

| 你遇到的问题 | 这个项目做什么 |
| --- | --- |
| Hermes Desktop UI 大多是英文 | 在前端界面加入中文/英文 `中/EN` 切换 |
| 暂时没有稳定的官方全局 i18n 插件 API | 使用本地、可恢复的 `app.asar` UI 注入 |
| 担心影响 app 或用户数据 | 写入前备份 `app.asar`，支持 uninstall，不碰用户数据和配置 |
| Hermes 更新可能覆盖本地补丁 | 提供 update helper：卸载补丁 -> 运行上游更新 -> 重新安装 -> 验证 |

## 30 秒开始

这个项目不分发 Hermes Desktop。请先从 Hermes 官方渠道安装。当前 Hermes 构建中，`/Applications/Hermes.app` 首次安装时可能只是一个 setup launcher；先打开 Hermes 并完成初始设置，直到桌面 UI 出现，然后退出 Hermes，再运行：

```bash
git clone https://github.com/flag0x369/hermes-zh-switcher.git
cd hermes-zh-switcher
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --yes
open -n /Applications/Hermes.app
```

安装后，Hermes Desktop 右下角会出现 `中/EN` 切换按钮。

## 安全边界

| 范围 | 行为 |
| --- | --- |
| Hermes Desktop `app.asar` | 备份后原地修改；如果 `/Applications/Hermes.app` 是 setup launcher，脚本会自动 patch `~/.hermes/hermes-agent/apps/desktop/release/*/Hermes.app` 下生成的真实 app |
| `app.asar` 内的 `dist/index.html` | 写入一个小的脚本注入标记 |
| `app.asar` 内的 `dist/hermes-zh-ui.js` | 加入中文/英文 UI 切换脚本 |
| 运行时解包目录 `app.asar.unpacked/dist` | 同步写入注入标记和 `hermes-zh-ui.js`，覆盖 Electron 优先加载解包资源的构建 |
| 生成目录 `~/.hermes/hermes-agent/apps/desktop/dist` | 同步写入注入标记和 `hermes-zh-ui.js`，覆盖 Hermes Desktop 从生成目录加载 UI 的构建 |
| `/Applications/Hermes.zh.app` | 不创建 |
| `~/.hermes`、profiles、model config、Gateway config | 不修改 |
| API keys、tokens、cookies、credentials | 不读取 |
| 环境变量、配置 key、模型 ID、工具 ID | 保留英文 |
| macOS signing | 本地修改后执行 ad-hoc re-sign |

更完整的安全说明见 [docs/SAFETY.md](docs/SAFETY.md)。

## 常用命令

### 验证当前安装

```bash
node scripts/verify.mjs --app /Applications/Hermes.app
```

`verify` 会同时检查 `app.asar` 和已发现的运行时 `dist` 目录。只看到 `installed: true` 还不够；`runtimeDists` 里的每一项也应该是 `installed: true`。如果 runtime 没有注入，Hermes 可能仍然显示英文。

### 卸载

```bash
node scripts/uninstall.mjs --app /Applications/Hermes.app --yes
```

卸载会从 `app.asar` 和已发现的运行时 `dist` 目录移除注入标记和 `hermes-zh-ui.js`，不会删除 Hermes 或用户数据。

### 安全更新 Hermes

```bash
node scripts/update-hermes.mjs --app /Applications/Hermes.app --yes
```

这个 helper 会按顺序执行：

1. 卸载中文 UI 注入。
2. 运行上游 `hermes update --yes`。
3. 重新安装中文 UI 注入。
4. 验证补丁状态。

如果你直接使用 Hermes 原生 updater，更新不应该被阻塞。补丁可能会因为上游替换 `app.asar` 而消失，更新后重新运行 install 命令即可。

某些 Hermes Desktop 构建会优先加载解包或生成目录里的 `dist/index.html`，而不是 `app.asar` 内的页面。当前安装器会自动同步 patch 这些目录；如果界面仍是英文，请先运行 `node scripts/verify.mjs --app /Applications/Hermes.app`，确认 `runtimeDists` 全部为 `installed: true`。

### Dry Run

```bash
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/uninstall.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
```

## 验证

```bash
npm run check
node scripts/verify.mjs --app /Applications/Hermes.app
npm run safety:check
npm run audit:runtime -- --limit 220
```

Release/package 检查：

```bash
npm run check
npm pack --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
```

旧的 copy-install 路径会被主动拒绝：

```bash
node scripts/install.mjs --app /Applications/Hermes.app --copy /tmp/Hermes.zh.app --dry-run
```

这个命令应该在修改任何文件之前失败。

## 中文覆盖范围

UI 脚本会翻译常见 Hermes Desktop 标签、设置、setup screens、工具区、模型/供应商控件、消息连接器标签，以及 installer/update 状态。

以下内容会故意保留英文：

- Brand names: `OpenAI`, `Claude`, `Slack`, `WhatsApp`, `Hugging Face`
- Model/provider names and technical terms: `MCP`, `OAuth`, `Token`, `API Key`
- Commands, URLs, paths, environment variables, config keys, tool IDs, skill IDs
- User-generated content, chat messages, terminal output, code, markdown, logs

## 故障排查

### Hermes 正在运行

安装或卸载前请先退出 Hermes。运行中 patch `app.asar` 可能让 bundle 处于不一致状态。

### `app.asar not found`

先打开 `/Applications/Hermes.app` 并完成 Hermes 初始设置，直到桌面 UI 出现；然后退出 Hermes，重新运行 install 命令。新的 Hermes installer 可能先在 `/Applications` 放置 setup launcher，真实 patch 目标会生成在 `~/.hermes/hermes-agent/apps/desktop/release/*/Hermes.app`。

### 更新后中文 UI 消失

Hermes 更新可能替换 `app.asar`。重新安装补丁：

```bash
node scripts/install.mjs --app /Applications/Hermes.app --yes
```

### macOS 提示签名或来源变化

本地修改 `app.asar` 会改变 app bundle。这个项目会对选中的 app 执行 ad-hoc re-sign，确保它可以本地启动。Apple notarization 不会在本地 patch 后保留，这是这种方案的正常限制。

### Installer 失败

installer 写入前会备份原始 `app.asar`。如果写入、签名或注入验证失败，会尝试 rollback。备份位于：

```text
~/Library/Application Support/hermes-zh-switcher/backups/
```

## 项目文档

- [docs/SAFETY.md](docs/SAFETY.md): write scope, backups, restore, and sensitive-data boundary.
- [docs/ROADMAP.md](docs/ROADMAP.md): supported, near-term, and not-planned work.
- [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md): public screenshot and redaction rules.
- [docs/RELEASE_TEMPLATE.md](docs/RELEASE_TEMPLATE.md): release notes template.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution scope and verification checklist.

## GitHub Metadata

建议 description：

```text
Unofficial Chinese UI switcher and reversible local app.asar patcher for Hermes Desktop on macOS.
```

建议 topics：

```text
hermes-desktop, zh-cn, i18n, localization, macos, electron, app-asar, developer-tools
```

## 长期稳定性

这个项目无法保证兼容未来所有 Hermes Desktop 版本。Hermes 可能改变前端 bundle 名称、`index.html` 结构、Electron 打包方式或更新行为。结构不匹配时，installer 和 verifier 应该明确失败，而不是猜测。

长期最好的方案是 Hermes Desktop 官方支持 i18n。

## License

MIT

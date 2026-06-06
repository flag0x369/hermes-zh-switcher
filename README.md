# Hermes 中文切换器

给 Hermes Desktop 安装一个可关闭的中文 UI 层。它只修改本机已安装 Hermes app 里的前端 `app.asar`，不修改 Hermes 后端、模型请求、API Key、本地记忆、知识库、机器人、Gateway、MCP 或工具调用逻辑。

这不是 Hermes 官方插件。Hermes Desktop 目前没有稳定的全局 i18n 插件接口，所以本项目提供的是本地 UI 补丁安装器。

## 安装方式

本项目不分发 Hermes Desktop 本体。请先从 Hermes 官方渠道安装 Hermes，然后在本机现有 Hermes 上安装汉化补丁：

```bash
git clone <你的仓库地址>
cd hermes-zh-switcher
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --yes
open -n /Applications/Hermes.app
```

安装后右下角会出现 `中/EN` 切换按钮。

## 重要安全边界

- 不创建 `/Applications/Hermes.zh.app` 或任何第二个 Hermes app。
- 不修改 `~/.hermes`、profiles、API key、模型配置、Gateway 配置、更新分支配置或用户数据。
- 不翻译环境变量名、配置 key、工具 ID、技能包 ID、命令名、模型名、服务商名、URL 示例和 token 示例。
- 安装器会备份修改前的 `app.asar` 到 `~/Library/Application Support/hermes-zh-switcher/backups/`。
- 如果写入、签名或注入校验失败，安装器会自动恢复本次修改前的 `app.asar`。
- macOS 上修改 app bundle 后会重新 ad-hoc 签名。Apple notarization 不会被保留，这是本地补丁的正常限制。

## 更新 Hermes

推荐用本项目提供的更新 helper：

```bash
node scripts/update-hermes.mjs --app /Applications/Hermes.app --yes
```

它会按顺序执行：

1. 卸载中文 UI 注入
2. 运行官方 `hermes update --yes`
3. 重新安装中文 UI 注入
4. 验证补丁状态

如果你直接使用 Hermes 自带更新功能，更新不会被汉化补丁阻断；但上游更新可能覆盖 `app.asar`，导致中文按钮消失。更新后重新运行安装命令即可。

## 卸载

```bash
node scripts/uninstall.mjs --app /Applications/Hermes.app --yes
```

卸载只移除 `dist/index.html` 里的注入标记和 `dist/hermes-zh-ui.js`，不会删除 Hermes 或用户数据。

## 验证

```bash
node scripts/verify.mjs --app /Applications/Hermes.app
npm run safety:check
npm run audit:runtime -- --limit 220
```

如果只想查看将要发生什么，可以使用 dry-run：

```bash
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/uninstall.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
```

## 常见问题

### 安装时报 Hermes 正在运行

请先退出 Hermes。补丁会改写 app bundle 里的 `app.asar`，运行中修改容易造成状态不一致。

### 更新后中文不见了

这是预期情况。Hermes 更新会替换前端 bundle，重新运行：

```bash
node scripts/install.mjs --app /Applications/Hermes.app --yes
```

### macOS 提示签名或来源变化

本地修改 app bundle 后必须重新签名，本项目使用 ad-hoc 签名。公开分发时建议只分发本补丁安装器，不要分发修改后的 Hermes app。

### 哪些英文会保留

会保留技术标识和品牌名，例如 `OPENAI_API_KEY`、`API_SERVER_KEY`、`AGENT_BROWSER_ENGINE`、`MCP`、`OAuth`、`Token`、`DeepSeek`、`DashScope`、`Hugging Face`、`Slack`、`WhatsApp`、`LINE`、模型名、命令名、URL 示例和技能/工具 ID。

## 开发验证

```bash
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --yes
npm run safety:check
npm run audit:runtime -- --limit 220
node scripts/uninstall.mjs --app /Applications/Hermes.app --yes
```

发布前建议至少跑：

```bash
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --dry-run
node scripts/update-hermes.mjs --app /Applications/Hermes.app --dry-run
node scripts/install.mjs --app /Applications/Hermes.app --copy /tmp/Hermes.zh.app --dry-run
```

最后一条应失败，并提示 copy install 已不再支持。

## 长期稳定性

不能承诺永远兼容未来 Hermes 版本。Hermes Desktop 的前端 bundle 文件名、`index.html` 结构、Electron 打包方式都可能变化。本项目会在结构不匹配时失败并报错，而不是猜测修改。

真正长期稳定的方案是 Hermes 官方提供 Desktop i18n 支持。

## 许可证

MIT

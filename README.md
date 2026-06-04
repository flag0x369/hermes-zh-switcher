# Hermes 中文切换器

给 Hermes Desktop 加一个可关闭的中文 UI 层。它只改桌面端前端资源，不改 Hermes 后端、模型请求、API Key、本地记忆、知识库、机器人或工具逻辑。

## 重要说明

这不是 Hermes 官方插件。Hermes 当前官方插件主要面向 CLI/Gateway/Web Dashboard；Dashboard 插件可以新增 tab、slot 和本地 API，但不能稳定接管 Desktop App 的全局界面文案。

所以本项目采用的是开源补丁安装器：

- 默认创建副本，例如 `/Applications/Hermes.zh.app`
- 原版 `/Applications/Hermes.app` 不会被修改
- `--in-place --yes` 只用于更新增强版副本，不用于 patch 原版
- 安装器会备份原始 `app.asar`
- macOS 上会自动重新 ad-hoc 签名
- UI 右下角提供 `中/EN` 切换按钮

## 安装到副本

```bash
git clone <你的私有仓库地址>
cd hermes-zh-switcher
npm run check
node scripts/install.mjs --app /Applications/Hermes.app --copy /Applications/Hermes.zh.app
open -n /Applications/Hermes.zh.app
```

## 更新增强版副本

如果 `/Applications/Hermes.zh.app` 已经存在，可以直接更新增强版副本：

```bash
node scripts/install.mjs --app /Applications/Hermes.zh.app --in-place --yes
```

安装器会拒绝对 `/Applications/Hermes.app` 执行 in-place patch，避免误改原版。

## 卸载

```bash
node scripts/uninstall.mjs --app /Applications/Hermes.zh.app
```

不要对原版 `/Applications/Hermes.app` 执行卸载或安装操作；原版默认应保持未注入状态。

## 验证

```bash
node scripts/verify.mjs --app /Applications/Hermes.zh.app
```

## 翻译覆盖审计

用原版 Hermes bundle 扫描可能漏翻的 UI 文案：

```bash
npm run audit:app
```

当前版本会保留代码、命令、路径、模型名、平台名、API 名、token 示例和 Hermes 专有名词。审计输出里的 `123456:ABC...`、`hermes tools` 这类内容属于预期保留。

## 长期稳定性

不能承诺“永远不会受版本更新影响”。原因是 Hermes Desktop 的前端 bundle 文件名、`index.html` 结构、Electron 打包方式都可能变化。

本项目尽量降低更新风险：

- 注入点使用 `</head>`，不依赖固定 bundle 文件名
- 多次运行不会重复注入
- 中文脚本包在 `try/catch` 中，失败时不会阻止 Hermes 主应用加载
- 运行时会处理常见拆分文本、斜杠菜单说明和动态状态句式
- 不修改模型、记忆、知识库、机器人、MCP、工具调用逻辑
- 版本更新后可重新运行安装器

真正长期稳定的方案是给 Hermes 官方源码提交 i18n 支持。

## 许可证

MIT

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = fs.readFileSync(path.join(rootDir, 'dist', 'hermes-zh-ui.js'), 'utf8');

const textNodes = [];
const attrs = new Map();
const fakeElement = {
  nodeType: 1,
  parentElement: null,
  closest: () => null,
  hasAttribute: (name) => attrs.has(name),
  getAttribute: (name) => attrs.get(name),
  setAttribute: (name, value) => attrs.set(name, value),
  append: () => {},
  addEventListener: () => {},
  set textContent(value) {
    this._textContent = value;
  },
  get textContent() {
    return this._textContent || '';
  },
  set title(value) {
    attrs.set('title', value);
  },
  get title() {
    return attrs.get('title') || '';
  },
  setAttributeNS: () => {}
};

const document = {
  readyState: 'complete',
  body: fakeElement,
  documentElement: { append: () => {}, lang: 'en' },
  querySelector: () => null,
  createElement: () => fakeElement,
  createTreeWalker: () => ({
    nextNode: () => textNodes.shift() || null
  })
};

const context = {
  console,
  window: {},
  localStorage: {
    getItem: () => '1',
    setItem: () => {}
  },
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_NODE: 9 },
  NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  document
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context);

const samples = [
  ['Skills & Tools', '技能与工具'],
  ['Search settings...', '搜索设置...'],
  ['Send follow-up', '发送后续消息'],
  ['Drop files to attach', '拖入文件以附加'],
  ['NO FOLDER SELECTED', '未选择文件夹'],
  ['Auxiliary models', '辅助模型'],
  ['Set to main', '设为主模型'],
  ['Change', '更改'],
  ['needs setup', '需要设置'],
  ['No model', '未选择模型'],
  ['Other providers', '其他服务商'],
  ['Mute haptics', '关闭触觉反馈'],
  ['checking', '检查中'],
  ['Context Window', '上下文窗口'],
  ['Fallback Models', '备用模型'],
  ['Open a folder', '打开文件夹'],
  ['Open Command Center', '打开命令中心'],
  ['Opens a verification page in your browser — Hermes connects automatically', '会在浏览器中打开验证页面 - Hermes 会自动连接'],
  ['Opens your browser to sign in — Hermes connects automatically', '会打开浏览器登录 - Hermes 会自动连接'],
  ['Opens your browser to sign in, then continues here', '会打开浏览器登录，然后在这里继续'],
  ['Sign in once in your terminal, then come back to chat', '请先在终端登录一次，然后回到聊天'],
  ['Anthropic OAuth: Required Extra Usage Credits to Use Subscription', 'Anthropic OAuth：需要额外使用额度才能使用订阅'],
  ['Collapse', '收起'],
  ['Starting Hermes...', '正在启动 Hermes...'],
  ['Starting Hermes…', '正在启动 Hermes...'],
  ['Hermes Desktop is ready', 'Hermes 桌面版已就绪'],
  ['Hermes Agent is ready', 'Hermes Agent 已就绪'],
  ['Loading configuration...', '正在加载配置...'],
  ['Loading file tree', '正在加载文件树'],
  ['Loading providers...', '正在加载服务商...'],
  ['Starting sign-in for', '正在启动登录：'],
  ['Starting sign-in for OpenAI', '正在为 OpenAI 启动登录'],
  ['Defaults to /Users/example/hermes-projects.', '默认为 /Users/example/hermes-projects。'],
  ['Allow Private URLs', '允许私有 URL'],
  ['Approval Mode', '审批模式'],
  ['Auto-Compression', '自动压缩'],
  ['Browser Private URLs', '浏览器私有 URL'],
  ['Command Timeout', '命令超时'],
  ['Default project folder for tool and terminal work.', '工具和终端工作的默认项目文件夹。'],
  ['Environment Passthrough', '环境变量透传'],
  ['File Read Limit', '文件读取上限'],
  ['Maximum characters Hermes can read from one file request.', 'Hermes 单次文件读取请求可读取的最大字符数。'],
  ['Memory Provider', '记忆服务商'],
  ['Hermes inference gateway status', 'Hermes 推理网关状态'],
  ['Keep shell state between commands when the backend supports it.', '后端支持时，在命令之间保留 shell 状态。'],
  ['Persistent Shell', '持久终端'],
  ['Read Responses Aloud', '朗读回复'],
  ['Transcription Language', '转写语言'],
  ['Search artifacts...', '搜索产物...'],
  ['Waiting for Hermes backend to become ready', '正在等待 Hermes 后端就绪'],
  ['Close command center', '关闭命令中心'],
  ['Close Command Center', '关闭命令中心'],
  ['Search and manage sessions', '搜索和管理会话'],
  ['Persist globally', '全局保存'],
  ['Suggestions', '建议'],
  ['Usage', '用量'],
  ['(unknown)', '（未知）'],
  ['Personality', '人格'],
  ['Default assistant style for new sessions.', '新会话默认助手风格。'],
  ['Timezone', '时区'],
  ['Used when Hermes needs local time context. Blank uses the system timezone.', 'Hermes 需要本地时间上下文时使用。留空则使用系统时区。'],
  ['Reasoning Blocks', '推理区块'],
  ['Show reasoning sections when the backend provides them.', '后端提供时显示推理内容分区。'],
  ['Image Attachments', '图片附件'],
  ['Controls how image attachments are sent to the model.', '控制图片附件如何发送给模型。'],
  ['None', '无'],
  ['Helpful', '乐于助人'],
  ['Concise', '简洁'],
  ['Creative', '创意'],
  ['Teacher', '教师'],
  ['Kawaii', '可爱'],
  ['Catgirl', '猫娘'],
  ['Pirate', '海盗'],
  ['Auto', '自动'],
  ['Uwu', '萌系风格'],
  ['Gateway Connection', '网关连接'],
  ['Hermes Desktop', 'Hermes 桌面版'],
  ['Loading model configuration...', '正在加载模型配置...'],
  ['No matching settings', '没有匹配的设置'],
  ['Remote gateway incomplete', '远程网关信息不完整'],
  ['GPT-5.5 connected.', 'GPT-5.5 已连接。'],
  ['Existing token abc123', '已有 token abc123'],
  ['Existing token saved', '已有 token 已保存'],
  ['12 skill commands available.', '12 个技能命令可用。'],
  ['Show desktop slash commands', '显示桌面端斜杠命令'],
  ['full list of commands + hotkeys', '完整命令列表和快捷键'],
  ['copy selection or last assistant message', '复制所选内容或上一条助手消息'],
  ['Ready when you are', '你准备好时我就在'],
  ['How can I help today?', '今天我能帮你什么？'],
  ['/model uses the desktop model picker instead of a slash command.', '/model 请使用桌面端模型选择器，而不是斜杠命令。'],
  ['/skills is managed from the desktop sidebar.', '/skills 请在桌面侧边栏中管理。'],
  ['Pirate mode is on. What should we work on?', 'Pirate 模式已开启。我们要做什么？'],
  ['What does Pirate Hermes need to see?', 'Pirate Hermes 需要看什么？']
  ,
  ['Search skills...', '搜索技能...'],
  ['Search toolsets...', '搜索工具集...'],
  ['Search API keys...', '搜索 API Key...'],
  ['17/27 toolsets enabled', '17/27 个工具集已启用'],
  ['27 keys', '27 个密钥'],
  ['0 of 28 set', '已设置 0/28'],
  ['0 of 14 configured', '已配置 0/14'],
  ['0 configured', '已配置 0 个'],
  ['Needs keys', '需要密钥'],
  ['Cron Jobs', '定时任务'],
  ['⏰ Cron Jobs', '⏰ 定时任务'],
  ['Configure ⏰ Cron Jobs', '配置 ⏰ 定时任务'],
  ['Browser Automation', '浏览器自动化'],
  ['Image Generation', '图像生成'],
  ['Video Generation', '视频生成'],
  ['create/list/update/pause/resume/run, with optional attached skills', '创建/列出/更新/暂停/恢复/运行，可附加技能'],
  ['Autonomous-Ai-Agents', '自主 AI 智能体'],
  ['Manage Apple Notes via memo CLI: create, search, edit.', '通过 memo CLI 管理 Apple Notes：创建、搜索、编辑。'],
  ['Delegate coding to OpenAI Codex CLI (features, PRs).', '将编码任务委派给 OpenAI Codex CLI（功能、PR）。'],
  ['Use Hermes through iMessage via a BlueBubbles server.', '通过 BlueBubbles 服务器使用 iMessage 运行 Hermes。'],
  ['BlueBubbles server URL', 'BlueBubbles 服务器 URL'],
  ['BlueBubbles server password (from BlueBubbles Server → Settings → API)', 'BlueBubbles 服务器密码（来自 BlueBubbles Server 的设置 → API）'],
  ['Allowed iMessage addresses (comma-separated)', '允许的 iMessage 地址（逗号分隔）'],
  ['Set', '设置'],
  ['Browser engine for local mode: auto (default Chrome), lightpanda (faster, no screenshots), chrome', '本地模式的浏览器引擎：auto（默认 Chrome）、lightpanda（更快、无截图）、chrome'],
  ['OpenAI TTS Model', 'OpenAI TTS 模型'],
  ['Base', '基础'],
  ['Tiny', '微型'],
  ['Small', '小型'],
  ['Smart', '智能'],
  ['Builtin', '内置'],
  ['💻 Terminal & Processes', '💻 终端与进程'],
  ['X (Twitter) Search', 'X (Twitter) 搜索'],
  ['🐦 X (Twitter) Search', '🐦 X (Twitter) 搜索'],
  ['Local / custom endpoint', '本地 / 自定义端点'],
  ['never', '从未'],
  ['(deprecated) Use display.tool_progress in config.yaml instead', '（已弃用）请改用 config.yaml 中的 display.tool_progress'],
  ['Allow all users to interact with messaging bots (true/false). Default: false.', '允许所有用户与消息机器人交互（true/false）。默认：false。'],
  ['Bearer token or \'user:pass\' for Basic auth (optional)', 'Bearer token 或用于 Basic auth 的 \'user:pass\'（可选）'],
  ['/tmp/hermes-home/hermes-agent isn\'t a git checkout — desktop self-update only runs against a source install.', '/tmp/hermes-home/hermes-agent 不是 git checkout - 桌面自更新仅适用于源码安装。'],
  ['Version 0.15.1', '版本 0.15.1'],
  ['A new update is ready (14 changes included).', '有新更新已就绪（包含 14 项变更）。'],
  ['Last checked 2 min ago', '上次检查：2 分钟前'],
  ['Branch main · Commit 0401176', '分支 main · 提交 0401176']
  ,
  ['Setting up Hermes Agent', '正在设置 Hermes Agent'],
  ['This is a one-time setup. The Hermes installer is downloading dependencies and configuring your machine. Subsequent launches will skip this step.', '这是一次性设置。Hermes 安装器正在下载依赖并配置你的机器。后续启动会跳过此步骤。'],
  ['1 of 10 steps complete -- now: Repository (8s)', '1/10 步完成 - 当前：仓库（8 秒）'],
  ['-- now: Prerequisites', '当前：前置检查'],
  ['Installing · 8s', '安装中 · 8 秒'],
  ['Installing · 1:23', '安装中 · 1 分 23 秒'],
  ['Cancel install', '取消安装'],
  ['Show installer output', '显示安装输出'],
  ['Hide installer output', '隐藏安装输出'],
  ['34 lines', '34 行'],
  ['Prerequisites', '前置检查'],
  ['Repository', '仓库'],
  ['Venv', '虚拟环境'],
  ['Python deps', 'Python 依赖'],
  ['Node deps', 'Node 依赖'],
  ['Path', '路径'],
  ['Config', '配置'],
  ['Complete', '完成'],
  ['Refreshing skills', '正在刷新技能'],
  ['Refresh skills', '刷新技能'],
  ['Refreshing artifacts', '正在刷新产物'],
  ['Search MCP servers...', '搜索 MCP 服务器...'],
  ['Branch main · Commit unknown', '分支 main · 提交 未知'],
  ['Branch unknown · Commit unknown', '分支 未知 · 提交 未知'],
  ['Tap "Check now" to look for updates.', '点击“立即检查”查找更新。'],
  ['Toggle 🌐 Browser Automation toolset', '切换 🌐 浏览器自动化 工具集'],
  ['Toggle 🔍 Web Search & Scraping toolset', '切换 🔍 网页搜索与抓取 工具集'],
  ['17/27 toolsets enabled', '17/27 个工具集已启用'],
  ['toolsets enabled', '个工具集已启用'],
  ['Text-to-Speech', '文字转语音'],
  ['fetch messages, search members, create thread', '获取消息、搜索成员、创建线程'],
  ['terminal, process', '终端、进程'],
  ['persistent memory across sessions', '跨会话持久记忆'],
  ['read, write, patch, search', '读取、写入、打补丁、搜索'],
  ['list, view, manage', '列出、查看、管理'],
  ['search past conversations', '搜索历史会话'],
  ['runtime tools from the active context engine', '来自当前上下文引擎的运行时工具'],
  ['list channels/roles, pin, assign roles', '列出频道/角色、置顶、分配角色'],
  ['x_search (requires xAI OAuth or XAI_API_KEY)', 'x_search（需要 xAI OAuth 或 XAI_API_KEY）'],
  ['CONNECTING', '连接中'],
  ['Hide right sidebar', '隐藏右侧边栏'],
  ['Med', '中'],
  ['GPT-5.5 · Med', 'GPT-5.5 · 中'],
  ['Model · openai-codex: gpt-5.5', '模型 · openai-codex: gpt-5.5'],
  ['ASCII art: pyfiglet, cowsay, boxes, image-to-ascii.', 'ASCII 艺术：pyfiglet、cowsay、boxes、image-to-ascii。'],
  ['Generate images, video, and audio with ComfyUI — install, launch, manage nodes/models, run workflows with parameter injection. Uses the official comfy-cli for lifecycle and direct REST/WebSocket API for execution.', '用 ComfyUI 生成图像、视频和音频：安装、启动、管理节点/模型，并通过参数注入运行工作流。生命周期使用官方 comfy-cli，执行使用直接 REST/WebSocket API。'],
  ['Use when building creative browser demos with @chenglou/pretext — DOM-free text layout for ASCII art, typographic flow around obstacles, text-as-geometry games, kinetic typography, and text-powered generative art. Produces single-file HTML demos by default.', '构建 @chenglou/pretext 创意浏览器 demo 时使用：无需 DOM 的文本布局，可用于 ASCII 艺术、绕障碍排版、文字几何游戏、动态字体和文本驱动生成艺术。默认生成单文件 HTML demo。'],
  ['Decomposition playbook + anti-temptation rules for an orchestrator profile routing work through Kanban. The "don\'t do the work yourself" rule and the basic lifecycle are auto-injected into every kanban worker\'s system prompt; this skill is the deeper playbook when you\'re specifically playing the orchestrator role.', '面向通过 Kanban 分派工作的 orchestrator profile 的拆解手册和防越界规则。“不要亲自做任务”规则和基础生命周期会自动注入每个 kanban worker 的系统提示；当你明确扮演 orchestrator 角色时，此技能提供更深入的手册。'],
  ['Himalaya CLI: IMAP/SMTP email from terminal.', 'Himalaya CLI：在终端中使用 IMAP/SMTP 邮件。'],
  ['Play Pokemon via headless emulator + RAM reads.', '通过无头模拟器和 RAM 读取来玩 Pokemon。'],
  ['GitHub PR lifecycle: branch, commit, open, CI, merge.', 'GitHub PR 生命周期：分支、提交、打开 PR、CI、合并。'],
  ['vLLM: high-throughput LLM serving, OpenAI API, quantization.', 'vLLM：高吞吐 LLM 服务、OpenAI API、量化。'],
  ['Create, read, edit .pptx decks, slides, notes, templates.', '创建、读取和编辑 .pptx 演示稿、幻灯片、备注和模板。'],
  ['Karpathy\'s LLM Wiki: build/query interlinked markdown KB.', 'Karpathy 的 LLM Wiki：构建/查询互联的 markdown 知识库。'],
  ['TDD: enforce RED-GREEN-REFACTOR, tests before code.', 'TDD：强制 RED-GREEN-REFACTOR，先写测试再写代码。'],
  ['Krea API key for Krea 2 image generation (Medium + Large)', 'Krea 2 图像生成 API Key（Medium + Large）'],
  ['Langfuse server URL (default: https://cloud.langfuse.com)', 'Langfuse 服务器 URL（默认：https://cloud.langfuse.com）'],
  ['Mistral API key for Voxtral TTS and transcription (STT)', 'Mistral Voxtral TTS 与转写（STT）API Key'],
  ['Model name advertised on /v1/models. Defaults to the profile name (or \'hermes-agent\' for the default profile). Useful for multi-user setups with OpenWebUI.', '在 /v1/models 中展示的模型名称。默认使用 profile 名称（默认 profile 使用 \'hermes-agent\'）。适合搭配 OpenWebUI 的多用户设置。'],
  ['Path to Service Account JSON key (or inline JSON). Leave empty to use Application Default Credentials on Cloud Run / GCE. Falls back to GOOGLE_APPLICATION_CREDENTIALS.', 'Service Account JSON key 文件路径（或内联 JSON）。留空时在 Cloud Run / GCE 使用 Application Default Credentials。可回退到 GOOGLE_APPLICATION_CREDENTIALS。'],
  ['Proxy URL for Telegram connections (overrides HTTPS_PROXY). Supports http://, https://, socks5://', 'Telegram 连接代理 URL（会覆盖 HTTPS_PROXY）。支持 http://、https://、socks5://'],
  ['QQ Bot App ID from QQ Open Platform (q.qq.com)', 'QQ Bot App ID（来自 QQ Open Platform，q.qq.com）'],
  ['Reload MCP', '重新加载 MCP'],
  ['No inference provider configured. Run \'hermes model\' to choose a provider and model, or set an API key (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.) in ~/.hermes/.env. setup.status reports configured credentials, but runtime resolution still failed.', '尚未配置推理服务商。请运行 \'hermes model\' 选择服务商和模型，或在 ~/.hermes/.env 中设置 API key（OPENROUTER_API_KEY、OPENAI_API_KEY 等）。setup.status 显示已有凭据，但运行时解析仍然失败。']
  ,
  ['Strict', '严格'],
  ['Gateway connection...', '网关连接...'],
  ['Test remote', '测试远程网关'],
  ['Save and reconnect', '保存并重新连接'],
  ['Token, cost, and skill activity over time', 'Token、成本和技能活动随时间变化'],
  ['7d', '7 天'],
  ['30d', '30 天'],
  ['90d', '90 天'],
  ['input', '输入'],
  ['output', '输出'],
  ['Status, logs, and system actions', '状态、日志和系统操作'],
  ['Active sessions 0', '活跃会话 0'],
  ['LINE', 'LINE'],
  ['Enable WhatsApp', '启用 WhatsApp'],
  ['Use Hermes through the bundled WhatsApp bridge with QR-based auth.', '通过内置 WhatsApp 桥接使用 Hermes，并用二维码认证。'],
  ['Start the WhatsApp bridge that ships with Hermes, scan the QR code on first run, then enable the platform.', '启动 Hermes 自带的 WhatsApp 桥接，首次运行时扫描二维码，然后启用此平台。'],
  ['Recommended. Comma-separated phone numbers or WhatsApp IDs.', '推荐填写。逗号分隔的手机号或 WhatsApp ID。'],
  ['Connect Hermes to Discord DMs, channels, and threads.', '将 Hermes 连接到 Discord 私信、频道和线程。'],
  ['Use Hermes from Slack via Socket Mode.', '通过 Socket Mode 在 Slack 中使用 Hermes。'],
  ['Talk to Hermes through an IMAP/SMTP mailbox.', '通过 IMAP/SMTP 邮箱与 Hermes 对话。'],
  ['Receive events from GitHub, GitLab, and other webhook sources.', '接收来自 GitHub、GitLab 和其他 webhook 来源的事件。'],
  ['Encrypt key', '加密 key'],
  ['Connect Hermes to a QQ Bot from the QQ Open Platform.', '将 Hermes 连接到 QQ Open Platform 的 QQ Bot。'],
  ['Register an app on the QQ Open Platform (q.qq.com) and copy the App ID and Client Secret.', '在 QQ Open Platform（q.qq.com）注册应用，并复制 App ID 和 Client Secret。'],
  ['Connect Hermes to Tencent Yuanbao.', '将 Hermes 连接到腾讯元宝。'],
  ['Expose Hermes as an OpenAI-compatible HTTP API for tools like Open WebUI.', '将 Hermes 暴露为 OpenAI 兼容 HTTP API，供 Open WebUI 等工具使用。'],
  ['Expose Hermes as an OpenAI-compatible API. Set an auth key, then point Open WebUI / LobeChat / etc. at the host:port.', '将 Hermes 暴露为 OpenAI 兼容 API。设置 auth key 后，将 Open WebUI / LobeChat 等指向对应 host:port。']
];

const failures = samples
  .map(([input, expected]) => [input, expected, context.window.__HERMES_ZH_TEST_TRANSLATE__(input)])
  .filter(([, expected, actual]) => actual !== expected);

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

const fragmentSamples = [
  ['Unset ', '取消设置 '],
  [' and ', ' 和 '],
  [' to use the saved setting below.', '，即可使用下方保存的设置。'],
  ['(provider default)', '（服务商默认）']
  ,
  [' opens the full panel · backspace dismisses', ' 打开完整面板 · Backspace 关闭']
];
const fragmentFailures = fragmentSamples
  .map(([input, expected]) => [input, expected, context.window.__HERMES_ZH_TEST_TRANSLATE_FRAGMENT__(input)])
  .filter(([, expected, actual]) => actual !== expected);

if (fragmentFailures.length) {
  console.error(JSON.stringify(fragmentFailures, null, 2));
  process.exit(1);
}

console.log(`dictionary checks passed (${samples.length + fragmentSamples.length})`);

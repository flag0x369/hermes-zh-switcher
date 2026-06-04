#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    app: '/Applications/Hermes.zh.app',
    includeSkillContent: true,
    limit: 200,
    port: 0,
    profileDir: null,
    setupTimeoutMs: 90000,
    timeoutMs: 60000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg === '--profile-dir') args.profileDir = path.resolve(argv[++i]);
    else if (arg === '--setup-timeout-ms') args.setupTimeoutMs = Number(argv[++i]);
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (arg === '--include-skill-content') args.includeSkillContent = true;
    else if (arg === '--exclude-skill-content') args.includeSkillContent = false;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/audit-runtime.mjs --app /Applications/Hermes.zh.app [--limit 200] [--port 9333] [--profile-dir /tmp/hermes-zh-runtime-profile] [--setup-timeout-ms 90000] [--timeout-ms 60000] [--exclude-skill-content]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function appExecutable(appPath) {
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  const preferred = path.join(macosDir, 'Hermes');
  if (fs.existsSync(preferred)) return preferred;
  const names = fs.readdirSync(macosDir);
  const found = names.find((name) => {
    const full = path.join(macosDir, name);
    return fs.statSync(full).isFile();
  });
  if (!found) throw new Error(`No executable found in ${macosDir}`);
  return path.join(macosDir, found);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function pickPort(requested) {
  if (requested) {
    if (await isPortFree(requested)) return requested;
    throw new Error(`Port is already in use: ${requested}`);
  }
  for (let port = 9333; port <= 9399; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error('No free CDP port found in 9333-9399');
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waitForPage(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await fetchJson(`http://127.0.0.1:${port}/json/list`, 1500);
      const page = list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Keep polling while Electron starts.
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for CDP page on port ${port}`);
}

class CdpClient {
  constructor(url) {
    if (typeof WebSocket !== 'function') {
      throw new Error('Global WebSocket is unavailable. Use Node 22+ to run audit-runtime.mjs.');
    }
    this.ws = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.closed = false;
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const pending = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.error) pending.reject(new Error(JSON.stringify(msg.error)));
      else pending.resolve(msg);
    };
    this.ws.onclose = () => {
      this.closed = true;
      for (const [id, pending] of this.pending.entries()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`CDP socket closed while waiting for request ${id}`));
      }
      this.pending.clear();
    };
    this.ws.onerror = (event) => {
      for (const [id, pending] of this.pending.entries()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`CDP socket error while waiting for request ${id}: ${event?.message || 'unknown error'}`));
      }
      this.pending.clear();
    };
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new Error(`CDP socket is closed before ${method}`));
        return;
      }
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}`));
      }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalValue(expression) {
    const msg = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (msg.result.exceptionDetails) throw new Error(JSON.stringify(msg.result.exceptionDetails));
    return msg.result.result.value;
  }

  close() {
    this.ws.close();
  }
}

const COLLECTOR = `(() => {
  const SKIP_TEXT = '[data-hermes-zh-owned], pre, code, kbd, samp, textarea, article, [role="article"], [data-message], [data-testid*="message" i], .markdown, .prose, .xterm, .katex, .whitespace-pre-wrap.break-words';
  const visible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const pathFor = (el) => {
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      let part = el.tagName.toLowerCase();
      if (el.id) part += '#' + el.id;
      const cls = String(el.className || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
      if (cls) part += '.' + cls;
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  };
  const stripExpected = (text) => String(text || '')
    .replace(/[\\u3400-\\u9fff\\uf900-\\ufaff]/g, ' ')
    .replace(/\\b(Brave\\s+Search|Browser\\s+Use|QQ\\s+Open\\s+Platform|LINE\\s+Developers\\s+Console|Open\\s+WebUI|Bot\\s+Framework|Developer\\s+Portal|Socket\\s+Mode|Basic\\s+Information|App-Level\\s+Tokens|Event\\s+Subscriptions|OAuth\\s*&\\s*Permissions|Push\\s+fallback|Application\\s+Default\\s+Credentials|Service\\s+Account|Cloud\\s+Run|OpenCode\\s+Go|OpenCode\\s+Zen|Kimi\\s*\\/\\s*Moonshot)\\b/gi, ' ')
    .replace(/\\b(Hermes|Agent|Desktop|GPT[-.\\w]*|OpenAI|ChatGPT|Nous|Portal|MiniMax|Qwen|Code|xAI|Grok|Anthropic|OpenRouter|Claude|Gemini|MCP|API|Key|OAuth|URL|Token|SOUL\\.md|YOLO|PR|EN|N|main|provider:model|localhost|branch|model|models|token|tokens|stdio|HTTP|JSON|LaTeX|Mermaid|Slack|Discord|Telegram|WhatsApp|Signal|Matrix|Shift|Ctrl|Cmd|Command|Backspace|Enter|Tab|Option|Alt|Alloy|Base|Edge|ElevenLabs|Scribe|DingTalk|Feishu|Lark|Google|Chat|Home|Assistant|BlueBubbles|iMessage|Mattermost|Microsoft|Msgraph|Graph|Teams|ntfy|SimpleX|Twilio|Yuanbao|Webhook|Webhooks|WeChat|WeCom|QQ|Shell|BotFather|userinfobot|ID|Apple|AirTags|FindMy|memo|remindctl|imsg|Codex|OpenCode|Kanban|Spotify|Camoufox|Camofox|Browserbase|Firecrawl|Brave|Exa|FAL|Chrome|macOS|Mac|Server|Settings|Security|Twitter|Honcho|Azure|Bearer|Pub\\/Sub|GCP|Python|Node|Runtime|DashScope|DeepSeek|Hugging|Face|Xiaomi|MiMo|filesystem|client|secret|auth|Basic|display|tool|gateway|config|yaml|true|false|auto|lightpanda|Tenant|tenant|origin|Subscriber|Subscribers|access|store|Search|Use|Developers?|Console|Messaging|Channel|channels?|home|topic|threading|thread|mention|bot|Framework|Platform|sandbox|NickServ|Kimi|Moonshot|Krea|Medium|Large|Langfuse|Mistral|Voxtral|STT|TTS|Whisper|Parallel|Tavily|native|extract|OpenWebUI|LobeChat|profile|prefill|few|shot|priming|Service|Account|inline|Application|Default|Credentials|Cloud|Run|GCE|HTTPS_PROXY|socks5|App|Client|Secret|scopes|slow|LLM|postback|Push|fallback|scheme|vendor|host|SearXNG|sudo|root|HMAC|SHA256|TLS|header|personal|homeserver|device|recovery|cross|signing|Element|E2EE|Socket|Mode|Information|Level|Tokens|Event|Subscriptions|message|groups|app_mention|app_mentions|Permissions|chat|write|read|files|history|im|users|Hub|GitHub|GitLab|DevOps|MLOps|http|https|xoxb|xapp|user|pass|server|off|first|all|ASCII|pyfiglet|cowsay|boxes|image-to-ascii|AudioCraft|MusicGen|AudioGen|DSPy|LM|RAG|CLI|HTTPS|SSH|gh|OpenHue|Philips|Hue|Reminders|signal-cli|REST|twozero|TouchDesigner|operator|Jupyter|kernel|RAM|Pokemon|orchestrator|worker|app|password|encrypt|verification)\\b/gi, ' ')
    .replace(/\\b[A-Z_]{2,}\\b/g, ' ')
    .replace(/\\b[a-z0-9]+(?:[_-][a-z0-9]+)+\\b/gi, ' ')
    .replace(/\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)+\\b/gi, ' ')
    .replace(/v\\d+(?:\\.\\d+)+/gi, ' ')
    .replace(/\\/[^\\s。]+/g, ' ')
    .replace(/~\\/[^\\s]*/g, ' ')
    .replace(/[\\d\\s.,:;()[\\]{}"'’‘“”_+\\-—·/\\\\<>|@#$%^&*=!?\`~]+/g, ' ');
  const likelyEnglish = (text) => {
    if (/[\\u3400-\\u9fff\\uf900-\\ufaff]/.test(text) && /\\/\\S+/.test(text)) return false;
    return /[A-Za-z]{2,}/.test(stripExpected(text));
  };
  const rows = [];
  const add = (kind, text, el) => {
    const normalized = String(text || '').replace(/\\s+/g, ' ').trim();
    if (!normalized || !/[A-Za-z]/.test(normalized) || !likelyEnglish(normalized)) return;
    rows.push({ kind, text: normalized, path: pathFor(el) });
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue.replace(/\\s+/g, ' ').trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      const el = node.parentElement;
      if (!visible(el)) return NodeFilter.FILTER_REJECT;
      if (el.closest(SKIP_TEXT)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) add('text', node.nodeValue, node.parentElement);
  document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => {
    if (!visible(el)) return;
    ['placeholder', 'aria-label', 'title'].forEach((attr) => add(attr, el.getAttribute(attr), el));
  });
  return {
    url: location.href,
    title: document.title,
    version: window.__HERMES_ZH_SWITCHER_VERSION__,
    lang: document.documentElement.lang,
    toggle: document.querySelector('[data-hermes-zh-owned="toggle"]')?.textContent || null,
    rows
  };
})()`;

function clickScript(pattern) {
  return `(() => {
    const re = new RegExp(${JSON.stringify(pattern)}, 'i');
    const candidates = [...document.querySelectorAll('button, [role="button"], a')];
    const target = candidates.find((el) => re.test(el.innerText || '') || re.test(el.getAttribute('title') || '') || re.test(el.getAttribute('aria-label') || ''));
    if (!target) return null;
    target.click();
    return {
      text: String(target.innerText || '').replace(/\\s+/g, ' ').trim(),
      title: target.getAttribute('title'),
      ariaLabel: target.getAttribute('aria-label')
    };
  })()`;
}

function routeScript(hash) {
  return `(() => {
    location.hash = ${JSON.stringify(hash)};
    return location.hash;
  })()`;
}

async function scan(client, name, action = null, settleMs = 900) {
  if (action) await action();
  await wait(settleMs);
  return { name, ...(await client.evalValue(COLLECTOR)) };
}

async function pressEscape(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await wait(250);
}

async function closeFloatingUi(client) {
  await client.evalValue(`(() => {
    const selectors = [
      '[aria-label="关闭命令中心"]',
      '[aria-label="Close command center"]',
      '[aria-label="Close Command Center"]',
      '[title="关闭命令中心"]',
      '[title="Close command center"]',
      '[title="Close Command Center"]'
    ];
    const button = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
    if (button) button.click();
    return Boolean(button);
  })()`);
  await pressEscape(client);
}

async function closeSettingsUi(client) {
  await client.evalValue(`(() => {
    const candidates = [...document.querySelectorAll('button, [role="button"]')];
    const button = candidates.find((el) => {
      const text = String(el.innerText || '').replace(/\\s+/g, ' ').trim();
      const title = el.getAttribute('title') || '';
      const aria = el.getAttribute('aria-label') || '';
      return /关闭设置|Close settings/i.test(text) || /关闭设置|Close settings/i.test(title) || /关闭设置|Close settings/i.test(aria);
    });
    if (button) button.click();
    return Boolean(button);
  })()`);
  await pressEscape(client);
}

async function waitForInstallerReady(client, timeoutMs) {
  if (!timeoutMs) return { waitedMs: 0, ready: true, skipped: true };
  const started = Date.now();
  const deadline = started + timeoutMs;
  while (Date.now() < deadline) {
    const state = await client.evalValue(`(() => {
      const text = String(document.body?.innerText || '').replace(/\\s+/g, ' ');
      return {
        installing: /Setting up Hermes Agent|正在设置 Hermes Agent|Cancel install|取消安装/.test(text),
        sample: text.slice(0, 240)
      };
    })()`);
    if (!state.installing) {
      return { waitedMs: Date.now() - started, ready: true, skipped: false };
    }
    await wait(1000);
  }
  return { waitedMs: Date.now() - started, ready: false, skipped: false };
}

function summarize(scans, limit, options = {}) {
  const counts = new Map();
  for (const scan of scans) {
    if (!options.includeSkillContent && scan.name.startsWith('skills-tools')) continue;
    for (const row of scan.rows || []) {
      if (
        scan.name.startsWith('skills-tools') &&
        row.kind === 'text' &&
        /^[a-z][a-z0-9_.-]*$/.test(row.text)
      ) {
        continue;
      }
      const key = `${row.kind}\u0000${row.text}`;
      const existing = counts.get(key) || { kind: row.kind, text: row.text, count: 0, screens: new Set(), examples: [] };
      existing.count += 1;
      existing.screens.add(scan.name);
      if (existing.examples.length < 3) existing.examples.push({ screen: scan.name, path: row.path });
      counts.set(key, existing);
    }
  }
  return [...counts.values()]
    .sort((a, b) => a.text.localeCompare(b.text))
    .slice(0, limit)
    .map((row) => ({ ...row, screens: [...row.screens] }));
}

const args = parseArgs(process.argv.slice(2));
if (!fs.existsSync(args.app)) throw new Error(`App not found: ${args.app}`);

const port = await pickPort(args.port);
const profileDir = args.profileDir || fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-zh-runtime-'));
fs.mkdirSync(profileDir, { recursive: true });
const executable = appExecutable(args.app);
const child = spawn(executable, [`--remote-debugging-port=${port}`], {
  env: {
    ...process.env,
    HERMES_DESKTOP_USER_DATA_DIR: profileDir,
    HERMES_HOME: path.join(profileDir, 'hermes-home')
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk.toString();
  if (logs.length > 8000) logs = logs.slice(-8000);
});
child.stderr.on('data', (chunk) => {
  logs += chunk.toString();
  if (logs.length > 8000) logs = logs.slice(-8000);
});

let client;
try {
  const page = await waitForPage(port, args.timeoutMs);
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  const setupWait = await waitForInstallerReady(client, args.setupTimeoutMs);
  const scans = [];
  scans.push(await scan(client, 'home', null, 2600));
  scans.push(await scan(client, 'model-picker', () => client.evalValue(clickScript('切换模型|Switch model|model picker|模型选择器')), 900));
  await closeFloatingUi(client);
  scans.push(await scan(client, 'command-center', () => client.evalValue(clickScript('命令中心|Command Center|Open Command Center|打开命令中心')), 900));
  await closeFloatingUi(client);
  scans.push(await scan(client, 'providers', () => client.evalValue(clickScript('其他服务商|Other providers|我有 API Key|I have an API key')), 1200));
  await closeFloatingUi(client);
  scans.push(await scan(client, 'settings', () => client.evalValue(clickScript('打开设置|Open settings|Settings')), 1200));
  scans.push(await scan(client, 'settings:聊天', () => client.evalValue(routeScript('/settings?tab=config%3Achat')), 700));
  scans.push(await scan(client, 'settings:聊天:personality', () => client.evalValue(clickScript('无|None|乐于助人|Helpful|简洁|Concise')), 700));
  scans.push(await scan(client, 'settings:外观', () => client.evalValue(routeScript('/settings?tab=config%3Aappearance')), 500));
  scans.push(await scan(client, 'settings:工作区', () => client.evalValue(routeScript('/settings?tab=config%3Aworkspace')), 500));
  scans.push(await scan(client, 'settings:安全', () => client.evalValue(routeScript('/settings?tab=config%3Asafety')), 500));
  scans.push(await scan(client, 'settings:安全:approval-options', () => client.evalValue(clickScript('手动|Manual|Smart')), 500));
  scans.push(await scan(client, 'settings:记忆与上下文', () => client.evalValue(routeScript('/settings?tab=config%3Amemory')), 500));
  scans.push(await scan(client, 'settings:记忆与上下文:provider-options', () => client.evalValue(clickScript('\\(无\\)|None|Builtin|Honcho')), 500));
  scans.push(await scan(client, 'settings:语音', () => client.evalValue(routeScript('/settings?tab=config%3Avoice')), 500));
  scans.push(await scan(client, 'settings:语音:model-options', () => client.evalValue(clickScript('基础|Base|Tiny|Small|Large')), 500));
  scans.push(await scan(client, 'settings:高级', () => client.evalValue(routeScript('/settings?tab=config%3Aadvanced')), 650));
  scans.push(await scan(client, 'settings:网关', () => client.evalValue(routeScript('/settings?tab=config%3Agateway')), 650));
  scans.push(await scan(client, 'settings:API Key', () => client.evalValue(routeScript('/settings?tab=keys')), 650));
  scans.push(await scan(client, 'settings:MCP', () => client.evalValue(routeScript('/settings?tab=mcp')), 650));
  scans.push(await scan(client, 'settings:已归档聊天', () => client.evalValue(routeScript('/settings?tab=sessions')), 650));
  scans.push(await scan(client, 'settings:关于', () => client.evalValue(routeScript('/settings?tab=about')), 650));
  await scan(client, 'settings:close', () => client.evalValue(routeScript('/')), 400);
  scans.push(await scan(client, 'skills-tools', () => client.evalValue(clickScript('技能与工具|Skills & Tools')), 1000));
  scans.push(await scan(client, 'skills-tools:skills', () => client.evalValue(clickScript('^技能$|^Skills$')), 800));
  scans.push(await scan(client, 'skills-tools:toolsets', () => client.evalValue(clickScript('工具集|Toolsets')), 800));
  scans.push(await scan(client, 'messaging', () => client.evalValue(clickScript('消息|Messaging')), 1000));
  const messagingPlatformPatterns = [
    ['telegram', '^Telegram$'],
    ['discord', '^Discord$'],
    ['slack', 'Slack'],
    ['mattermost', '^Mattermost$'],
    ['matrix', '^Matrix$'],
    ['whatsapp', '^WhatsApp$'],
    ['signal', '^Signal$'],
    ['bluebubbles', 'BlueBubbles'],
    ['home-assistant', 'Home Assistant'],
    ['email', '邮件|Email'],
    ['sms', '短信|SMS'],
    ['dingtalk', '钉钉|DingTalk'],
    ['feishu-lark', '飞书|Feishu|Lark'],
    ['wecom-group', '企业微信（群机器人）|WeCom \\(group bot\\)'],
    ['wecom-app', '企业微信（应用）|WeCom \\(app\\)'],
    ['wechat-official', '微信公众号|WeChat'],
    ['qq', 'QQ 机器人|QQ Bot'],
    ['yuanbao', '元宝|Yuanbao'],
    ['api-server', 'API 服务器|API server'],
    ['webhook', '^Webhook$'],
    ['google-chat', 'Google Chat'],
    ['irc', '^IRC$'],
    ['line', '^LINE$'],
    ['teams', 'Microsoft Teams'],
    ['msgraph-webhook', 'Microsoft Graph Webhook'],
    ['ntfy', '^ntfy$'],
    ['simplex', 'SimpleX Chat']
  ];
  for (const [slug, pattern] of messagingPlatformPatterns) {
    scans.push(await scan(client, `messaging:${slug}`, () => client.evalValue(clickScript(pattern)), 500));
  }
  scans.push(await scan(client, 'artifacts', () => client.evalValue(clickScript('产物|Artifacts')), 1000));
  const likelyUntranslated = summarize(scans, args.limit, { includeSkillContent: args.includeSkillContent });
  console.log(JSON.stringify({
    app: args.app,
    includeSkillContent: args.includeSkillContent,
    port,
    profileDir,
    setupWait,
    scanCount: scans.length,
    likelyUntranslatedCount: likelyUntranslated.length,
    likelyUntranslated,
    screens: scans.map((scan) => ({
      name: scan.name,
      url: scan.url,
      version: scan.version,
      lang: scan.lang,
      toggle: scan.toggle,
      candidateCount: scan.rows.length
    }))
  }, null, 2));
  if (likelyUntranslated.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    app: args.app,
    port,
    profileDir,
    error: error.message,
    logs
  }, null, 2));
  process.exitCode = 1;
} finally {
  try {
    client?.close();
  } catch {
    // ignore close errors
  }
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 1500).unref();
}

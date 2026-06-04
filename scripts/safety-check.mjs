#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { hasInjection, readAsar } from './asar-utils.mjs';

function parseArgs(argv) {
  const args = { app: '/Applications/Hermes.zh.app', original: '/Applications/Hermes.app', port: 0, timeoutMs: 60000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--original') args.original = argv[++i];
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/safety-check.mjs --app /Applications/Hermes.zh.app --original /Applications/Hermes.app');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function appAsarPath(appPath) {
  return path.join(appPath, 'Contents', 'Resources', 'app.asar');
}

function appExecutable(appPath) {
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  const preferred = path.join(macosDir, 'Hermes');
  if (fs.existsSync(preferred)) return preferred;
  const found = fs.readdirSync(macosDir).find((name) => fs.statSync(path.join(macosDir, name)).isFile());
  if (!found) throw new Error(`No executable found in ${macosDir}`);
  return path.join(macosDir, found);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verifySignature(appPath) {
  if (process.platform !== 'darwin') return { ok: true, output: 'skipped on non-darwin' };
  const result = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { encoding: 'utf8' });
  return { ok: result.status === 0, output: (result.stderr || result.stdout || '').trim() };
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
    assert(await isPortFree(requested), `Port is already in use: ${requested}`);
    return requested;
  }
  for (let port = 9433; port <= 9499; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error('No free CDP port found in 9433-9499');
}

async function waitForPage(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {
      // Keep polling while Electron starts.
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for CDP page on port ${port}`);
}

class CdpClient {
  constructor(url) {
    assert(typeof WebSocket === 'function', 'Global WebSocket is unavailable. Use Node 22+.');
    this.ws = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const pending = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(JSON.stringify(msg.error)));
      else pending.resolve(msg);
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
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
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

async function checkToggle(appPath, port, timeoutMs) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-zh-safety-'));
  const child = spawn(appExecutable(appPath), [`--remote-debugging-port=${port}`], {
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
    const page = await waitForPage(port, timeoutMs);
    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();
    await wait(2600);
    const before = await client.evalValue(`(() => ({
      version: window.__HERMES_ZH_SWITCHER_VERSION__ || null,
      lang: document.documentElement.lang,
      toggle: document.querySelector('[data-hermes-zh-owned="toggle"]')?.textContent || null,
      text: document.body.innerText
    }))()`);
    assert(before.version, 'zh switcher version hook missing');
    assert(before.lang === 'zh-CN', `Expected zh-CN lang before toggle, got ${before.lang}`);
    assert(before.toggle === 'EN', `Expected toggle label EN before toggle, got ${before.toggle}`);
    assert(before.text.includes('技能与工具'), 'Chinese UI text missing before toggle');

    const afterEnglish = await client.evalValue(`(() => {
      document.querySelector('[data-hermes-zh-owned="toggle"]')?.click();
      return true;
    })()`).then(async () => {
      await wait(700);
      return client.evalValue(`(() => ({
        lang: document.documentElement.lang,
        toggle: document.querySelector('[data-hermes-zh-owned="toggle"]')?.textContent || null,
        text: document.body.innerText
      }))()`);
    });
    assert(afterEnglish.lang === 'en', `Expected en lang after toggle, got ${afterEnglish.lang}`);
    assert(afterEnglish.toggle === '中', `Expected toggle label 中 after toggle, got ${afterEnglish.toggle}`);
    assert(afterEnglish.text.includes('Skills & Tools'), 'English UI text was not restored after toggle');

    const afterChinese = await client.evalValue(`(() => {
      document.querySelector('[data-hermes-zh-owned="toggle"]')?.click();
      return true;
    })()`).then(async () => {
      await wait(700);
      return client.evalValue(`(() => ({
        lang: document.documentElement.lang,
        toggle: document.querySelector('[data-hermes-zh-owned="toggle"]')?.textContent || null,
        text: document.body.innerText
      }))()`);
    });
    assert(afterChinese.lang === 'zh-CN', `Expected zh-CN lang after second toggle, got ${afterChinese.lang}`);
    assert(afterChinese.toggle === 'EN', `Expected toggle label EN after second toggle, got ${afterChinese.toggle}`);
    assert(afterChinese.text.includes('技能与工具'), 'Chinese UI text was not restored after second toggle');
    return {
      profileDir,
      version: before.version,
      before: { lang: before.lang, toggle: before.toggle },
      afterEnglish: { lang: afterEnglish.lang, toggle: afterEnglish.toggle },
      afterChinese: { lang: afterChinese.lang, toggle: afterChinese.toggle }
    };
  } catch (error) {
    error.message = `${error.message}\nRuntime logs:\n${logs}`;
    throw error;
  } finally {
    try {
      client?.close();
    } catch {
      // ignore close errors
    }
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 1500).unref();
  }
}

const args = parseArgs(process.argv.slice(2));
assert(fs.existsSync(args.app), `App not found: ${args.app}`);
assert(fs.existsSync(args.original), `Original app not found: ${args.original}`);

const originalArchive = readAsar(appAsarPath(args.original));
const patchedArchive = readAsar(appAsarPath(args.app));
assert(!hasInjection(originalArchive), 'Original app unexpectedly contains zh switcher injection');
assert(hasInjection(patchedArchive), 'Patched app is missing zh switcher injection');

const originalSignature = verifySignature(args.original);
const patchedSignature = verifySignature(args.app);
assert(originalSignature.ok, `Original app signature invalid: ${originalSignature.output}`);
assert(patchedSignature.ok, `Patched app signature invalid: ${patchedSignature.output}`);

const port = await pickPort(args.port);
const toggle = await checkToggle(args.app, port, args.timeoutMs);
console.log(JSON.stringify({
  app: args.app,
  original: args.original,
  originalUnpatched: true,
  patchedInstalled: true,
  originalSignatureOk: originalSignature.ok,
  patchedSignatureOk: patchedSignature.ok,
  toggle
}, null, 2));

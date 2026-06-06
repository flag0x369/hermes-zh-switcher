#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readAsar } from './asar-utils.mjs';

function parseArgs(argv) {
  const args = { app: '/Applications/Hermes.app', limit: 200 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/audit-bundle.mjs --app /Applications/Hermes.app [--limit 200]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function decodeLiteral(s) {
  return s
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\`/g, '`')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
}

function loadDictionaryKeys() {
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const source = fs.readFileSync(path.join(rootDir, 'dist', 'hermes-zh-ui.js'), 'utf8');
  const keys = [...source.matchAll(/^\s*(['"])(.*?)\1:\s*/gm)]
    .map((match) => match[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  return new Set([...keys, ...keys.map((key) => key.toLowerCase())]);
}

function stripExpectedEnglish(s) {
  return String(s || '')
    .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b(Hermes|Agent|Desktop|OpenAI|Nous|Portal|DashScope|Qwen|AWS|Arcee|Xiaomi|MiMo|Hugging|Face|router\.huggingface\.co|ollama\.com|GMI|Cloud|GPU|StepFun|Step|Plan|Slack|Discord|Telegram|WhatsApp|Signal|Matrix|Mattermost|BlueBubbles|iMessage|QQ|WeCom|Bot|MCP|API|Key|URL|Token|ID|AppID|Corp|AES|OAuth|Permissions|Socket|Mode|GitHub|GitLab|OpenWebUI|LobeChat|YOLO|SOUL\.md|PR|TUI|CLI|Gateway|Gateway|profile|profiles|branch|commit|diff|host|port|space|auth|key|secret|token|bot|app|user|users|channel|channels|home|thread|off|stash|discard)\b/gi, ' ')
    .replace(/\b[A-Z_]{2,}\b/g, ' ')
    .replace(/\b[a-z0-9]+(?:[_-][a-z0-9]+)+\b/gi, ' ')
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi, ' ')
    .replace(/[\d\s.,:;()[\]{}"'’‘“”_+\-—·/\\<>|@#$%^&*=!?`~]+/g, ' ');
}

function isExpectedEnglish(s) {
  if (/[\u3400-\u9fff\uf900-\ufaff]/.test(s) && !/[A-Za-z]{2,}/.test(stripExpectedEnglish(s))) return true;
  return [
    /^(Discord|Slack|Telegram|Signal|WhatsApp|Matrix|OpenAI|OpenRouter|Nous|Nous Portal|MiniMax|Qwen Code|xAI Grok|Anthropic|Claude|SOUL\.md|MCP|API Key|HERMES AGENT|GPT|Pro|Free tier|Free|Medium|High|Low|Default|Custom|Fixed|Cyberpunk|Ember|Midnight|Mono|Slate|mermaid|filesystem|file-tree|stderr|stdout|root|my-profile)$/i,
    /^\/[a-z0-9_.-]+$/i,
    /^\d+:[A-Z0-9._-]+(?:\.\.\.)?$/i,
    /^https?:\/\/\S+$/i,
    /^(hermes tools)$/i,
    /(token|URL|API|OAuth|OpenAI|Hermes|MCP|SOUL\.md|endpoint|vLLM|llama\.cpp|Ollama|ChatGPT|Gemini|Grok|LaTeX|\\|xapp-|xoxb-|LOCALAPPDATA|\.env|\.yaml|\.local|@file|@folder|@hermes|\/help|\/skin)/,
    /^(backdrop|blend|brightness|invert color|position|radius scalar|saturate|value|children|height \(dvh\))$/
  ].some((pattern) => pattern.test(s));
}

function isCoveredByDynamicRule(s) {
  return [
    /^Advanced\s+\(\d+\)$/i,
    /^Paste\s+.+?\s+(key|token)$/i,
    /^Last checked .+$/i,
    /^Loading .+$/i
  ].some((pattern) => pattern.test(s));
}

function isLikelyUiString(s) {
  if (!/[A-Za-z]/.test(s) || s.length < 2 || s.length > 180) return false;
  if (/[{}<>]/.test(s)) return false;
  if (/^(http|\.\/|[a-z]+\.|[A-Z_]+$)/.test(s)) return false;
  if (/className|data-|aria-|font-|text-|border-|size-|px-|py-|grid|flex|rounded|absolute|relative/.test(s)) return false;
  return !isExpectedEnglish(s);
}

function forEachQuotedString(source, cb) {
  for (let i = 0; i < source.length; i += 1) {
    const quote = source[i];
    if (quote !== '"' && quote !== "'") continue;
    let raw = '';
    let escaped = false;
    let closed = false;
    for (let j = i + 1; j < source.length; j += 1) {
      const ch = source[j];
      if (escaped) {
        raw += `\\${ch}`;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        i = j;
        closed = true;
        break;
      }
      raw += ch;
      if (raw.length > 240) break;
    }
    if (closed && raw.length <= 240) cb(raw);
  }
}

const args = parseArgs(process.argv.slice(2));
const asarPath = path.join(args.app, 'Contents', 'Resources', 'app.asar');
if (!fs.existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`);

const dictKeys = loadDictionaryKeys();
const archive = readAsar(asarPath);
let js = '';
for (const [filePath, buf] of archive.files) {
  if (filePath.startsWith('dist/assets/') && filePath.endsWith('.js')) {
    js += `${buf.toString('utf8')}\n`;
  }
}

const re = /(?:label|title|description|placeholder|message|body|headline|children):(`(?:\\.|[^`$]){1,240}`|'(?:\\.|[^'\\]){1,240}'|"(?:\\.|[^"\\]){1,240}")/g;
const counts = new Map();
function addCandidate(rawText) {
  const s = decodeLiteral(rawText).replace(/\s+/g, ' ').trim();
  if (isLikelyUiString(s) && !dictKeys.has(s) && !dictKeys.has(s.toLowerCase()) && !isCoveredByDynamicRule(s)) {
    counts.set(s, (counts.get(s) || 0) + 1);
  }
}

let match;
while ((match = re.exec(js))) {
  const raw = match[1];
  addCandidate(raw.slice(1, -1));
}

const slashCommandRe = /\[`\/[^`]+`,`((?:\\.|[^`$]){1,240})`\]/g;
while ((match = slashCommandRe.exec(js))) {
  addCandidate(match[1]);
}

const slashMetaRe = /meta:`((?:\\.|[^`$]){1,240})`/g;
while ((match = slashMetaRe.exec(js))) {
  addCandidate(match[1]);
}

const personalityRe = /\{"personality":"[^"]+","headline":"((?:\\"|[^"])*)","body":"((?:\\"|[^"])*)"\}/g;
while ((match = personalityRe.exec(js))) {
  addCandidate(match[1]);
  addCandidate(match[2]);
}

forEachQuotedString(js, (raw) => {
  const text = decodeLiteral(raw).replace(/\s+/g, ' ').trim();
  if (/^(Loading|Starting)\b/.test(text) || /\bis ready$/.test(text) || /\bwill reconnect using the saved settings\.$/.test(text)) {
    addCandidate(raw);
  }
});

const rows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(JSON.stringify({
  app: args.app,
  likelyUntranslatedCount: rows.length,
  likelyUntranslated: rows.slice(0, args.limit).map(([text, count]) => ({ text, count }))
}, null, 2));

if (rows.length > 0) process.exitCode = 1;

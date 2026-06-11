#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { appAsarPath, resolveHermesApp, runtimeDistCandidates } from './app-resolver.mjs';
import { INDEX_PATH, UI_SCRIPT_PATH, hasInjection, readAsar } from './asar-utils.mjs';

function parseArgs(argv) {
  const args = { app: '/Applications/Hermes.app' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/verify.mjs [--app /Applications/Hermes.app]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  return { ok: result.status === 0, output: (result.stderr || result.stdout || '').trim() };
}

const args = parseArgs(process.argv.slice(2));
const resolved = resolveHermesApp(args.app);
const asarPath = appAsarPath(resolved.app);
if (!fs.existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`);

const archive = readAsar(asarPath);
const installed = hasInjection(archive);
const index = archive.files.get(INDEX_PATH)?.toString('utf8') || '';
const script = archive.files.get(UI_SCRIPT_PATH);
const version = script?.toString('utf8').match(/\bvar VERSION = ['"]([^'"]+)['"]/)?.[1] || null;
const runtimeDists = runtimeDistCandidates(resolved.app).map((distPath) => {
  const runtimeIndex = path.join(distPath, 'index.html');
  const runtimeScript = path.join(distPath, 'hermes-zh-ui.js');
  const indexHtml = fs.existsSync(runtimeIndex) ? fs.readFileSync(runtimeIndex, 'utf8') : '';
  const scriptSource = fs.existsSync(runtimeScript) ? fs.readFileSync(runtimeScript, 'utf8') : '';
  return {
    path: distPath,
    installed: indexHtml.includes('hermes-zh-switcher:start') && Boolean(scriptSource),
    indexHasMarker: indexHtml.includes('hermes-zh-switcher:start'),
    version: scriptSource.match(/\bvar VERSION = ['"]([^'"]+)['"]/)?.[1] || null,
    scriptBytes: scriptSource ? Buffer.byteLength(scriptSource) : 0
  };
});
const signature = process.platform === 'darwin'
  ? run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', resolved.app])
  : { ok: true, output: 'not macOS' };

console.log(JSON.stringify({
  requestedApp: resolved.requested,
  app: resolved.app,
  redirected: resolved.redirected,
  installed,
  indexHasMarker: index.includes('hermes-zh-switcher:start'),
  version,
  scriptBytes: script ? script.length : 0,
  runtimeDists,
  signatureOk: signature.ok,
  signatureOutput: signature.output.split('\n').slice(-2).join('\n')
}, null, 2));

if (!installed || runtimeDists.some((item) => !item.installed) || !signature.ok) process.exit(1);

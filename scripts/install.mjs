#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  INDEX_PATH,
  UI_SCRIPT_PATH,
  hasInjection,
  injectIndex,
  packAsar,
  readAsar,
  sha256
} from './asar-utils.mjs';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const uiScriptPath = path.join(rootDir, 'dist', 'hermes-zh-ui.js');
const originalHermesApp = '/Applications/Hermes.app';

function parseArgs(argv) {
  const args = { app: '/Applications/Hermes.app', copy: null, inPlace: false, yes: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--copy') args.copy = argv[++i];
    else if (arg === '--in-place') args.inPlace = true;
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/install.mjs --app /Applications/Hermes.app [--copy /Applications/Hermes.zh.app | --in-place --yes] [--dry-run]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${cmd} failed`).trim());
  }
  return result.stdout;
}

function signApp(appPath) {
  if (process.platform !== 'darwin') return;
  run('codesign', ['--force', '--deep', '--sign', '-', appPath]);
}

function verifySignature(appPath) {
  if (process.platform !== 'darwin') return;
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
}

function appAsarPath(appPath) {
  return path.join(appPath, 'Contents', 'Resources', 'app.asar');
}

function backupPathFor(appPath, asarHash) {
  const dir = path.join(os.homedir(), 'Library', 'Application Support', 'hermes-zh-switcher', 'backups');
  const appHash = sha256(Buffer.from(path.resolve(appPath))).slice(0, 12);
  return path.join(dir, `${path.basename(appPath)}-${appHash}-${asarHash.slice(0, 12)}.asar`);
}

function copyApp(src, dest, dryRun) {
  if (!dest) return src;
  if (dryRun) {
    console.log(`[dry-run] would copy ${src} -> ${dest}`);
    return dest;
  }
  if (fs.existsSync(dest)) {
    throw new Error(`Copy target already exists: ${dest}`);
  }
  run('ditto', [src, dest]);
  return dest;
}

const args = parseArgs(process.argv.slice(2));
if (!args.copy && !args.inPlace) {
  throw new Error('Choose one install mode: --copy <target.app> or --in-place --yes');
}
if (args.inPlace && !args.yes) {
  throw new Error('In-place install modifies the app bundle. Re-run with --in-place --yes after testing a copy.');
}
if (args.inPlace && path.resolve(args.app) === originalHermesApp) {
  throw new Error('Refusing to patch /Applications/Hermes.app in place. Use --copy /Applications/Hermes.zh.app or target /Applications/Hermes.zh.app.');
}
if (!fs.existsSync(args.app)) throw new Error(`App not found: ${args.app}`);
if (!fs.existsSync(uiScriptPath)) throw new Error(`UI script not found: ${uiScriptPath}`);
const sourceAsarPath = appAsarPath(args.app);
if (!fs.existsSync(sourceAsarPath)) throw new Error(`app.asar not found: ${sourceAsarPath}`);

const targetApp = copyApp(args.app, args.copy, args.dryRun);
if (args.dryRun) {
  console.log(`[dry-run] would patch ${targetApp}`);
  process.exit(0);
}
const asarPath = appAsarPath(targetApp);
if (!fs.existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`);

const originalAsar = fs.readFileSync(asarPath);
const originalHash = sha256(originalAsar);
const backupPath = backupPathFor(targetApp, originalHash);
fs.mkdirSync(path.dirname(backupPath), { recursive: true });
if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, originalAsar);

const archive = readAsar(asarPath);
const indexHtml = archive.files.get(INDEX_PATH)?.toString('utf8');
if (!indexHtml) throw new Error(`${INDEX_PATH} not found in app.asar`);
archive.files.set(INDEX_PATH, Buffer.from(injectIndex(indexHtml), 'utf8'));
archive.files.set(UI_SCRIPT_PATH, fs.readFileSync(uiScriptPath));
packAsar(archive, asarPath);
signApp(targetApp);
verifySignature(targetApp);

const patched = readAsar(asarPath);
if (!hasInjection(patched)) throw new Error('Patch verification failed: injection missing');

console.log(`Installed Hermes zh switcher into: ${targetApp}`);
console.log(`Backup saved at: ${backupPath}`);

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  INDEX_PATH,
  UI_SCRIPT_PATH,
  hasInjection,
  packAsar,
  readAsar,
  removeIndexInjection
} from './asar-utils.mjs';

function parseArgs(argv) {
  const args = { app: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/uninstall.mjs --app /Applications/Hermes.zh.app');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.app) throw new Error('--app is required');
  return args;
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${cmd} failed`).trim());
}

function signApp(appPath) {
  if (process.platform !== 'darwin') return;
  run('codesign', ['--force', '--deep', '--sign', '-', appPath]);
}

function verifySignature(appPath) {
  if (process.platform !== 'darwin') return;
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
}

const args = parseArgs(process.argv.slice(2));
const asarPath = path.join(args.app, 'Contents', 'Resources', 'app.asar');
if (!fs.existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`);

const archive = readAsar(asarPath);
if (!hasInjection(archive)) {
  console.log('Hermes zh switcher is not installed.');
  process.exit(0);
}

const indexHtml = archive.files.get(INDEX_PATH)?.toString('utf8') || '';
archive.files.set(INDEX_PATH, Buffer.from(removeIndexInjection(indexHtml), 'utf8'));
archive.files.delete(UI_SCRIPT_PATH);
packAsar(archive, asarPath);
signApp(args.app);
verifySignature(args.app);

console.log(`Uninstalled Hermes zh switcher from: ${args.app}`);

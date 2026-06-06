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
  const args = { app: '/Applications/Hermes.app', yes: false, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/uninstall.mjs [--app /Applications/Hermes.app] --yes [--dry-run] [--force]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
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

function restoreAsarAfterFailure(asarPath, appPath, originalAsar, cause) {
  try {
    fs.writeFileSync(asarPath, originalAsar);
    signApp(appPath);
    clearLaunchQuarantine(appPath);
    verifySignature(appPath);
  } catch (restoreError) {
    throw new Error(`Uninstall failed and rollback also failed: ${cause.message}\nRollback error: ${restoreError.message}`);
  }
  throw new Error(`Uninstall failed. Previous app.asar was restored: ${cause.message}`);
}

function clearLaunchQuarantine(appPath) {
  if (process.platform !== 'darwin') return;
  spawnSync('xattr', ['-dr', 'com.apple.quarantine', appPath], { encoding: 'utf8' });
}

function appExecutablePath(appPath) {
  if (process.platform !== 'darwin') return null;
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  const preferred = path.join(macosDir, 'Hermes');
  if (fs.existsSync(preferred)) return preferred;
  if (!fs.existsSync(macosDir)) return null;
  const found = fs.readdirSync(macosDir).find((name) => fs.statSync(path.join(macosDir, name)).isFile());
  return found ? path.join(macosDir, found) : null;
}

function assertNotRunning(appPath, force) {
  if (process.platform !== 'darwin' || force) return;
  const executable = appExecutablePath(appPath);
  if (!executable) return;
  const result = spawnSync('pgrep', ['-fl', executable], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    throw new Error(`Hermes appears to be running from ${appPath}. Quit Hermes first, or rerun with --force if you are sure.`);
  }
}

const args = parseArgs(process.argv.slice(2));
const asarPath = path.join(args.app, 'Contents', 'Resources', 'app.asar');
if (!fs.existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`);

const archive = readAsar(asarPath);
if (!hasInjection(archive)) {
  console.log('Hermes zh switcher is not installed.');
  process.exit(0);
}
if (args.dryRun) {
  console.log(`[dry-run] would uninstall Hermes zh switcher from: ${args.app}`);
  process.exit(0);
}
if (!args.yes) {
  throw new Error('Uninstall modifies the selected Hermes app bundle. Re-run with --yes after quitting Hermes.');
}
assertNotRunning(args.app, args.force);

const originalAsar = fs.readFileSync(asarPath);
try {
  const indexHtml = archive.files.get(INDEX_PATH)?.toString('utf8') || '';
  archive.files.set(INDEX_PATH, Buffer.from(removeIndexInjection(indexHtml), 'utf8'));
  archive.files.delete(UI_SCRIPT_PATH);
  packAsar(archive, asarPath);
  signApp(args.app);
  clearLaunchQuarantine(args.app);
  verifySignature(args.app);
} catch (error) {
  restoreAsarAfterFailure(asarPath, args.app, originalAsar, error);
}

console.log(`Uninstalled Hermes zh switcher from: ${args.app}`);

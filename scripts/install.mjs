#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appAsarPath, describeResolvedApp, resolveHermesApp, runtimeDistCandidates } from './app-resolver.mjs';
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

function parseArgs(argv) {
  const args = { app: '/Applications/Hermes.app', yes: false, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--copy') throw new Error('Copy installs are no longer supported. Patch the existing Hermes.app in place.');
    else if (arg === '--in-place') {
      // Kept as a no-op for older command lines; all installs are now in-place.
    }
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/install.mjs [--app /Applications/Hermes.app] --yes [--dry-run] [--force]');
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

function restoreAsarAfterFailure(asarPath, appPath, originalAsar, cause) {
  try {
    fs.writeFileSync(asarPath, originalAsar);
    signApp(appPath);
    clearLaunchQuarantine(appPath);
    verifySignature(appPath);
  } catch (restoreError) {
    throw new Error(`Install failed and rollback also failed: ${cause.message}\nRollback error: ${restoreError.message}`);
  }
  throw new Error(`Install failed. Original app.asar was restored: ${cause.message}`);
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

function backupPathFor(appPath, asarHash) {
  const dir = path.join(os.homedir(), 'Library', 'Application Support', 'hermes-zh-switcher', 'backups');
  const appHash = sha256(Buffer.from(path.resolve(appPath))).slice(0, 12);
  return path.join(dir, `${path.basename(appPath)}-${appHash}-${asarHash.slice(0, 12)}.asar`);
}

function backupRuntimeFilePath(appPath, distPath, fileName, fileHash) {
  const dir = path.join(os.homedir(), 'Library', 'Application Support', 'hermes-zh-switcher', 'backups', 'runtime-dist');
  const appHash = sha256(Buffer.from(path.resolve(appPath))).slice(0, 12);
  const distHash = sha256(Buffer.from(path.resolve(distPath))).slice(0, 12);
  return path.join(dir, `${path.basename(appPath)}-${appHash}-${distHash}-${fileHash.slice(0, 12)}-${fileName}`);
}

function hasRuntimeInjection(distPath) {
  const indexPath = path.join(distPath, 'index.html');
  return fs.existsSync(indexPath)
    && fs.readFileSync(indexPath, 'utf8').includes('hermes-zh-switcher:start')
    && fs.existsSync(path.join(distPath, 'hermes-zh-ui.js'));
}

function installRuntimeDist(distPath, appPath) {
  const indexPath = path.join(distPath, 'index.html');
  const scriptPath = path.join(distPath, 'hermes-zh-ui.js');
  const originalIndex = fs.readFileSync(indexPath);
  const backupPath = backupRuntimeFilePath(appPath, distPath, 'index.html', sha256(originalIndex));
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, originalIndex);
  fs.writeFileSync(indexPath, injectIndex(originalIndex.toString('utf8')));
  fs.copyFileSync(uiScriptPath, scriptPath);
  if (!hasRuntimeInjection(distPath)) throw new Error(`Runtime dist verification failed: ${distPath}`);
}

const args = parseArgs(process.argv.slice(2));
if (!args.yes && !args.dryRun) {
  throw new Error('Installing modifies the selected Hermes app bundle. Re-run with --yes after quitting Hermes.');
}
if (!fs.existsSync(args.app)) throw new Error(`App not found: ${args.app}`);
if (!fs.existsSync(uiScriptPath)) throw new Error(`UI script not found: ${uiScriptPath}`);
const resolved = resolveHermesApp(args.app);
const targetApp = resolved.app;
if (args.dryRun) {
  console.log(`[dry-run] would patch existing Hermes app in place: ${targetApp}`);
  const note = describeResolvedApp(resolved);
  if (note) console.log(`[dry-run] ${note}`);
  process.exit(0);
}
const note = describeResolvedApp(resolved);
if (note) console.log(note);
assertNotRunning(targetApp, args.force);
if (resolved.redirected) assertNotRunning(resolved.requested, args.force);
const asarPath = appAsarPath(targetApp);
if (!fs.existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`);

const originalAsar = fs.readFileSync(asarPath);
const originalHash = sha256(originalAsar);
const backupPath = backupPathFor(targetApp, originalHash);
fs.mkdirSync(path.dirname(backupPath), { recursive: true });
if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, originalAsar);

try {
  const archive = readAsar(asarPath);
  const indexHtml = archive.files.get(INDEX_PATH)?.toString('utf8');
  if (!indexHtml) throw new Error(`${INDEX_PATH} not found in app.asar`);
  archive.files.set(INDEX_PATH, Buffer.from(injectIndex(indexHtml), 'utf8'));
  archive.files.set(UI_SCRIPT_PATH, fs.readFileSync(uiScriptPath));
  packAsar(archive, asarPath);
  const runtimeDists = runtimeDistCandidates(targetApp);
  for (const distPath of runtimeDists) installRuntimeDist(distPath, targetApp);
  signApp(targetApp);
  clearLaunchQuarantine(targetApp);
  verifySignature(targetApp);

  const patched = readAsar(asarPath);
  if (!hasInjection(patched)) throw new Error('Patch verification failed: injection missing');
} catch (error) {
  restoreAsarAfterFailure(asarPath, targetApp, originalAsar, error);
}

console.log(`Installed Hermes zh switcher into: ${targetApp}`);
for (const distPath of runtimeDistCandidates(targetApp)) {
  console.log(`Installed runtime dist overlay into: ${distPath}`);
}
console.log(`Backup saved at: ${backupPath}`);

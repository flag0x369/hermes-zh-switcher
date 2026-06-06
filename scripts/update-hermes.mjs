#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const installScript = path.join(rootDir, 'scripts', 'install.mjs');
const uninstallScript = path.join(rootDir, 'scripts', 'uninstall.mjs');
const verifyScript = path.join(rootDir, 'scripts', 'verify.mjs');

function parseArgs(argv) {
  const args = { app: '/Applications/Hermes.app', hermes: null, yes: false, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') args.app = argv[++i];
    else if (arg === '--hermes') args.hermes = argv[++i];
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/update-hermes.mjs [--app /Applications/Hermes.app] [--hermes hermes] --yes [--dry-run] [--force]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8', stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} failed with exit code ${result.status}`);
  }
}

function commandExists(cmd) {
  const result = spawnSync('sh', ['-lc', `command -v ${JSON.stringify(cmd)} >/dev/null 2>&1`], { encoding: 'utf8' });
  return result.status === 0;
}

function resolveHermes(explicit) {
  if (explicit) return explicit;
  if (commandExists('hermes')) return 'hermes';
  const local = path.join(os.homedir(), '.local', 'bin', 'hermes');
  if (fs.existsSync(local)) return local;
  throw new Error('Could not find the hermes command. Pass --hermes /path/to/hermes.');
}

function printDryRun(args, hermes) {
  const forceArg = args.force ? ' --force' : '';
  console.log(`[dry-run] would uninstall patch: node ${uninstallScript} --app ${args.app} --yes${forceArg}`);
  console.log(`[dry-run] would run upstream update: ${hermes} update --yes`);
  console.log(`[dry-run] would reinstall patch: node ${installScript} --app ${args.app} --yes${forceArg}`);
  console.log(`[dry-run] would verify patch: node ${verifyScript} --app ${args.app}`);
}

const args = parseArgs(process.argv.slice(2));
const hermes = resolveHermes(args.hermes);

if (args.dryRun) {
  printDryRun(args, hermes);
  process.exit(0);
}
if (!args.yes) {
  throw new Error('Updating modifies Hermes files and dependencies. Re-run with --yes after quitting Hermes.');
}

const forceArg = args.force ? ['--force'] : [];

try {
  run(process.execPath, [uninstallScript, '--app', args.app, '--yes', ...forceArg]);
  run(hermes, ['update', '--yes']);
  run(process.execPath, [installScript, '--app', args.app, '--yes', ...forceArg]);
  run(process.execPath, [verifyScript, '--app', args.app]);
  console.log('Hermes updated and zh switcher reinstalled.');
} catch (error) {
  console.error(error.message);
  console.error('If the upstream update already completed, rerun the install command to reinstall the Chinese UI patch.');
  process.exit(1);
}

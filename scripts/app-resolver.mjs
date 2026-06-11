import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function appAsarPath(appPath) {
  return path.join(appPath, 'Contents', 'Resources', 'app.asar');
}

export function unpackedDistPath(appPath) {
  return path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'dist');
}

export function sourceDistPath(appPath) {
  const parts = path.resolve(appPath).split(path.sep);
  const releaseIndex = parts.lastIndexOf('release');
  if (releaseIndex < 0) return null;
  const desktopRoot = parts.slice(0, releaseIndex).join(path.sep) || path.sep;
  return path.join(desktopRoot, 'dist');
}

export function runtimeDistCandidates(appPath) {
  const candidates = [
    unpackedDistPath(appPath),
    sourceDistPath(appPath)
  ].filter(Boolean);
  return [...new Set(candidates)]
    .filter((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
}

export function hasAppAsar(appPath) {
  return fs.existsSync(appAsarPath(appPath));
}

function releaseRoot() {
  return path.join(os.homedir(), '.hermes', 'hermes-agent', 'apps', 'desktop', 'release');
}

function releaseCandidates() {
  const root = releaseRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'Hermes.app'))
    .filter((candidate) => fs.existsSync(candidate));
}

function preferredReleaseCandidates() {
  const arch = process.arch === 'arm64' ? 'mac-arm64' : process.arch === 'x64' ? 'mac-x64' : null;
  const candidates = releaseCandidates();
  if (!arch) return candidates;
  return candidates.sort((a, b) => {
    const aPreferred = a.includes(`${path.sep}${arch}${path.sep}`) ? 0 : 1;
    const bPreferred = b.includes(`${path.sep}${arch}${path.sep}`) ? 0 : 1;
    return aPreferred - bPreferred || a.localeCompare(b);
  });
}

export function resolveHermesApp(appPath, options = {}) {
  const requested = path.resolve(appPath);
  if (!fs.existsSync(requested)) {
    throw new Error(`App not found: ${appPath}`);
  }
  if (hasAppAsar(requested)) {
    return { requested, app: requested, redirected: false, reason: null };
  }

  const candidate = preferredReleaseCandidates().find((item) => hasAppAsar(item));
  if (candidate) {
    return {
      requested,
      app: candidate,
      redirected: true,
      reason: `${requested} is a Hermes setup launcher; patching the generated desktop app instead.`
    };
  }

  const message = [
    `app.asar not found under: ${requested}`,
    'Hermes Desktop may still be a first-run setup launcher.',
    'Open Hermes once and finish the initial setup until the desktop UI appears, then quit Hermes and rerun this command.'
  ].join('\n');
  if (options.allowMissing) return { requested, app: requested, redirected: false, reason: message };
  throw new Error(message);
}

export function describeResolvedApp(resolved) {
  if (!resolved.redirected) return null;
  return `Resolved Hermes app: ${resolved.requested} -> ${resolved.app}`;
}

const fs = require('fs');
const path = require('path');

const PRIVATE_UMASK = 0o077;
const SECURE_FILE_MODE = 0o600;
const SECURE_DIR_MODE = 0o700;

function applySecureUmask() {
  process.umask(PRIVATE_UMASK);
}

function modeString(mode) {
  return (mode & 0o777).toString(8).padStart(3, '0');
}

function isReadableByGroupOrWorld(mode) {
  return Boolean(mode & 0o044);
}

function securePath(targetPath, options = {}) {
  const {
    type = 'file',
    mode = type === 'dir' ? SECURE_DIR_MODE : SECURE_FILE_MODE,
    label = targetPath,
    warnOnly = false,
    warn = console.warn
  } = options;

  if (!targetPath || !fs.existsSync(targetPath)) {
    return { exists: false, changed: false, warning: false };
  }

  const stats = fs.statSync(targetPath);
  const currentMode = stats.mode & 0o777;
  const insecure = isReadableByGroupOrWorld(currentMode);

  if (insecure) {
    warn(`[security] ${label} has insecure permissions ${modeString(currentMode)}; expected ${modeString(mode)} or stricter.`);
  }

  if (!warnOnly && currentMode !== mode) {
    fs.chmodSync(targetPath, mode);
    return { exists: true, changed: true, warning: insecure, mode: currentMode };
  }

  return { exists: true, changed: false, warning: insecure, mode: currentMode };
}

function ensurePrivateDir(dirPath, options = {}) {
  applySecureUmask();
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: SECURE_DIR_MODE });
  }
  return securePath(dirPath, {
    type: 'dir',
    mode: SECURE_DIR_MODE,
    label: options.label || dirPath,
    warn: options.warn || console.warn
  });
}

function hardenRuntimePermissions(rootDir = process.cwd(), options = {}) {
  applySecureUmask();

  const warn = options.warn || console.warn;
  const envPath = path.join(rootDir, '.env');
  const dataDir = path.join(rootDir, 'data');
  const dbPath = path.join(dataDir, 'orchestrator.db');
  const logDir = path.join(rootDir, 'logs');
  const logFiles = ['out.log', 'err.log'].map(file => path.join(logDir, file));

  securePath(envPath, { mode: SECURE_FILE_MODE, label: '.env', warn });
  ensurePrivateDir(dataDir, { label: 'data/', warn });
  securePath(dbPath, { mode: SECURE_FILE_MODE, label: 'SQLite DB', warn });

  for (const filePath of findGeneratedTokenFiles(rootDir)) {
    securePath(filePath, {
      mode: SECURE_FILE_MODE,
      label: path.relative(rootDir, filePath),
      warn
    });
  }

  for (const logFile of logFiles) {
    securePath(logFile, {
      mode: SECURE_FILE_MODE,
      label: path.relative(rootDir, logFile),
      warn
    });
  }
}

function findGeneratedTokenFiles(rootDir) {
  const entries = [];
  for (const name of fs.existsSync(rootDir) ? fs.readdirSync(rootDir) : []) {
    if (name === 'node_modules' || name === '.git') continue;
    const fullPath = path.join(rootDir, name);
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;
    if (isGeneratedTokenFilename(name)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function isGeneratedTokenFilename(name) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.token') ||
    lower.endsWith('.key') ||
    lower.includes('token') ||
    lower.includes('secret')
  );
}

module.exports = {
  PRIVATE_UMASK,
  SECURE_FILE_MODE,
  SECURE_DIR_MODE,
  applySecureUmask,
  securePath,
  ensurePrivateDir,
  hardenRuntimePermissions,
  modeString
};

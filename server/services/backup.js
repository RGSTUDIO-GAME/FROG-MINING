import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, readFileSync } from 'fs';

/**
 * BackupService — Automatic backup of the SQLite database to GitHub.
 *
 * On every interval (BACKUP_INTERVAL_MINUTES) and shortly after data changes,
 * the service creates a consistent snapshot of `frog-mining.db` and pushes it
 * to a GitHub repository using the GitHub Contents API:
 *
 *   backups/latest/frog-mining.db   -> the database snapshot (restore point)
 *   backups/history.json            -> metadata log of every snapshot
 *
 * Configuration (environment variables):
 *   GITHUB_TOKEN            (required) Personal access token with repo scope
 *   GITHUB_REPO             (optional) owner/repo, default: RGSTUDIO-GAME/FROG-MINING
 *   GITHUB_BRANCH           (optional) branch for backups, default: backup
 *   BACKUP_INTERVAL_MINUTES (optional) interval between automatic backups, default: 5
 *   BACKUP_ENABLED          (optional) set to 'false' to disable
 */
const GITHUB_API = 'https://api.github.com';

const config = {
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || 'RGSTUDIO-GAME/FROG-MINING',
  branch: process.env.GITHUB_BRANCH || 'backup',
  intervalMinutes: Math.max(1, Number(process.env.BACKUP_INTERVAL_MINUTES) || 5),
  enabled: process.env.BACKUP_ENABLED !== 'false',
};

const LATEST_PATH = 'backups/latest/frog-mining.db';
const HISTORY_PATH = 'backups/history.json';

let db = null;
let timer = null;
let lastBackupAt = 0;
let lastChangeAt = 0;
let changeTimer = null;
let running = false;
let status = {
  enabled: config.enabled && !!config.token,
  lastBackupAt: null,
  lastResult: null,
  lastError: null,
  backups: 0,
};

async function gh(path, opts = {}) {
  const headers = {
    'User-Agent': 'frog-mining-backup',
    Accept: 'application/vnd.github+json',
    ...(config.token ? { Authorization: 'Bearer ' + config.token } : {}),
  };
  const res = await fetch(GITHUB_API + path, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function ensureBranch() {
  const { res } = await gh('/repos/' + config.repo + '/branches/' + config.branch);
  if (res.status === 200) return true;

  // Create branch from default branch HEAD
  const repo = await gh('/repos/' + config.repo);
  const defaultBranch = repo.body.default_branch || 'main';
  const head = await gh('/repos/' + config.repo + '/git/ref/heads/' + defaultBranch);
  if (!head.body.object?.sha) {
    throw new Error('Tidak dapat membaca HEAD branch ' + defaultBranch);
  }
  const created = await gh('/repos/' + config.repo + '/git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: 'refs/heads/' + config.branch, sha: head.body.object.sha }),
  });
  if (created.res.status !== 201 && created.res.status !== 422) {
    throw new Error('Gagal membuat branch backup: ' + created.res.status);
  }
  return true;
}

async function getFileSha(path) {
  const { res, body } = await gh('/repos/' + config.repo + '/contents/' + path + '?ref=' + config.branch);
  if (res.status === 200 && body.sha) return body.sha;
  return null;
}

async function pushFile(path, contentBase64, message) {
  const sha = await getFileSha(path);
  const payload = {
    message,
    content: contentBase64,
    branch: config.branch,
  };
  if (sha) payload.sha = sha;

  const { res, body } = await gh('/repos/' + config.repo + '/contents/' + path, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error('Gagal push ' + path + ' (' + res.status + '): ' + JSON.stringify(body).slice(0, 200));
  }
  return body.content?.sha || body.commit?.sha || '';
}

async function readHistory() {
  const { res, body } = await gh('/repos/' + config.repo + '/contents/' + HISTORY_PATH + '?ref=' + config.branch);
  if (res.status !== 200 || !body.content) return [];
  try {
    const parsed = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dbStats() {
  try {
    const players = db.prepare('SELECT COUNT(*) AS c FROM players').get()?.c || 0;
    const score = db.prepare('SELECT COALESCE(SUM(total_score),0) AS s FROM players').get()?.s || 0;
    const diamonds = db.prepare('SELECT COALESCE(SUM(total_diamonds),0) AS d FROM players').get()?.d || 0;
    return { players, totalScore: score, totalDiamonds: diamonds };
  } catch {
    return { players: 0, totalScore: 0, totalDiamonds: 0 };
  }
}

export async function backupNow(force = false) {
  if (!status.enabled) return { success: false, error: 'Backup GitHub dinonaktifkan' };
  if (running) return { success: false, error: 'Backup sedang berjalan' };
  if (!force && Date.now() - lastBackupAt < 60_000) {
    return { success: true, skipped: true, lastBackupAt };
  }

  running = true;
  const tmpDir = mkdtempSync(join(tmpdir(), 'frog-backup-'));
  const tmpFile = join(tmpDir, 'frog-mining.db');

  try {
    await ensureBranch();
    await db.backup(tmpFile);

    const buffer = readFileSync(tmpFile);
    const content = buffer.toString('base64');
    const stats = dbStats();
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');

    // Push latest snapshot (overwrite)
    await pushFile(LATEST_PATH, content, 'backup: ' + stamp + ' (' + buffer.length + ' bytes)');

    // Append to history log
    const history = await readHistory();
    history.push({
      timestamp: now.toISOString(),
      size: buffer.length,
      players: stats.players,
      totalScore: stats.totalScore,
      totalDiamonds: stats.totalDiamonds,
      file: 'backups/latest/frog-mining.db',
    });
    const keep = Number(process.env.BACKUP_KEEP_HISTORY) || 500;
    const trimmed = history.slice(-keep);
    await pushFile(HISTORY_PATH, Buffer.from(JSON.stringify(trimmed, null, 2)).toString('base64'), 'backup history: ' + trimmed.length + ' entries');

    lastBackupAt = Date.now();
    status = {
      ...status,
      lastBackupAt: new Date().toISOString(),
      lastResult: 'success',
      lastError: null,
      backups: status.backups + 1,
    };
    console.log('[Backup] Snapshot ' + stamp + ' pushed ke ' + config.repo + ' (' + buffer.length + ' bytes, ' + stats.players + ' players)');
    return { success: true, stamp, size: buffer.length, stats };
  } catch (err) {
    status.lastResult = 'error';
    status.lastError = err.message;
    console.error('[Backup] Gagal:', err.message);
    return { success: false, error: err.message };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    running = false;
  }
}

export function markDataChanged() {
  if (!status.enabled) return;
  lastChangeAt = Date.now();
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    backupNow().catch(() => {});
  }, 30_000);
}

export function getBackupStatus() {
  return { ...status, config: { repo: config.repo, branch: config.branch, intervalMinutes: config.intervalMinutes } };
}

export function initBackup(database) {
  db = database;
  if (!config.enabled) {
    console.warn('[Backup] Dinonaktifkan — set GITHUB_TOKEN untuk mengaktifkan backup otomatis.');
    status.enabled = false;
    return status;
  }
  if (!config.token) {
    status.enabled = false;
    console.warn('[Backup] GITHUB_TOKEN belum di-set — backup otomatis nonaktif.');
    return status;
  }

  // First backup shortly after start, then on interval
  setTimeout(() => backupNow(true).catch(() => {}), 15_000);
  timer = setInterval(() => backupNow().catch(() => {}), config.intervalMinutes * 60_000);
  console.log('[Backup] Terjadwal setiap ' + config.intervalMinutes + ' menit -> ' + config.repo + '#' + config.branch);
  return status;
}

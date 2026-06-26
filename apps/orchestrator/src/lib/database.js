const Database = require('better-sqlite3');
const path = require('path');
const {
  applySecureUmask,
  ensurePrivateDir,
  securePath,
  SECURE_FILE_MODE
} = require('./security');

const DB_PATH = path.join(process.cwd(), 'data', 'orchestrator.db');

let db;

function initDatabase() {
  const dir = path.dirname(DB_PATH);
  applySecureUmask();
  ensurePrivateDir(dir, { label: 'data/' });

  db = new Database(DB_PATH);
  securePath(DB_PATH, {
    mode: SECURE_FILE_MODE,
    label: 'SQLite DB'
  });

  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      issue_number INTEGER PRIMARY KEY,
      title TEXT,
      body TEXT,
      status TEXT DEFAULT 'pending',
      delivery_status TEXT,
      started_at TEXT,
      completed_at TEXT,
      result_summary TEXT,
      retry_count INTEGER DEFAULT 0,
      codex_output TEXT,
      error_log TEXT
    )
  `);

  ensureColumn('issues', 'body', 'TEXT');
  ensureColumn('issues', 'delivery_status', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      old_key_suffix TEXT,
      new_key_suffix TEXT,
      rotated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS codex_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT,
      source TEXT,
      model TEXT,
      status TEXT,
      duration_seconds REAL DEFAULT 0,
      issue_number INTEGER,
      operator_username TEXT,
      operator_display TEXT,
      started_at TEXT,
      completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      files_json TEXT DEFAULT '[]',
      total_tokens INTEGER,
      error TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_lock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      holder_user_id TEXT,
      holder_chat_id TEXT,
      holder_username TEXT,
      holder_display TEXT,
      operation TEXT,
      issue_number INTEGER,
      locked_at TEXT NOT NULL
    )
  `);

  const defaults = [
    ['current_issue_number', 'null'],
    ['pipeline_status', 'idle'],
    ['codex_pid', 'null'],
    ['codex_status', 'idle'],
    ['current_model', process.env.CODEX_DEFAULT_MODEL || 'gpt-5.5'],
    ['api_key_index', '0'],
    ['last_poll_time', 'null'],
    ['codex_lock', 'null'],
    ['pipeline_operator', 'null'],
    ['priority_queue', '[]'],
    ['batch_remaining', '0'],
    ['last_delivery_issue_number', 'null'],
    ['watchdog_last_alert_at', 'null'],
    ['watchdog_last_alert_signature', 'null']
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO pipeline_state (key, value) VALUES (?, ?)');
  for (const [k, v] of defaults) {
    stmt.run(k, v);
  }

  return db;
}

function getState(key) {
  const row = db.prepare('SELECT value FROM pipeline_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setState(key, value) {
  db.prepare('INSERT OR REPLACE INTO pipeline_state (key, value) VALUES (?, ?)').run(key, value);
}

function getJsonState(key, fallback = null) {
  const value = getState(key);
  if (!value || value === 'null') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function setJsonState(key, value) {
  setState(key, value === null || value === undefined ? 'null' : JSON.stringify(value));
}

function getCurrentIssue() {
  const num = getState('current_issue_number');
  if (num === 'null') return null;
  return db.prepare('SELECT * FROM issues WHERE issue_number = ?').get(parseInt(num));
}

function setCurrentIssue(issueNumber) {
  setState('current_issue_number', issueNumber ? issueNumber.toString() : 'null');
}

function recordIssueStart(issueNumber, title, body = null) {
  db.prepare(`
    INSERT OR REPLACE INTO issues 
    (issue_number, title, body, status, delivery_status, started_at, retry_count) 
    VALUES (?, ?, ?, 'in_progress', 'retrying', datetime('now'), COALESCE((SELECT retry_count FROM issues WHERE issue_number = ?), 0))
  `).run(issueNumber, title, body, issueNumber);
  setCurrentIssue(issueNumber);
  setState('pipeline_status', 'running');
}

function recordIssueComplete(issueNumber, summary, codexOutput, deliveryStatus = 'pending_review') {
  db.prepare(`
    UPDATE issues 
    SET status = 'completed', delivery_status = ?, completed_at = datetime('now'), result_summary = ?, codex_output = ?
    WHERE issue_number = ?
  `).run(deliveryStatus, summary, codexOutput, issueNumber);
  setCurrentIssue(issueNumber);
  setState('last_delivery_issue_number', String(issueNumber));
  setState('pipeline_status', deliveryStatus === 'pending_review' ? 'awaiting_delivery' : 'awaiting_approval');
}

function recordIssueError(issueNumber, error) {
  db.prepare(`
    UPDATE issues 
    SET status = 'failed', delivery_status = COALESCE(delivery_status, 'discarded'), completed_at = COALESCE(completed_at, datetime('now')), error_log = ?
    WHERE issue_number = ?
  `).run(error, issueNumber);
  if (getState('current_issue_number') === String(issueNumber)) {
    setCurrentIssue(null);
  }
}

function recordIssueStopped(issueNumber, reason) {
  if (!issueNumber) return;
  db.prepare(`
    UPDATE issues
    SET status = 'stopped', delivery_status = 'discarded', completed_at = COALESCE(completed_at, datetime('now')), error_log = ?
    WHERE issue_number = ?
  `).run(reason || 'Stopped by operator', issueNumber);
  if (getState('current_issue_number') === String(issueNumber)) {
    setCurrentIssue(null);
  }
}

function setIssueDeliveryStatus(issueNumber, deliveryStatus, options = {}) {
  const fields = ['delivery_status = ?'];
  const values = [deliveryStatus];

  if (options.status) {
    fields.push('status = ?');
    values.push(options.status);
  }
  if (options.summary !== undefined) {
    fields.push('result_summary = ?');
    values.push(options.summary);
  }
  if (options.codexOutput !== undefined) {
    fields.push('codex_output = ?');
    values.push(options.codexOutput);
  }
  if (options.error !== undefined) {
    fields.push('error_log = ?');
    values.push(options.error);
  }
  if (options.completedAt) {
    fields.push('completed_at = COALESCE(completed_at, datetime(\'now\'))');
  }

  values.push(issueNumber);
  db.prepare(`UPDATE issues SET ${fields.join(', ')} WHERE issue_number = ?`).run(...values);

  if (deliveryStatus) {
    setState('last_delivery_issue_number', String(issueNumber));
  }

  if (options.clearCurrentIssue && getState('current_issue_number') === String(issueNumber)) {
    setCurrentIssue(null);
  }
}

function getIssueRecord(issueNumber) {
  return db.prepare('SELECT * FROM issues WHERE issue_number = ?').get(Number(issueNumber));
}

function getLastDeliveryIssue() {
  const current = getCurrentIssue();
  if (current?.delivery_status) return current;

  const lastNumber = getState('last_delivery_issue_number');
  if (lastNumber && lastNumber !== 'null') {
    const last = getIssueRecord(lastNumber);
    if (last) return last;
  }

  return db.prepare(`
    SELECT * FROM issues
    WHERE delivery_status IS NOT NULL
    ORDER BY completed_at DESC, started_at DESC
    LIMIT 1
  `).get() || null;
}

function clearCurrentIssue(reason = 'unspecified') {
  const issue = getCurrentIssue();
  setCurrentIssue(null);
  return {
    cleared: Boolean(issue),
    issue,
    reason
  };
}

function inspectActiveIssueState() {
  const currentIssueNumber = getState('current_issue_number');
  const current = getCurrentIssue();
  const codexStatus = (getState('codex_status') || 'idle').toLowerCase();
  const pipelineStatus = (getState('pipeline_status') || 'idle').toLowerCase();
  const issues = [];

  if (!currentIssueNumber || currentIssueNumber === 'null') {
    return {
      ok: true,
      changed: false,
      issues,
      currentIssueNumber: null,
      codexStatus,
      pipelineStatus,
      currentIssue: null
    };
  }

  const pendingDeliveryReview = current &&
    current.delivery_status === 'pending_review' &&
    pipelineStatus === 'awaiting_delivery';
  const pendingDeliveryRetry = current &&
    current.delivery_status === 'retrying' &&
    current.status === 'pending' &&
    pipelineStatus === 'running';

  if (!current) {
    issues.push(`current_issue_number=${currentIssueNumber} has no matching issue row`);
  } else if (current.status !== 'in_progress' && !pendingDeliveryReview && !pendingDeliveryRetry) {
    issues.push(`current issue #${current.issue_number} is ${current.status}, not in_progress`);
  }

  if (current && current.status === 'in_progress' && ['failed', 'stopped', 'timeout', 'idle'].includes(codexStatus)) {
    issues.push(`current issue #${current.issue_number} is in_progress while codex_status=${codexStatus}`);
  }

  if (current && current.status !== 'in_progress' && !pendingDeliveryReview && !pendingDeliveryRetry && ['running', 'paused', 'error'].includes(pipelineStatus)) {
    issues.push(`pipeline_status=${pipelineStatus} while current issue #${current.issue_number} is ${current.status}`);
  }

  return {
    ok: issues.length === 0,
    issues,
    currentIssueNumber,
    currentIssue: current,
    codexStatus,
    pipelineStatus
  };
}

function reconcileActiveIssueState(reason = 'state_reconcile') {
  const inspection = inspectActiveIssueState();

  if (inspection.issues.length === 0) {
    return {
      changed: false,
      ...inspection
    };
  }

  setCurrentIssue(null);
  if (
    ['failed', 'stopped', 'timeout', 'idle'].includes(inspection.codexStatus) ||
    (inspection.currentIssue && inspection.currentIssue.status !== 'in_progress')
  ) {
    setState('pipeline_status', 'idle');
  }

  return {
    changed: true,
    ...inspection,
    clearedIssueNumber: inspection.currentIssue?.issue_number || inspection.currentIssueNumber,
    reason
  };
}

function incrementRetry(issueNumber) {
  db.prepare('UPDATE issues SET retry_count = retry_count + 1 WHERE issue_number = ?').run(issueNumber);
}

function getIssueHistory() {
  return db.prepare('SELECT * FROM issues ORDER BY started_at DESC').all();
}

function recordKeyRotation(oldSuffix, newSuffix, reason) {
  db.prepare('INSERT INTO api_key_rotations (old_key_suffix, new_key_suffix, reason) VALUES (?, ?, ?)')
    .run(oldSuffix, newSuffix, reason);
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some(existing => existing.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function normalizeOperator(operator) {
  if (!operator) return null;

  const user = operator.user || operator.from || operator;
  const firstName = user.first_name || user.firstName || '';
  const lastName = user.last_name || user.lastName || '';
  const username = user.username || operator.username || null;
  const displayName = operator.displayName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    (username ? `@${username}` : null) ||
    (user.id ? `user ${user.id}` : null);

  if (!displayName && !username && !user.id) return null;

  return {
    chatId: operator.chatId || operator.chat_id || null,
    userId: user.id || user.user_id || operator.userId || null,
    username,
    firstName: firstName || null,
    lastName: lastName || null,
    displayName
  };
}

function setPipelineOperator(operator) {
  setJsonState('pipeline_operator', normalizeOperator(operator));
}

function getPipelineOperator() {
  return getJsonState('pipeline_operator', null);
}

function clearPipelineOperator() {
  setJsonState('pipeline_operator', null);
}

function setCodexLock(operator, label) {
  const lock = {
    operator: normalizeOperator(operator),
    label: label || 'Codex run',
    startedAt: new Date().toISOString()
  };
  setJsonState('codex_lock', lock);
  return lock;
}

function getCodexLock() {
  return getJsonState('codex_lock', null);
}

function clearCodexLock() {
  setJsonState('codex_lock', null);
}

function getDeliveryLock() {
  return db.prepare('SELECT * FROM delivery_lock WHERE id = 1').get() || null;
}

function clearDeliveryLock() {
  db.prepare('DELETE FROM delivery_lock WHERE id = 1').run();
}

function parseLockTime(lockedAt) {
  if (!lockedAt) return 0;
  const parsed = Date.parse(lockedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function acquireDeliveryLock(holder, operation, issueNumber, staleMs = 5 * 60 * 1000) {
  const existing = getDeliveryLock();
  const now = Date.now();

  if (existing) {
    const ageMs = now - parseLockTime(existing.locked_at);
    if (ageMs >= 0 && ageMs < staleMs) {
      return {
        acquired: false,
        lock: existing,
        ageMs
      };
    }
    db.prepare('DELETE FROM delivery_lock WHERE id = 1 AND locked_at = ?').run(existing.locked_at);
  }

  const operator = normalizeOperator(holder) || {};
  const lockedAt = new Date(now).toISOString();
  const result = db.prepare(`
    INSERT OR IGNORE INTO delivery_lock (
      id, holder_user_id, holder_chat_id, holder_username,
      holder_display, operation, issue_number, locked_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    operator.userId ? String(operator.userId) : null,
    operator.chatId ? String(operator.chatId) : null,
    operator.username || null,
    operator.displayName || null,
    operation || null,
    Number.isInteger(Number(issueNumber)) ? Number(issueNumber) : null,
    lockedAt
  );

  const lock = getDeliveryLock();
  if (result.changes !== 1) {
    return {
      acquired: false,
      lock,
      ageMs: lock ? now - parseLockTime(lock.locked_at) : null
    };
  }

  return {
    acquired: true,
    lock,
    ageMs: 0
  };
}

function releaseDeliveryLock(lock = null) {
  if (!lock?.locked_at) {
    clearDeliveryLock();
    return;
  }

  db.prepare(`
    DELETE FROM delivery_lock
    WHERE id = 1
      AND locked_at = ?
      AND COALESCE(holder_user_id, '') = COALESCE(?, '')
      AND COALESCE(operation, '') = COALESCE(?, '')
  `).run(
    lock.locked_at,
    lock.holder_user_id || null,
    lock.operation || null
  );
}

function getPriorityQueue() {
  const raw = getJsonState('priority_queue', []);
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter(Number.isInteger).filter(n => n > 0))];
}

function setPriorityQueue(issueNumbers) {
  const normalized = [...new Set((issueNumbers || [])
    .map(Number)
    .filter(Number.isInteger)
    .filter(n => n > 0))];
  setJsonState('priority_queue', normalized);
  return normalized;
}

function prioritizeIssue(issueNumber) {
  const num = Number(issueNumber);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('Issue number must be a positive integer');
  }
  return setPriorityQueue([num, ...getPriorityQueue().filter(n => n !== num)]);
}

function prunePriorityQueue(openIssueNumbers) {
  const open = new Set((openIssueNumbers || []).map(Number));
  return setPriorityQueue(getPriorityQueue().filter(n => open.has(n)));
}

function getBatchRemaining() {
  const value = Number(getState('batch_remaining') || '0');
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function setBatchRemaining(count) {
  const value = Math.max(0, parseInt(count, 10) || 0);
  setState('batch_remaining', String(value));
  return value;
}

function decrementBatchRemaining() {
  const next = Math.max(0, getBatchRemaining() - 1);
  setBatchRemaining(next);
  return next;
}

function recordCodexRun(run) {
  const operator = normalizeOperator(run.operator);
  db.prepare(`
    INSERT INTO codex_runs (
      label, source, model, status, duration_seconds, issue_number,
      operator_username, operator_display, started_at, completed_at,
      files_json, total_tokens, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.label || null,
    run.source || null,
    run.model || null,
    run.status || null,
    Number(run.durationSeconds || run.duration || 0) || 0,
    run.issueNumber || null,
    operator?.username || null,
    operator?.displayName || null,
    run.startedAt || null,
    run.completedAt || new Date().toISOString(),
    JSON.stringify(run.files || []),
    run.totalTokens || null,
    run.error || null
  );
}

function getStats() {
  const issueRows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM issues
    GROUP BY status
  `).all();
  const runs = db.prepare('SELECT * FROM codex_runs ORDER BY completed_at DESC').all();
  const rotationRow = db.prepare('SELECT COUNT(*) AS count FROM api_key_rotations').get();
  const modelRows = db.prepare(`
    SELECT model, COUNT(*) AS count
    FROM codex_runs
    WHERE model IS NOT NULL
    GROUP BY model
    ORDER BY count DESC, model ASC
  `).all();

  const issueCounts = {};
  for (const row of issueRows) {
    issueCounts[row.status || 'unknown'] = row.count;
  }

  const fileCounts = new Map();
  let totalRuntimeSeconds = 0;
  let totalTokens = 0;
  for (const run of runs) {
    totalRuntimeSeconds += Number(run.duration_seconds || 0);
    totalTokens += Number(run.total_tokens || 0);
    let files = [];
    try {
      files = JSON.parse(run.files_json || '[]');
    } catch {
      files = [];
    }
    for (const file of files) {
      const filePath = typeof file === 'string' ? file : file?.path;
      if (!filePath) continue;
      fileCounts.set(filePath, (fileCounts.get(filePath) || 0) + 1);
    }
  }

  return {
    issueCounts,
    lifetimeIssuesProcessed: (issueCounts.completed || 0) + (issueCounts.failed || 0) + (issueCounts.stopped || 0),
    codexRuns: runs.length,
    totalRuntimeSeconds,
    totalTokens,
    favoriteModel: modelRows[0] || null,
    mostModifiedFiles: [...fileCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([path, count]) => ({ path, count })),
    apiKeyRotations: rotationRow?.count || 0,
    lastRun: runs[0] || null
  };
}

module.exports = {
  initDatabase,
  getState,
  setState,
  getCurrentIssue,
  setCurrentIssue,
  recordIssueStart,
  recordIssueComplete,
  recordIssueError,
  recordIssueStopped,
  setIssueDeliveryStatus,
  getIssueRecord,
  getLastDeliveryIssue,
  clearCurrentIssue,
  inspectActiveIssueState,
  reconcileActiveIssueState,
  incrementRetry,
  getIssueHistory,
  recordKeyRotation,
  normalizeOperator,
  setPipelineOperator,
  getPipelineOperator,
  clearPipelineOperator,
  setCodexLock,
  getCodexLock,
  clearCodexLock,
  getDeliveryLock,
  acquireDeliveryLock,
  releaseDeliveryLock,
  getPriorityQueue,
  setPriorityQueue,
  prioritizeIssue,
  prunePriorityQueue,
  getBatchRemaining,
  setBatchRemaining,
  decrementBatchRemaining,
  recordCodexRun,
  getStats
};

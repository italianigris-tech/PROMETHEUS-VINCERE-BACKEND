const Database = require('better-sqlite3');
const path = require('path');
const {
  classifyFailureReason,
  classifyTaskType
} = require('./analytics');
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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  ensureColumn('issues', 'service_outage_retry_count', 'INTEGER DEFAULT 0');
  ensureColumn('issues', 'service_outage_next_retry_at', 'TEXT');
  ensureColumn('issues', 'service_outage_first_seen_at', 'TEXT');

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
    CREATE TABLE IF NOT EXISTS api_key_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      changed_by_user_id TEXT,
      changed_by_username TEXT,
      changed_by_display TEXT,
      action TEXT,
      target TEXT,
      old_key_prefix TEXT,
      old_key_suffix TEXT,
      new_key_prefix TEXT,
      new_key_suffix TEXT,
      fallback_count INTEGER DEFAULT 0,
      note TEXT
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS waiting_users (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      requested_at TEXT NOT NULL,
      task_description TEXT,
      chat_id TEXT,
      display_name TEXT
    )
  `);
  ensureColumn('waiting_users', 'chat_id', 'TEXT');
  ensureColumn('waiting_users', 'display_name', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS surprises (
      id TEXT PRIMARY KEY,
      category TEXT,
      severity TEXT,
      title TEXT,
      description TEXT,
      affectedFiles TEXT,
      suggestedPrompt TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT,
      dismissedAt TEXT,
      dismissedBy TEXT,
      issueId TEXT,
      detailsJson TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS run_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issueId TEXT,
      model TEXT,
      promptLength INTEGER,
      taskType TEXT,
      exitCode INTEGER,
      durationMs INTEGER,
      tokenCost REAL,
      failureReason TEXT,
      filesModified INTEGER,
      testsPassing INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS self_heal_tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      prompt TEXT,
      affectedFile TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      approvedAt TEXT,
      ignoredAt TEXT
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
    ['queue_order', '[]'],
    ['batch_remaining', '0'],
    ['last_delivery_issue_number', 'null'],
    ['watchdog_last_alert_at', 'null'],
    ['watchdog_last_alert_signature', 'null'],
    ['self_heal_last_created_at', 'null']
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

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  return row.value;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, String(value), new Date().toISOString());
}

function getBooleanSetting(key, fallback = false) {
  const value = getSetting(key, fallback ? 'true' : 'false');
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function setBooleanSetting(key, value) {
  setSetting(key, value ? 'true' : 'false');
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
    (
      issue_number, title, body, status, delivery_status, started_at,
      retry_count, service_outage_retry_count, service_outage_next_retry_at,
      service_outage_first_seen_at
    )
    VALUES (
      ?, ?, ?, 'in_progress', 'retrying', datetime('now'),
      COALESCE((SELECT retry_count FROM issues WHERE issue_number = ?), 0),
      COALESCE((SELECT service_outage_retry_count FROM issues WHERE issue_number = ?), 0),
      (SELECT service_outage_next_retry_at FROM issues WHERE issue_number = ?),
      (SELECT service_outage_first_seen_at FROM issues WHERE issue_number = ?)
    )
  `).run(issueNumber, title, body, issueNumber, issueNumber, issueNumber, issueNumber);
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

function recordIssueAwaitingKey(issueNumber, error) {
  db.prepare(`
    UPDATE issues
    SET status = 'pending', delivery_status = 'retrying', error_log = ?
    WHERE issue_number = ?
  `).run(error, issueNumber);
  setCurrentIssue(issueNumber);
  setState('pipeline_status', 'awaiting_key');
}

function isServiceOutageState(status) {
  return status === 'service_unavailable';
}

function recordIssueServiceUnavailable(issueNumber, options = {}) {
  if (!issueNumber) return null;
  const now = options.now || new Date().toISOString();
  const retryCount = Math.max(0, Number(options.retryCount || 0));
  db.prepare(`
    UPDATE issues
    SET status = 'service_unavailable',
        delivery_status = 'retrying',
        service_outage_retry_count = ?,
        service_outage_next_retry_at = ?,
        service_outage_first_seen_at = COALESCE(service_outage_first_seen_at, ?),
        error_log = ?
    WHERE issue_number = ?
  `).run(
    retryCount,
    options.nextRetryAt || null,
    now,
    options.error || 'Codex service temporarily unavailable.',
    issueNumber
  );
  if (getState('current_issue_number') === String(issueNumber)) {
    setCurrentIssue(null);
  }
  return getIssueRecord(issueNumber);
}

function resetIssueServiceOutage(issueNumber, options = {}) {
  if (!issueNumber) return null;
  db.prepare(`
    UPDATE issues
    SET status = 'pending',
        delivery_status = 'retrying',
        service_outage_retry_count = ?,
        service_outage_next_retry_at = NULL,
        service_outage_first_seen_at = CASE WHEN ? THEN NULL ELSE service_outage_first_seen_at END,
        error_log = COALESCE(?, error_log)
    WHERE issue_number = ?
  `).run(
    Number(options.retryCount || 0) || 0,
    options.clearFirstSeen ? 1 : 0,
    options.error || null,
    issueNumber
  );
  return getIssueRecord(issueNumber);
}

function getDueServiceOutageIssues(now = new Date().toISOString()) {
  return db.prepare(`
    SELECT * FROM issues
    WHERE status = 'service_unavailable'
      AND service_outage_next_retry_at IS NOT NULL
      AND service_outage_next_retry_at <= ?
    ORDER BY service_outage_next_retry_at ASC, issue_number ASC
  `).all(now);
}

function resumeDueServiceOutageIssues(now = new Date().toISOString()) {
  const due = getDueServiceOutageIssues(now);
  const update = db.prepare(`
    UPDATE issues
    SET status = 'pending',
        delivery_status = 'retrying',
        service_outage_next_retry_at = NULL
    WHERE issue_number = ?
  `);
  for (const issue of due) {
    update.run(issue.issue_number);
  }
  return due;
}

function discardServiceOutageIssue(issueNumber, reason = 'Discarded by admin') {
  if (!issueNumber) return null;
  db.prepare(`
    UPDATE issues
    SET status = 'failed',
        delivery_status = 'discarded',
        completed_at = COALESCE(completed_at, datetime('now')),
        error_log = ?
    WHERE issue_number = ?
  `).run(reason, issueNumber);
  if (getState('current_issue_number') === String(issueNumber)) {
    setCurrentIssue(null);
  }
  return getIssueRecord(issueNumber);
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
    (pipelineStatus === 'running' || pipelineStatus === 'awaiting_key');

  if (!current) {
    issues.push(`current_issue_number=${currentIssueNumber} has no matching issue row`);
  } else if (current.status !== 'in_progress' && !pendingDeliveryReview && !pendingDeliveryRetry) {
    issues.push(`current issue #${current.issue_number} is ${current.status}, not in_progress`);
  }

  if (current && current.status === 'in_progress' && ['failed', 'stopped', 'timeout', 'idle'].includes(codexStatus)) {
    issues.push(`current issue #${current.issue_number} is in_progress while codex_status=${codexStatus}`);
  }

  if (current && current.status !== 'in_progress' && !pendingDeliveryReview && !pendingDeliveryRetry && ['running', 'paused', 'error', 'awaiting_key'].includes(pipelineStatus)) {
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

function recordApiKeyChange(change = {}) {
  const operator = normalizeOperator(change.operator);
  db.prepare(`
    INSERT INTO api_key_changes (
      changed_by_user_id, changed_by_username, changed_by_display,
      action, target, old_key_prefix, old_key_suffix,
      new_key_prefix, new_key_suffix, fallback_count, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    operator?.userId ? String(operator.userId) : null,
    operator?.username || null,
    operator?.displayName || null,
    change.action || null,
    change.target || null,
    change.oldKeyPrefix || null,
    change.oldKeySuffix || null,
    change.newKeyPrefix || null,
    change.newKeySuffix || null,
    Number(change.fallbackCount || 0) || 0,
    change.note || null
  );
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some(existing => existing.name === column)) return;
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (!/duplicate column name/i.test(String(error?.message || ''))) {
      throw error;
    }
  }
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

function getWaitingUserId(operatorOrId) {
  if (operatorOrId === null || operatorOrId === undefined) return null;
  if (typeof operatorOrId === 'string' || typeof operatorOrId === 'number') {
    const raw = String(operatorOrId).trim();
    return raw || null;
  }

  const operator = normalizeOperator(operatorOrId);
  if (!operator) return null;
  if (operator.userId) return String(operator.userId);
  if (operator.chatId) return `chat:${operator.chatId}`;
  if (operator.username) return `username:${operator.username}`;
  return null;
}

function rowToWaitingUser(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username || null,
    chatId: row.chat_id || null,
    displayName: row.display_name || null,
    requestedAt: row.requested_at,
    taskDescription: row.task_description || null
  };
}

function getWaitingUsers() {
  return db.prepare(`
    SELECT user_id, username, chat_id, display_name, requested_at, task_description
    FROM waiting_users
    ORDER BY requested_at ASC, user_id ASC
  `).all().map(rowToWaitingUser);
}

function getWaitingUser(operatorOrId) {
  const userId = getWaitingUserId(operatorOrId);
  if (!userId) return null;
  return rowToWaitingUser(db.prepare(`
    SELECT user_id, username, chat_id, display_name, requested_at, task_description
    FROM waiting_users
    WHERE user_id = ?
  `).get(userId));
}

function getWaitingUserPosition(operatorOrId) {
  const userId = getWaitingUserId(operatorOrId);
  if (!userId) return null;
  const waiters = getWaitingUsers();
  const index = waiters.findIndex(waiter => waiter.userId === userId);
  return index >= 0 ? index + 1 : null;
}

function addWaitingUser(operatorOrId, taskDescription = 'Codex session') {
  const operator = normalizeOperator(operatorOrId) || {};
  const userId = getWaitingUserId(operator) || getWaitingUserId(operatorOrId);
  if (!userId) {
    throw new Error('WAITING_USER_MISSING_ID: Telegram user id is required to queue for Codex');
  }

  const existing = getWaitingUser(userId);
  const requestedAt = existing?.requestedAt || new Date().toISOString();
  db.prepare(`
    INSERT INTO waiting_users (
      user_id, username, chat_id, display_name, requested_at, task_description
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      chat_id = excluded.chat_id,
      display_name = excluded.display_name,
      task_description = excluded.task_description
  `).run(
    userId,
    operator.username || null,
    operator.chatId ? String(operator.chatId) : null,
    operator.displayName || null,
    requestedAt,
    taskDescription || existing?.taskDescription || 'Codex session'
  );

  return {
    user: getWaitingUser(userId),
    position: getWaitingUserPosition(userId),
    alreadyWaiting: Boolean(existing)
  };
}

function removeWaitingUser(operatorOrId) {
  const userId = getWaitingUserId(operatorOrId);
  if (!userId) return null;
  const existing = getWaitingUser(userId);
  db.prepare('DELETE FROM waiting_users WHERE user_id = ?').run(userId);
  return existing;
}

function clearWaitingUsers() {
  const users = getWaitingUsers();
  db.prepare('DELETE FROM waiting_users').run();
  return users;
}

function recordSurprise(surprise) {
  if (!surprise?.id) return null;
  const createdAt = surprise.createdAt || new Date().toISOString();
  db.prepare(`
    INSERT INTO surprises (
      id, category, severity, title, description, affectedFiles,
      suggestedPrompt, status, createdAt, detailsJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      severity = excluded.severity,
      title = excluded.title,
      description = excluded.description,
      affectedFiles = excluded.affectedFiles,
      suggestedPrompt = excluded.suggestedPrompt,
      detailsJson = excluded.detailsJson
  `).run(
    surprise.id,
    surprise.category || null,
    surprise.severity || null,
    surprise.title || null,
    surprise.description || null,
    JSON.stringify(surprise.affectedFiles || []),
    surprise.suggestedPrompt || null,
    createdAt,
    JSON.stringify(surprise)
  );
  return getSurprise(surprise.id);
}

function getSurprise(id) {
  const row = db.prepare('SELECT * FROM surprises WHERE id = ?').get(id);
  return rowToSurprise(row);
}

function getPendingSurprises(limit = 10) {
  return db.prepare(`
    SELECT * FROM surprises
    WHERE status = 'pending'
    ORDER BY createdAt DESC
    LIMIT ?
  `).all(limit).map(rowToSurprise);
}

function getDismissedSurprises() {
  return db.prepare(`
    SELECT id, dismissedAt, dismissedBy
    FROM surprises
    WHERE status = 'dismissed' AND dismissedAt IS NOT NULL
  `).all();
}

function dismissSurprise(id, dismissedBy = null) {
  db.prepare(`
    UPDATE surprises
    SET status = 'dismissed', dismissedAt = ?, dismissedBy = ?
    WHERE id = ?
  `).run(new Date().toISOString(), dismissedBy || null, id);
  return getSurprise(id);
}

function acceptSurprise(id, issueId = null) {
  db.prepare(`
    UPDATE surprises
    SET status = 'accepted', issueId = ?
    WHERE id = ?
  `).run(issueId ? String(issueId) : null, id);
  return getSurprise(id);
}

function completeSurprise(id) {
  db.prepare('UPDATE surprises SET status = ? WHERE id = ?').run('completed', id);
  return getSurprise(id);
}

function rowToSurprise(row) {
  if (!row) return null;
  let affectedFiles = [];
  let details = {};
  try {
    affectedFiles = JSON.parse(row.affectedFiles || '[]');
  } catch {
    affectedFiles = [];
  }
  try {
    details = JSON.parse(row.detailsJson || '{}');
  } catch {
    details = {};
  }
  return {
    ...details,
    id: row.id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    affectedFiles,
    suggestedPrompt: row.suggestedPrompt,
    status: row.status,
    createdAt: row.createdAt,
    dismissedAt: row.dismissedAt,
    dismissedBy: row.dismissedBy,
    issueId: row.issueId
  };
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

function getQueueOrder() {
  const raw = getJsonState('queue_order', []);
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter(Number.isInteger).filter(n => n > 0))];
}

function setQueueOrder(issueNumbers) {
  const normalized = [...new Set((issueNumbers || [])
    .map(Number)
    .filter(Number.isInteger)
    .filter(n => n > 0))];
  setJsonState('queue_order', normalized);
  return normalized;
}

function pruneQueueOrder(openIssueNumbers) {
  const open = new Set((openIssueNumbers || []).map(Number));
  return setQueueOrder(getQueueOrder().filter(n => open.has(n)));
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
  const status = run.status || null;
  const durationSeconds = Number(run.durationSeconds || run.duration || 0) || 0;
  const files = run.files || [];
  const error = run.error || null;
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
    status,
    durationSeconds,
    run.issueNumber || null,
    operator?.username || null,
    operator?.displayName || null,
    run.startedAt || null,
    run.completedAt || new Date().toISOString(),
    JSON.stringify(files),
    run.totalTokens || null,
    error
  );
  recordRunAnalytics({
    issueId: run.issueNumber || run.label || null,
    model: run.model || null,
    promptLength: run.promptLength || 0,
    taskType: classifyTaskType(`${run.label || ''}\n${run.error || ''}`),
    exitCode: status === 'completed' ? 0 : 1,
    durationMs: Math.round(durationSeconds * 1000),
    tokenCost: run.tokenCost || null,
    failureReason: classifyFailureReason(error || status),
    filesModified: Array.isArray(files) ? files.length : 0,
    testsPassing: run.testsPassing ?? null,
    createdAt: run.completedAt || new Date().toISOString()
  });
}

function recordRunAnalytics(row = {}) {
  db.prepare(`
    INSERT INTO run_analytics (
      issueId, model, promptLength, taskType, exitCode, durationMs,
      tokenCost, failureReason, filesModified, testsPassing, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.issueId ? String(row.issueId) : null,
    row.model || null,
    Number(row.promptLength || 0) || 0,
    row.taskType || null,
    Number.isInteger(Number(row.exitCode)) ? Number(row.exitCode) : null,
    Number(row.durationMs || 0) || 0,
    row.tokenCost || null,
    row.failureReason || null,
    Number(row.filesModified || 0) || 0,
    row.testsPassing === null || row.testsPassing === undefined ? null : Number(row.testsPassing),
    row.createdAt || new Date().toISOString()
  );
}

function getRunAnalytics(limit = 500) {
  return db.prepare(`
    SELECT * FROM run_analytics
    ORDER BY createdAt DESC
    LIMIT ?
  `).all(limit);
}

function recordSelfHealTask(task) {
  if (!task?.id) return null;
  db.prepare(`
    INSERT OR IGNORE INTO self_heal_tasks (
      id, title, description, prompt, affectedFile, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    task.id,
    task.title || null,
    task.description || null,
    task.prompt || null,
    task.affectedFile || null,
    task.createdAt || new Date().toISOString()
  );
  setState('self_heal_last_created_at', new Date().toISOString());
  return getSelfHealTask(task.id);
}

function getSelfHealTask(id) {
  return db.prepare('SELECT * FROM self_heal_tasks WHERE id = ?').get(id) || null;
}

function updateSelfHealTaskStatus(id, status) {
  const field = status === 'approved' ? 'approvedAt' : status === 'ignored' ? 'ignoredAt' : null;
  if (field) {
    db.prepare(`UPDATE self_heal_tasks SET status = ?, ${field} = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), id);
  } else {
    db.prepare('UPDATE self_heal_tasks SET status = ? WHERE id = ?').run(status, id);
  }
  return getSelfHealTask(id);
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
  getSetting,
  setSetting,
  getBooleanSetting,
  setBooleanSetting,
  getCurrentIssue,
  setCurrentIssue,
  recordIssueStart,
  recordIssueComplete,
  recordIssueError,
  recordIssueAwaitingKey,
  isServiceOutageState,
  recordIssueServiceUnavailable,
  resetIssueServiceOutage,
  getDueServiceOutageIssues,
  resumeDueServiceOutageIssues,
  discardServiceOutageIssue,
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
  recordApiKeyChange,
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
  addWaitingUser,
  getWaitingUser,
  getWaitingUsers,
  getWaitingUserPosition,
  removeWaitingUser,
  clearWaitingUsers,
  recordSurprise,
  getSurprise,
  getPendingSurprises,
  getDismissedSurprises,
  dismissSurprise,
  acceptSurprise,
  completeSurprise,
  getPriorityQueue,
  setPriorityQueue,
  prioritizeIssue,
  prunePriorityQueue,
  getQueueOrder,
  setQueueOrder,
  pruneQueueOrder,
  getBatchRemaining,
  setBatchRemaining,
  decrementBatchRemaining,
  recordCodexRun,
  recordRunAnalytics,
  getRunAnalytics,
  recordSelfHealTask,
  getSelfHealTask,
  updateSelfHealTaskStatus,
  getStats
};

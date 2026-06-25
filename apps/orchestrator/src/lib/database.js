const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'orchestrator.db');

let db;

function initDatabase() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);

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
      status TEXT DEFAULT 'pending',
      started_at TEXT,
      completed_at TEXT,
      result_summary TEXT,
      retry_count INTEGER DEFAULT 0,
      codex_output TEXT,
      error_log TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      old_key_suffix TEXT,
      new_key_suffix TEXT,
      rotated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    )
  `);

  const defaults = [
    ['current_issue_number', 'null'],
    ['pipeline_status', 'idle'],
    ['codex_pid', 'null'],
    ['codex_status', 'idle'],
    ['current_model', process.env.CODEX_DEFAULT_MODEL || 'gpt-5.5'],
    ['api_key_index', '0'],
    ['last_poll_time', 'null']
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

function getCurrentIssue() {
  const num = getState('current_issue_number');
  if (num === 'null') return null;
  return db.prepare('SELECT * FROM issues WHERE issue_number = ?').get(parseInt(num));
}

function setCurrentIssue(issueNumber) {
  setState('current_issue_number', issueNumber ? issueNumber.toString() : 'null');
}

function recordIssueStart(issueNumber, title) {
  db.prepare(`
    INSERT OR REPLACE INTO issues 
    (issue_number, title, status, started_at, retry_count) 
    VALUES (?, ?, 'in_progress', datetime('now'), COALESCE((SELECT retry_count FROM issues WHERE issue_number = ?), 0))
  `).run(issueNumber, title, issueNumber);
  setCurrentIssue(issueNumber);
  setState('pipeline_status', 'running');
}

function recordIssueComplete(issueNumber, summary, codexOutput) {
  db.prepare(`
    UPDATE issues 
    SET status = 'completed', completed_at = datetime('now'), result_summary = ?, codex_output = ?
    WHERE issue_number = ?
  `).run(summary, codexOutput, issueNumber);
  setCurrentIssue(null);
  setState('pipeline_status', 'awaiting_approval');
}

function recordIssueError(issueNumber, error) {
  db.prepare(`
    UPDATE issues 
    SET status = 'failed', error_log = ?
    WHERE issue_number = ?
  `).run(error, issueNumber);
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

module.exports = {
  initDatabase,
  getState,
  setState,
  getCurrentIssue,
  setCurrentIssue,
  recordIssueStart,
  recordIssueComplete,
  recordIssueError,
  incrementRetry,
  getIssueHistory,
  recordKeyRotation
};

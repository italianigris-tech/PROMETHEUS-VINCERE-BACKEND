const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  getState,
  setState,
  getCurrentIssue,
  setCurrentIssue,
  recordKeyRotation,
  recordIssueStopped,
  reconcileActiveIssueState,
  setCodexLock,
  getCodexLock,
  clearCodexLock,
  recordCodexRun,
  normalizeOperator,
  getPipelineOperator
} = require('./database');

const WORKDIR = process.env.CODEX_WORKDIR || process.cwd();
const CODEX_LOG_LIMIT = 80;
const STOP_TIMEOUT_MS = 5000;

let activeRun = null;
let lastRun = null;
let runCounter = 0;
let codexEventLog = [];
let stoppedRunIds = new Map();

function safeGetState(key) {
  try {
    return getState(key);
  } catch {
    return null;
  }
}

function normalizePid(value) {
  if (value === null || value === undefined || value === 'null' || value === '') {
    return null;
  }

  const pid = Number(value);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function getStoredCodexPid() {
  return normalizePid(safeGetState('codex_pid'));
}

function setCodexPid(pid) {
  setState('codex_pid', pid ? String(pid) : 'null');
}

function setCodexStatus(status) {
  setState('codex_status', status);
}

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readProcessCmdline(pid) {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    return raw.replace(/\0/g, ' ').trim();
  } catch {
    return null;
  }
}

function isLikelyCodexProcess(pid) {
  if (!isProcessAlive(pid)) return false;

  const cmdline = readProcessCmdline(pid);
  if (!cmdline) return true;

  const firstToken = cmdline.split(/\s+/)[0] || '';
  return firstToken === 'codex' || firstToken.endsWith('/codex');
}

function clearCodexProcessState(status = 'idle') {
  setCodexPid(null);
  setCodexStatus(status);
}

function clearCodexRunState(status = 'idle', reason = 'codex_state_clear') {
  clearCodexProcessState(status);
  return reconcileActiveIssueState(reason);
}

function clearActiveRun(runId, status = 'idle') {
  if (activeRun?.id === runId) {
    activeRun = null;
    clearCodexLock();
  }
  clearCodexProcessState(status);
}

function getApiKeys() {
  const keys = [];
  const primary = safeGetState('codex_primary_api_key') || process.env.CODEX_API_KEY;
  if (primary) keys.push(primary);
  
  const fallbacks = process.env.CODEX_FALLBACK_KEYS;
  if (fallbacks) {
    keys.push(...fallbacks.split(',').map(k => k.trim()).filter(k => k));
  }
  
  return keys;
}

function getCurrentApiKey() {
  const keys = getApiKeys();
  const index = parseInt(getState('api_key_index') || '0');
  return keys[index] || keys[0] || null;
}

function getKeySuffix(key) {
  if (!key) return 'none';
  return key.slice(-4);
}

function rotateApiKey(reason) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    return {
      rotated: false,
      oldSuffix: 'none',
      newSuffix: 'none',
      exhausted: true
    };
  }

  const currentIndex = parseInt(getState('api_key_index') || '0');
  const oldSuffix = getKeySuffix(keys[currentIndex]);
  
  const nextIndex = (currentIndex + 1) % keys.length;
  setState('api_key_index', nextIndex.toString());
  
  const newSuffix = getKeySuffix(keys[nextIndex]);
  recordKeyRotation(oldSuffix, newSuffix, reason);
  
  return {
    rotated: true,
    oldSuffix,
    newSuffix,
    exhausted: nextIndex === 0
  };
}

function setPrimaryApiKey(apiKey, reason = 'Manual Telegram update') {
  const key = String(apiKey || '').trim();
  if (!isLikelyApiKey(key)) {
    throw new Error('INVALID_API_KEY: key must start with sk- and be at least 20 characters');
  }

  const oldSuffix = getKeySuffix(getCurrentApiKey());
  setState('codex_primary_api_key', key);
  setState('api_key_index', '0');
  process.env.CODEX_API_KEY = key;
  process.env.OPENAI_API_KEY = key;

  const newSuffix = getKeySuffix(key);
  recordKeyRotation(oldSuffix, newSuffix, reason);
  logCodexEvent('key', `Active Codex API key updated to ...${newSuffix}`);

  return {
    oldSuffix,
    newSuffix,
    totalKeys: getApiKeys().length
  };
}

function isLikelyApiKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.trim().startsWith('sk-') && apiKey.trim().length >= 20;
}

function runCodex(issueNumber, issueTitle, issueBody, model) {
  const prompt = buildPrompt(issueNumber, issueTitle, issueBody);
  return runCodexCommand(prompt, {
    label: `Issue #${issueNumber}: ${issueTitle}`,
    model,
    source: 'pipeline',
    metadata: { issueNumber, issueTitle },
    operator: getPipelineOperator()
  });
}

function runCodexPrompt(prompt, options = {}) {
  return runCodexCommand(prompt, {
    label: options.label || 'Manual Telegram prompt',
    model: options.model || getState('current_model') || 'gpt-5.5',
    source: options.source || 'telegram',
    metadata: options.metadata || {},
    operator: options.operator || null
  });
}

function runCodexCommand(prompt, options) {
  return new Promise((resolve, reject) => {
    const persistedPid = getStoredCodexPid();
    if (activeRun || (persistedPid && isLikelyCodexProcess(persistedPid))) {
      const label = activeRun?.label || `Codex process PID ${persistedPid}`;
      const startedAt = activeRun?.startedAt || 'before this orchestrator process started';
      const lock = activeRun?.lock || getCodexLock();
      const owner = formatOperator(lock?.operator || activeRun?.operator);
      reject(new Error(`CODEX_BUSY: ${label} has been running since ${startedAt}${owner ? ` by ${owner}` : ''}`));
      return;
    }
    if (persistedPid) {
      clearCodexRunState('idle', 'stale_persisted_pid_before_start');
    }

    const apiKey = getCurrentApiKey();
    if (!apiKey) {
      logCodexEvent('error', 'Codex cannot start: no API key configured');
      reject(new Error('NO_API_KEY: No API keys configured'));
      return;
    }

    const model = options.model || getState('current_model') || 'gpt-5.5';
    const args = ['exec', '-m', model, '--json', prompt];

    const env = {
      ...process.env,
      CODEX_API_KEY: apiKey,
      OPENAI_API_KEY: apiKey,
      HOME: process.env.HOME,
      PATH: process.env.PATH
    };

    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const output = [];
    let errorOutput = '';
    let isRateLimitError = false;
    let isExhaustionError = false;
    let settled = false;
    const runId = ++runCounter;

    activeRun = {
      id: runId,
      label: options.label,
      source: options.source,
      model,
      startedAt,
      pid: null,
      eventCount: 0,
      latestEvent: null,
      keySuffix: getKeySuffix(apiKey),
      metadata: options.metadata || {},
      operator: normalizeOperator(options.operator),
      lock: null,
      child: null
    };
    activeRun.lock = setCodexLock(activeRun.operator, options.label);
    logCodexEvent('start', `Codex started: ${options.label}`, {
      runId,
      model,
      source: options.source,
      keySuffix: activeRun.keySuffix,
      operator: formatOperator(activeRun.operator)
    });

    const codex = spawn('codex', args, {
      cwd: WORKDIR,
      env,
      shell: false
    });
    activeRun.child = codex;
    activeRun.pid = codex.pid || null;
    if (activeRun.pid) {
      setCodexPid(activeRun.pid);
      setCodexStatus('running');
    }

    codex.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          event = { type: 'raw', content: line };
        }
        output.push(event);
        const summary = summarizeCodexEvent(event);
        if (activeRun && activeRun.id === runId) {
          activeRun.eventCount += 1;
          activeRun.latestEvent = summary;
        }
        logCodexEvent('event', summary, { runId, eventType: event.type || 'unknown' });
      }
    });

    codex.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      
      if (text.includes('rate limit') || text.includes('429') || 
          text.includes('exceeded') || text.includes('quota') ||
          text.includes('insufficient_quota') || text.includes('billing')) {
        isRateLimitError = true;
      }
      if (text.includes('exhausted') || text.includes('depleted') ||
          text.includes('out of credits') || text.includes('limit reached')) {
        isExhaustionError = true;
      }
      logCodexEvent('stderr', text.trim().slice(0, 500), { runId });
    });

    codex.on('close', (code) => {
      if (settled) return;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const stoppedReason = stoppedRunIds.get(runId);
      stoppedRunIds.delete(runId);
      clearActiveRun(runId, stoppedReason ? 'stopped' : 'idle');

      if (stoppedReason) {
        const error = new Error(`CODEX_STOPPED: Codex run stopped by ${stoppedReason}`);
        lastRun = buildLastRun(runId, options, model, duration, 'stopped', error.message, output, errorOutput);
        persistCodexRun(options, model, duration, 'stopped', error.message, output, startedAt);
        logCodexEvent('stop', `Codex stopped: ${options.label}`, { runId, pid: codex.pid || null, reason: stoppedReason });
        settled = true;
        reject(error);
        return;
      }
      
      if (code !== 0 && (isRateLimitError || isExhaustionError)) {
        const error = new Error(`API_KEY_EXHAUSTED: Key ending in ...${getKeySuffix(apiKey)} hit limit. ${errorOutput}`);
        lastRun = buildLastRun(runId, options, model, duration, 'api_key_exhausted', error.message, output, errorOutput);
        persistCodexRun(options, model, duration, 'api_key_exhausted', error.message, output, startedAt);
        logCodexEvent('error', `Codex stopped: ${error.message.slice(0, 500)}`, { runId });
        settled = true;
        reject(error);
        return;
      }

      if (code !== 0) {
        const error = new Error(`CODEX_FAILED: Exit code ${code}. ${errorOutput}`);
        lastRun = buildLastRun(runId, options, model, duration, 'failed', error.message, output, errorOutput);
        persistCodexRun(options, model, duration, 'failed', error.message, output, startedAt);
        logCodexEvent('error', `Codex failed with exit code ${code}`, { runId });
        settled = true;
        reject(error);
        return;
      }

      const result = {
        output,
        duration,
        rawOutput: output.map(e => JSON.stringify(e)).join('\n'),
        errorOutput: errorOutput || null
      };
      lastRun = buildLastRun(runId, options, model, duration, 'completed', null, output, errorOutput);
      persistCodexRun(options, model, duration, 'completed', null, output, startedAt);
      logCodexEvent('complete', `Codex completed: ${options.label} in ${duration}s`, { runId });
      settled = true;
      resolve(result);
    });

    codex.on('error', (err) => {
      if (settled) return;
      clearActiveRun(runId, 'idle');
      const error = err.code === 'ENOENT'
        ? new Error('CODEX_NOT_FOUND: codex CLI not installed')
        : new Error(`CODEX_SPAWN_ERROR: ${err.message}`);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      lastRun = buildLastRun(runId, options, model, duration, 'spawn_error', error.message, output, errorOutput);
      persistCodexRun(options, model, duration, 'spawn_error', error.message, output, startedAt);
      logCodexEvent('error', error.message, { runId });
      settled = true;
      reject(error);
    });
  });
}

async function stopCodex(reason = 'operator', options = {}) {
  const silentIfMissing = Boolean(options.silentIfMissing);
  const currentIssue = getCurrentIssue();
  const run = activeRun;
  const pid = normalizePid(run?.pid) || getStoredCodexPid();
  const issueNumber = currentIssue?.issue_number || run?.metadata?.issueNumber || null;
  const label = run?.label || (issueNumber ? `Issue #${issueNumber}` : 'Codex process');

  if (!pid || !isLikelyCodexProcess(pid)) {
    if (pid) {
      logCodexEvent('stop', `No live Codex process found for stored PID ${pid}; clearing stale state`, { pid, reason });
    }
    if (run && (!run.pid || !isLikelyCodexProcess(run.pid))) {
      activeRun = null;
    }
    clearCodexLock();
    if (issueNumber) {
      recordIssueStopped(issueNumber, `Codex stop requested (${reason}) but no live Codex process was found.`);
    }
    clearCodexRunState('idle', 'stop_no_live_process');
    if (silentIfMissing) {
      return {
        stopped: false,
        pid,
        issueNumber,
        label,
        forced: false
      };
    }
    return {
      stopped: false,
      pid,
      issueNumber,
      label,
      forced: false
    };
  }

  if (run?.id) {
    stoppedRunIds.set(run.id, reason);
    run.stopRequestedAt = new Date().toISOString();
    run.stopReason = reason;
  }

  logCodexEvent('stop', `Stopping Codex PID ${pid}: ${label}`, {
    pid,
    runId: run?.id || null,
    reason
  });

  let exited = false;
  let forced = false;
  let stopError = null;

  try {
    sendSignal(pid, run?.child, 'SIGTERM');
    exited = await waitForProcessExit(pid, run?.child, STOP_TIMEOUT_MS);

    if (!exited && isLikelyCodexProcess(pid)) {
      forced = true;
      sendSignal(pid, run?.child, 'SIGKILL');
      exited = await waitForProcessExit(pid, run?.child, 1000);
    }
  } catch (error) {
    stopError = error;
  }

  if (issueNumber) {
    recordIssueStopped(issueNumber, forced
      ? `Codex was force-killed by ${reason}.`
      : `Codex was stopped by ${reason}.`
    );
  } else {
    setCurrentIssue(null);
  }
  if (!run?.id) {
    activeRun = null;
    clearCodexLock();
  }
  clearCodexRunState('stopped', forced ? 'stop_forced_kill' : 'stop_graceful');

  if (stopError) {
    stopError.message = `CODEX_STOP_SIGNAL_FAILED: ${stopError.message}`;
    throw stopError;
  }

  return {
    stopped: true,
    pid,
    issueNumber,
    label,
    forced,
    exited
  };
}

function sendSignal(pid, child, signal) {
  try {
    if (child?.pid === pid) {
      child.kill(signal);
      return;
    }
    process.kill(pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

function waitForProcessExit(pid, child, timeoutMs) {
  if (!isLikelyCodexProcess(pid)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let done = false;

    const finish = (exited) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      clearInterval(interval);
      if (child) {
        child.removeListener('exit', onExit);
        child.removeListener('close', onExit);
      }
      resolve(exited);
    };

    const onExit = () => finish(true);
    const interval = setInterval(() => {
      if (!isLikelyCodexProcess(pid)) {
        finish(true);
      }
    }, 100);
    const timeout = setTimeout(() => finish(!isLikelyCodexProcess(pid)), timeoutMs);

    if (child) {
      child.once('exit', onExit);
      child.once('close', onExit);
    }
  });
}

function reconcileCodexPidOnBoot() {
  const pid = getStoredCodexPid();
  const storedStatus = safeGetState('codex_status') || 'idle';
  let issueReconcile;

  if (!pid) {
    if (storedStatus === 'running') {
      setCodexStatus('idle');
    }
    issueReconcile = reconcileActiveIssueState('boot_no_codex_pid');
    return {
      pid: null,
      running: false,
      cleared: false,
      issueReconcile
    };
  }

  if (!isLikelyCodexProcess(pid)) {
    clearCodexRunState(storedStatus === 'running' ? 'stopped' : 'idle', 'boot_stale_codex_pid');
    logCodexEvent('stop', `Cleared stale Codex PID ${pid} on boot`, { pid });
    issueReconcile = reconcileActiveIssueState('boot_stale_codex_pid');
    return {
      pid,
      running: false,
      cleared: true,
      issueReconcile
    };
  }

  setCodexStatus('running');
  logCodexEvent('start', `Recovered live Codex PID ${pid} from persisted state`, { pid });
  return {
    pid,
    running: true,
    cleared: false
  };
}

function buildLastRun(runId, options, model, duration, status, error, output = [], errorOutput = '') {
  return {
    id: runId,
    label: options.label,
    source: options.source,
    model,
    duration,
    status,
    error,
    outputPreview: buildOutputPreview(output),
    errorOutput: errorOutput ? errorOutput.slice(-1200) : null,
    completedAt: new Date().toISOString()
  };
}

function persistCodexRun(options, model, duration, status, error, output, startedAt) {
  const parsed = parseCodexOutput(output);
  try {
    recordCodexRun({
      label: options.label,
      source: options.source,
      model,
      status,
      durationSeconds: Number(duration) || 0,
      issueNumber: options.metadata?.issueNumber || null,
      operator: options.operator || null,
      startedAt,
      completedAt: new Date().toISOString(),
      files: parsed.filesChanged,
      totalTokens: parsed.totalTokens,
      error
    });
  } catch (persistError) {
    logCodexEvent('error', `Failed to persist Codex run stats: ${persistError.message}`);
  }
}

function formatOperator(operator) {
  const normalized = normalizeOperator(operator);
  if (!normalized) return '';
  return normalized.username ? `@${normalized.username}` : normalized.displayName;
}

function summarizeCodexEvent(event) {
  if (!event || typeof event !== 'object') return 'Codex emitted an event';

  switch (event.type) {
    case 'agent_message':
    case 'assistant_message':
    case 'message':
      return `Codex says: ${extractEventText(event) || 'message received'}`;
    case 'command':
      return `Command: ${event.command || 'unknown command'}`;
    case 'tool_call':
    case 'function_call':
      return `Tool call: ${event.name || event.tool || event.command || 'unknown tool'}`;
    case 'file':
      return `File ${event.status || 'changed'}: ${event.path || 'unknown path'}`;
    case 'error':
      return `Error: ${event.message || event.error || 'unknown error'}`;
    case 'usage':
      return `Usage update: ${event.total_tokens || 'unknown'} tokens`;
    case 'reasoning':
      return 'Progress update received';
    case 'raw':
      return `Output: ${String(event.content || '').slice(0, 240)}`;
    default:
      return `Event: ${event.type || 'unknown'}${extractEventText(event) ? ` - ${extractEventText(event)}` : ''}`;
  }
}

function extractEventText(event) {
  if (!event || typeof event !== 'object') return '';
  const candidate =
    event.content ||
    event.message ||
    event.text ||
    event.output ||
    event.summary ||
    event.delta;

  if (typeof candidate === 'string') {
    return candidate.replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  if (Array.isArray(candidate)) {
    return candidate
      .map(item => typeof item === 'string' ? item : item?.text || item?.content || '')
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  return '';
}

function buildOutputPreview(output) {
  const lines = [];
  for (const event of output) {
    if (!event || typeof event !== 'object') continue;
    if (event.type === 'reasoning') {
      lines.push('Progress update received');
      continue;
    }
    const summary = summarizeCodexEvent(event);
    if (summary) lines.push(summary);
  }
  return lines.slice(-20).join('\n').slice(-3000);
}

function logCodexEvent(type, message, data = {}) {
  codexEventLog.push({
    at: new Date().toISOString(),
    type,
    message: String(message || '').replace(/\s+/g, ' ').trim(),
    data
  });
  if (codexEventLog.length > CODEX_LOG_LIMIT) {
    codexEventLog = codexEventLog.slice(-CODEX_LOG_LIMIT);
  }
}

function getCodexRuntimeStatus() {
  const keyCount = getApiKeys().length;
  const currentKey = getCurrentApiKey();
  const persistedPid = getStoredCodexPid();
  const activePid = normalizePid(activeRun?.pid) || persistedPid;
  const persistedStatus = safeGetState('codex_status') || 'idle';
  let state = 'idle';

  if (activeRun || (persistedPid && isLikelyCodexProcess(persistedPid))) state = 'running';
  else if (persistedPid) {
    clearCodexProcessState(persistedStatus === 'running' ? 'stopped' : 'idle');
    state = persistedStatus === 'running' ? 'stopped' : 'idle';
  }
  else if (persistedStatus === 'stopped') state = 'stopped';
  else if (keyCount === 0) state = 'missing_api_key';
  else if (lastRun?.status && lastRun.status !== 'completed') state = lastRun.status;

  return {
    state,
    pid: state === 'running' ? activePid : null,
    activeRun,
    lastRun,
    keyCount,
    keySuffix: getKeySuffix(currentKey),
    workdir: WORKDIR,
    model: safeGetState('current_model') || 'gpt-5.5'
  };
}

function getCodexEventLog(limit = 20) {
  return codexEventLog.slice(-limit);
}

function buildPrompt(issueNumber, title, body) {
  return `You are a senior backend engineer working on the Prometheus project. 

Issue #${issueNumber}: ${title}

Description:
${body || 'No description provided.'}

Your task:
1. Analyze the issue carefully
2. Implement the necessary changes in the codebase
3. Write or update tests as needed
4. Ensure the code follows existing patterns in the repo
5. Do NOT modify files unrelated to this issue
6. After making changes, provide a summary of what you did

Work in the current directory which contains the project repository.
Be thorough but focused.`;
}

function parseCodexOutput(output) {
  const summary = {
    filesChanged: [],
    commandsRun: [],
    progress: [],
    errors: [],
    totalTokens: null
  };

  for (const event of output) {
    if (typeof event !== 'object') continue;

    switch (event.type) {
      case 'file':
        if (event.status === 'modified' || event.status === 'created') {
          summary.filesChanged.push({
            path: event.path,
            status: event.status,
            additions: event.additions || 0,
            deletions: event.deletions || 0
          });
        }
        break;
      case 'command':
        summary.commandsRun.push(event.command);
        break;
      case 'reasoning':
        summary.progress.push('Progress update received');
        break;
      case 'error':
        summary.errors.push(event.message || event.error || 'Unknown error');
        break;
      case 'usage':
        summary.totalTokens = event.total_tokens;
        break;
    }
  }

  return summary;
}

function generateSummaryMessage(issueNumber, title, codexResult, model) {
  const parsed = parseCodexOutput(codexResult.output);
  const duration = codexResult.duration;
  const tokens = parsed.totalTokens || 'N/A';
  
  let message = `✅ *PROMETHEUS AGENT — Issue #${issueNumber} COMPLETE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 *Title:* ${escapeMarkdown(title)}\n`;
  message += `🤖 *Model:* ${model}\n`;
  message += `⏱ *Duration:* ${duration}s | 🔑 *Key:* ...${getKeySuffix(getCurrentApiKey())}\n\n`;

  message += `📝 *What I did:*\n`;
  
  if (parsed.progress.length > 0) {
    message += `${parsed.progress.length} Codex progress updates received.\n\n`;
  }

  if (parsed.filesChanged.length > 0) {
    message += `📁 *Files changed (${parsed.filesChanged.length}):*\n`;
    for (const file of parsed.filesChanged.slice(0, 10)) {
      const emoji = file.status === 'created' ? '➕' : file.status === 'deleted' ? '➖' : '✏️';
      message += `${emoji} \`${escapeMarkdown(file.path)}\` `;
      if (file.additions || file.deletions) {
        message += `(+${file.additions}/-${file.deletions})`;
      }
      message += '\n';
    }
    if (parsed.filesChanged.length > 10) {
      message += `_...and ${parsed.filesChanged.length - 10} more files_\n`;
    }
    message += '\n';
  }

  if (parsed.commandsRun.length > 0) {
    message += `⚡ *Commands run:*\n`;
    for (const cmd of parsed.commandsRun.slice(0, 5)) {
      message += `• \`${escapeMarkdown(cmd)}\`\n`;
    }
    if (parsed.commandsRun.length > 5) {
      message += `_...and ${parsed.commandsRun.length - 5} more_\n`;
    }
    message += '\n';
  }

  if (parsed.errors.length > 0) {
    message += `⚠️ *Errors encountered:*\n`;
    for (const err of parsed.errors.slice(0, 3)) {
      message += `• ${escapeMarkdown(err.substring(0, 100))}\n`;
    }
    message += '\n';
  }

  message += `📊 *Stats:*\n`;
  message += `Files: ${parsed.filesChanged.length} | Tokens: ${tokens} | Time: ${duration}s\n\n`;

  return message;
}

function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\~/g, '\\~')
    .replace(/\`/g, '\\`')
    .replace(/>/g, '\\>');
}

module.exports = {
  runCodex,
  runCodexPrompt,
  stopCodex,
  parseCodexOutput,
  generateSummaryMessage,
  rotateApiKey,
  setPrimaryApiKey,
  getCurrentApiKey,
  getKeySuffix,
  getApiKeys,
  getCodexRuntimeStatus,
  getCodexEventLog,
  reconcileCodexPidOnBoot
};

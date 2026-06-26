const { spawn, execFile } = require('child_process');
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

const WORKDIR = process.env.CODEX_WORKDIR || process.env.REPO_PATH || process.cwd();
const CODEX_LOG_LIMIT = 80;
const STOP_TIMEOUT_MS = 5000;
const CODEX_MAX_RUNTIME_MINUTES = parsePositiveNumber(process.env.CODEX_MAX_RUNTIME_MINUTES, 30);
const DEFAULT_NO_OUTPUT_TIMEOUT_MINUTES = parsePositiveNumber(
  process.env.CODEX_NO_OUTPUT_TIMEOUT_MINUTES || process.env.CODEX_NO_OUTPUT_MINUTES,
  10
);
const MANUAL_NO_OUTPUT_TIMEOUT_MINUTES = parsePositiveNumber(
  process.env.CODEX_MANUAL_NO_OUTPUT_TIMEOUT_MINUTES,
  2
);
const CODEX_MAX_RUNTIME_MS = CODEX_MAX_RUNTIME_MINUTES * 60 * 1000;
const GIT_TIMEOUT_MS = 120000;
const GIT_COMMITTER_NAME = process.env.GIT_COMMITTER_NAME || 'Prometheus Orchestrator';
const GIT_COMMITTER_EMAIL = process.env.GIT_COMMITTER_EMAIL || 'prometheus-orchestrator@localhost';

let activeRun = null;
let lastRun = null;
let runCounter = 0;
let codexEventLog = [];
let stoppedRunIds = new Map();

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function writePromptTempFile(prompt) {
  const filePath = path.join(
    '/tmp',
    `codex-prompt-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.md`
  );
  fs.writeFileSync(filePath, String(prompt || ''), {
    encoding: 'utf8',
    mode: 0o600
  });
  return filePath;
}

function deletePromptTempFile(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      logCodexEvent('error', `Failed to delete prompt temp file: ${error.message}`, { promptFile: filePath });
    }
  }
}

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
    operator: options.operator || null,
    noOutputTimeoutMinutes: options.noOutputTimeoutMinutes || MANUAL_NO_OUTPUT_TIMEOUT_MINUTES
  });
}

function runGit(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd: options.workdir || WORKDIR,
      timeout: options.timeout || GIT_TIMEOUT_MS,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || GIT_COMMITTER_NAME,
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || GIT_COMMITTER_EMAIL,
        GIT_COMMITTER_NAME,
        GIT_COMMITTER_EMAIL
      }
    }, (error, stdout, stderr) => {
      const result = {
        args,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim()
      };
      if (error) {
        const gitError = new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout || error.message}`);
        gitError.result = result;
        reject(gitError);
        return;
      }
      resolve(result);
    });
  });
}

function getCodexWorkdir() {
  return WORKDIR;
}

async function getGitBranchState() {
  await runGit(['rev-parse', '--is-inside-work-tree']);
  const head = (await runGit(['rev-parse', 'HEAD'])).stdout;
  let branch = null;
  let detached = false;

  try {
    branch = (await runGit(['branch', '--show-current'])).stdout;
  } catch {
    branch = null;
  }

  if (!branch) {
    const abbrev = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout;
    if (abbrev && abbrev !== 'HEAD') {
      branch = abbrev;
    } else {
      detached = true;
    }
  }

  return {
    head,
    branch,
    detached
  };
}

async function getGitStatusShort() {
  return (await runGit(['status', '--short'])).stdout;
}

async function getGitDiffStat() {
  const diff = (await runGit(['diff', '--stat'])).stdout;
  const untracked = (await runGit(['ls-files', '--others', '--exclude-standard'])).stdout;
  if (!untracked) return diff;

  const untrackedLines = untracked
    .split('\n')
    .filter(Boolean)
    .map(file => `${file} | new file`)
    .join('\n');

  return [diff, untrackedLines].filter(Boolean).join('\n');
}

async function getGitNumstat() {
  const diff = (await runGit(['diff', '--numstat'])).stdout;
  const untracked = (await runGit(['ls-files', '--others', '--exclude-standard'])).stdout;
  if (!untracked) return diff;

  const untrackedLines = [];
  for (const file of untracked.split('\n').filter(Boolean)) {
    let additions = 0;
    try {
      const content = fs.readFileSync(path.join(WORKDIR, file), 'utf8');
      additions = content.length === 0 ? 0 : content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
    } catch {
      additions = 0;
    }
    untrackedLines.push(`${additions}\t0\t${file}`);
  }

  return [diff, untrackedLines.join('\n')].filter(Boolean).join('\n');
}

function buildDeliveryBranchName(issueNumber) {
  return `codex/issue-${issueNumber || 'manual'}`;
}

function buildCommitMessage(issueNumber, issueTitle) {
  const title = String(issueTitle || `Issue #${issueNumber || 'manual'}`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return issueNumber
    ? `fix: ${title} [Closes #${issueNumber}]`
    : `fix: ${title}`;
}

async function rollbackGitChanges(options = {}) {
  const target = options.targetRef || 'HEAD';
  const reason = options.reason || 'rollback';
  const reset = await runGit(['reset', '--hard', target]);
  const clean = await runGit(['clean', '-fd']);
  logCodexEvent('git', `Rolled back working tree to ${target}: ${reason}`, {
    target,
    reason,
    reset: reset.stdout,
    clean: clean.stdout
  });
  return {
    target,
    reason,
    reset: reset.stdout,
    clean: clean.stdout,
    statusShort: await getGitStatusShort()
  };
}

async function discardCodexChanges(reason = 'operator_discard') {
  return rollbackGitChanges({ targetRef: 'HEAD', reason });
}

async function pushMain(options = {}) {
  const args = options.force
    ? ['push', '--force-with-lease', 'origin', 'main']
    : ['push', 'origin', 'main'];
  try {
    const result = await runGit(args, { timeout: options.timeout || GIT_TIMEOUT_MS });
    logCodexEvent('git', `${options.force ? 'Force pushed' : 'Pushed'} main to origin`, result);
    return result;
  } catch (error) {
    error.stage = options.force ? 'force_push' : 'push';
    error.conflict = isPushConflictError(error);
    throw error;
  }
}

async function pullAndMergeMain() {
  try {
    const result = await runGit(['pull', '--no-edit', 'origin', 'main']);
    logCodexEvent('git', 'Pulled and merged origin/main', result);
    return result;
  } catch (error) {
    error.stage = 'pull_merge';
    error.conflict = true;
    throw error;
  }
}

async function commitAndPushIssueChanges(issueNumber, issueTitle) {
  const statusBefore = await getGitStatusShort();
  if (!statusBefore) {
    const error = new Error('NO_CHANGES_TO_PUSH: working tree is clean');
    error.stage = 'status';
    throw error;
  }

  const commitMessage = buildCommitMessage(issueNumber, issueTitle);
  try {
    await runGit(['add', '-A']);
    await runGit(['commit', '-m', commitMessage]);
  } catch (error) {
    error.stage = 'commit';
    throw error;
  }

  const commitSha = (await runGit(['rev-parse', 'HEAD'])).stdout;
  try {
    await pushMain();
  } catch (error) {
    error.commitSha = commitSha;
    error.commitMessage = commitMessage;
    throw error;
  }

  return {
    statusBefore,
    commitMessage,
    commitSha,
    pushed: true
  };
}

function isPushConflictError(error) {
  const text = `${error?.message || ''}\n${error?.result?.stderr || ''}\n${error?.result?.stdout || ''}`.toLowerCase();
  return (
    text.includes('non-fast-forward') ||
    text.includes('fetch first') ||
    text.includes('rejected') ||
    text.includes('failed to push some refs') ||
    text.includes('merge conflict') ||
    text.includes('conflict')
  );
}

async function deliverCodexChanges(options = {}) {
  const issueNumber = options.issueNumber || options.metadata?.issueNumber || null;
  const issueTitle = options.issueTitle || options.metadata?.issueTitle || 'Codex changes';
  const remote = options.remote || process.env.GIT_REMOTE || 'origin';
  const statusBefore = await getGitStatusShort();

  if (!statusBefore) {
    logCodexEvent('git', `Codex completed but no files were modified for ${issueNumber ? `Issue #${issueNumber}` : issueTitle}`);
    return {
      changed: false,
      committed: false,
      pushed: false,
      noChanges: true,
      statusBefore,
      message: 'Codex completed but no files were modified'
    };
  }

  const branchState = await getGitBranchState();
  const originalHead = branchState.head;
  let branch = branchState.branch;
  let branchCreated = false;

  try {
    if (branchState.detached || !branch) {
      branch = buildDeliveryBranchName(issueNumber);
      await runGit(['checkout', '-B', branch]);
      branchCreated = true;
      logCodexEvent('git', `Detached or unknown HEAD; created delivery branch ${branch}`, { branch, originalHead });
    }

    const commitMessage = buildCommitMessage(issueNumber, issueTitle);
    await runGit(['add', '-A']);
    await runGit(['commit', '-m', commitMessage]);
    const commitSha = (await runGit(['rev-parse', 'HEAD'])).stdout;
    await runGit(['push', remote, branch]);

    const statusAfter = await getGitStatusShort();
    const delivery = {
      changed: true,
      committed: true,
      pushed: true,
      noChanges: false,
      branch,
      branchCreated,
      commitSha,
      commitMessage,
      remote,
      originalHead,
      statusBefore,
      statusAfter
    };

    logCodexEvent('git', `Delivered Codex changes on ${branch} at ${commitSha.slice(0, 12)}`, delivery);
    return delivery;
  } catch (error) {
    let rollback = null;
    try {
      rollback = await rollbackGitChanges({
        targetRef: originalHead || 'HEAD',
        reason: `delivery_failed:${error.message.slice(0, 180)}`
      });
    } catch (rollbackError) {
      rollback = {
        failed: true,
        error: rollbackError.message
      };
    }

    error.delivery = {
      branch,
      branchCreated,
      originalHead,
      statusBefore,
      rollback
    };
    logCodexEvent('error', `Delivery failed: ${error.message}`, error.delivery);
    throw error;
  }
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
    const promptFile = writePromptTempFile(prompt);
    const args = ['exec', '-m', model, '--json', '-'];
    const noOutputTimeoutMinutes = parsePositiveNumber(
      options.noOutputTimeoutMinutes,
      options.source === 'telegram' ? MANUAL_NO_OUTPUT_TIMEOUT_MINUTES : DEFAULT_NO_OUTPUT_TIMEOUT_MINUTES
    );
    const noOutputTimeoutMs = noOutputTimeoutMinutes * 60 * 1000;

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
    let runtimeTimer = null;
    let noOutputTimer = null;
    let timeoutTriggered = null;
    const runId = ++runCounter;

    const cleanupPromptFile = () => {
      deletePromptTempFile(promptFile);
    };

    const clearRunTimers = () => {
      if (runtimeTimer) {
        clearTimeout(runtimeTimer);
        runtimeTimer = null;
      }
      if (noOutputTimer) {
        clearTimeout(noOutputTimer);
        noOutputTimer = null;
      }
    };

    const triggerTimeout = (type) => {
      if (settled || timeoutTriggered) return;
      const minutes = type === 'no_output'
        ? noOutputTimeoutMinutes
        : CODEX_MAX_RUNTIME_MINUTES;
      timeoutTriggered = {
        type,
        minutes,
        triggeredAt: new Date().toISOString()
      };
      if (activeRun?.id === runId) {
        activeRun.timeout = timeoutTriggered;
      }
      stoppedRunIds.set(runId, {
        reason: `timeout_${type}`,
        status: 'timeout',
        timeoutType: type,
        timeoutMinutes: minutes
      });
      logCodexEvent('timeout', `Codex timed out after ${minutes} minutes: ${options.label}`, {
        runId,
        type,
        minutes
      });
      stopCodex(`timeout_${type}`, {
        status: 'timeout',
        timeoutType: type,
        timeoutMinutes: minutes,
        silentIfMissing: true
      }).catch((error) => {
        logCodexEvent('error', `Timeout stop failed: ${error.message}`, { runId, type });
      });
    };

    const resetNoOutputTimer = () => {
      if (settled || timeoutTriggered) return;
      if (noOutputTimer) clearTimeout(noOutputTimer);
      noOutputTimer = setTimeout(() => triggerTimeout('no_output'), noOutputTimeoutMs);
    };

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
      child: null,
      timeoutConfig: {
        maxRuntimeMinutes: CODEX_MAX_RUNTIME_MINUTES,
        noOutputTimeoutMinutes
      },
      timeout: null,
      promptFile,
      thinking: createThinkingState(options.label)
    };
    activeRun.lock = setCodexLock(activeRun.operator, options.label);
    logCodexEvent('start', `Codex started: ${options.label}`, {
      runId,
      model,
      source: options.source,
      promptFile,
      keySuffix: activeRun.keySuffix,
      operator: formatOperator(activeRun.operator)
    });

    const codex = spawn('codex', args, {
      cwd: WORKDIR,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const promptStream = fs.createReadStream(promptFile, { encoding: 'utf8' });
    promptStream.on('error', (error) => {
      logCodexEvent('error', `Failed to read Codex prompt temp file: ${error.message}`, { runId, promptFile });
      codex.stdin?.destroy(error);
    });
    if (codex.stdin) {
      codex.stdin.on('error', (error) => {
        if (error?.code !== 'EPIPE') {
          logCodexEvent('error', `Failed to write Codex prompt stdin: ${error.message}`, { runId, promptFile });
        }
      });
      promptStream.pipe(codex.stdin);
    } else {
      promptStream.destroy();
      logCodexEvent('error', 'Codex stdin was not available for prompt delivery', { runId, promptFile });
    }
    activeRun.child = codex;
    activeRun.pid = codex.pid || null;
    if (activeRun.pid) {
      setCodexPid(activeRun.pid);
      setCodexStatus('running');
    }
    runtimeTimer = setTimeout(() => triggerTimeout('runtime'), CODEX_MAX_RUNTIME_MS);
    resetNoOutputTimer();

    codex.stdout.on('data', (data) => {
      resetNoOutputTimer();
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
          updateThinkingState(activeRun, event, line);
        }
        logCodexEvent('event', summary, { runId, eventType: event.type || 'unknown' });
      }
    });

    codex.stderr.on('data', (data) => {
      resetNoOutputTimer();
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
      if (activeRun && activeRun.id === runId) {
        updateThinkingState(activeRun, { type: 'stderr', content: text }, text);
      }
      logCodexEvent('stderr', text.trim().slice(0, 500), { runId });
    });

    codex.on('close', (code) => {
      if (settled) return;
      clearRunTimers();
      cleanupPromptFile();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const stoppedEntry = stoppedRunIds.get(runId) || (timeoutTriggered ? {
        reason: `timeout_${timeoutTriggered.type}`,
        status: 'timeout',
        timeoutType: timeoutTriggered.type,
        timeoutMinutes: timeoutTriggered.minutes
      } : null);
      stoppedRunIds.delete(runId);
      const stoppedReason = typeof stoppedEntry === 'string' ? stoppedEntry : stoppedEntry?.reason;
      const stoppedStatus = stoppedEntry && typeof stoppedEntry === 'object' && stoppedEntry.status
        ? stoppedEntry.status
        : 'stopped';
      clearActiveRun(runId, stoppedReason ? stoppedStatus : 'idle');

      if (stoppedReason) {
        const isTimeout = stoppedStatus === 'timeout';
        const timeoutMinutes = typeof stoppedEntry === 'object' ? stoppedEntry.timeoutMinutes : null;
        const timeoutType = typeof stoppedEntry === 'object' ? stoppedEntry.timeoutType : null;
        const error = isTimeout
          ? new Error(`CODEX_TIMEOUT: Codex timed out after ${timeoutMinutes || CODEX_MAX_RUNTIME_MINUTES} minutes. ${options.label} aborted.`)
          : new Error(`CODEX_STOPPED: Codex run stopped by ${stoppedReason}`);
        error.code = isTimeout ? 'CODEX_TIMEOUT' : 'CODEX_STOPPED';
        if (isTimeout) {
          error.timeout = true;
          error.timeoutMinutes = timeoutMinutes || CODEX_MAX_RUNTIME_MINUTES;
          error.timeoutType = timeoutType || null;
          error.issueNumber = options.metadata?.issueNumber || null;
        }
        lastRun = buildLastRun(runId, options, model, duration, stoppedStatus, error.message, output, errorOutput);
        persistCodexRun(options, model, duration, stoppedStatus, error.message, output, startedAt);
        logCodexEvent(isTimeout ? 'timeout' : 'stop', `Codex ${isTimeout ? 'timed out' : 'stopped'}: ${options.label}`, {
          runId,
          pid: codex.pid || null,
          reason: stoppedReason,
          timeoutType,
          timeoutMinutes
        });
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
        exitCode: code,
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
      clearRunTimers();
      cleanupPromptFile();
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
  const finalStatus = options.status || (options.timeout ? 'timeout' : 'stopped');
  const isTimeout = finalStatus === 'timeout';
  const timeoutType = options.timeoutType || null;
  const timeoutMinutes = options.timeoutMinutes || null;
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
      recordIssueStopped(issueNumber, isTimeout
        ? `Codex timed out after ${timeoutMinutes || 'configured'} minutes (${timeoutType || 'timeout'}), but no live Codex process was found.`
        : `Codex stop requested (${reason}) but no live Codex process was found.`
      );
    }
    clearCodexRunState(isTimeout ? 'timeout' : 'idle', 'stop_no_live_process');
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
    stoppedRunIds.set(run.id, {
      reason,
      status: finalStatus,
      timeoutType,
      timeoutMinutes
    });
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
    let stopReason;
    if (isTimeout) {
      stopReason = `Codex timed out after ${timeoutMinutes || 'configured'} minutes${timeoutType ? ` (${timeoutType})` : ''}.`;
      if (forced) stopReason += ' SIGKILL was required.';
    } else {
      stopReason = forced
        ? `Codex was force-killed by ${reason}.`
        : `Codex was stopped by ${reason}.`;
    }
    recordIssueStopped(issueNumber, stopReason);
  } else {
    setCurrentIssue(null);
  }
  if (!run?.id) {
    activeRun = null;
    clearCodexLock();
  }
  clearCodexRunState(finalStatus, forced ? 'stop_forced_kill' : 'stop_graceful');

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
    metadata: options.metadata || {},
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

function createThinkingState(label) {
  return {
    label: label || 'Codex run',
    current: '🧠 Planning approach...',
    phase: 'planning',
    filesTouched: [],
    filesTouchedCount: 0,
    lastSignal: null,
    updatedAt: new Date().toISOString()
  };
}

function updateThinkingState(run, event, rawText = '') {
  if (!run) return;
  if (!run.thinking) {
    run.thinking = createThinkingState(run.label);
  }

  const text = [
    rawText,
    extractEventText(event),
    event?.message,
    event?.content,
    event?.command,
    event?.path,
    event?.name,
    event?.tool
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = text.toLowerCase();
  const filePath = extractEventFilePath(event, text);

  if (filePath) {
    addThinkingFile(run.thinking, filePath);
  }

  let phase = null;
  let current = null;

  if (/\bcomplete(?:d)?\b|wrapping up|finished|done/.test(lower)) {
    phase = 'complete';
    current = '✅ Wrapping up...';
  }

  if (!phase && /\brunning tests(?:\.\.\.)?\b|\b(test|tests|testing|verification|verify|lint|node --check|npm test|pytest|jest|build)\b/.test(lower)) {
    phase = 'testing';
    current = '🧪 Running verification...';
  }

  if (!phase && (
    event?.type === 'file' ||
    /\bediting\s+/.test(lower) ||
    /\b(modified|created|deleted|patch|apply_patch|writing|updated)\b/.test(lower)
  )) {
    phase = 'editing';
    current = `✏️ Editing ${filePath || extractEditingTarget(text) || 'files'}...`;
  }

  if (!phase && /\breading files(?:\.\.\.)?\b|\b(reading|read file|opened|searching|rg |grep |listing|inspecting|analyzing)\b/.test(lower)) {
    phase = 'reading';
    current = '📖 Reading codebase...';
  }

  if (!phase && (event?.type === 'reasoning' || /\bplanning(?:\.\.\.)?\b|\b(plan|thinking|approach)\b/.test(lower))) {
    phase = 'planning';
    current = '🧠 Planning approach...';
  }

  if (phase && current) {
    run.thinking.phase = phase;
    run.thinking.current = current;
  }

  if (text) {
    run.thinking.lastSignal = text.slice(0, 240);
  }
  run.thinking.updatedAt = new Date().toISOString();
}

function extractEventFilePath(event, text = '') {
  if (event?.path) return String(event.path);
  if (event?.file) return String(event.file);

  const match = String(text || '').match(/\b(?:editing|modified|created|deleted|updated|file)\s+([A-Za-z0-9_./-]+\.[A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

function extractEditingTarget(text = '') {
  const match = String(text || '').match(/\bediting\s+([^.\n]+(?:\.[A-Za-z0-9_-]+)?)/i);
  return match ? match[1].trim().replace(/\.+$/, '') : null;
}

function addThinkingFile(thinking, filePath) {
  if (!filePath) return;
  const normalized = String(filePath).trim();
  if (!normalized) return;
  if (!thinking.filesTouched.includes(normalized)) {
    thinking.filesTouched.push(normalized);
    thinking.filesTouched = thinking.filesTouched.slice(-25);
  }
  thinking.filesTouchedCount = thinking.filesTouched.length;
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
  else if (persistedStatus === 'timeout') state = 'timeout';
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
  getCodexWorkdir,
  deliverCodexChanges,
  discardCodexChanges,
  rollbackGitChanges,
  commitAndPushIssueChanges,
  pushMain,
  pullAndMergeMain,
  getGitBranchState,
  getGitStatusShort,
  getGitDiffStat,
  getGitNumstat,
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

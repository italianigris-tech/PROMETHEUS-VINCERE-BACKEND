const { applySecureUmask, hardenRuntimePermissions } = require('./lib/security');
applySecureUmask();
hardenRuntimePermissions();

const dotenv = require('dotenv');
dotenv.config();

const crypto = require('crypto');
const os = require('os');
const { execFile } = require('child_process');
const {
  initDatabase,
  getState,
  setState,
  getCurrentIssue,
  setCurrentIssue,
  recordIssueStart,
  recordIssueComplete,
  recordIssueError,
  recordIssueAwaitingKey,
  setIssueDeliveryStatus,
  prunePriorityQueue,
  getQueueOrder,
  setQueueOrder,
  decrementBatchRemaining,
  getBatchRemaining,
  getPipelineOperator,
  getWaitingUsers
} = require('./lib/database');
const { getOpenIssues } = require('./lib/github');
const {
  runCodex,
  generateSummaryMessage,
  getCodexRuntimeStatus,
  reconcileCodexPidOnBoot,
  getGitStatusShort,
  discardCodexChanges
} = require('./lib/codex');
const {
  initBot,
  sendDeliveryReviewPanel,
  sendDirtyWorktreePrompt,
  sendKeyExhaustedAlert,
  broadcastNotification,
  startDiffStream,
  stopDiffStream,
  startThinkingStream,
  stopThinkingStream,
  notifyWaitingUsersCodexFree
} = require('./lib/telegram');

const ADMIN_CHAT_IDS = (process.env.AUTHORIZED_CHAT_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
const CHAT_ID = ADMIN_CHAT_IDS[0] || null;
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 30) * 1000;
const HEARTBEAT_INTERVAL = 60 * 1000;
const WATCHDOG_INTERVAL = 5 * 60 * 1000;
const WATCHDOG_THRESHOLD = parseInt(process.env.WATCHDOG_THRESHOLD_PERCENT, 10) || 80;
const WATCHDOG_COOLDOWN_MS = (parseInt(process.env.WATCHDOG_COOLDOWN_MINUTES, 10) || 15) * 60 * 1000;
const WATCHDOG_PATH = process.env.WATCHDOG_DISK_PATH || (process.env.CODEX_WORKDIR || process.cwd());

let isProcessing = false;
let isShuttingDown = false;
let bot;
let pollTimer;
let heartbeatTimer;
let watchdogTimer;

async function main() {
  console.log('🔧 PROMETHEUS ORCHESTRATOR v1.0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  initDatabase();
  console.log('✅ Database initialized');
  const codexPidState = reconcileCodexPidOnBoot();
  if (codexPidState.cleared) {
    console.log(`🧹 Cleared stale Codex PID ${codexPidState.pid}`);
  } else if (codexPidState.running) {
    console.log(`🤖 Recovered live Codex PID ${codexPidState.pid}`);
  }
  if (codexPidState.issueReconcile?.changed) {
    console.warn(
      `[state-reconcile] Cleared stale current issue ${codexPidState.issueReconcile.clearedIssueNumber}. ` +
      `reason=${codexPidState.issueReconcile.reason} issues=${JSON.stringify(codexPidState.issueReconcile.issues)}`
    );
  }

  bot = initBot();
  if (!bot) {
    exitFatally('telegram_init_failed', new Error('initBot returned null. Check TELEGRAM_BOT_TOKEN.'));
    return;
  }

  if (hasAdmins()) {
    try {
      await notifyAdmins(
        `🚀 *Orchestrator Started*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Model: \`${getState('current_model') || 'gpt-5.5'}\`\n` +
        `API Keys: ${getApiKeyCount()} available\n` +
        `Status: Awaiting Start button` +
        buildStartupReconcileLine(codexPidState)
      );
    } catch (error) {
      console.error('[startup] Failed to send Telegram startup notification; continuing:', formatError(error));
    }
  }

  console.log('✅ Bot initialized');
  console.log(`⏱ Polling every ${POLL_INTERVAL / 1000}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  pollTimer = setInterval(pollLoop, POLL_INTERVAL);
  startHeartbeat();
  startWatchdogTimer();
  notifyReady();
  
  if (prepareResumeFromPreviousState()) {
    pollLoop();
  }
}

function buildStartupReconcileLine(codexPidState) {
  const reconcile = codexPidState.issueReconcile;
  if (!reconcile?.changed) return '';
  return `\n\n🧹 Cleared stale issue pointer #${reconcile.clearedIssueNumber}. Open Doctor → Health for details.`;
}

function prepareResumeFromPreviousState() {
  const status = getState('pipeline_status');
  if (status !== 'running') return false;

  const currentIssueNumber = getState('current_issue_number');
  const current = getCurrentIssue();
  const stateHash = createStateHash({
    pipeline_status: status,
    current_issue_number: currentIssueNumber,
    current_issue_status: current?.status || 'missing',
    current_issue_started_at: current?.started_at || null
  });

  console.log(`🔄 Resuming pipeline from previous state... state_hash=${stateHash} current_issue=${currentIssueNumber || 'null'}`);

  if (currentIssueNumber && currentIssueNumber !== 'null' && (!current || current.status === 'in_progress')) {
    console.warn(
      `[resume] Stale/bad active issue state detected; continuing instead of exiting. ` +
      `state_hash=${stateHash} issue_id=${currentIssueNumber} issue_status=${current?.status || 'missing'}`
    );
    setCurrentIssue(null);
  }

  return true;
}

function createStateHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 12);
}

function startHeartbeat() {
  heartbeatTimer = setInterval(async () => {
    const current = getCurrentIssue();
    console.log(
      `[heartbeat] alive pid=${process.pid} uptime=${Math.round(process.uptime())}s ` +
      `status=${getState('pipeline_status') || 'unknown'} current_issue=${current?.issue_number || 'none'}`
    );
  }, HEARTBEAT_INTERVAL);
}

function startWatchdogTimer() {
  watchdogTimer = setInterval(() => {
    runWatchdog('scheduled').catch(error => {
      console.error('[watchdog] scheduled check failed:', formatError(error));
    });
  }, WATCHDOG_INTERVAL);
  runWatchdog('startup', { notifyOk: false }).catch(error => {
    console.error('[watchdog] startup check failed:', formatError(error));
  });
}

function notifyReady() {
  if (typeof process.send === 'function') {
    process.send('ready');
    console.log('[lifecycle] PM2 ready signal sent.');
  }
}

async function pollLoop() {
  if (isProcessing) return;
  
  const status = getState('pipeline_status');
  if (status !== 'running') {
    setState('last_poll_time', new Date().toISOString());
    return;
  }

  const current = getCurrentIssue();
  if (current && current.status === 'in_progress') {
    return;
  }
  if (current && current.delivery_status === 'pending_review') {
    setState('pipeline_status', 'awaiting_delivery');
    return;
  }

  isProcessing = true;

  try {
    const retryIssue = getRetryIssue();
    const issues = retryIssue ? [retryIssue] : await getOpenIssues();
    
    if (issues.length === 0) {
      console.log('📭 No open issues found.');
      if (hasAdmins()) {
        await notifyAdmins('✅ *All issues completed!* Pipeline is idle.');
      }
      setState('pipeline_status', 'idle');
      isProcessing = false;
      return;
    }

    const issue = selectNextIssue(issues);
    console.log(`🎯 Processing Issue #${issue.number}: ${issue.title}`);

    const watchdog = await runWatchdog('pre_codex', { notifyOk: false });
    if (watchdog.critical) {
      setState('pipeline_status', 'paused');
      await notifyAdmins(
        `🧯 *Codex start blocked by EC2 Watchdog*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Issue #${issue.number}: ${issue.title}\n` +
        `RAM: ${watchdog.memory.usedPercent}% used\n` +
        `Disk: ${watchdog.disk.usedPercent}% used on \`${watchdog.disk.path}\`\n\n` +
        `Pipeline paused. Free resources, then press Continue.`
      );
      return;
    }

    const dirtyStatus = await getGitStatusShort();
    if (dirtyStatus) {
      if (!CHAT_ID) {
        throw new Error(`DIRTY_WORKTREE: CODEX_WORKDIR has uncommitted changes:\n${dirtyStatus}`);
      }

      const decision = await sendDirtyWorktreePrompt(CHAT_ID, dirtyStatus);
      if (decision === 'dirty_discard_continue') {
        await discardCodexChanges('pre_codex_dirty_guard');
        await notifyAdmins('🧹 Dirty working tree discarded. Continuing with Codex.');
      } else {
        setState('pipeline_status', 'paused');
        await notifyAdmins('⏸️ Codex start cancelled. Pipeline paused and working tree was left untouched.');
        return;
      }
    }

    recordIssueStart(issue.number, issue.title, issue.body || null);
    
    if (hasAdmins()) {
      const operator = getPipelineOperator();
      const operatorLine = operator ? `👤 Operator: ${formatOperator(operator)}\n` : '';
      await notifyAdmins(
        `🔧 *Issue #${issue.number} STARTED*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 ${issue.title}\n` +
        operatorLine +
        `🤖 Model: \`${getState('current_model') || 'gpt-5.5'}\`\n` +
        `⏳ Working...`
      );
    }

    const model = getState('current_model') || 'gpt-5.5';
    let result;
    
    try {
      if (hasAdmins()) {
        await startDiffStreamsForAdmins(`Issue #${issue.number}: ${issue.title}`, getPipelineOperator());
        await startThinkingStreamsForAdmins(`Issue #${issue.number}`, getPipelineOperator());
      }
      result = await runCodex(issue.number, issue.title, issue.body, model);
      stopDiffStream();
      stopThinkingStream('✅ Wrapping up...');
    } catch (error) {
      stopDiffStream();
      stopThinkingStream(`Codex run stopped or failed: ${error.message.slice(0, 160)}`);
      if (isApiKeyFailure(error)) {
        await handleApiKeyExhaustion(issue.number, issue.title, error);
        isProcessing = false;
        return;
      }
      if (isCodexTimeoutError(error)) {
        await handleCodexTimeout(issue.number, error);
        isProcessing = false;
        return;
      }
      throw error;
    }

    const summary = generateSummaryMessage(issue.number, issue.title, result, model);
    const statusAfterCodex = await getGitStatusShort();

    console.log(`✅ Issue #${issue.number} completed in ${result.duration}s`);

    if (!statusAfterCodex) {
      recordIssueComplete(issue.number, summary, result.rawOutput, 'discarded');
      setIssueDeliveryStatus(issue.number, 'discarded', {
        status: 'completed',
        clearCurrentIssue: true,
        completedAt: true
      });
      setState('pipeline_status', 'paused');
      const remaining = finishBatchSlot();
      if (remaining > 0) {
        setState('pipeline_status', 'running');
      }
      if (hasAdmins()) {
        await notifyAdmins(
          `⚠️ Codex finished but no files were modified for Issue #${issue.number}.` +
          `${remaining > 0 ? `\n\n🔢 Batch continuing with ${remaining} issue${remaining === 1 ? '' : 's'} remaining.` : ''}`
        );
      }
      await notifyCodexQueueAvailable(issue, result, 'completed_no_changes');
      return;
    }

    recordIssueComplete(issue.number, summary, result.rawOutput, 'pending_review');
    setState('pipeline_status', 'awaiting_delivery');

    finishBatchSlot();

    if (hasAdmins()) {
      await sendDeliveryReviewPanelsForAdmins({
        issueNumber: issue.number,
        issueTitle: issue.title,
        result
      });
    } else {
      console.log(`Codex finished Issue #${issue.number}; changes are pending human delivery review.`);
    }
    await notifyCodexQueueAvailable(issue, result, 'completed');

  } catch (error) {
    if (isCodexTimeoutError(error)) {
      const current = getCurrentIssue();
      await handleCodexTimeout(current?.issue_number || null, error);
      return;
    }

    if (String(error?.message || '').includes('CODEX_STOPPED')) {
      console.warn('🛑 Codex run stopped by operator.');
      const current = getCurrentIssue();
      await notifyCodexQueueAvailable(current, null, 'stopped');
      return;
    }

    console.error('❌ Pipeline error:', error);
    const current = getCurrentIssue();
    if (current) {
      recordIssueError(current.issue_number, error.message);
      if (hasAdmins()) {
        await notifyAdmins(
          `❌ *ERROR on Issue #${current.issue_number}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${error.message.substring(0, 300)}\n\n` +
          `Pipeline paused. Use the Continue button to resume.`
        );
      }
      await notifyCodexQueueAvailable(current, null, 'failed');
    }
    setState('pipeline_status', 'error');
  } finally {
    isProcessing = false;
  }
}

function isCodexTimeoutError(error) {
  return error?.code === 'CODEX_TIMEOUT' || String(error?.message || '').includes('CODEX_TIMEOUT');
}

function isApiKeyFailure(error) {
  const code = error?.code;
  const message = String(error?.message || '');
  return (
    code === 'API_KEY_EXHAUSTED' ||
    code === 'API_KEY_FAILED' ||
    message.includes('API_KEY_EXHAUSTED') ||
    message.includes('API_KEY_FAILED')
  );
}

async function handleCodexTimeout(issueNumber, error) {
  const minutes = error?.timeoutMinutes || 'configured limit';
  const issueText = issueNumber ? `Issue #${issueNumber}` : 'Codex task';
  console.warn(`⏱️ ${issueText} timed out after ${minutes} minutes.`);
  setState('pipeline_status', 'paused');
  setCurrentIssue(null);
  if (hasAdmins() && issueNumber) {
    await notifyAdmins(`⏱️ Codex timed out after ${minutes} minutes. Issue #${issueNumber} aborted.`);
  } else if (hasAdmins()) {
    await notifyAdmins(`⏱️ Codex timed out after ${minutes} minutes. Task aborted.`);
  }
  await notifyCodexQueueAvailable(
    issueNumber ? { number: issueNumber, title: issueText } : null,
    null,
    'timeout'
  );
}

function hasAdmins() {
  return ADMIN_CHAT_IDS.length > 0;
}

async function notifyAdmins(text) {
  if (!hasAdmins()) return [];
  return broadcastNotification(text, ADMIN_CHAT_IDS);
}

async function notifyCodexQueueAvailable(issue, result = null, status = 'completed') {
  try {
    const waiters = getWaitingUsers();
    const current = getCurrentIssue();
    const preserveDeliveryGate = current?.delivery_status === 'pending_review';
    if (
      waiters.length > 0 &&
      !preserveDeliveryGate &&
      ['completed', 'completed_no_changes', 'failed', 'stopped', 'timeout'].includes(status)
    ) {
      setState('pipeline_status', 'paused');
    }

    const issueNumber = issue?.number || issue?.issue_number || null;
    const issueTitle = issue?.title || (issueNumber ? `Issue #${issueNumber}` : 'Codex task');
    const label = issueNumber ? `Issue #${issueNumber}: ${issueTitle}` : issueTitle;
    await notifyWaitingUsersCodexFree({
      operator: getPipelineOperator(),
      label,
      task: issueNumber ? `Issue #${issueNumber}` : label,
      metadata: issueNumber ? { issueNumber, issueTitle } : {},
      duration: Number(result?.duration || 0),
      status
    });
  } catch (error) {
    console.warn('[queue] Failed to notify waiting users that Codex is free:', formatError(error));
  }
}

async function startDiffStreamsForAdmins(label, operator) {
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      await startDiffStream(chatId, label, operator);
    } catch (error) {
      console.warn(`[diff-stream] Failed to start stream for chat ${chatId}:`, formatError(error));
    }
  }
}

async function startThinkingStreamsForAdmins(label, operator) {
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      await startThinkingStream(chatId, label, operator);
    } catch (error) {
      console.warn(`[thinking-stream] Failed to start stream for chat ${chatId}:`, formatError(error));
    }
  }
}

async function sendDeliveryReviewPanelsForAdmins(review) {
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      await sendDeliveryReviewPanel(chatId, review);
    } catch (error) {
      console.warn(`[delivery] Failed to send review panel to chat ${chatId}:`, formatError(error));
    }
  }
}

function finishBatchSlot() {
  const before = getBatchRemaining();
  if (before <= 0) return 0;
  const remaining = decrementBatchRemaining();
  return remaining;
}

async function runWatchdog(reason, options = {}) {
  const report = await getWatchdogReport();
  const warnings = report.warnings;

  if (warnings.length === 0) {
    if (options.notifyOk && hasAdmins()) {
      await notifyAdmins(`✅ Watchdog OK. RAM ${report.memory.usedPercent}% | Disk ${report.disk.usedPercent}%`);
    }
    return report;
  }

  const signature = warnings.join('|');
  const lastSignature = getState('watchdog_last_alert_signature');
  const lastAlertAt = getState('watchdog_last_alert_at');
  const lastAlertMs = lastAlertAt && lastAlertAt !== 'null' ? Date.parse(lastAlertAt) : 0;
  const shouldAlert = signature !== lastSignature || Date.now() - lastAlertMs > WATCHDOG_COOLDOWN_MS;

  console.warn(`[watchdog] reason=${reason} warnings=${JSON.stringify(warnings)} report=${JSON.stringify(report)}`);
  if (shouldAlert && hasAdmins()) {
    setState('watchdog_last_alert_signature', signature);
    setState('watchdog_last_alert_at', new Date().toISOString());
    await notifyAdmins(
      `⚠️ *EC2 Watchdog Warning*\n` +
      `Reason: ${reason}\n` +
      `RAM: ${report.memory.usedPercent}% used (${formatBytes(report.memory.used)} / ${formatBytes(report.memory.total)})\n` +
      `Disk: ${report.disk.usedPercent}% used on \`${report.disk.path}\`\n\n` +
      warnings.map(warning => `• ${warning}`).join('\n')
    );
  }

  return report;
}

async function getWatchdogReport() {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const memoryUsed = memoryTotal - memoryFree;
  const memoryUsedPercent = Math.round((memoryUsed / memoryTotal) * 100);
  const disk = await getDiskUsage(WATCHDOG_PATH);
  const warnings = [];

  if (memoryUsedPercent >= WATCHDOG_THRESHOLD) {
    warnings.push(`RAM usage is ${memoryUsedPercent}% (threshold ${WATCHDOG_THRESHOLD}%)`);
  }
  if (disk.usedPercent >= WATCHDOG_THRESHOLD) {
    warnings.push(`Disk usage is ${disk.usedPercent}% on ${disk.path} (threshold ${WATCHDOG_THRESHOLD}%)`);
  }

  return {
    threshold: WATCHDOG_THRESHOLD,
    memory: {
      total: memoryTotal,
      free: memoryFree,
      used: memoryUsed,
      usedPercent: memoryUsedPercent
    },
    disk,
    warnings,
    critical: warnings.length > 0
  };
}

function getDiskUsage(targetPath) {
  return new Promise((resolve) => {
    execFile('df', ['-Pk', targetPath], { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({
          path: targetPath,
          totalKb: 0,
          usedKb: 0,
          availableKb: 0,
          usedPercent: 0,
          error: error.message
        });
        return;
      }

      const line = stdout.trim().split('\n')[1] || '';
      const parts = line.split(/\s+/);
      const totalKb = Number(parts[1] || 0);
      const usedKb = Number(parts[2] || 0);
      const availableKb = Number(parts[3] || 0);
      const usedPercent = Number(String(parts[4] || '0').replace('%', '')) || 0;
      resolve({
        path: targetPath,
        filesystem: parts[0] || 'unknown',
        totalKb,
        usedKb,
        availableKb,
        usedPercent
      });
    });
  });
}

function formatBytes(bytes) {
  const gib = bytes / 1024 / 1024 / 1024;
  return `${gib.toFixed(1)} GiB`;
}

function formatOperator(operator) {
  if (!operator) return '';
  return operator.username ? `@${operator.username}` : operator.displayName || `user ${operator.userId || 'unknown'}`;
}

function selectNextIssue(issues) {
  const openNumbers = issues.map(issue => issue.number);
  const priorityQueue = prunePriorityQueue(openNumbers);
  const existingOrder = getQueueOrder().filter(issueNumber => openNumbers.includes(issueNumber));
  const missing = openNumbers.filter(issueNumber => !existingOrder.includes(issueNumber));
  const queueOrder = setQueueOrder([...existingOrder, ...missing]);
  const byNumber = new Map(issues.map(issue => [issue.number, issue]));
  const priorityIssue = priorityQueue
    .map(issueNumber => byNumber.get(issueNumber))
    .find(Boolean);
  if (priorityIssue) {
    setQueueOrder([
      priorityIssue.number,
      ...queueOrder.filter(issueNumber => issueNumber !== priorityIssue.number)
    ]);
    return priorityIssue;
  }
  return queueOrder.map(issueNumber => byNumber.get(issueNumber)).find(Boolean) || issues[0];
}

function getRetryIssue() {
  const current = getCurrentIssue();
  if (!current || current.delivery_status !== 'retrying') return null;
  return {
    number: current.issue_number,
    title: current.title,
    body: current.body || ''
  };
}

async function handleApiKeyExhaustion(issueNumber, title, error) {
  console.error('🔑 API key failure:', error?.message || error);

  recordIssueAwaitingKey(issueNumber, error?.message || 'API key failure');

  if (hasAdmins()) {
    await sendKeyExhaustedAlertsForAdmins(issueNumber, title, 'interrupted', error);
  }
}

async function sendKeyExhaustedAlertsForAdmins(issueNumber, title, progress, error = null) {
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      await sendKeyExhaustedAlert(chatId, issueNumber, title, {
        progress,
        keyRedacted: error?.keyRedacted,
        failureType: error?.failureType,
        message: error?.message
      });
    } catch (error) {
      console.warn(`[api-key] Failed to send exhausted alert to chat ${chatId}:`, formatError(error));
    }
  }
}

function getApiKeyCount() {
  return getCodexRuntimeStatus().keyCount;
}

function buildSignalContext(signal) {
  const pm2Managed = Boolean(process.env.pm_id || process.env.PM2_HOME);
  const execMode = process.env.exec_mode || (process.env.NODE_APP_INSTANCE ? 'pm2-instance' : 'direct');
  const sshSession = Boolean(process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.SSH_CLIENT);
  let classification = 'direct OS signal';

  if (signal === 'SIGTERM' && pm2Managed) {
    classification = 'supervisor-requested shutdown (PM2/systemd/container)';
  } else if (signal === 'SIGINT') {
    classification = 'interactive interrupt';
  } else if (signal === 'SIGHUP' && sshSession) {
    classification = 'likely SSH/session hangup';
  } else if (signal === 'SIGHUP') {
    classification = 'terminal/session hangup';
  }

  return {
    signal,
    classification,
    pid: process.pid,
    ppid: process.ppid,
    uptime_seconds: Math.round(process.uptime()),
    pm2_managed: pm2Managed,
    pm_id: process.env.pm_id || null,
    exec_mode: execMode,
    ssh_session: sshSession,
    note: 'Child process exits do not reach this signal handler.'
  };
}

function logShutdownTrigger(reason, details) {
  console.warn(`[shutdown-trigger] reason=${reason} details=${JSON.stringify(details)}`);
}

async function shutdown(reason, details, exitCode = 0) {
  if (isShuttingDown) {
    console.warn(`[shutdown] Duplicate shutdown request ignored. reason=${reason}`);
    return;
  }

  isShuttingDown = true;
  console.warn(`[shutdown] Starting graceful shutdown. reason=${reason} details=${JSON.stringify(details)}`);
  console.log('\n👋 Shutting down gracefully...');
  if (pollTimer) clearInterval(pollTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (watchdogTimer) clearInterval(watchdogTimer);

  try {
    if (bot) await bot.stopPolling();
  } catch (error) {
    console.error('[shutdown] Failed to stop Telegram polling cleanly:', formatError(error));
  }

  process.exit(exitCode);
}

function handleSignal(signal) {
  const details = buildSignalContext(signal);
  logShutdownTrigger(`signal:${signal}`, details);
  shutdown(`signal:${signal}`, details, 0);
}

function handleSighup() {
  const details = buildSignalContext('SIGHUP');
  logShutdownTrigger('signal:SIGHUP', details);

  if (process.env.ALLOW_SIGHUP_SHUTDOWN === 'true') {
    shutdown('signal:SIGHUP', { ...details, allowed_by_env: true }, 0);
    return;
  }

  console.warn(
    '[shutdown] Ignoring SIGHUP so SSH/session drops do not stop the orchestrator. ' +
    'Set ALLOW_SIGHUP_SHUTDOWN=true to make SIGHUP terminate the process.'
  );
}

function exitFatally(reason, error) {
  console.error(`[fatal-exit] reason=${reason}`, formatError(error));
  process.exit(1);
}

function formatError(error) {
  if (!error) return 'none';
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return error;
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGHUP', handleSighup);

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection caught; keeping orchestrator alive:', formatError(reason));
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception caught; keeping orchestrator alive:', formatError(error));
});

main().catch(err => {
  exitFatally('main_unhandled_error', err);
});

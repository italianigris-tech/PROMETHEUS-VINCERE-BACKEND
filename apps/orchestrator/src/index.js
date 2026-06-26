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
  setIssueDeliveryStatus,
  getPriorityQueue,
  prunePriorityQueue,
  getPipelineOperator
} = require('./lib/database');
const { getOpenIssues } = require('./lib/github');
const {
  runCodex,
  generateSummaryMessage,
  rotateApiKey,
  getCurrentApiKey,
  getKeySuffix,
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
  sendNotification,
  startDiffStream,
  stopDiffStream
} = require('./lib/telegram');

const CHAT_ID = process.env.AUTHORIZED_CHAT_IDS?.split(',')[0];
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 30) * 1000;
const HEARTBEAT_INTERVAL = 60 * 1000;
const WATCHDOG_THRESHOLD = parseInt(process.env.WATCHDOG_THRESHOLD_PERCENT, 10) || 80;
const WATCHDOG_COOLDOWN_MS = (parseInt(process.env.WATCHDOG_COOLDOWN_MINUTES, 10) || 15) * 60 * 1000;
const WATCHDOG_PATH = process.env.WATCHDOG_DISK_PATH || (process.env.CODEX_WORKDIR || process.cwd());

let isProcessing = false;
let isShuttingDown = false;
let bot;
let pollTimer;
let heartbeatTimer;

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

  if (CHAT_ID) {
    try {
      await sendNotification(CHAT_ID,
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
    await runWatchdog('heartbeat');
  }, HEARTBEAT_INTERVAL);
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
      if (CHAT_ID) {
        await sendNotification(CHAT_ID, '✅ *All issues completed!* Pipeline is idle.');
      }
      setState('pipeline_status', 'idle');
      isProcessing = false;
      return;
    }

    const issue = selectNextIssue(issues);
    console.log(`🎯 Processing Issue #${issue.number}: ${issue.title}`);

    const dirtyStatus = await getGitStatusShort();
    if (dirtyStatus) {
      if (!CHAT_ID) {
        throw new Error(`DIRTY_WORKTREE: CODEX_WORKDIR has uncommitted changes:\n${dirtyStatus}`);
      }

      const decision = await sendDirtyWorktreePrompt(CHAT_ID, dirtyStatus);
      if (decision === 'dirty_discard_continue') {
        await discardCodexChanges('pre_codex_dirty_guard');
        await sendNotification(CHAT_ID, '🧹 Dirty working tree discarded. Continuing with Codex.');
      } else {
        setState('pipeline_status', 'paused');
        await sendNotification(CHAT_ID, '⏸️ Codex start cancelled. Pipeline paused and working tree was left untouched.');
        return;
      }
    }

    recordIssueStart(issue.number, issue.title, issue.body || null);
    
    if (CHAT_ID) {
      await sendNotification(CHAT_ID, 
        `🔧 *Issue #${issue.number} STARTED*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 ${issue.title}\n` +
        `🤖 Model: \`${getState('current_model') || 'gpt-5.5'}\`\n` +
        `⏳ Working...`
      );
    }

    const model = getState('current_model') || 'gpt-5.5';
    let result;
    
    try {
      await runWatchdog('pre_codex', { notifyOk: false });
      if (CHAT_ID) {
        await startDiffStream(CHAT_ID, `Issue #${issue.number}: ${issue.title}`, getPipelineOperator());
      }
      result = await runCodex(issue.number, issue.title, issue.body, model);
      stopDiffStream();
    } catch (error) {
      stopDiffStream();
      if (error.message.includes('API_KEY_EXHAUSTED')) {
        await handleApiKeyExhaustion(issue.number, issue.title, error.message);
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
      if (CHAT_ID) {
        await sendNotification(CHAT_ID, `⚠️ Codex finished but no files were modified for Issue #${issue.number}.`);
      }
      return;
    }

    recordIssueComplete(issue.number, summary, result.rawOutput, 'pending_review');
    setState('pipeline_status', 'awaiting_delivery');

    if (CHAT_ID) {
      await sendDeliveryReviewPanel(CHAT_ID, {
        issueNumber: issue.number,
        issueTitle: issue.title,
        result
      });
    } else {
      console.log(`Codex finished Issue #${issue.number}; changes are pending human delivery review.`);
    }

  } catch (error) {
    if (isCodexTimeoutError(error)) {
      const current = getCurrentIssue();
      await handleCodexTimeout(current?.issue_number || null, error);
      return;
    }

    if (String(error?.message || '').includes('CODEX_STOPPED')) {
      console.warn('🛑 Codex run stopped by operator.');
      return;
    }

    console.error('❌ Pipeline error:', error);
    const current = getCurrentIssue();
    if (current) {
      recordIssueError(current.issue_number, error.message);
      if (CHAT_ID) {
        await sendNotification(CHAT_ID, 
          `❌ *ERROR on Issue #${current.issue_number}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${error.message.substring(0, 300)}\n\n` +
          `Pipeline paused. Use the Continue button to resume.`
        );
      }
    }
    setState('pipeline_status', 'error');
  } finally {
    isProcessing = false;
  }
}

function isCodexTimeoutError(error) {
  return error?.code === 'CODEX_TIMEOUT' || String(error?.message || '').includes('CODEX_TIMEOUT');
}

async function handleCodexTimeout(issueNumber, error) {
  const minutes = error?.timeoutMinutes || 'configured limit';
  const issueText = issueNumber ? `Issue #${issueNumber}` : 'Codex task';
  console.warn(`⏱️ ${issueText} timed out after ${minutes} minutes.`);
  setState('pipeline_status', 'paused');
  setCurrentIssue(null);
  if (CHAT_ID && issueNumber) {
    await sendNotification(CHAT_ID, `⏱️ Codex timed out after ${minutes} minutes. Issue #${issueNumber} aborted.`);
  } else if (CHAT_ID) {
    await sendNotification(CHAT_ID, `⏱️ Codex timed out after ${minutes} minutes. Task aborted.`);
  }
}

async function runWatchdog(reason, options = {}) {
  const report = await getWatchdogReport();
  const warnings = report.warnings;

  if (warnings.length === 0) {
    if (options.notifyOk && CHAT_ID) {
      await sendNotification(CHAT_ID, `✅ Watchdog OK. RAM ${report.memory.usedPercent}% | Disk ${report.disk.usedPercent}%`);
    }
    return report;
  }

  const signature = warnings.join('|');
  const lastSignature = getState('watchdog_last_alert_signature');
  const lastAlertAt = getState('watchdog_last_alert_at');
  const lastAlertMs = lastAlertAt && lastAlertAt !== 'null' ? Date.parse(lastAlertAt) : 0;
  const shouldAlert = signature !== lastSignature || Date.now() - lastAlertMs > WATCHDOG_COOLDOWN_MS;

  console.warn(`[watchdog] reason=${reason} warnings=${JSON.stringify(warnings)} report=${JSON.stringify(report)}`);
  if (shouldAlert && CHAT_ID) {
    setState('watchdog_last_alert_signature', signature);
    setState('watchdog_last_alert_at', new Date().toISOString());
    await sendNotification(CHAT_ID,
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
    warnings
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

function selectNextIssue(issues) {
  const openNumbers = issues.map(issue => issue.number);
  const priorityQueue = prunePriorityQueue(openNumbers);
  const priorityIssue = priorityQueue
    .map(issueNumber => issues.find(issue => issue.number === issueNumber))
    .find(Boolean);
  return priorityIssue || issues[0];
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

async function handleApiKeyExhaustion(issueNumber, title, errorMessage) {
  console.error('🔑 API Key exhausted:', errorMessage);
  
  const rotation = rotateApiKey('Rate limit / exhaustion detected during issue execution');
  
  if (CHAT_ID) {
    if (rotation.exhausted) {
      await sendKeyExhaustedAlert(CHAT_ID, issueNumber, title, '67% (interrupted)');
      setState('pipeline_status', 'awaiting_key');
    } else {
      await sendNotification(CHAT_ID,
        `🔄 *API Key Auto-Rotated*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Old key: ...${rotation.oldSuffix}\n` +
        `New key: ...${rotation.newSuffix}\n\n` +
        `Retrying Issue #${issueNumber} with new key...`
      );
      isProcessing = false;
      return;
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

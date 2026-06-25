const dotenv = require('dotenv');
dotenv.config();

const crypto = require('crypto');
const { initDatabase, getState, setState, getCurrentIssue, setCurrentIssue, recordIssueStart, recordIssueComplete, recordIssueError, incrementRetry } = require('./lib/database');
const { getOpenIssues, getIssue, closeIssue, addComment } = require('./lib/github');
const { runCodex, generateSummaryMessage, rotateApiKey, getCurrentApiKey, getKeySuffix, getCodexRuntimeStatus, reconcileCodexPidOnBoot } = require('./lib/codex');
const { initBot, sendCompletionPrompt, sendKeyExhaustedAlert, sendNotification } = require('./lib/telegram');

const CHAT_ID = process.env.AUTHORIZED_CHAT_IDS?.split(',')[0];
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 30) * 1000;
const HEARTBEAT_INTERVAL = 60 * 1000;

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
        `Status: Awaiting /pipeline start`
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
  heartbeatTimer = setInterval(() => {
    const current = getCurrentIssue();
    console.log(
      `[heartbeat] alive pid=${process.pid} uptime=${Math.round(process.uptime())}s ` +
      `status=${getState('pipeline_status') || 'unknown'} current_issue=${current?.issue_number || 'none'}`
    );
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

  isProcessing = true;

  try {
    const issues = await getOpenIssues();
    
    if (issues.length === 0) {
      console.log('📭 No open issues found.');
      if (CHAT_ID) {
        await sendNotification(CHAT_ID, '✅ *All issues completed!* Pipeline is idle.');
      }
      setState('pipeline_status', 'idle');
      isProcessing = false;
      return;
    }

    const issue = issues[0];
    console.log(`🎯 Processing Issue #${issue.number}: ${issue.title}`);

    recordIssueStart(issue.number, issue.title);
    
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
      result = await runCodex(issue.number, issue.title, issue.body, model);
    } catch (error) {
      if (error.message.includes('API_KEY_EXHAUSTED')) {
        await handleApiKeyExhaustion(issue.number, issue.title, error.message);
        isProcessing = false;
        return;
      }
      throw error;
    }

    const summary = generateSummaryMessage(issue.number, issue.title, result, model);
    recordIssueComplete(issue.number, summary, result.rawOutput);

    console.log(`✅ Issue #${issue.number} completed in ${result.duration}s`);

    if (CHAT_ID) {
      const decision = await sendCompletionPrompt(CHAT_ID, summary);
      await handleHumanDecision(decision, issue.number, issue.title, summary);
    } else {
      console.log('No TELEGRAM_CHAT configured. Auto-continuing...');
      await closeIssue(issue.number, `Completed by Prometheus Orchestrator\n\n${summary}`);
    }

  } catch (error) {
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
          `Pipeline paused. Use /pipeline resume to continue.`
        );
      }
    }
    setState('pipeline_status', 'error');
  } finally {
    isProcessing = false;
  }
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

async function handleHumanDecision(decision, issueNumber, title, summary) {
  switch (decision) {
    case 'continue':
      console.log(`✅ Human approved Issue #${issueNumber}. Closing and continuing...`);
      await closeIssue(issueNumber, `✅ Completed by Prometheus Orchestrator\n\n${summary}`);
      setState('pipeline_status', 'running');
      break;

    case 'view_details':
      const current = getCurrentIssue();
      if (current && current.codex_output) {
        let details = current.codex_output;
        if (details.length > 3500) {
          details = details.substring(0, 3500) + '\n\n... (truncated)';
        }
        await sendNotification(CHAT_ID, 
          `📋 *Detailed Output for Issue #${issueNumber}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `\`\`\`\n${details}\n\`\`\``
        );
      }
      const rePrompt = generateSummaryMessage(issueNumber, title, { output: [], duration: 'N/A' }, getState('current_model'));
      const newDecision = await sendCompletionPrompt(CHAT_ID, rePrompt);
      await handleHumanDecision(newDecision, issueNumber, title, summary);
      break;

    case 'retry':
      console.log(`🔄 Human requested retry for Issue #${issueNumber}`);
      incrementRetry(issueNumber);
      setState('pipeline_status', 'running');
      break;

    case 'pause':
      console.log(`⏸️ Pipeline paused by human after Issue #${issueNumber}`);
      setState('pipeline_status', 'paused');
      await sendNotification(CHAT_ID, '⏸️ Pipeline paused. Use /pipeline resume to continue.');
      break;

    case 'skip':
      console.log(`⏭️ Human skipped Issue #${issueNumber}`);
      await addComment(issueNumber, `⏭️ Skipped by human operator. Moving to next issue.`);
      setState('pipeline_status', 'running');
      break;

    case 'change_model':
      await sendNotification(CHAT_ID, 
        `🤖 *Change Model*\n` +
        `Current: \`${getState('current_model')}\`\n` +
        `Reply with: /model gpt-5.5-xhigh`
      );
      const afterModelPrompt = generateSummaryMessage(issueNumber, title, { output: [], duration: 'N/A' }, getState('current_model'));
      const afterModelDecision = await sendCompletionPrompt(CHAT_ID, afterModelPrompt);
      await handleHumanDecision(afterModelDecision, issueNumber, title, summary);
      break;

    case 'timeout':
      console.log(`⏰ No response from human for Issue #${issueNumber}. Auto-continuing...`);
      await closeIssue(issueNumber, `✅ Completed by Prometheus Orchestrator (auto-approved after timeout)\n\n${summary}`);
      setState('pipeline_status', 'running');
      break;

    default:
      console.log(`Unknown decision: ${decision}. Pausing.`);
      setState('pipeline_status', 'paused');
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

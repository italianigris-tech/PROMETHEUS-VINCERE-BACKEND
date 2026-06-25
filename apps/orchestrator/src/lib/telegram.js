const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const {
  getState,
  setState,
  getCurrentIssue,
  setCurrentIssue,
  inspectActiveIssueState,
  setPipelineOperator,
  clearPipelineOperator,
  normalizeOperator,
  getPriorityQueue,
  prioritizeIssue,
  prunePriorityQueue,
  getBatchRemaining,
  setBatchRemaining,
  getStats
} = require('./database');
const {
  runCodexPrompt,
  stopCodex,
  parseCodexOutput,
  setPrimaryApiKey,
  getCodexRuntimeStatus,
  getCodexEventLog,
  getCurrentApiKey,
  getKeySuffix
} = require('./codex');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHATS = (process.env.AUTHORIZED_CHAT_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
const LOG_DIR = path.join(process.cwd(), 'logs');
const OUT_LOG = path.join(LOG_DIR, 'out.log');
const ERR_LOG = path.join(LOG_DIR, 'err.log');
const MAX_LOG_CHARS = 2200;
const MAX_TRACKED_MESSAGES_PER_CHAT = 40;
const DIFF_STREAM_INTERVAL = (parseInt(process.env.DIFF_STREAM_INTERVAL_SECONDS, 10) || 30) * 1000;
const DIFF_STREAM_WORKDIR = process.env.CODEX_WORKDIR || process.cwd();
const WATCHDOG_THRESHOLD = parseInt(process.env.WATCHDOG_THRESHOLD_PERCENT, 10) || 80;
const WATCHDOG_PATH = process.env.WATCHDOG_DISK_PATH || DIFF_STREAM_WORKDIR;

let bot;
let messageCallbacks = new Map();
let pendingInputs = new Map();
let trackedBotMessages = new Map();
let pollingRetryTimer = null;
let pollingRetryDelay = 5000;
let diffStream = null;

function initBot() {
  if (!TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set. Bot will not start.');
    return null;
  }

  bot = new TelegramBot(TOKEN, { polling: { autoStart: false } });
  attachPollingLifecycleHandlers(bot);
  bot.startPolling().catch((error) => {
    console.error('[telegram] Initial polling start failed; retrying instead of shutting down:', formatError(error));
    schedulePollingRetry(bot, 'initial_start_failed');
  });
  console.log('Telegram bot started (polling mode)');

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAuthorized(chatId)) {
      await sendTrackedMessage(chatId, `Unauthorized chat. Your chat ID is \`${chatId}\`.`, { parse_mode: 'Markdown' });
      return;
    }
    await sendControlPanel(chatId, msg.from.first_name || 'there');
  });

  bot.on('message', async (msg) => {
    await handlePendingInputMessage(msg);
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (!isAuthorized(chatId)) {
      bot.answerCallbackQuery(query.id, { text: 'Unauthorized' });
      return;
    }

    if (data === 'logs:refresh' || data === 'logs:refresh:simple' || data === 'logs:refresh:technical') {
      await bot.answerCallbackQuery(query.id, { text: 'Refreshing logs' });
      await refreshLogsMessage(query.message, data.endsWith(':technical') ? 'technical' : 'simple');
      return;
    }

    if (data.startsWith('help:')) {
      await handleHelpAction(query);
      return;
    }

    if (data.startsWith('panel:')) {
      await handlePanelAction(query);
      return;
    }

    const completionActions = new Set(['view_details', 'continue', 'retry', 'pause', 'change_model', 'skip']);
    if (messageCallbacks.has(chatId)) {
      if (!completionActions.has(data)) {
        await bot.answerCallbackQuery(query.id, { text: 'Use the review buttons for this issue first.' });
        return;
      }
      await bot.answerCallbackQuery(query.id);
      const resolve = messageCallbacks.get(chatId);
      messageCallbacks.delete(chatId);
      resolve(data);
      return;
    }

    await bot.answerCallbackQuery(query.id);
  });

  return bot;
}

async function sendControlPanel(chatId, name = 'there') {
  await sendTrackedMessage(chatId, buildControlPanelText(name), {
    parse_mode: 'Markdown',
    reply_markup: controlPanelKeyboard()
  });
}

async function refreshControlPanel(message) {
  await safeEditMessageText(buildControlPanelText('there'), {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'Markdown',
    reply_markup: controlPanelKeyboard()
  });
}

function buildControlPanelText(name) {
  const codex = getCodexRuntimeStatus();
  const current = getCurrentIssue();
  const status = getState('pipeline_status') || 'idle';
  const currentLine = current
    ? `#${current.issue_number}: ${escapeMarkdown(current.title || 'Unknown')}`
    : 'none';

  return (
    `🔧 *PROMETHEUS CONTROL PANEL*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Welcome, ${escapeMarkdown(name)}.\n` +
    `Pipeline: *${escapeMarkdown(status.toUpperCase())}*\n` +
    `Codex: *${escapeMarkdown(formatCodexStatusSummary(codex))}* | Model: \`${escapeMarkdown(codex.model)}\`\n` +
    `API keys: ${codex.keyCount} | Active: \`...${escapeMarkdown(codex.keySuffix)}\`\n` +
    `Current issue: ${currentLine}\n`
  );
}

function controlPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '▶️ Start', callback_data: 'panel:pipeline:start' },
        { text: '⏸️ Pause', callback_data: 'panel:pipeline:pause' },
        { text: '❓', callback_data: 'help:main:pipeline' }
      ],
      [
        { text: '➡️ Continue', callback_data: 'panel:pipeline:resume' },
        { text: '🛑 Stop Codex', callback_data: 'panel:codex_stop' },
        { text: '❓', callback_data: 'help:main:runtime' }
      ],
      [
        { text: '⛔ Stop All', callback_data: 'panel:stop_all' },
        { text: '❌ Cancel', callback_data: 'panel:cancel' },
        { text: '❓', callback_data: 'help:main:stop' }
      ],
      [
        { text: '📊 Status', callback_data: 'panel:status' },
        { text: '📋 Queue', callback_data: 'panel:queue' },
        { text: '❓', callback_data: 'help:main:status_queue' }
      ],
      [
        { text: '📊 Stats', callback_data: 'panel:stats' },
        { text: '🩺 Doctor', callback_data: 'panel:doctor' },
        { text: '❓', callback_data: 'help:main:stats_doctor' }
      ],
      [
        { text: '💬 Prompt', callback_data: 'panel:prompt' },
        { text: '📜 Logs', callback_data: 'panel:logs' },
        { text: '❓', callback_data: 'help:main:prompt_logs' }
      ],
      [
        { text: '⚙️ Settings', callback_data: 'panel:settings' },
        { text: '❔ Help', callback_data: 'panel:help' },
        { text: '❓', callback_data: 'help:main:settings_help' }
      ],
      [
        { text: '🔄 Refresh', callback_data: 'panel:refresh' },
        { text: '❓', callback_data: 'help:main:refresh' }
      ]
    ]
  };
}

async function handlePanelAction(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'panel:refresh') {
    await bot.answerCallbackQuery(query.id, { text: 'Refreshing panel' });
    await refreshControlPanel(query.message);
    return;
  }

  if (data === 'panel:codex_stop') {
    await bot.answerCallbackQuery(query.id, { text: 'Stopping Codex' });
    await stopCodexFromTelegram(chatId);
    await refreshControlPanel(query.message);
    return;
  }

  if (data === 'panel:stop_all') {
    await bot.answerCallbackQuery(query.id, { text: 'Stopping all systems' });
    await stopAllFromTelegram(chatId);
    await refreshControlPanel(query.message);
    return;
  }

  if (data === 'panel:status') {
    await bot.answerCallbackQuery(query.id, { text: 'Status' });
    await sendStatus(chatId);
    return;
  }

  if (data === 'panel:queue') {
    await bot.answerCallbackQuery(query.id, { text: 'Queue' });
    await sendQueuePanel(chatId);
    return;
  }

  if (data === 'panel:stats') {
    await bot.answerCallbackQuery(query.id, { text: 'Stats' });
    await sendStatsPanel(chatId);
    return;
  }

  if (data === 'panel:settings') {
    await bot.answerCallbackQuery(query.id, { text: 'Settings' });
    await sendSettingsPanel(chatId);
    return;
  }

  if (data === 'panel:help') {
    await bot.answerCallbackQuery(query.id, { text: 'Help' });
    await sendHelpPanel(chatId);
    return;
  }

  if (data === 'panel:codex_status') {
    await bot.answerCallbackQuery(query.id, { text: 'Codex status' });
    await sendCodexStatus(chatId);
    return;
  }

  if (data === 'panel:logs') {
    await bot.answerCallbackQuery(query.id, { text: 'Logs' });
    await sendLogsPanel(chatId);
    return;
  }

  if (data === 'panel:logs:simple' || data === 'panel:logs:technical') {
    await bot.answerCallbackQuery(query.id, { text: 'Opening logs' });
    await sendLogs(chatId, data.endsWith(':technical') ? 'technical' : 'simple');
    return;
  }

  if (data === 'panel:codex_logs') {
    await bot.answerCallbackQuery(query.id, { text: 'Opening Codex activity' });
    await maybeWarnCodexLiveDuringRun(chatId);
    await sendCodexActivity(chatId, 'simple');
    return;
  }

  if (data === 'panel:codex_logs:simple' || data === 'panel:codex_logs:technical') {
    await bot.answerCallbackQuery(query.id, { text: 'Opening Codex activity' });
    await maybeWarnCodexLiveDuringRun(chatId);
    await sendCodexActivity(chatId, data.endsWith(':technical') ? 'technical' : 'simple');
    return;
  }

  if (data === 'panel:codex_logs_refresh' || data === 'panel:codex_logs_refresh:simple' || data === 'panel:codex_logs_refresh:technical') {
    await bot.answerCallbackQuery(query.id, { text: 'Refreshing Codex activity' });
    await refreshCodexActivity(query.message, data.endsWith(':technical') ? 'technical' : 'simple');
    return;
  }

  if (data === 'panel:prompt') {
    if (await warnIfCodexRunning(chatId)) {
      await bot.answerCallbackQuery(query.id, { text: 'Codex is already running' });
      return;
    }
    await bot.answerCallbackQuery(query.id, { text: 'Waiting for prompt' });
    await askForInput(
      chatId,
      'codex_prompt',
      '💬 *Send Prompt to Codex*\nSend the prompt in your next message.\n\nUse the Cancel button below to abort.'
    );
    return;
  }

  if (data === 'panel:doctor') {
    await bot.answerCallbackQuery(query.id, { text: 'Doctor' });
    await sendDoctorPanel(chatId);
    return;
  }

  if (data === 'panel:watchdog') {
    await bot.answerCallbackQuery(query.id, { text: 'Watchdog' });
    await sendWatchdog(chatId);
    return;
  }

  if (data === 'panel:doctor:confirm') {
    await bot.answerCallbackQuery(query.id, { text: 'Doctor started' });
    await runDoctor(chatId, operatorFromQuery(query));
    return;
  }

  if (data === 'panel:doctor:cancel') {
    await bot.answerCallbackQuery(query.id, { text: 'Doctor cancelled' });
    await sendTrackedMessage(chatId, 'Doctor run cancelled.');
    return;
  }

  if (data === 'panel:key') {
    await bot.answerCallbackQuery(query.id, { text: 'Waiting for API key' });
    await askForInput(
      chatId,
      'api_key',
      '🔑 *API Key Update*\nSend the new Codex/OpenAI API key in your next message.\n\nUse the Cancel button below to abort.'
    );
    return;
  }

  if (data === 'panel:cancel') {
    await bot.answerCallbackQuery(query.id, { text: 'Cancelling' });
    await cancelCurrentOperation(chatId);
    return;
  }

  if (data === 'panel:back') {
    await bot.answerCallbackQuery(query.id, { text: 'Main panel' });
    await sendControlPanel(chatId);
    return;
  }

  if (data === 'panel:queue:priority') {
    await bot.answerCallbackQuery(query.id, { text: 'Priority picker' });
    await sendPriorityPicker(chatId);
    return;
  }

  if (data === 'panel:queue:batch') {
    await bot.answerCallbackQuery(query.id, { text: 'Batch picker' });
    await sendBatchPicker(chatId);
    return;
  }

  if (data.startsWith('panel:priority:')) {
    const issueNumber = parseInt(data.replace('panel:priority:', ''), 10);
    await prioritizeIssueFromPanel(chatId, issueNumber);
    await bot.answerCallbackQuery(query.id, { text: `Priority #${issueNumber}` });
    return;
  }

  if (data.startsWith('panel:batch:')) {
    const count = parseInt(data.replace('panel:batch:', ''), 10);
    setBatchRemaining(count);
    setPipelineOperator(operatorFromQuery(query));
    setState('pipeline_status', 'running');
    await bot.answerCallbackQuery(query.id, { text: `Batch ${count}` });
    await sendTrackedMessage(chatId, `🔢 Batch mode armed for ${count} issue${count === 1 ? '' : 's'}. Pipeline started.`, {
      reply_markup: queuePanelKeyboard()
    });
    return;
  }

  if (data === 'panel:stats:history') {
    await bot.answerCallbackQuery(query.id, { text: 'History' });
    await sendHistory(chatId);
    return;
  }

  if (data === 'panel:doctor:health') {
    await bot.answerCallbackQuery(query.id, { text: 'Health' });
    await sendHealth(chatId);
    return;
  }

  if (data === 'panel:clear') {
    await bot.answerCallbackQuery(query.id, { text: 'Clearing bot messages' });
    await clearTrackedMessages(chatId);
    return;
  }

  if (data.startsWith('panel:model:')) {
    const model = data.replace('panel:model:', '');
    await setModel(chatId, model);
    await bot.answerCallbackQuery(query.id, { text: `Model set to ${model}` });
    return;
  }

  if (data === 'panel:model') {
    await bot.answerCallbackQuery(query.id, { text: 'Choose model' });
    await sendModelPicker(chatId);
    return;
  }

  if (data.startsWith('panel:pipeline:')) {
    const action = data.replace('panel:pipeline:', '');
    await setPipelineAction(chatId, action, operatorFromQuery(query));
    await bot.answerCallbackQuery(query.id, { text: `Pipeline ${action}` });
    return;
  }

  await bot.answerCallbackQuery(query.id, { text: 'Unknown action' });
}

async function handleHelpAction(query) {
  const helpKey = query.data.replace('help:', '');
  const text = HELP_TEXT[helpKey] || 'No help is registered for this row yet.';

  if (text.length <= 180) {
    await bot.answerCallbackQuery(query.id, { text, show_alert: true });
    return;
  }

  await bot.answerCallbackQuery(query.id, { text: 'Help opened' });
  await sendTrackedMessage(query.message.chat.id, `❓ *Help*\n${escapeMarkdown(text)}`, { parse_mode: 'Markdown' });
}

const HELP_TEXT = {
  'main:pipeline': 'Start begins issue processing. Pause stops after the current job.',
  'main:runtime': 'Continue resumes a paused pipeline. Stop Codex kills only the active Codex process.',
  'main:stop': 'Stop All pauses the pipeline and stops Codex. Cancel clears pending input and stops Codex if one is running.',
  'main:status_queue': 'Status shows live pipeline/Codex state. Queue opens issue order, priority, and batch controls.',
  'main:stats_doctor': 'Stats shows lifetime usage. Doctor opens health checks and a guarded Codex doctor run.',
  'main:prompt_logs': 'Prompt sends a one-off Codex task. Logs opens system and Codex activity views.',
  'main:settings_help': 'Settings contains model/API key/watchdog/cleanup controls. Help opens the command-free guide.',
  'main:refresh': 'Refresh updates this control panel message.',
  'queue:actions': 'Priority moves an issue to the front. Batch runs the next N issues back-to-back. Refresh reloads the queue.',
  'queue:nav': 'Back returns to the main control panel.',
  'priority:list': 'Choose an issue number to move it to the front of the queue.',
  'batch:sizes': 'Choose how many issues to process automatically before pausing.',
  'stats:actions': 'Refresh recalculates stats from SQLite. History shows recent issue outcomes.',
  'stats:nav': 'Back returns to the main control panel.',
  'doctor:actions': 'Health checks DB/runtime consistency. Watchdog checks EC2 disk and RAM. Run Doctor starts a Codex inspection.',
  'doctor:nav': 'Back returns to the main control panel.',
  'logs:actions': 'System Logs reads PM2 out/err logs. Codex Live shows recent Codex events.',
  'logs:mode': 'Simple mode summarizes. Technical mode shows rawer tails and events.',
  'settings:actions': 'Model changes Codex model. API Key starts secure key input. Clear removes recent bot messages.',
  'settings:nav': 'Back returns to the main control panel.',
  'model:choices': 'Pick the model for future Codex runs.',
  'input:cancel': 'Cancel abandons the pending input request.',
  'completion:review': 'View details shows raw output. Continue closes the issue and resumes processing.',
  'completion:control': 'Redo retries the issue. Pause stops after this issue.',
  'completion:finish': 'Change Model opens model guidance. Skip comments on the issue and moves on.'
};

function attachPollingLifecycleHandlers(activeBot) {
  activeBot.on('polling_error', (error) => {
    console.error('[telegram] polling_error; retrying polling instead of shutting down:', formatError(error));
    schedulePollingRetry(activeBot, 'polling_error');
  });

  activeBot.on('webhook_error', (error) => {
    console.error('[telegram] webhook_error in polling bot:', formatError(error));
  });

  activeBot.on('error', (error) => {
    console.error('[telegram] bot error; keeping process alive:', formatError(error));
  });
}

function schedulePollingRetry(activeBot, reason) {
  if (pollingRetryTimer) return;

  const delay = pollingRetryDelay;
  console.warn(`[telegram] Scheduling polling retry in ${Math.round(delay / 1000)}s. reason=${reason}`);

  pollingRetryTimer = setTimeout(async () => {
    pollingRetryTimer = null;

    try {
      await activeBot.stopPolling();
    } catch (error) {
      console.warn('[telegram] stopPolling during retry failed; continuing with restart:', formatError(error));
    }

    try {
      await activeBot.startPolling();
      pollingRetryDelay = 5000;
      console.log('[telegram] Polling restarted successfully.');
    } catch (error) {
      console.error('[telegram] Polling restart failed:', formatError(error));
      pollingRetryDelay = Math.min(pollingRetryDelay * 2, 60000);
      schedulePollingRetry(activeBot, 'restart_failed');
    }
  }, delay);
}

async function sendTrackedMessage(chatId, text, options = {}) {
  const sent = await bot.sendMessage(chatId, text, options);
  trackMessage(chatId, sent.message_id);
  return sent;
}

async function startDiffStream(chatId, label, operator = null) {
  if (!bot || !chatId) return null;

  stopDiffStream();

  const stream = {
    chatId,
    label,
    operator: normalizeOperator(operator),
    startedAt: Date.now(),
    messageId: null,
    timer: null,
    updating: false
  };
  diffStream = stream;

  const sent = await sendTrackedMessage(chatId, buildDiffStreamText(stream, 'Starting diff stream...'), {
    parse_mode: 'Markdown'
  });
  stream.messageId = sent.message_id;

  await refreshDiffStream();
  stream.timer = setInterval(refreshDiffStream, DIFF_STREAM_INTERVAL);
  return stream;
}

function stopDiffStream(finalText = null) {
  if (!diffStream) return;
  if (diffStream.timer) {
    clearInterval(diffStream.timer);
  }
  const stream = diffStream;
  diffStream = null;

  if (finalText && bot && stream.messageId) {
    safeEditMessageText(finalText, {
      chat_id: stream.chatId,
      message_id: stream.messageId,
      parse_mode: 'Markdown'
    }).catch(error => console.warn('[telegram] Unable to finalize diff stream:', formatError(error)));
  }
}

async function refreshDiffStream() {
  const stream = diffStream;
  if (!stream || stream.updating || !stream.messageId) return;
  stream.updating = true;

  try {
    const stat = await readGitDiffStat(DIFF_STREAM_WORKDIR);
    await safeEditMessageText(buildDiffStreamText(stream, stat), {
      chat_id: stream.chatId,
      message_id: stream.messageId,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    await safeEditMessageText(buildDiffStreamText(stream, `Unable to read git diff: ${error.message}`), {
      chat_id: stream.chatId,
      message_id: stream.messageId,
      parse_mode: 'Markdown'
    });
  } finally {
    stream.updating = false;
  }
}

function readGitDiffStat(workdir) {
  return new Promise((resolve, reject) => {
    execFile('git', ['diff', '--stat'], { cwd: workdir, timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve(stdout.trim() || 'No working tree diff yet.');
    });
  });
}

function buildDiffStreamText(stream, stat) {
  const owner = formatOperatorMention(stream.operator);
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - stream.startedAt) / 1000));
  const safeStat = String(stat || 'No working tree diff yet.').slice(-2200);

  return (
    `🧾 *LIVE DIFF STREAM*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Task: ${escapeMarkdown(stream.label || 'Codex run')}\n` +
    `${owner ? `Operator: ${escapeMarkdown(owner)}\n` : ''}` +
    `Elapsed: ${elapsedSeconds}s\n` +
    `Updated: \`${new Date().toISOString()}\`\n\n` +
    `\`\`\`\n${escapeCodeBlock(safeStat)}\n\`\`\``
  ).slice(0, 3900);
}

function trackMessage(chatId, messageId) {
  if (!messageId) return;
  const key = chatId.toString();
  const messages = trackedBotMessages.get(key) || [];
  messages.push(messageId);
  trackedBotMessages.set(key, messages.slice(-MAX_TRACKED_MESSAGES_PER_CHAT));
}

async function clearTrackedMessages(chatId) {
  const key = chatId.toString();
  const messages = trackedBotMessages.get(key) || [];
  trackedBotMessages.set(key, []);

  let deleted = 0;
  for (const messageId of messages.reverse()) {
    try {
      await bot.deleteMessage(chatId, messageId);
      deleted += 1;
    } catch (error) {
      console.warn('[telegram] Unable to delete tracked message:', formatError(error));
    }
  }

  const sent = await bot.sendMessage(chatId, `Cleared ${deleted} recent bot messages. Codex and PM2 were not touched.`);
  trackMessage(chatId, sent.message_id);
}

async function askForInput(chatId, type, prompt) {
  pendingInputs.set(chatId, {
    type,
    createdAt: Date.now()
  });

  await sendTrackedMessage(chatId, prompt, {
    parse_mode: 'Markdown',
    reply_markup: inputCancelKeyboard()
  });
}

async function handlePendingInputMessage(msg) {
  if (!msg.text || msg.text.startsWith('/')) return;
  if (!isAuthorized(msg.chat.id)) return;

  const pending = pendingInputs.get(msg.chat.id);
  if (!pending) return;

  pendingInputs.delete(msg.chat.id);

  if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
    await sendTrackedMessage(msg.chat.id, 'That input request expired. Press the panel button again.');
    return;
  }

  if (pending.type === 'api_key') {
    await updateApiKeyFromMessage(msg.chat.id, msg.message_id, msg.text);
    return;
  }

  if (pending.type === 'codex_prompt') {
    await runPromptFromTelegram(msg.chat.id, msg.text.trim(), 'Manual Telegram prompt', operatorFromMessage(msg));
    return;
  }
}

async function updateApiKeyFromMessage(chatId, messageId, rawKey) {
  try {
    const result = setPrimaryApiKey(rawKey, 'Telegram operator update');
    await deleteSensitiveMessage(chatId, messageId);
    await sendTrackedMessage(chatId,
      `🔑 *API Key Updated*\n` +
      `Active Codex key is now \`...${escapeMarkdown(result.newSuffix)}\`.\n` +
      `Total configured keys: ${result.totalKeys}`,
      { parse_mode: 'Markdown', reply_markup: controlPanelKeyboard() }
    );
  } catch (error) {
    await sendTrackedMessage(chatId, `Invalid API key: ${escapeMarkdown(error.message)}`, { parse_mode: 'Markdown' });
  }
}

async function deleteSensitiveMessage(chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    console.warn('[telegram] Unable to delete sensitive API key message:', formatError(error));
  }
}

async function setPipelineAction(chatId, action, operator = null) {
  if (action === 'start' || action === 'resume') {
    setPipelineOperator(operator || { chatId });
    setState('pipeline_status', 'running');
    await sendTrackedMessage(chatId, action === 'start' ? '▶️ Pipeline started.' : '➡️ Pipeline resumed.');
    return;
  }

  if (action === 'pause') {
    setState('pipeline_status', 'paused');
    await sendTrackedMessage(chatId, '⏸️ Pipeline paused.');
    return;
  }

  if (action === 'stop') {
    clearPipelineOperator();
    setState('pipeline_status', 'stopped');
    await sendTrackedMessage(chatId, '⏹️ Pipeline stopped.');
  }
}

async function setModel(chatId, model) {
  const validModels = ['gpt-5.4', 'gpt-5.5', 'gpt-5.5-high', 'gpt-5.5-xhigh'];
  if (!validModels.includes(model)) {
    await sendTrackedMessage(chatId, `Invalid model. Use: ${validModels.join(', ')}`);
    return;
  }
  setState('current_model', model);
  await sendTrackedMessage(chatId, `✅ Model set to \`${model}\``, { parse_mode: 'Markdown' });
}

function describeRunningCodex(codex) {
  if (codex?.activeRun?.label) {
    return codex.activeRun.label;
  }
  if (codex?.pid) {
    return `Codex process PID ${codex.pid}`;
  }
  return 'Codex process';
}

function operatorFromMessage(msg) {
  return normalizeOperator({
    chatId: msg.chat?.id,
    user: msg.from
  });
}

function operatorFromQuery(query) {
  return normalizeOperator({
    chatId: query.message?.chat?.id,
    user: query.from
  });
}

function formatOperatorMention(operator) {
  const normalized = normalizeOperator(operator);
  if (!normalized) return '';
  return normalized.username ? `@${normalized.username}` : normalized.displayName;
}

async function warnIfCodexRunning(chatId) {
  const codex = getCodexRuntimeStatus();
  if (codex.state !== 'running') {
    return false;
  }

  const owner = formatOperatorMention(codex.activeRun?.operator || codex.activeRun?.lock?.operator);
  await sendTrackedMessage(
    chatId,
    `🔒 Codex is busy${owner ? `, started by ${escapeMarkdown(owner)}` : ''}${codex.pid ? ` (PID: ${codex.pid})` : ''}.\n` +
    `${escapeMarkdown(describeRunningCodex(codex))}`,
    { parse_mode: 'Markdown' }
  );
  return true;
}

async function maybeWarnCodexLiveDuringRun(chatId) {
  const codex = getCodexRuntimeStatus();
  if (codex.state !== 'running') {
    return false;
  }

  await sendTrackedMessage(
    chatId,
    `⚠️ Codex is already running${codex.pid ? ` (PID: ${codex.pid})` : ''}. Live activity is read-only.`,
    { parse_mode: 'Markdown' }
  );
  return true;
}

async function stopCodexFromTelegram(chatId, reason = 'telegram_stop_codex') {
  try {
    const result = await stopCodex(reason);
    await sendStopCodexResult(chatId, result);
    return result;
  } catch (error) {
    await sendTrackedMessage(chatId, `Unable to stop Codex: ${escapeMarkdown(error.message)}`, { parse_mode: 'Markdown' });
    return { stopped: false, error };
  }
}

async function cancelCurrentOperation(chatId) {
  const hadPendingInput = pendingInputs.delete(chatId);

  try {
    const result = await stopCodex('telegram_cancel', { silentIfMissing: true });
    if (result.stopped) {
      await sendStopCodexResult(chatId, result);
      return;
    }
  } catch (error) {
    await sendTrackedMessage(chatId, `Unable to stop Codex: ${escapeMarkdown(error.message)}`, {
      parse_mode: 'Markdown',
      reply_markup: controlPanelKeyboard()
    });
    return;
  }

  await sendTrackedMessage(chatId, hadPendingInput ? 'Cancelled pending input.' : 'Nothing is waiting for input, and Codex is not running.', {
    reply_markup: controlPanelKeyboard()
  });
}

async function stopAllFromTelegram(chatId) {
  setState('pipeline_status', 'paused');

  try {
    const result = await stopCodex('telegram_stop_all');

    if (result.stopped) {
      await sendTrackedMessage(chatId, '⛔ All systems stopped. Pipeline paused. Codex killed.');
      return result;
    }

    await sendTrackedMessage(chatId, '⛔ All systems stopped. Pipeline paused. No Codex process is currently running.');
    return result;
  } catch (error) {
    await sendTrackedMessage(chatId, `Unable to stop all systems: ${escapeMarkdown(error.message)}`, { parse_mode: 'Markdown' });
    return { stopped: false, error };
  } finally {
    setCurrentIssue(null);
  }
}

async function sendStopCodexResult(chatId, result) {
  if (!result.stopped) {
    await sendTrackedMessage(chatId, 'No Codex process is currently running.');
    return;
  }

  const issueText = result.issueNumber ? `Issue #${result.issueNumber}` : result.label || 'Current task';
  const message = `🛑 Codex stopped. ${issueText} was aborted.`;
  await sendTrackedMessage(chatId, message);
}

async function sendModelPicker(chatId) {
  await sendTrackedMessage(chatId, '🤖 *Choose Codex model*', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'gpt-5.5', callback_data: 'panel:model:gpt-5.5' },
          { text: 'gpt-5.5-high', callback_data: 'panel:model:gpt-5.5-high' },
          { text: '❓', callback_data: 'help:model:choices' }
        ],
        [
          { text: 'gpt-5.5-xhigh', callback_data: 'panel:model:gpt-5.5-xhigh' },
          { text: 'gpt-5.4', callback_data: 'panel:model:gpt-5.4' },
          { text: '❓', callback_data: 'help:model:choices' }
        ],
        [
          { text: '⬅️ Back', callback_data: 'panel:settings' },
          { text: '❓', callback_data: 'help:settings:nav' }
        ]
      ]
    }
  });
}

async function sendSettingsPanel(chatId) {
  await sendTrackedMessage(chatId,
    `⚙️ *SETTINGS*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Model: \`${escapeMarkdown(getState('current_model') || 'gpt-5.5')}\`\n` +
    `API key: \`...${escapeMarkdown(getKeySuffix(getCurrentApiKey()))}\`\n\n` +
    `Change runtime settings or clean up recent bot messages.`,
    {
      parse_mode: 'Markdown',
      reply_markup: settingsPanelKeyboard()
    }
  );
}

function settingsPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🤖 Model', callback_data: 'panel:model' },
        { text: '🔑 API Key', callback_data: 'panel:key' },
        { text: '❓', callback_data: 'help:settings:actions' }
      ],
      [
        { text: '🧹 Clear', callback_data: 'panel:clear' },
        { text: '⬅️ Back', callback_data: 'panel:back' },
        { text: '❓', callback_data: 'help:settings:nav' }
      ]
    ]
  };
}

async function sendHelpPanel(chatId) {
  await sendTrackedMessage(chatId,
    `❔ *PROMETHEUS HELP*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Use the inline panels instead of slash commands. Each button row has a ❓ button explaining that row.\n\n` +
    `Main areas:\n` +
    `• Pipeline controls start, pause, resume, or stop work.\n` +
    `• Queue controls priority and batch mode.\n` +
    `• Doctor checks health and EC2 pressure.\n` +
    `• Settings manages model and API key updates.`,
    {
      parse_mode: 'Markdown',
      reply_markup: helpPanelKeyboard()
    }
  );
}

function helpPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📋 Queue', callback_data: 'panel:queue' },
        { text: '🩺 Doctor', callback_data: 'panel:doctor' },
        { text: '❓', callback_data: 'help:main:status_queue' }
      ],
      [
        { text: '⚙️ Settings', callback_data: 'panel:settings' },
        { text: '⬅️ Back', callback_data: 'panel:back' },
        { text: '❓', callback_data: 'help:main:settings_help' }
      ]
    ]
  };
}

function inputCancelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '❌ Cancel', callback_data: 'panel:cancel' },
        { text: '❓', callback_data: 'help:input:cancel' }
      ]
    ]
  };
}

async function sendDoctorConfirmation(chatId) {
  const codex = getCodexRuntimeStatus();
  if (codex.state === 'running') {
    await sendTrackedMessage(chatId, `Codex is already running: ${escapeMarkdown(describeRunningCodex(codex))}`, { parse_mode: 'Markdown' });
    return;
  }

  await sendTrackedMessage(chatId,
    `🩺 *Doctor Run*\n` +
    `This spends one Codex run to inspect the orchestrator, PM2 lifecycle, Telegram controls, API-key state, and recent logs, then apply narrowly-scoped fixes if needed.\n\n` +
    `Are you sure you want to run it?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Run Doctor', callback_data: 'panel:doctor:confirm' },
            { text: 'Cancel', callback_data: 'panel:doctor:cancel' },
            { text: '❓', callback_data: 'help:doctor:actions' }
          ],
          [
            { text: '⬅️ Back', callback_data: 'panel:doctor' },
            { text: '❓', callback_data: 'help:doctor:nav' }
          ]
        ]
      }
    }
  );
}

async function runDoctor(chatId, operator = null) {
  const prompt =
    `Doctor check for the Prometheus orchestrator.\n\n` +
    `Inspect the current orchestrator in /home/ec2-user/prometheus-orchestrator and verify: PM2 lifecycle, Telegram polling, Telegram control panel, API key handling, Codex run health, and logs. ` +
    `Only make narrow fixes for concrete issues you find. Do not change business logic. Run relevant syntax checks. Report what changed and what verified.`;

  await runPromptFromTelegram(chatId, prompt, 'Doctor check', operator);
}

async function runPromptFromTelegram(chatId, prompt, label, operator = null) {
  const codex = getCodexRuntimeStatus();
  if (codex.state === 'running') {
    await sendTrackedMessage(chatId, `Codex is already running: ${escapeMarkdown(describeRunningCodex(codex))}`, { parse_mode: 'Markdown' });
    return;
  }

  const model = getState('current_model') || 'gpt-5.5';
  await sendTrackedMessage(chatId,
    `🤖 *Codex Started*\n` +
    `Task: ${escapeMarkdown(label)}\n` +
    `Model: \`${escapeMarkdown(model)}\`\n` +
    `Key: \`...${escapeMarkdown(getKeySuffix(getCurrentApiKey()))}\`\n\n` +
    `Use the Logs panel or Codex Activity button to watch operational output.`,
    { parse_mode: 'Markdown' }
  );

  try {
    await startDiffStream(chatId, label, operator);
    const result = await runCodexPrompt(prompt, { label, model, source: 'telegram', operator });
    stopDiffStream(buildDiffStreamText({
      chatId,
      label,
      operator: normalizeOperator(operator),
      startedAt: Date.now()
    }, 'Codex run completed. Use the Logs panel for the event log.'));
    await sendTrackedMessage(chatId, buildManualCodexSummary(label, result, model, operator), {
      parse_mode: 'Markdown',
      reply_markup: postCodexKeyboard()
    });
  } catch (error) {
    stopDiffStream(buildDiffStreamText({
      chatId,
      label,
      operator: normalizeOperator(operator),
      startedAt: Date.now()
    }, `Codex run stopped or failed: ${error.message.slice(0, 500)}`));
    const owner = formatOperatorMention(operator);
    await sendTrackedMessage(chatId,
      `❌ *Codex Failed*\n` +
      `${owner ? `${escapeMarkdown(owner)} ` : ''}` +
      `${escapeMarkdown(error.message.slice(0, 1200))}\n\n` +
      `Use the API Key pill if this is a key/quota issue.`,
      { parse_mode: 'Markdown', reply_markup: controlPanelKeyboard() }
    );
  }
}

function buildManualCodexSummary(label, result, model, operator = null) {
  const parsed = parseCodexOutput(result.output);
  const owner = formatOperatorMention(operator);
  let text =
    `✅ *Codex Complete*\n` +
    `${owner ? `${escapeMarkdown(owner)} ` : ''}` +
    `Task: ${escapeMarkdown(label)}\n` +
    `Model: \`${escapeMarkdown(model)}\`\n` +
    `Duration: ${result.duration}s\n\n`;

  if (parsed.filesChanged.length > 0) {
    text += `*Files changed (${parsed.filesChanged.length}):*\n`;
    for (const file of parsed.filesChanged.slice(0, 8)) {
      text += `• \`${escapeMarkdown(file.path)}\` ${escapeMarkdown(file.status || 'changed')}\n`;
    }
    text += '\n';
  }

  if (parsed.commandsRun.length > 0) {
    text += `*Commands run:*\n`;
    for (const command of parsed.commandsRun.slice(0, 5)) {
      text += `• \`${escapeMarkdown(command)}\`\n`;
    }
    text += '\n';
  }

  if (parsed.errors.length > 0) {
    text += `*Errors:*\n`;
    for (const err of parsed.errors.slice(0, 3)) {
      text += `• ${escapeMarkdown(err.slice(0, 160))}\n`;
    }
  } else if (parsed.filesChanged.length === 0 && parsed.commandsRun.length === 0) {
    text += `No file or command events were reported. Use Codex Activity for raw operational events.\n`;
  }

  return text.slice(0, 3900);
}

function postCodexKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🧾 Codex Activity', callback_data: 'panel:codex_logs' },
        { text: '➡️ Continue Pipeline', callback_data: 'panel:pipeline:resume' },
        { text: '❓', callback_data: 'help:main:runtime' }
      ],
      [
        { text: '📊 Status', callback_data: 'panel:status' },
        { text: '💬 Prompt Again', callback_data: 'panel:prompt' },
        { text: '❓', callback_data: 'help:main:prompt_logs' }
      ]
    ]
  };
}

function isAuthorized(chatId) {
  if (AUTHORIZED_CHATS.length === 0) return true;
  return AUTHORIZED_CHATS.includes(chatId.toString());
}

function getKeyCount() {
  return getCodexRuntimeStatus().keyCount;
}

async function sendStatus(chatId) {
  const status = getState('pipeline_status') || 'idle';
  const current = getCurrentIssue();
  const model = getState('current_model') || 'gpt-5.5';
  const keyCount = getKeyCount();
  const codex = getCodexRuntimeStatus();
  const batchRemaining = getBatchRemaining();
  const priorityQueue = getPriorityQueue();
  
  let text = `📊 *SYSTEM STATUS*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `${humanSystemStatusLine(status, codex)}\n\n`;
  text += `Pipeline: *${escapeMarkdown(status.toUpperCase())}*\n`;
  text += `Codex: *${escapeMarkdown(formatCodexStatusSummary(codex))}*\n`;
  text += `Model: \`${escapeMarkdown(model)}\`\n`;
  text += `API keys: ${keyCount} | Active: \`...${escapeMarkdown(codex.keySuffix)}\`\n`;
  text += `Batch remaining: ${batchRemaining}\n`;
  text += `Priority queue: ${priorityQueue.length ? priorityQueue.map(n => `#${n}`).join(', ') : 'empty'}\n`;
  
  if (current) {
    text += `\n🔄 *Current Issue:*\n`;
    text += `#${current.issue_number}: ${escapeMarkdown(current.title || 'Unknown')}\n`;
    text += `Started: ${current.started_at || 'N/A'}\n`;
    text += `Retries: ${current.retry_count || 0}\n`;
  } else {
    text += `\n⏳ No issue currently in progress.`;
  }
  
  await sendTrackedMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: controlPanelKeyboard() });
}

async function sendQueue(chatId) {
  const { getOpenIssues } = require('./github');
  const issues = await getOpenIssues();
  const priorityQueue = prunePriorityQueue(issues.map(issue => issue.number));
  const ordered = orderIssuesForQueue(issues, priorityQueue);
  const batchRemaining = getBatchRemaining();

  let text =
    `📋 *ISSUE QUEUE (${issues.length})*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Batch remaining: ${batchRemaining}\n` +
    `Priority: ${priorityQueue.length ? priorityQueue.map(n => `#${n}`).join(', ') : 'empty'}\n\n`;

  if (ordered.length === 0) {
    text += `_No open issues match the configured GitHub filter._`;
  } else {
    for (const [index, issue] of ordered.slice(0, 15).entries()) {
      const priorityMark = priorityQueue.includes(issue.number) ? ' ⚡' : '';
      text += `${index + 1}. #${issue.number}${priorityMark} ${escapeMarkdown(issue.title.slice(0, 70))}${issue.title.length > 70 ? '...' : ''}\n`;
    }
    if (ordered.length > 15) {
      text += `\n...and ${ordered.length - 15} more`;
    }
  }

  await sendTrackedMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: queuePanelKeyboard() });
}

async function sendQueuePanel(chatId) {
  await sendQueue(chatId);
}

function queuePanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '⬆️ Priority', callback_data: 'panel:queue:priority' },
        { text: '🔢 Batch', callback_data: 'panel:queue:batch' },
        { text: '❓', callback_data: 'help:queue:actions' }
      ],
      [
        { text: '🔄 Refresh', callback_data: 'panel:queue' },
        { text: '⬅️ Back', callback_data: 'panel:back' },
        { text: '❓', callback_data: 'help:queue:nav' }
      ]
    ]
  };
}

async function sendPriorityPicker(chatId) {
  const { getOpenIssues } = require('./github');
  const issues = await getOpenIssues();
  const priorityQueue = prunePriorityQueue(issues.map(issue => issue.number));
  const ordered = orderIssuesForQueue(issues, priorityQueue).slice(0, 9);

  let text =
    `⬆️ *PRIORITY PICKER*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Current priority: ${priorityQueue.length ? priorityQueue.map(n => `#${n}`).join(', ') : 'empty'}\n\n`;

  if (ordered.length === 0) {
    text += `_No open issues are available._`;
  } else {
    text += `Choose an issue to move to the front.`;
  }

  await sendTrackedMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: priorityPickerKeyboard(ordered)
  });
}

function priorityPickerKeyboard(issues) {
  const rows = [];
  for (let index = 0; index < issues.length; index += 2) {
    const row = issues.slice(index, index + 2).map(issue => ({
      text: `#${issue.number}`,
      callback_data: `panel:priority:${issue.number}`
    }));
    row.push({ text: '❓', callback_data: 'help:priority:list' });
    rows.push(row);
  }
  rows.push([
    { text: '⬅️ Back', callback_data: 'panel:queue' },
    { text: '❓', callback_data: 'help:queue:nav' }
  ]);
  return { inline_keyboard: rows };
}

async function prioritizeIssueFromPanel(chatId, issueNumber) {
  const { getOpenIssues } = require('./github');
  const issues = await getOpenIssues();
  const exists = issues.some(issue => issue.number === issueNumber);
  if (!exists) {
    await sendTrackedMessage(chatId, `Issue #${issueNumber} is not in the open queue.`, {
      reply_markup: queuePanelKeyboard()
    });
    return;
  }
  prioritizeIssue(issueNumber);
  await sendTrackedMessage(chatId, `⬆️ Issue #${issueNumber} moved to the front.`, {
    reply_markup: queuePanelKeyboard()
  });
  await sendQueue(chatId);
}

async function sendBatchPicker(chatId) {
  await sendTrackedMessage(chatId,
    `🔢 *BATCH MODE*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Current batch remaining: ${getBatchRemaining()}\n\n` +
    `Choose how many issues to process automatically before pausing.`,
    {
      parse_mode: 'Markdown',
      reply_markup: batchPickerKeyboard()
    }
  );
}

function batchPickerKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '1', callback_data: 'panel:batch:1' },
        { text: '3', callback_data: 'panel:batch:3' },
        { text: '❓', callback_data: 'help:batch:sizes' }
      ],
      [
        { text: '5', callback_data: 'panel:batch:5' },
        { text: '10', callback_data: 'panel:batch:10' },
        { text: '❓', callback_data: 'help:batch:sizes' }
      ],
      [
        { text: '⬅️ Back', callback_data: 'panel:queue' },
        { text: '❓', callback_data: 'help:queue:nav' }
      ]
    ]
  };
}

async function sendStats(chatId) {
  const stats = getStats();
  const counts = stats.issueCounts;
  let text =
    `🏅 *PROMETHEUS STATS*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Issues processed: ${stats.lifetimeIssuesProcessed}\n` +
    `Completed: ${counts.completed || 0} | Failed: ${counts.failed || 0} | Stopped: ${counts.stopped || 0}\n` +
    `Codex runs: ${stats.codexRuns}\n` +
    `Total Codex runtime: ${formatDuration(stats.totalRuntimeSeconds)}\n` +
    `Total tokens reported: ${stats.totalTokens || 0}\n` +
    `API key rotations: ${stats.apiKeyRotations}\n`;

  if (stats.favoriteModel) {
    text += `Favorite model: \`${escapeMarkdown(stats.favoriteModel.model)}\` (${stats.favoriteModel.count} runs)\n`;
  } else {
    text += `Favorite model: n/a\n`;
  }

  if (stats.mostModifiedFiles.length > 0) {
    text += `\n*Most modified files:*\n`;
    for (const file of stats.mostModifiedFiles) {
      text += `• \`${escapeMarkdown(file.path)}\` (${file.count})\n`;
    }
  }

  if (stats.lastRun) {
    text +=
      `\n*Last run:*\n` +
      `${escapeMarkdown(stats.lastRun.label || 'Codex run')}\n` +
      `Status: ${escapeMarkdown(stats.lastRun.status || 'unknown')} | Model: \`${escapeMarkdown(stats.lastRun.model || 'n/a')}\`\n`;
  }

  await sendTrackedMessage(chatId, text.slice(0, 3900), { parse_mode: 'Markdown', reply_markup: statsPanelKeyboard() });
}

async function sendStatsPanel(chatId) {
  await sendStats(chatId);
}

function statsPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📜 History', callback_data: 'panel:stats:history' },
        { text: '🔄 Refresh', callback_data: 'panel:stats' },
        { text: '❓', callback_data: 'help:stats:actions' }
      ],
      [
        { text: '⬅️ Back', callback_data: 'panel:back' },
        { text: '❓', callback_data: 'help:stats:nav' }
      ]
    ]
  };
}

async function sendHistory(chatId) {
  const { getIssueHistory } = require('./database');
  const history = getIssueHistory();

  let text = `📜 *ISSUE HISTORY*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (history.length === 0) {
    text += '_No completed issues yet._';
  } else {
    for (const issue of history.slice(0, 10)) {
      const status = issue.status === 'completed' ? '✅' : issue.status === 'stopped' ? '🛑' : '❌';
      text += `${status} #${issue.issue_number}: ${escapeMarkdown(issue.title?.substring(0, 50) || 'Untitled')}\n`;
    }
  }

  await sendTrackedMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: statsPanelKeyboard() });
}

function orderIssuesForQueue(issues, priorityQueue) {
  const priority = priorityQueue
    .map(issueNumber => issues.find(issue => issue.number === issueNumber))
    .filter(Boolean);
  const priorityNumbers = new Set(priority.map(issue => issue.number));
  return [...priority, ...issues.filter(issue => !priorityNumbers.has(issue.number))];
}

function formatDuration(seconds) {
  const total = Math.round(Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

async function sendHealth(chatId) {
  const inspection = inspectActiveIssueState();
  const codex = getCodexRuntimeStatus();
  const current = inspection.currentIssue;
  const watchdog = await getWatchdogSnapshot();

  let text =
    `🩺 *PROMETHEUS HEALTH*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `State: *${inspection.ok ? 'OK' : 'MISMATCH'}*\n` +
    `Pipeline: \`${escapeMarkdown(inspection.pipelineStatus)}\`\n` +
    `Codex DB: \`${escapeMarkdown(inspection.codexStatus)}\`\n` +
    `Codex runtime: *${escapeMarkdown(formatCodexStatusSummary(codex))}*\n` +
    `Current issue pointer: \`${escapeMarkdown(inspection.currentIssueNumber || 'null')}\`\n` +
    `RAM: ${watchdog.memory.usedPercent}% | Disk: ${watchdog.disk.usedPercent}%\n`;

  if (current) {
    text +=
      `Issue row: #${current.issue_number} \`${escapeMarkdown(current.status)}\`\n` +
      `Started: \`${escapeMarkdown(current.started_at || 'n/a')}\`\n`;
  } else if (inspection.currentIssueNumber) {
    text += `Issue row: _missing_\n`;
  }

  if (inspection.issues.length > 0) {
    text += `\n*State mismatches:*\n`;
    for (const issue of inspection.issues) {
      text += `• ${escapeMarkdown(issue)}\n`;
    }
    text += `\nRestarting the orchestrator will run boot reconciliation, or use Stop All to clear a stale live run.`;
  } else {
    text += `\nNo active state mismatch detected.`;
  }

  await sendTrackedMessage(chatId, text.slice(0, 3900), { parse_mode: 'Markdown', reply_markup: doctorPanelKeyboard() });
}

async function sendWatchdog(chatId) {
  const watchdog = await getWatchdogSnapshot();
  let text =
    `🧯 *EC2 WATCHDOG*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Threshold: ${WATCHDOG_THRESHOLD}%\n` +
    `RAM: ${watchdog.memory.usedPercent}% used (${formatBytes(watchdog.memory.used)} / ${formatBytes(watchdog.memory.total)})\n` +
    `Disk: ${watchdog.disk.usedPercent}% used on \`${escapeMarkdown(watchdog.disk.path)}\`\n`;

  if (watchdog.warnings.length > 0) {
    text += `\n*Warnings:*\n`;
    for (const warning of watchdog.warnings) {
      text += `• ${escapeMarkdown(warning)}\n`;
    }
  } else {
    text += `\nNo watchdog warnings at the current threshold.`;
  }

  await sendTrackedMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: doctorPanelKeyboard() });
}

async function sendDoctorPanel(chatId) {
  const inspection = inspectActiveIssueState();
  const codex = getCodexRuntimeStatus();
  const text =
    `🩺 *DOCTOR PANEL*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Health: *${inspection.ok ? 'OK' : 'MISMATCH'}*\n` +
    `Codex: *${escapeMarkdown(formatCodexStatusSummary(codex))}*\n\n` +
    `Run quick checks or start a guarded Codex doctor run.`;

  await sendTrackedMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: doctorPanelKeyboard()
  });
}

function doctorPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🩺 Health', callback_data: 'panel:doctor:health' },
        { text: '🧯 Watchdog', callback_data: 'panel:watchdog' },
        { text: '❓', callback_data: 'help:doctor:actions' }
      ],
      [
        { text: 'Run Doctor', callback_data: 'panel:doctor:confirm' },
        { text: '⬅️ Back', callback_data: 'panel:back' },
        { text: '❓', callback_data: 'help:doctor:nav' }
      ]
    ]
  };
}

async function getWatchdogSnapshot() {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const memoryUsed = memoryTotal - memoryFree;
  const memoryUsedPercent = Math.round((memoryUsed / memoryTotal) * 100);
  const disk = await readDiskUsage(WATCHDOG_PATH);
  const warnings = [];

  if (memoryUsedPercent >= WATCHDOG_THRESHOLD) {
    warnings.push(`RAM usage is ${memoryUsedPercent}%`);
  }
  if (disk.usedPercent >= WATCHDOG_THRESHOLD) {
    warnings.push(`Disk usage is ${disk.usedPercent}%`);
  }

  return {
    memory: {
      total: memoryTotal,
      used: memoryUsed,
      free: memoryFree,
      usedPercent: memoryUsedPercent
    },
    disk,
    warnings
  };
}

function readDiskUsage(targetPath) {
  return new Promise((resolve) => {
    execFile('df', ['-Pk', targetPath], { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ path: targetPath, usedPercent: 0, error: error.message });
        return;
      }

      const line = stdout.trim().split('\n')[1] || '';
      const parts = line.split(/\s+/);
      resolve({
        path: targetPath,
        filesystem: parts[0] || 'unknown',
        totalKb: Number(parts[1] || 0),
        usedKb: Number(parts[2] || 0),
        availableKb: Number(parts[3] || 0),
        usedPercent: Number(String(parts[4] || '0').replace('%', '')) || 0
      });
    });
  });
}

function formatBytes(bytes) {
  return `${(Number(bytes || 0) / 1024 / 1024 / 1024).toFixed(1)} GiB`;
}

async function sendCodexStatus(chatId) {
  const status = getCodexRuntimeStatus();
  await sendTrackedMessage(chatId, buildCodexStatusText(status), {
    parse_mode: 'Markdown',
    reply_markup: controlPanelKeyboard()
  });
}

function buildCodexStatusText(status) {
  let text =
    `🤖 *CODEX LIVE STATUS*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `State: *${escapeMarkdown(formatCodexStatusSummary(status))}*\n` +
    `Model: \`${escapeMarkdown(status.model)}\`\n` +
    `Workdir: \`${escapeMarkdown(status.workdir)}\`\n` +
    `API keys: ${status.keyCount} | Active: \`...${escapeMarkdown(status.keySuffix)}\`\n`;

  if (status.activeRun) {
    const owner = formatOperatorMention(status.activeRun.operator || status.activeRun.lock?.operator);
    text +=
      `\n*Active run:*\n` +
      `Task: ${escapeMarkdown(status.activeRun.label)}\n` +
      `PID: ${status.pid || status.activeRun?.pid || 'unknown'}\n` +
      `Started: \`${escapeMarkdown(status.activeRun.startedAt)}\`\n` +
      `Events: ${status.activeRun.eventCount}\n`;
    if (owner) {
      text += `Operator: ${escapeMarkdown(owner)}\n`;
    }
    if (status.activeRun.latestEvent) {
      text += `Now: ${escapeMarkdown(status.activeRun.latestEvent)}\n`;
    }
  } else if (status.state === 'running' && status.pid) {
    text += `\n*Active run:*\nPID: ${status.pid}\n`;
  }

  if (status.lastRun) {
    text +=
      `\n*Last run:*\n` +
      `Task: ${escapeMarkdown(status.lastRun.label)}\n` +
      `Status: ${escapeMarkdown(status.lastRun.status)}\n` +
      `Completed: \`${escapeMarkdown(status.lastRun.completedAt)}\`\n`;
    if (status.lastRun.error) {
      text += `Error: ${escapeMarkdown(status.lastRun.error.slice(0, 500))}\n`;
    }
    if (status.lastRun.outputPreview) {
      text += `\n*Recent output:*\n${escapeMarkdown(status.lastRun.outputPreview.slice(-700))}\n`;
    }
  }

  return text;
}

async function sendCodexActivity(chatId, mode = 'simple') {
  await sendTrackedMessage(chatId, buildCodexActivityText(mode), {
    parse_mode: 'Markdown',
    reply_markup: codexActivityKeyboard(mode)
  });
}

async function sendLogsPanel(chatId) {
  await sendTrackedMessage(chatId,
    `📜 *LOGS PANEL*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Open system logs or live Codex activity.`,
    {
      parse_mode: 'Markdown',
      reply_markup: logsPanelKeyboard()
    }
  );
}

function logsPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📜 System Logs', callback_data: 'panel:logs:simple' },
        { text: '🧾 Codex Live', callback_data: 'panel:codex_logs:simple' },
        { text: '❓', callback_data: 'help:logs:actions' }
      ],
      [
        { text: '⬅️ Back', callback_data: 'panel:back' },
        { text: '❓', callback_data: 'help:logs:mode' }
      ]
    ]
  };
}

async function refreshCodexActivity(message, mode = 'simple') {
  await safeEditMessageText(buildCodexActivityText(mode), {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'Markdown',
    reply_markup: codexActivityKeyboard(mode)
  });
}

function codexActivityKeyboard(mode = 'simple') {
  const otherMode = mode === 'technical' ? 'simple' : 'technical';
  return {
    inline_keyboard: [
      [
        { text: '🔄 Refresh', callback_data: `panel:codex_logs_refresh:${mode}` },
        { text: mode === 'technical' ? 'Simple Mode' : 'Technical Mode', callback_data: `panel:codex_logs_refresh:${otherMode}` },
        { text: '❓', callback_data: 'help:logs:mode' }
      ],
      [
        { text: '🤖 Status', callback_data: 'panel:codex_status' },
        { text: '⬅️ Back', callback_data: 'panel:logs' },
        { text: '❓', callback_data: 'help:logs:actions' }
      ]
    ]
  };
}

function buildCodexActivityText(mode = 'simple') {
  if (mode === 'simple') {
    return buildSimpleCodexActivityText();
  }

  const events = getCodexEventLog(18);
  let text =
    `🧾 *CODEX ACTIVITY — TECHNICAL*\n` +
    `Updated: \`${new Date().toISOString()}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (events.length === 0) {
    text += `_No Codex activity recorded since the orchestrator started._`;
    return text;
  }

  for (const event of events) {
    text += `• \`${escapeMarkdown(event.at.slice(11, 19))}\` ${escapeMarkdown(event.type)}: ${escapeMarkdown(event.message.slice(0, 180))}\n`;
  }

  return text.slice(0, 3900);
}

function buildSimpleCodexActivityText() {
  const status = getCodexRuntimeStatus();
  const events = getCodexEventLog(8);
  let text =
    `🧾 *CODEX LIVE — SIMPLE*\n` +
    `Updated: \`${new Date().toISOString()}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${humanCodexStateLine(status)}\n\n`;

  if (status.activeRun) {
    const owner = formatOperatorMention(status.activeRun.operator || status.activeRun.lock?.operator);
    text +=
      `*Current work:*\n` +
      `${escapeMarkdown(status.activeRun.label)}\n` +
      `PID: ${status.pid || status.activeRun?.pid || 'unknown'}\n` +
      `Started: \`${escapeMarkdown(status.activeRun.startedAt)}\`\n` +
      `${owner ? `Operator: ${escapeMarkdown(owner)}\n` : ''}` +
      `Latest: ${escapeMarkdown(status.activeRun.latestEvent || 'waiting for the next Codex update')}\n\n`;
  } else if (status.state === 'running' && status.pid) {
    text += `*Current work:*\nPID: ${status.pid}\n\n`;
  } else if (status.lastRun) {
    text +=
      `*Last work:*\n` +
      `${escapeMarkdown(status.lastRun.label)}\n` +
      `Result: ${escapeMarkdown(status.lastRun.status)}\n`;
    if (status.lastRun.outputPreview) {
      text += `\n*Recent output:*\n${escapeMarkdown(status.lastRun.outputPreview.slice(-900))}\n`;
    }
    if (status.lastRun.error) {
      text += `\n*Problem:*\n${escapeMarkdown(status.lastRun.error.slice(0, 700))}\n`;
    }
  } else {
    text += `No Codex run has happened since the orchestrator restarted.\n`;
  }

  if (events.length > 0) {
    text += `\n*Recent activity:*\n`;
    for (const event of events) {
      text += `• ${escapeMarkdown(event.message.slice(0, 150))}\n`;
    }
  }

  return text.slice(0, 3900);
}

async function sendLogs(chatId, mode = 'simple') {
  const text = buildLogsMessage(mode);
  await sendTrackedMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: logsKeyboard(mode)
  });
}

async function refreshLogsMessage(message, mode = 'simple') {
  const text = buildLogsMessage(mode);
  await safeEditMessageText(text, {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'Markdown',
    reply_markup: logsKeyboard(mode)
  });
}

function logsKeyboard(mode = 'simple') {
  const otherMode = mode === 'technical' ? 'simple' : 'technical';
  return {
    inline_keyboard: [
      [
        { text: '🔄 Refresh', callback_data: `logs:refresh:${mode}` },
        { text: mode === 'technical' ? 'Simple Mode' : 'Technical Mode', callback_data: `logs:refresh:${otherMode}` },
        { text: '❓', callback_data: 'help:logs:mode' }
      ],
      [
        { text: '🤖 Codex Live', callback_data: 'panel:codex_status' },
        { text: '⬅️ Back', callback_data: 'panel:logs' },
        { text: '❓', callback_data: 'help:logs:actions' }
      ]
    ]
  };
}

async function safeEditMessageText(text, options) {
  try {
    return await bot.editMessageText(text, options);
  } catch (error) {
    if (String(error.message || '').includes('message is not modified')) {
      return null;
    }
    throw error;
  }
}

function buildLogsMessage(mode = 'simple') {
  if (mode === 'simple') {
    return buildSimpleLogsMessage();
  }

  const out = redactSecrets(readLogTail(OUT_LOG, MAX_LOG_CHARS));
  const err = redactSecrets(readLogTail(ERR_LOG, 3000));
  const timestamp = new Date().toISOString();

  let text = `📜 *PROMETHEUS LOGS — TECHNICAL*\n`;
  text += `Updated: \`${timestamp}\`\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (err.trim()) {
    text += `*err.log:*\n\`\`\`\n${escapeCodeBlock(err)}\n\`\`\`\n`;
  } else {
    text += `*err.log:* _empty_\n`;
  }

  text += `*out.log:*\n\`\`\`\n${escapeCodeBlock(out || 'No log output yet.')}\n\`\`\``;
  return text;
}

function buildSimpleLogsMessage() {
  const out = redactSecrets(readLogTail(OUT_LOG, 2400));
  const err = redactSecrets(readLogTail(ERR_LOG, 5000));
  const status = getCodexRuntimeStatus();
  const heartbeat = extractLatestHeartbeat(out);
  const shutdown = extractLatestShutdown(err);
  const errorSummary = summarizeErrorLog(err, heartbeat);

  let text =
    `📜 *SYSTEM LOGS — SIMPLE*\n` +
    `Updated: \`${new Date().toISOString()}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${humanCodexStateLine(status)}\n`;

  if (heartbeat) {
    text += `The orchestrator is alive. Last heartbeat: \`${escapeMarkdown(heartbeat.time)}\` with ${escapeMarkdown(heartbeat.status)}.\n`;
  } else {
    text += `No recent heartbeat was found in the visible log window.\n`;
  }

  if (shutdown) {
    text += `Last shutdown signal seen: ${escapeMarkdown(shutdown)}.\n`;
  }

  if (errorSummary.active) {
    text += `\n*Needs attention:*\n${escapeMarkdown(errorSummary.message)}\n`;
  } else {
    text += `\n${escapeMarkdown(errorSummary.message)}\n`;
  }

  if (status.lastRun?.error) {
    text += `\n*Last Codex problem:*\n${escapeMarkdown(status.lastRun.error.slice(0, 700))}\n`;
  }

  return text.slice(0, 3900);
}

function humanSystemStatusLine(pipelineStatus, codexStatus) {
  if (codexStatus.state === 'running') {
    return `Codex is currently running on the EC2 instance${codexStatus.pid ? ` (PID ${codexStatus.pid})` : ''}.`;
  }
  if (codexStatus.state === 'stopped') {
    return `Codex was stopped by the operator.`;
  }
  if (codexStatus.state === 'missing_api_key') {
    return `Codex is not ready because no API key is configured.`;
  }
  if (codexStatus.state === 'api_key_exhausted') {
    return `Codex stopped because the active API key appears exhausted.`;
  }
  if (codexStatus.state === 'failed' || codexStatus.state === 'spawn_error') {
    return `Codex is not currently running. The last run failed.`;
  }
  if (pipelineStatus === 'running') {
    return `The orchestrator is running and waiting for the next Codex job.`;
  }
  return `The orchestrator is online. Codex is idle, and no job is running right now.`;
}

function humanCodexStateLine(status) {
  if (status.state === 'running') {
    return `Codex is running now on EC2${status.pid ? ` (PID ${status.pid})` : ''}.`;
  }
  if (status.state === 'idle' || status.state === 'ready') {
    return `Codex is idle. No Codex task is running right now.`;
  }
  if (status.state === 'missing_api_key') {
    return `Codex cannot run until an API key is added.`;
  }
  if (status.state === 'stopped') {
    return `Codex was stopped by the operator.`;
  }
  if (status.state === 'api_key_exhausted') {
    return `Codex hit an API-key/quota problem. Use the API Key pill to replace the active key.`;
  }
  if (status.state === 'spawn_error') {
    return `Codex could not start on the EC2 instance.`;
  }
  if (status.state === 'failed') {
    return `Codex is stopped. The last Codex task failed.`;
  }
  return `Codex state: ${status.state}.`;
}

function formatCodexStatusSummary(status) {
  if (!status) return 'IDLE';
  if (status.state === 'running') {
    return status.pid ? `RUNNING (PID: ${status.pid})` : 'RUNNING';
  }
  if (status.state === 'stopped') return 'STOPPED';
  if (status.state === 'missing_api_key') return 'MISSING API KEY';
  if (status.state === 'api_key_exhausted') return 'API KEY EXHAUSTED';
  if (status.state === 'failed') return 'FAILED';
  if (status.state === 'spawn_error') return 'SPAWN ERROR';
  return 'IDLE';
}

function extractLatestHeartbeat(logText) {
  const lines = logText.split('\n').filter(line => line.includes('[heartbeat] alive'));
  const latest = lines[lines.length - 1];
  if (!latest) return null;

  const timeMatch = latest.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  const statusMatch = latest.match(/status=([^\s]+)/);
  const issueMatch = latest.match(/current_issue=([^\s]+)/);
  const parts = [];
  if (statusMatch) parts.push(`pipeline ${statusMatch[1]}`);
  if (issueMatch) parts.push(`issue ${issueMatch[1]}`);

  return {
    time: timeMatch ? timeMatch[1] : 'recently',
    timestamp: timeMatch ? new Date(`${timeMatch[1].replace(' ', 'T')}Z`) : null,
    status: parts.join(', ') || 'unknown status'
  };
}

function extractLatestShutdown(logText) {
  const lines = logText.split('\n').filter(line => line.includes('[shutdown-trigger]'));
  const latest = lines[lines.length - 1];
  if (!latest) return null;

  if (latest.includes('signal:SIGHUP')) return 'SIGHUP was received and treated as a session hangup';
  if (latest.includes('signal:SIGINT')) return 'SIGINT was received, usually an intentional restart/interrupt';
  if (latest.includes('signal:SIGTERM')) return 'SIGTERM was received, usually PM2 or the host stopping/restarting the app';
  return latest.slice(-240);
}

function simplifyErrorLog(logText) {
  const text = logText.trim();
  if (!text) return 'No error details are present.';
  if (text.includes('message is not modified')) {
    return 'Telegram tried to refresh a message that was already current. This does not mean Codex is down, and refresh/toggle edits now ignore that harmless Telegram response.';
  }
  if (text.includes('API_KEY_EXHAUSTED') || text.includes('insufficient_quota') || text.includes('quota') || text.includes('429')) {
    return 'Codex appears to have hit an API key, quota, or rate-limit problem. Replace the active key with the API Key pill.';
  }
  if (text.includes('CODEX_NOT_FOUND') || text.includes('codex CLI not installed')) {
    return 'The Codex command-line tool could not be found on the EC2 instance.';
  }
  if (text.includes('polling_error')) {
    return 'Telegram polling had a connection/API problem. The bot is configured to retry polling automatically.';
  }
  if (text.includes('[shutdown-trigger]')) {
    return 'The latest technical entries are shutdown-signal records, not necessarily a crash.';
  }
  return text.split('\n').slice(-5).join('\n').slice(0, 900);
}

function summarizeErrorLog(logText, heartbeat) {
  const text = logText.trim();
  if (!text) {
    return {
      active: false,
      message: 'No active error is visible in the latest error log window.'
    };
  }

  if (text.includes('[shutdown-trigger]') && !text.includes('Error') && !text.includes('Unhandled')) {
    return {
      active: false,
      message: 'The latest technical entries are shutdown-signal records, not an application crash.'
    };
  }

  const latestErrorTime = extractLatestLogTimestamp(text);
  const heartbeatAfterError = heartbeat?.timestamp && latestErrorTime && heartbeat.timestamp.getTime() - latestErrorTime.getTime() > 120000;
  const message = simplifyErrorLog(text);

  if (heartbeatAfterError) {
    return {
      active: false,
      message: `Last recorded error was at ${formatLogTime(latestErrorTime)}, and the orchestrator has heartbeated since then. It does not look active now. Last issue: ${message}`
    };
  }

  if (text.includes('message is not modified')) {
    return {
      active: false,
      message
    };
  }

  return {
    active: true,
    message
  };
}

function extractLatestLogTimestamp(logText) {
  const matches = [...logText.matchAll(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})/g)];
  const latest = matches[matches.length - 1];
  if (!latest) return null;
  return new Date(`${latest[1]}T${latest[2]}${latest[3]}`);
}

function formatLogTime(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function redactSecrets(text) {
  return String(text || '')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>')
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, 'sk-...redacted');
}

function readLogTail(filePath, maxChars) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const stats = fs.statSync(filePath);
    const length = Math.min(stats.size, maxChars);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, length, stats.size - length);
    fs.closeSync(fd);
    const text = buffer.toString('utf8');
    const newlineIndex = text.indexOf('\n');
    return stats.size > maxChars && newlineIndex >= 0 ? text.slice(newlineIndex + 1) : text;
  } catch (error) {
    console.error('[telegram] Failed to read logs:', formatError(error));
    return `Unable to read logs: ${error.message}`;
  }
}

async function sendCompletionPrompt(chatId, message) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '👁️ View Details', callback_data: 'view_details' },
        { text: '✅ Continue', callback_data: 'continue' },
        { text: '❓', callback_data: 'help:completion:review' }
      ],
      [
        { text: '❌ Redo Issue', callback_data: 'retry' },
        { text: '⏸️ Pause Pipeline', callback_data: 'pause' },
        { text: '❓', callback_data: 'help:completion:control' }
      ],
      [
        { text: '🤖 Change Model', callback_data: 'change_model' },
        { text: '📋 Skip to Next', callback_data: 'skip' },
        { text: '❓', callback_data: 'help:completion:finish' }
      ]
    ]
  };

  const sent = await sendTrackedMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });

  return new Promise((resolve) => {
    messageCallbacks.set(chatId, resolve);
    
    setTimeout(() => {
      if (messageCallbacks.has(chatId)) {
        messageCallbacks.delete(chatId);
        resolve('timeout');
      }
    }, 24 * 60 * 60 * 1000);
  });
}

async function sendKeyExhaustedAlert(chatId, issueNumber, title, progress) {
  const currentKey = getState('api_key_index') || '0';
  const totalKeys = getKeyCount();
  
  const message = 
    `⚠️ *API KEY EXHAUSTED*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔑 Current key index: ${parseInt(currentKey) + 1}/${totalKeys}\n` +
    `🔄 *Issue #${issueNumber}:* ${escapeMarkdown(title || 'Unknown')}\n` +
    `📊 Progress: ${progress || 'Unknown'}\n\n` +
    `Use Settings → API Key to replace the active key, or use the completion controls to skip this issue.`;

  await sendTrackedMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: settingsPanelKeyboard() });
}

async function sendNotification(chatId, text) {
  await sendTrackedMessage(chatId, text, { parse_mode: 'Markdown' });
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

function escapeCodeBlock(text) {
  return String(text).replace(/```/g, '`\\`\\`');
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

module.exports = {
  initBot,
  sendCompletionPrompt,
  sendKeyExhaustedAlert,
  sendNotification,
  sendStatus,
  sendHealth,
  sendLogs,
  startDiffStream,
  stopDiffStream,
  isAuthorized
};

const assert = require('node:assert/strict');
const test = require('node:test');

process.env.AUTHORIZED_CHAT_IDS = '';

const { initDatabase } = require('../src/lib/database');
const telegram = require('../src/lib/telegram');

initDatabase();

function createFakeBot() {
  const calls = [];
  let nextMessageId = 1000;
  return {
    calls,
    async sendMessage(chatId, text, options = {}) {
      const message = { chat: { id: chatId }, message_id: nextMessageId++, text };
      calls.push({ method: 'sendMessage', chatId, text, options, message_id: message.message_id });
      return message;
    },
    async editMessageText(text, options = {}) {
      calls.push({ method: 'editMessageText', text, options });
      return { chat: { id: options.chat_id }, message_id: options.message_id, text };
    },
    async answerCallbackQuery(id, options = {}) {
      calls.push({ method: 'answerCallbackQuery', id, options });
      return true;
    },
    async deleteMessage(chatId, messageId) {
      calls.push({ method: 'deleteMessage', chatId, messageId });
      return true;
    }
  };
}

function query(data, chatId = 123, messageId = 77) {
  return {
    id: `callback-${data}`,
    data,
    from: { id: 456, first_name: 'Pat' },
    message: {
      chat: { id: chatId },
      message_id: messageId
    }
  };
}

test('API key input prompt edits the active menu message and keeps Cancel only', async () => {
  const fakeBot = createFakeBot();
  telegram._test.resetTelegramInteractionStateForTest({ bot: fakeBot, now: () => 1000 });

  await telegram._test.handlePanelAction(query('panel:settings'));
  await telegram._test.handlePanelAction(query('panel:key'));

  const edits = fakeBot.calls.filter(call => call.method === 'editMessageText');
  assert.ok(edits.length >= 2);
  const inputPrompt = edits.at(-1);
  assert.equal(inputPrompt.options.chat_id, 123);
  assert.equal(inputPrompt.options.message_id, 77);
  assert.match(inputPrompt.text, /API Key Update/);
  assert.deepEqual(
    inputPrompt.options.reply_markup.inline_keyboard.map(row => row.map(button => button.callback_data)),
    [['panel:cancel', 'help:input:cancel']]
  );

  const state = telegram._test.getChatSession(123);
  assert.equal(state.current_menu, 'awaiting_input');
  assert.equal(state.awaiting_input, 'api_key');
  assert.equal(state.context_data.parent_menu, 'settings');
});

test('inline Cancel aborts pending input and edits back to parent menu', async () => {
  const fakeBot = createFakeBot();
  telegram._test.resetTelegramInteractionStateForTest({ bot: fakeBot, now: () => 1000 });

  await telegram._test.handlePanelAction(query('panel:settings'));
  await telegram._test.handlePanelAction(query('panel:key'));
  await telegram._test.handlePanelAction(query('panel:cancel'));

  assert.equal(telegram._test.getChatSession(123).current_menu, 'settings');
  assert.ok(fakeBot.calls.some(call => call.method === 'sendMessage' && call.text === 'Cancelled.'));
  assert.match(fakeBot.calls.filter(call => call.method === 'editMessageText').at(-1).text, /PROMETHEUS SETTINGS/);
});

test('unexpected API key input keeps awaiting state and prompts retry in-thread', async () => {
  const fakeBot = createFakeBot();
  telegram._test.resetTelegramInteractionStateForTest({ bot: fakeBot, now: () => 1000 });

  await telegram._test.handlePanelAction(query('panel:settings'));
  await telegram._test.handlePanelAction(query('panel:key'));
  await telegram._test.handlePendingInputMessage({
    chat: { id: 123 },
    from: { id: 456, first_name: 'Pat' },
    message_id: 88,
    text: 'not a key with spaces'
  });

  assert.equal(telegram._test.getChatSession(123).awaiting_input, 'api_key');
  assert.ok(fakeBot.calls.some(call =>
    call.method === 'sendMessage' &&
    call.text === 'I was expecting an API key. Please try again or press Cancel.' &&
    !call.options.reply_markup
  ));
});

test('idle awaiting input times out after five minutes and returns to root', async () => {
  let now = 1000;
  const fakeBot = createFakeBot();
  telegram._test.resetTelegramInteractionStateForTest({ bot: fakeBot, now: () => now });

  await telegram._test.askForInput(123, 'api_key', 'Send key.', {
    message: { chat: { id: 123 }, message_id: 77 },
    parentMenu: 'settings'
  });
  now += 5 * 60 * 1000 + 1;

  await telegram._test.expireIdleAwaitingInputs();

  assert.equal(telegram._test.getChatSession(123).current_menu, 'root');
  assert.ok(fakeBot.calls.some(call =>
    call.method === 'sendMessage' &&
    call.text === 'Session timed out. Returning to main menu.'
  ));
});

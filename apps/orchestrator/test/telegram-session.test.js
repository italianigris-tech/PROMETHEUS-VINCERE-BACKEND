const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AWAITING_INPUT_TIMEOUT_MS,
  createTelegramSessionStore
} = require('../src/lib/telegram-session');

test('new sessions start at the root menu', () => {
  const sessions = createTelegramSessionStore({ now: () => 1000 });

  const state = sessions.get('chat-1');

  assert.equal(state.current_menu, 'root');
  assert.equal(state.awaiting_input, null);
  assert.deepEqual(state.context_data, {});
});

test('menu navigation records current menu, active message, and immediate parent', () => {
  const sessions = createTelegramSessionStore({ now: () => 1000 });

  sessions.setMenu('chat-1', 'root', { messageId: 10 });
  sessions.setMenu('chat-1', 'settings', { messageId: 10, parentMenu: 'root' });
  sessions.setMenu('chat-1', 'settings_model', { messageId: 10, parentMenu: 'settings' });

  assert.equal(sessions.get('chat-1').current_menu, 'settings_model');
  assert.equal(sessions.get('chat-1').context_data.message_id, 10);
  assert.equal(sessions.back('chat-1'), 'settings');
  assert.equal(sessions.back('chat-1'), 'root');
  assert.equal(sessions.back('chat-1'), 'root');
});

test('awaiting input stores field type and parent menu, then cancel returns to parent', () => {
  const sessions = createTelegramSessionStore({ now: () => 5000 });

  sessions.setMenu('chat-1', 'settings', { messageId: 42, parentMenu: 'root' });
  sessions.awaitInput('chat-1', 'api_key', { parentMenu: 'settings', messageId: 42 });

  const waiting = sessions.get('chat-1');
  assert.equal(waiting.current_menu, 'awaiting_input');
  assert.equal(waiting.awaiting_input, 'api_key');
  assert.equal(waiting.context_data.parent_menu, 'settings');
  assert.equal(waiting.context_data.message_id, 42);

  assert.equal(sessions.cancelInput('chat-1'), 'settings');
  const cancelled = sessions.get('chat-1');
  assert.equal(cancelled.current_menu, 'settings');
  assert.equal(cancelled.awaiting_input, null);
});

test('awaiting input expires after five minutes and resets to root', () => {
  let now = 10000;
  const sessions = createTelegramSessionStore({ now: () => now });

  sessions.awaitInput('chat-1', 'codex_prompt', { parentMenu: 'root', messageId: 7 });
  now += AWAITING_INPUT_TIMEOUT_MS + 1;

  const expired = sessions.expireIdleInputs();

  assert.deepEqual(expired.map(item => item.sessionKey), ['chat-1']);
  const state = sessions.get('chat-1');
  assert.equal(state.current_menu, 'root');
  assert.equal(state.awaiting_input, null);
  assert.deepEqual(state.context_data, {});
});

test('goToMenu pops back to an existing parent menu instead of duplicating stack entries', () => {
  const sessions = createTelegramSessionStore({ now: () => 1000 });

  sessions.setMenu('chat-1', 'root', { messageId: 10 });
  sessions.setMenu('chat-1', 'settings', { messageId: 10, parentMenu: 'root' });
  sessions.setMenu('chat-1', 'settings_model', { messageId: 10, parentMenu: 'settings' });
  sessions.goToMenu('chat-1', 'settings');

  assert.equal(sessions.get('chat-1').current_menu, 'settings');
  assert.deepEqual(sessions.get('chat-1').context_data.menu_stack, ['root']);
  assert.equal(sessions.back('chat-1'), 'root');
});

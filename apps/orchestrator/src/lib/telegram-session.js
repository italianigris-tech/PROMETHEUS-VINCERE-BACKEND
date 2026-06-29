const AWAITING_INPUT_TIMEOUT_MS = 5 * 60 * 1000;

function createTelegramSessionStore(options = {}) {
  const sessions = new Map();
  const now = options.now || (() => Date.now());

  function get(sessionKey) {
    return cloneState(ensure(sessionKey));
  }

  function setMenu(sessionKey, menu, options = {}) {
    const state = ensure(sessionKey);
    const parentMenu = options.parentMenu || state.current_menu || 'root';
    const stack = Array.isArray(state.context_data.menu_stack)
      ? [...state.context_data.menu_stack]
      : [];

    if (menu === 'root') {
      stack.length = 0;
    } else if (parentMenu && parentMenu !== menu && stack[stack.length - 1] !== parentMenu) {
      stack.push(parentMenu);
    }

    state.current_menu = menu || 'root';
    state.awaiting_input = null;
    state.context_data = {
      ...state.context_data,
      ...options.contextData,
      message_id: options.messageId ?? state.context_data.message_id,
      parent_menu: parentMenu,
      menu_stack: stack,
      input_started_at: null
    };
    sessions.set(String(sessionKey), state);
    return cloneState(state);
  }

  function awaitInput(sessionKey, inputType, options = {}) {
    const state = ensure(sessionKey);
    const parentMenu = options.parentMenu || state.current_menu || 'root';
    const messageId = options.messageId ?? state.context_data.message_id;

    state.current_menu = 'awaiting_input';
    state.awaiting_input = inputType;
    state.context_data = {
      ...state.context_data,
      ...options.contextData,
      parent_menu: parentMenu,
      message_id: messageId,
      input_started_at: now()
    };
    sessions.set(String(sessionKey), state);
    return cloneState(state);
  }

  function back(sessionKey) {
    const state = ensure(sessionKey);
    const stack = Array.isArray(state.context_data.menu_stack)
      ? [...state.context_data.menu_stack]
      : [];
    const previous = stack.pop() || state.context_data.parent_menu || 'root';
    state.current_menu = previous || 'root';
    state.awaiting_input = null;
    state.context_data = {
      ...state.context_data,
      parent_menu: stack[stack.length - 1] || 'root',
      menu_stack: previous === 'root' ? [] : stack
    };
    sessions.set(String(sessionKey), state);
    return state.current_menu;
  }

  function goToMenu(sessionKey, menu) {
    const state = ensure(sessionKey);
    const stack = Array.isArray(state.context_data.menu_stack)
      ? [...state.context_data.menu_stack]
      : [];
    const target = menu || 'root';
    const existingIndex = stack.lastIndexOf(target);

    if (target === 'root') {
      stack.length = 0;
    } else if (existingIndex >= 0) {
      stack.length = existingIndex;
    } else if (state.current_menu && state.current_menu !== target && stack[stack.length - 1] !== state.current_menu) {
      stack.push(state.current_menu);
    }

    state.current_menu = target;
    state.awaiting_input = null;
    state.context_data = {
      ...state.context_data,
      parent_menu: stack[stack.length - 1] || 'root',
      menu_stack: stack,
      input_started_at: null
    };
    sessions.set(String(sessionKey), state);
    return cloneState(state);
  }

  function cancelInput(sessionKey) {
    const state = ensure(sessionKey);
    const parentMenu = state.context_data.parent_menu || 'root';
    state.current_menu = parentMenu;
    state.awaiting_input = null;
    state.context_data = {
      ...state.context_data,
      input_started_at: null
    };
    sessions.set(String(sessionKey), state);
    return parentMenu;
  }

  function clearInput(sessionKey) {
    const state = ensure(sessionKey);
    state.awaiting_input = null;
    state.context_data = {
      ...state.context_data,
      input_started_at: null
    };
    sessions.set(String(sessionKey), state);
    return cloneState(state);
  }

  function reset(sessionKey) {
    const state = createDefaultState();
    sessions.set(String(sessionKey), state);
    return cloneState(state);
  }

  function expireIdleInputs() {
    const expired = [];
    for (const [sessionKey, state] of sessions.entries()) {
      if (!state.awaiting_input || !state.context_data.input_started_at) continue;
      if (now() - state.context_data.input_started_at <= AWAITING_INPUT_TIMEOUT_MS) continue;

      expired.push({
        sessionKey,
        state: cloneState(state)
      });
      sessions.set(sessionKey, createDefaultState());
    }
    return expired;
  }

  function ensure(sessionKey) {
    const key = String(sessionKey);
    if (!sessions.has(key)) {
      sessions.set(key, createDefaultState());
    }
    return sessions.get(key);
  }

  return {
    get,
    setMenu,
    awaitInput,
    back,
    goToMenu,
    cancelInput,
    clearInput,
    reset,
    expireIdleInputs
  };
}

function createDefaultState() {
  return {
    current_menu: 'root',
    awaiting_input: null,
    context_data: {}
  };
}

function cloneState(state) {
  return {
    current_menu: state.current_menu,
    awaiting_input: state.awaiting_input,
    context_data: { ...state.context_data }
  };
}

module.exports = {
  AWAITING_INPUT_TIMEOUT_MS,
  createTelegramSessionStore
};

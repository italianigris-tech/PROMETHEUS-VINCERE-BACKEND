function parseCodexStream(chunk) {
  const events = [];
  const lines = String(chunk || '').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const parsed = parseCodexEvent(event);
      if (parsed) events.push(parsed);
    } catch {
      // Ignore non-JSON lines from the CLI.
    }
  }

  return events;
}

function parseCodexEvent(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.type === 'file_delta') {
    return {
      kind: 'file',
      file: event.file || event.path || 'unknown file',
      delta: event.delta || event.content || ''
    };
  }
  if (event.type === 'tool_call') {
    return {
      kind: 'tool',
      tool: event.tool || event.name || 'tool',
      command: event.command || event.input || ''
    };
  }
  if (event.type === 'reasoning') {
    return {
      kind: 'thought',
      content: event.content || event.summary || event.text || ''
    };
  }
  return null;
}

function createLiveStreamState(label, model) {
  return {
    label: label || 'Codex run',
    model: model || 'unknown',
    events: [],
    updatedAt: new Date().toISOString()
  };
}

function appendLiveEvents(state, events) {
  if (!state || !Array.isArray(events) || events.length === 0) return state;
  state.events.push(...events);
  state.events = state.events.slice(-20);
  state.updatedAt = new Date().toISOString();
  return state;
}

module.exports = {
  parseCodexStream,
  parseCodexEvent,
  createLiveStreamState,
  appendLiveEvents
};

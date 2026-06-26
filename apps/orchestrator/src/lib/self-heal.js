const SELF_HEAL_COOLDOWN_MS = 60 * 60 * 1000;

function createSelfHealTask(error) {
  const stack = String(error?.stack || '');
  const message = String(error?.message || error || 'Unknown orchestrator error');
  const affectedFile = extractAffectedFile(stack) || 'src/index.js';

  return {
    id: `self-heal-${Date.now()}`,
    title: `🩹 Self-heal: ${message.slice(0, 80)}`,
    description: `The orchestrator encountered an error in ${affectedFile}.\n\nError: ${message}\n\nStack: ${stack}`,
    prompt: [
      'Fix the following bug in the Prometheus orchestrator:',
      `File: ${affectedFile}`,
      `Error: ${message}`,
      `Stack trace: ${stack}`,
      'Analyze the error, fix the root cause, and add defensive checks. Do not change unrelated code.'
    ].join('\n\n'),
    priority: 'critical',
    isSelfHeal: true,
    affectedFile
  };
}

function extractAffectedFile(stack) {
  const match = String(stack || '').match(/(?:\(|\s)(src\/[^():]+):\d+:\d+\)?/);
  return match ? match[1] : null;
}

function canCreateSelfHealTask(lastCreatedAt, now = Date.now()) {
  if (!lastCreatedAt || lastCreatedAt === 'null') return true;
  const last = Date.parse(lastCreatedAt);
  return !Number.isFinite(last) || now - last >= SELF_HEAL_COOLDOWN_MS;
}

module.exports = {
  createSelfHealTask,
  extractAffectedFile,
  canCreateSelfHealTask,
  SELF_HEAL_COOLDOWN_MS
};

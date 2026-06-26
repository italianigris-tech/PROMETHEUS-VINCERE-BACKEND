function classifyTaskType(text) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('security') || lower.includes('auth') || lower.includes('xss') || lower.includes('rce')) return 'security';
  if (lower.includes('test') || lower.includes('spec')) return 'test';
  if (lower.includes('refactor') || lower.includes('architecture')) return 'refactor';
  if (lower.includes('bug') || lower.includes('fix') || lower.includes('error')) return 'bugfix';
  return 'feature';
}

function classifyFailureReason(errorOrStatus) {
  const text = String(errorOrStatus || '').toLowerCase();
  if (!text || text === 'completed') return null;
  if (text.includes('service_unavailable') || text.includes('503')) return 'service_outage';
  if (text.includes('rate') || text.includes('429')) return 'rate_limit';
  if (text.includes('api_key') || text.includes('unauthorized') || text.includes('authentication')) return 'api_key';
  if (text.includes('syntax')) return 'syntax_error';
  return 'logic_error';
}

function summarizeAnalytics(rows = []) {
  const total = rows.length;
  const successes = rows.filter(row => !row.failureReason && Number(row.exitCode || 0) === 0).length;
  const avgDurationMs = average(rows.map(row => Number(row.durationMs || 0)));
  const byModel = groupRows(rows, row => row.model || 'unknown');
  const byTaskType = groupRows(rows, row => row.taskType || 'unknown');

  return {
    totalRuns: total,
    successes,
    successRate: total ? successes / total : 0,
    avgDurationMs,
    byModel: summarizeGroups(byModel),
    byTaskType: summarizeGroups(byTaskType),
    insight: buildInsight(summarizeGroups(byTaskType), summarizeGroups(byModel))
  };
}

function groupRows(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function summarizeGroups(groups) {
  return [...groups.entries()].map(([name, rows]) => {
    const successes = rows.filter(row => !row.failureReason && Number(row.exitCode || 0) === 0).length;
    return {
      name,
      total: rows.length,
      successes,
      successRate: rows.length ? successes / rows.length : 0,
      avgDurationMs: average(rows.map(row => Number(row.durationMs || 0)))
    };
  }).sort((a, b) => b.successRate - a.successRate || b.total - a.total);
}

function buildInsight(byTaskType, byModel) {
  const topTask = byTaskType[0];
  const topModel = byModel[0];
  if (!topTask || !topModel) return 'Not enough data for optimization yet.';
  return `${topTask.name} tasks currently perform best overall; ${topModel.name} has the strongest observed success rate.`;
}

function average(values) {
  const usable = values.filter(value => Number.isFinite(value) && value >= 0);
  if (usable.length === 0) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

module.exports = {
  classifyTaskType,
  classifyFailureReason,
  summarizeAnalytics
};

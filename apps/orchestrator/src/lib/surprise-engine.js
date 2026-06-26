const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = process.env.CODEX_WORKDIR || process.env.REPO_PATH || process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache']);
const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.tsx']);
const DISMISSAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const SURPRISE_CATEGORIES = {
  SECURITY: {
    patterns: [
      { name: 'eval() usage', regex: /eval\s*\(/g, impact: 'Prevents potential remote code execution' },
      { name: 'innerHTML assignment', regex: /innerHTML\s*=/g, impact: 'Reduces browser XSS exposure' },
      { name: 'hardcoded password', regex: /password\s*[:=]\s*["'][^"']+["']/gi, impact: 'Prevents credential leakage' },
      { name: 'security TODO', regex: /TODO.*security/gi, impact: 'Closes known security follow-up work' },
      { name: 'auth FIXME', regex: /FIXME.*auth/gi, impact: 'Reduces authentication correctness risk' }
    ],
    severity: 'high',
    emoji: '🔒'
  },
  PERFORMANCE: {
    patterns: [
      { name: 'await inside loop', regex: /for\s*\([^)]*\)\s*\{[^}]*await/g, impact: 'Improves serial async hot paths' },
      { name: 'map/filter chain', regex: /\.map\s*\([^)]*\)\s*\.\s*filter/g, impact: 'Avoids unnecessary array passes' },
      { name: 'setInterval usage', regex: /setInterval\s*\(/g, impact: 'Reduces timer leak risk' },
      { name: 'console.log usage', regex: /console\.log\s*\(/g, impact: 'Reduces noisy production logging' },
      { name: 'dynamic RegExp', regex: /new\s+RegExp\s*\(/g, impact: 'Avoids repeated regex compilation' }
    ],
    severity: 'medium',
    emoji: '⚡'
  },
  ARCHITECTURE: {
    patterns: [
      { name: 'refactor TODO', regex: /TODO.*refactor/gi, impact: 'Pays down documented design debt' },
      { name: 'architecture FIXME', regex: /FIXME.*architecture/gi, impact: 'Addresses known architecture risk' },
      { name: 'duplicate code marker', regex: /duplicate.*code/gi, impact: 'Removes duplication' },
      { name: 'copy/paste marker', regex: /copy.*paste/gi, impact: 'Reduces maintenance drift' },
      { name: 'TypeScript any[]', regex: /any\s*\[\s*\]/g, impact: 'Improves type safety' },
      { name: 'TypeScript as any', regex: /as\s+any\s*;/g, impact: 'Improves type safety' }
    ],
    severity: 'low',
    emoji: '🏗️'
  }
};

const SEVERITY_WEIGHT = {
  high: 9,
  medium: 5,
  low: 2
};

function audit(options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const files = walkSourceFiles(root);
  const findings = [];
  const functionRefs = new Map();

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath);
    const content = readText(filePath);
    if (content === null) continue;
    collectPatternFindings(findings, relativePath, content);
    collectFunctionReferences(functionRefs, relativePath, content);
  }

  findings.push(...detectDeadCode(functionRefs));
  const ranked = rankFindings(mergeFindings(findings), files.length);
  const dismissed = options.dismissed || [];
  return ranked.map(finding => ({
    ...finding,
    isNew: !isDismissed(finding, dismissed)
  }));
}

function getTopSurprises(options = {}) {
  return audit(options).filter(finding => finding.isNew).slice(0, options.limit || 3);
}

function walkSourceFiles(root) {
  const result = [];
  walk(root, result);
  return result;
}

function walk(dir, result) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') {
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(fullPath, result);
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function collectPatternFindings(findings, filePath, content) {
  for (const [category, config] of Object.entries(SURPRISE_CATEGORIES)) {
    for (const pattern of config.patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        findings.push(createFinding({
          category,
          severity: config.severity,
          emoji: config.emoji,
          patternName: pattern.name,
          description: buildDescription(category, pattern.name),
          estimatedImpact: pattern.impact,
          filePath,
          line: lineForIndex(content, match.index),
          snippet: snippetAt(content, match.index)
        }));
        if (match.index === regex.lastIndex) regex.lastIndex += 1;
      }
    }
  }
}

function collectFunctionReferences(functionRefs, filePath, content) {
  const definitions = content.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g);
  for (const match of definitions) {
    const name = match[1];
    if (!functionRefs.has(name)) {
      functionRefs.set(name, { name, definitions: [], calls: 0 });
    }
    functionRefs.get(name).definitions.push({
      filePath,
      line: lineForIndex(content, match.index),
      snippet: snippetAt(content, match.index)
    });
  }

  for (const [name, ref] of functionRefs.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`, 'g');
    const calls = [...content.matchAll(regex)].length;
    ref.calls += calls;
  }
}

function detectDeadCode(functionRefs) {
  const findings = [];
  for (const ref of functionRefs.values()) {
    if (ref.definitions.length === 0 || ref.calls > ref.definitions.length) continue;
    if (/^(main|init|handler|constructor)$/.test(ref.name)) continue;
    const definition = ref.definitions[0];
    findings.push(createFinding({
      category: 'DEAD_CODE',
      severity: 'low',
      emoji: '🧹',
      patternName: `possibly unused function ${ref.name}()`,
      description: `${ref.name}() appears to be defined but not called in the scanned source files.`,
      estimatedImpact: 'Reduces maintenance surface area',
      filePath: definition.filePath,
      line: definition.line,
      snippet: definition.snippet
    }));
  }
  return findings;
}

function createFinding(input) {
  const id = stableFindingId(input.category, input.patternName, [input.filePath]);
  return {
    id,
    category: input.category,
    emoji: input.emoji,
    title: `${input.patternName} detected in ${input.filePath}`,
    description: input.description,
    severity: input.severity,
    affectedFiles: [input.filePath],
    estimatedImpact: input.estimatedImpact,
    suggestedPrompt: buildSuggestedPrompt(input),
    occurrences: [{
      file: input.filePath,
      line: input.line,
      snippet: input.snippet
    }],
    patternName: input.patternName,
    score: SEVERITY_WEIGHT[input.severity] || 1
  };
}

function mergeFindings(findings) {
  const grouped = new Map();
  for (const finding of findings) {
    const key = `${finding.category}:${finding.patternName}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...finding });
      continue;
    }
    existing.affectedFiles = [...new Set([...existing.affectedFiles, ...finding.affectedFiles])];
    existing.occurrences.push(...finding.occurrences);
    existing.score += finding.score;
    existing.title = `${existing.occurrences.length} ${finding.patternName} finding${existing.occurrences.length === 1 ? '' : 's'} detected`;
    existing.id = stableFindingId(existing.category, existing.patternName, existing.affectedFiles);
    existing.suggestedPrompt = buildSuggestedPrompt({
      category: existing.category,
      patternName: existing.patternName,
      filePath: existing.affectedFiles.join(', '),
      description: existing.description,
      estimatedImpact: existing.estimatedImpact
    });
  }
  return [...grouped.values()];
}

function rankFindings(findings, fileCount) {
  const divisor = Math.max(1, fileCount);
  return findings
    .map(finding => ({
      ...finding,
      score: Number((finding.score / divisor).toFixed(3))
    }))
    .sort((a, b) => {
      const severityDiff = (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
      if (severityDiff) return severityDiff;
      return b.occurrences.length - a.occurrences.length || a.title.localeCompare(b.title);
    });
}

function buildDescription(category, patternName) {
  if (category === 'SECURITY') return `${patternName} can expose the application to avoidable security risk.`;
  if (category === 'PERFORMANCE') return `${patternName} may slow repeated orchestration paths or increase operational noise.`;
  if (category === 'ARCHITECTURE') return `${patternName} points to maintainability debt worth tightening.`;
  return `${patternName} may be removable or worth reviewing.`;
}

function buildSuggestedPrompt(finding) {
  return [
    `Audit and fix ${finding.patternName} in ${finding.filePath}.`,
    finding.description,
    `Focus only on the affected files. Add or update verification where practical.`,
    `Estimated impact: ${finding.estimatedImpact}.`
  ].join('\n\n');
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function snippetAt(content, index) {
  const start = Math.max(0, content.lastIndexOf('\n', index - 1) + 1);
  const end = content.indexOf('\n', index);
  return content.slice(start, end === -1 ? undefined : end).trim().slice(0, 240);
}

function stableFindingId(category, patternName, files) {
  const raw = `${category}:${patternName}:${files.sort().join('|')}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `surprise-${Math.abs(hash).toString(36)}`;
}

function isDismissed(finding, dismissed = []) {
  const now = Date.now();
  return dismissed.some(row => {
    if (row.id !== finding.id) return false;
    const dismissedAt = Date.parse(row.dismissedAt || row.dismissed_at || '');
    return Number.isFinite(dismissedAt) && now - dismissedAt < DISMISSAL_WINDOW_MS;
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  SURPRISE_CATEGORIES,
  audit,
  getTopSurprises,
  walkSourceFiles
};

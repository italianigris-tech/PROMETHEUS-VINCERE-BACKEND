const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = process.env.CODEX_WORKDIR || process.env.REPO_PATH || process.cwd();
const PROTECTED_FILES = ['.env', 'package-lock.json', 'yarn.lock', '.gitignore'];
const ACTIONABLE_WORDS = ['create', 'add', 'implement', 'fix', 'refactor', 'remove', 'update', 'delete'];
const BREAKING_INDICATORS = ['breaking change', 'remove api', 'delete endpoint', 'change signature'];

function runPreflightCheck(prompt, options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const text = String(prompt || '');
  const lower = text.toLowerCase();
  const warnings = [];

  for (const file of extractFileMentions(text)) {
    if (!fs.existsSync(path.join(root, file))) {
      warnings.push({
        type: 'HALLUCINATION_RISK',
        message: `Prompt references ${file} which does not exist. Codex may hallucinate this file.`,
        severity: 'medium'
      });
    }
  }

  for (const protectedFile of PROTECTED_FILES) {
    if (lower.includes(protectedFile.toLowerCase())) {
      warnings.push({
        type: 'PROTECTED_FILE',
        message: `Prompt mentions ${protectedFile}. This file should not be auto-modified.`,
        severity: 'high'
      });
    }
  }

  if (!ACTIONABLE_WORDS.some(word => lower.includes(word))) {
    warnings.push({
      type: 'VAGUE_PROMPT',
      message: 'Prompt lacks clear action verbs. Codex may produce unfocused output.',
      severity: 'low'
    });
  }

  if (lower.includes('refactor') && !lower.includes('test')) {
    warnings.push({
      type: 'UNTESTED_REFACTOR',
      message: 'Large refactor requested without test instructions. Risk of regressions.',
      severity: 'medium'
    });
  }

  for (const indicator of BREAKING_INDICATORS) {
    if (lower.includes(indicator)) {
      warnings.push({
        type: 'BREAKING_CHANGE',
        message: `Prompt suggests a breaking change (${indicator}). Consider backward compatibility.`,
        severity: 'high'
      });
    }
  }

  return warnings;
}

function extractFileMentions(text) {
  const mentions = new Set();
  const quoted = String(text || '').matchAll(/["']([\w./-]+\.(?:js|ts|tsx|json|md))["']/g);
  for (const match of quoted) mentions.add(match[1]);

  const bare = String(text || '').matchAll(/\b([\w./-]+\.(?:js|ts|tsx|json|md))\b/g);
  for (const match of bare) mentions.add(match[1]);
  return [...mentions].filter(file => !file.startsWith('http'));
}

function hasHighSeverityWarnings(warnings) {
  return warnings.some(warning => warning.severity === 'high');
}

module.exports = {
  runPreflightCheck,
  extractFileMentions,
  hasHighSeverityWarnings
};

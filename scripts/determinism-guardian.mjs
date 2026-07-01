import {mkdir, readdir, readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const DEFAULT_RENDER_PATHS = [
  "remotion-app/src/compositions/JosephEdit.tsx",
  "remotion-app/src/compositions/VideoPlane.tsx",
  "remotion-app/src/compositions/joseph-render-contract.ts",
  "remotion-app/src/compositions/joseph-default-manifest.ts",
  "remotion-app/src/entries/joseph-entry.tsx",
];

const DEFAULT_VARIATION_PATHS = [
  "backend/src/director/joseph-director.ts",
  "backend/src/director/joseph-background-primitives.ts",
  "backend/src/director/joseph-audio-visual-choreography.ts",
  "backend/src/director/micro-animation-primitives.ts",
  "backend/src/director/variation-key.ts",
  "remotion-app/src/compositions/joseph-render-contract.ts",
  "packages/shared-types/src/seeded-prng.ts",
];

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const FORBIDDEN_RULES = [
  {ruleId: "no-math-random", label: "Math.random()", pattern: /\bMath\.random\s*\(/g},
  {ruleId: "no-date-now", label: "Date.now()", pattern: /\bDate\.now\s*\(/g},
  {ruleId: "no-performance-now", label: "performance.now()", pattern: /\bperformance\.now\s*\(/g},
  {ruleId: "no-request-animation-frame", label: "requestAnimationFrame()", pattern: /\b(?:window\.)?requestAnimationFrame\s*\(/g},
  {ruleId: "no-set-interval", label: "setInterval()", pattern: /\b(?:window\.)?setInterval\s*\(/g},
  {ruleId: "no-set-timeout", label: "setTimeout()", pattern: /\b(?:window\.)?setTimeout\s*\(/g},
  {ruleId: "no-crypto-get-random-values", label: "crypto.getRandomValues()", pattern: /\bcrypto\.getRandomValues\s*\(/g},
  {ruleId: "no-new-date", label: "new Date()", pattern: /\bnew\s+Date\s*\(/g},
  {ruleId: "no-gsap-runtime", label: "GSAP runtime", pattern: /\b(?:import\s+.*?from\s+['"]gsap['"]|gsap\.)/g},
];

const SEEDED_PATTERNS = [
  /\bseededRandom\s*\(/g,
  /\bseededPick\s*\(/g,
  /\bseededChance\s*\(/g,
  /\bseededInt\s*\(/g,
  /\bseededFloat\s*\(/g,
  /\bhashSeed\s*\(/g,
];

const toPortablePath = (value) => value.replace(/\\/g, "/");

const lineAndColumnFor = (content, index) => {
  const before = content.slice(0, index);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
};

const maskComments = (content) => {
  let masked = "";
  let state = "code";
  let quote = "";
  let escaped = false;

  const maskChar = (char) => char === "\r" || char === "\n" ? char : " ";

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (state === "line-comment") {
      if (char === "\r" || char === "\n") {
        state = "code";
        masked += char;
      } else {
        masked += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      masked += maskChar(char);
      if (char === "*" && next === "/") {
        index += 1;
        masked += " ";
        state = "code";
      }
      continue;
    }

    if (state === "string") {
      masked += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        state = "code";
        quote = "";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      masked += "  ";
      index += 1;
      state = "line-comment";
      continue;
    }

    if (char === "/" && next === "*") {
      masked += "  ";
      index += 1;
      state = "block-comment";
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      state = "string";
      quote = char;
      escaped = false;
    }

    masked += char;
  }

  return masked;
};

const collectFiles = async (targetPath) => {
  const stats = await stat(targetPath).catch((error) => {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  if (!stats) {
    return [];
  }

  if (stats.isFile()) {
    return SOURCE_EXTENSIONS.has(path.extname(targetPath)) ? [targetPath] : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const files = [];
  const entries = await readdir(targetPath, {withFileTypes: true});

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build" || entry.name === ".next") {
        continue;
      }
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const unique = (items) => [...new Set(items)];

const countMatches = (content, patterns) => {
  let count = 0;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    count += [...content.matchAll(pattern)].length;
  }
  return count;
};

export const runDeterminismGuardianAudit = async ({
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  renderPaths = DEFAULT_RENDER_PATHS.map((relativePath) => path.join(repoRoot, relativePath)),
  variationPaths = DEFAULT_VARIATION_PATHS.map((relativePath) => path.join(repoRoot, relativePath)),
  reportPath = path.join(repoRoot, "artifacts", "determinism-guardian", "determinism-guardian-report.json"),
} = {}) => {
  const resolvedRenderPaths = renderPaths.map((targetPath) => path.resolve(repoRoot, targetPath));
  const resolvedVariationPaths = variationPaths.map((targetPath) => path.resolve(repoRoot, targetPath));
  const renderFiles = unique((await Promise.all(resolvedRenderPaths.map(collectFiles))).flat()).sort();
  const variationFiles = unique((await Promise.all(resolvedVariationPaths.map(collectFiles))).flat()).sort();
  const scannedFiles = unique([...renderFiles, ...variationFiles]).sort();

  const violations = [];
  for (const filePath of renderFiles) {
    const content = await readFile(filePath, "utf8");
    const code = maskComments(content);
    for (const rule of FORBIDDEN_RULES) {
      rule.pattern.lastIndex = 0;
      for (const match of code.matchAll(rule.pattern)) {
        const position = lineAndColumnFor(content, match.index ?? 0);
        violations.push({
          ruleId: rule.ruleId,
          label: rule.label,
          file: toPortablePath(path.relative(repoRoot, filePath)),
          ...position,
          excerpt: match[0],
        });
      }
    }
  }

  const variationSummaries = [];
  let seededUsageCount = 0;
  let unseededRandomCount = 0;
  for (const filePath of variationFiles) {
    const content = await readFile(filePath, "utf8");
    const code = maskComments(content);
    const seededCount = countMatches(code, SEEDED_PATTERNS);
    const randomCount = countMatches(code, [/\bMath\.random\s*\(/g, /\bcrypto\.getRandomValues\s*\(/g]);
    seededUsageCount += seededCount;
    unseededRandomCount += randomCount;
    if (seededCount > 0 || randomCount > 0) {
      variationSummaries.push({
        file: toPortablePath(path.relative(repoRoot, filePath)),
        seededCount,
        unseededRandomCount: randomCount,
      });
    }
  }

  const seededVariation = {
    ok: seededUsageCount > 0 && unseededRandomCount === 0,
    seededUsageCount,
    unseededRandomCount,
    files: variationSummaries,
  };

  const report = {
    schemaVersion: "determinism-guardian-v1",
    generatedAt: new Date().toISOString(),
    pass: violations.length === 0 && seededVariation.ok,
    renderPaths: resolvedRenderPaths.map((targetPath) => toPortablePath(path.relative(repoRoot, targetPath))),
    variationPaths: resolvedVariationPaths.map((targetPath) => toPortablePath(path.relative(repoRoot, targetPath))),
    scannedFiles: scannedFiles.map((filePath) => toPortablePath(path.relative(repoRoot, filePath))),
    violations,
    seededVariation,
  };

  await mkdir(path.dirname(reportPath), {recursive: true});
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const main = async () => {
  const reportPathArg = process.argv.find((arg) => arg.startsWith("--report="));
  const reportPath = reportPathArg ? path.resolve(reportPathArg.slice("--report=".length)) : undefined;
  const report = await runDeterminismGuardianAudit({reportPath});
  const artifactPath = reportPath ?? path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "artifacts", "determinism-guardian", "determinism-guardian-report.json");
  console.log(`${report.pass ? "PASS" : "FAIL"} Determinism Guardian`);
  console.log(`Scanned files: ${report.scannedFiles.length}`);
  console.log(`Forbidden render-path violations: ${report.violations.length}`);
  console.log(`Seeded variation usages: ${report.seededVariation.seededUsageCount}`);
  console.log(`Unseeded variation usages: ${report.seededVariation.unseededRandomCount}`);
  console.log(`Artifact: ${artifactPath}`);
  if (!report.pass) {
    for (const violation of report.violations.slice(0, 20)) {
      console.log(`- ${violation.ruleId} ${violation.file}:${violation.line}:${violation.column} ${violation.excerpt}`);
    }
    process.exit(1);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

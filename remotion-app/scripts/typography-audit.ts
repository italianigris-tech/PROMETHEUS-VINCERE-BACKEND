import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {
  FontCategory,
  FontContextRole,
  FontNode,
  FontQualityFlag,
  FontRoleBand,
  FontSourceType,
  FontUsageLayer,
  FontUsageOccurrence,
  TypographyAuditIssue,
  TypographyAuditReport
} from "../src/lib/cinematic-typography/font-system";

type KnownFontTraits = {
  aliases?: string[];
  category: FontCategory;
  sourceType: FontSourceType;
  weightRange: string;
  limitedWeightRange?: boolean;
  premiumConflict?: boolean;
  motionNoiseRisk?: boolean;
  kerningRisk?: boolean;
  allowedRoleBands: FontRoleBand[];
};

type MutableFontAggregate = {
  id: string;
  name: string;
  normalizedName: string;
  category: FontCategory;
  sourceTypes: Set<FontSourceType>;
  usageCount: number;
  dynamicUseCount: number;
  hardcodedUseCount: number;
  activeRuntimeUseCount: number;
  legacyUseCount: number;
  files: Set<string>;
  stacks: Set<string>;
  contextRoles: Set<FontContextRole>;
  roleBands: Set<FontRoleBand>;
  qualityFlags: Set<FontQualityFlag>;
  qualityNotes: Set<string>;
  weightRange: string;
  allowedRoleBands: FontRoleBand[];
  occurrences: FontUsageOccurrence[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const remotionRoot = path.resolve(__dirname, "..");
const outputJsonPath = path.resolve(remotionRoot, "src/lib/cinematic-typography/typography-audit.generated.json");
const outputMarkdownPath = path.resolve(remotionRoot, "docs/typography-audit.md");

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".svg"]);
const ignoredDirectories = new Set([
  ".git",
  ".cache",
  "coverage",
  "dist",
  "build",
  "out",
  "node_modules"
]);
const ignoredPathFragments = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}docs${path.sep}`,
  `${path.sep}public${path.sep}showcase-assets${path.sep}`,
  `${path.sep}src${path.sep}data${path.sep}`,
  `${path.sep}retrieval-assets${path.sep}`
];

const genericFamilies = new Set([
  "sans-serif",
  "serif",
  "cursive",
  "fantasy",
  "monospace",
  "ui-monospace",
  "ui-sans-serif",
  "system-ui"
]);

const systemFonts = new Set([
  "arial",
  "arial narrow",
  "consolas",
  "cascadia code",
  "georgia",
  "impact",
  "segoe ui",
  "times new roman"
]);

const knownFonts: KnownFontTraits[] = [
  {category: "script", sourceType: "google", weightRange: "400 italic", limitedWeightRange: true, motionNoiseRisk: true, allowedRoleBands: ["accent"] , aliases: ["allura"]},
  {category: "display-sans", sourceType: "google", weightRange: "400", limitedWeightRange: true, premiumConflict: true, allowedRoleBands: ["hero"], aliases: ["anton"]},
  {category: "display-sans", sourceType: "google", weightRange: "400", limitedWeightRange: true, premiumConflict: true, allowedRoleBands: ["hero"], aliases: ["bebas neue"]},
  {category: "display-serif", sourceType: "google", weightRange: "400-900 italic", allowedRoleBands: ["hero", "accent"], aliases: ["bodoni moda"]},
  {category: "mono", sourceType: "system", weightRange: "400-700", allowedRoleBands: ["support"], aliases: ["cascadia code"]},
  {category: "display-serif", sourceType: "google", weightRange: "400-900", allowedRoleBands: ["hero"], aliases: ["cinzel"]},
  {category: "display-serif", sourceType: "google", weightRange: "300-700 italic", allowedRoleBands: ["hero", "body", "accent"], aliases: ["cormorant garamond"]},
  {category: "display-serif", sourceType: "remotion-google", weightRange: "200-900 italic", allowedRoleBands: ["body", "hero"], aliases: ["crimson pro"]},
  {category: "neutral-sans", sourceType: "remotion-google", weightRange: "100-1000 italic", allowedRoleBands: ["support", "body"], aliases: ["dm sans"]},
  {category: "display-serif", sourceType: "google", weightRange: "400", limitedWeightRange: true, allowedRoleBands: ["hero"], aliases: ["dm serif display"]},
  {category: "decorative", sourceType: "local", weightRange: "400", limitedWeightRange: true, motionNoiseRisk: true, allowedRoleBands: ["accent", "hero"], aliases: ["fabringo"]},
  {category: "display-serif", sourceType: "remotion-google", weightRange: "100-900 italic", allowedRoleBands: ["hero", "body"], aliases: ["fraunces"]},
  {category: "decorative", sourceType: "local", weightRange: "700", limitedWeightRange: true, allowedRoleBands: ["hero"], aliases: ["freight pro"]},
  {category: "display-serif", sourceType: "system", weightRange: "400-700", premiumConflict: true, allowedRoleBands: ["body"], aliases: ["georgia"]},
  {category: "script", sourceType: "google", weightRange: "400", limitedWeightRange: true, motionNoiseRisk: true, allowedRoleBands: ["accent"], aliases: ["great vibes"]},
  {category: "display-sans", sourceType: "system", weightRange: "400", limitedWeightRange: true, premiumConflict: true, allowedRoleBands: ["hero"], aliases: ["impact"]},
  {category: "display-serif", sourceType: "remotion-google", weightRange: "400", limitedWeightRange: true, allowedRoleBands: ["hero", "accent"], aliases: ["instrument serif"]},
  {category: "display-sans", sourceType: "google", weightRange: "400", limitedWeightRange: true, premiumConflict: true, kerningRisk: true, allowedRoleBands: ["hero"], aliases: ["league gothic"]},
  {category: "display-serif", sourceType: "remotion-google", weightRange: "400-700 italic", allowedRoleBands: ["body", "hero"], aliases: ["lora"]},
  {category: "neutral-sans", sourceType: "google", weightRange: "200-800", allowedRoleBands: ["support", "body"], aliases: ["manrope"]},
  {category: "display-serif", sourceType: "remotion-google", weightRange: "100-900", allowedRoleBands: ["hero"], aliases: ["noto serif display"]},
  {category: "display-sans", sourceType: "google", weightRange: "200-700", premiumConflict: true, allowedRoleBands: ["hero"], aliases: ["oswald"]},
  {category: "display-serif", sourceType: "remotion-google", weightRange: "400-900 italic", allowedRoleBands: ["hero"], aliases: ["playfair display"]},
  {category: "neutral-sans", sourceType: "system", weightRange: "400-700", allowedRoleBands: ["support", "body"], aliases: ["segoe ui"]},
  {category: "decorative", sourceType: "local", weightRange: "400", limitedWeightRange: true, motionNoiseRisk: true, allowedRoleBands: ["accent", "hero"], aliases: ["saint monica"]},
  {category: "display-sans", sourceType: "google", weightRange: "300-700", limitedWeightRange: true, premiumConflict: true, kerningRisk: true, allowedRoleBands: ["hero"], aliases: ["teko"]},
  {category: "display-serif", sourceType: "system", weightRange: "400-700 italic", allowedRoleBands: ["body"], aliases: ["times new roman"]},
  {category: "display-serif", sourceType: "local", weightRange: "400-900 italic", allowedRoleBands: ["hero"], aliases: ["blacker pro"]},
  {category: "display-serif", sourceType: "local", weightRange: "400-700", allowedRoleBands: ["hero"], aliases: ["avelia serif"]},
  {category: "neutral-sans", sourceType: "system", weightRange: "400-700", premiumConflict: true, allowedRoleBands: ["support"], aliases: ["arial narrow", "arial"]}
];

const knownFontMap = new Map<string, KnownFontTraits>();
for (const traits of knownFonts) {
  for (const alias of traits.aliases ?? []) {
    knownFontMap.set(alias, traits);
  }
}

const lineValuePatterns = [
  /(?:font|display|support|italic|descriptor)[A-Za-z-]*Family\s*:\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g,
  /font-family\s*:\s*([^;]+)(?:;|$)/gi,
  /font-family\s*=\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/gi
];

const literalIgnoreSet = new Set(["font-family", "fontfamily"]);

const normalizePath = (value: string): string => value.split(path.sep).join("/");

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeFontName = (value: string): string =>
  value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const isIgnoredPath = (absolutePath: string): boolean =>
  ignoredPathFragments.some((fragment) => absolutePath.includes(fragment));

const isDuplicateCompiledFile = async (absolutePath: string): Promise<boolean> => {
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== ".js" && ext !== ".jsx") {
    return false;
  }

  const tsPeer = absolutePath.slice(0, -ext.length) + ".ts";
  const tsxPeer = absolutePath.slice(0, -ext.length) + ".tsx";

  try {
    await readFile(tsPeer, "utf8");
    return true;
  } catch {
    // no-op
  }

  try {
    await readFile(tsxPeer, "utf8");
    return true;
  } catch {
    return false;
  }
};

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, {withFileTypes: true});
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      files.push(...await listFiles(path.join(directory, entry.name)));
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (isIgnoredPath(absolutePath)) {
      continue;
    }
    if (!allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    if (await isDuplicateCompiledFile(absolutePath)) {
      continue;
    }
    files.push(absolutePath);
  }

  return files;
};

const unescapeLiteral = (value: string): string => {
  const trimmed = value.trim();
  const hasMatchingWrapper =
    trimmed.length >= 2 &&
    ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith("`") && trimmed.endsWith("`")));
  const withoutWrapper = hasMatchingWrapper ? trimmed.slice(1, -1) : trimmed;
  return withoutWrapper
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .replace(/\\`/g, "`")
    .replace(/\\\\/g, "\\");
};

const extractFontNamesFromStack = (stackExpression: string): string[] => {
  const normalizedExpression = unescapeLiteral(stackExpression);
  const quotedMatches = Array.from(normalizedExpression.matchAll(/"([^"]+)"|'([^']+)'/g))
    .map((match) => (match[1] ?? match[2] ?? "").trim())
    .filter(Boolean);

  const rawTokens = quotedMatches.length > 0
    ? quotedMatches
    : normalizedExpression
        .replace(/var\(([^)]+)\)/g, (_match, content: string) => {
          const fallback = content.split(",").slice(1).join(",");
          return fallback || "";
        })
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);

  return rawTokens
    .map((token) => token.replace(/^["'`]+|["'`]+$/g, "").trim())
    .filter((token) => {
      const normalized = normalizeFontName(token);
      return normalized.length > 0 &&
        !genericFamilies.has(normalized) &&
        !normalized.startsWith("var(") &&
        !normalized.startsWith("--") &&
        !literalIgnoreSet.has(normalized);
    });
};

const inferUsageLayer = (relativePath: string): FontUsageLayer => {
  if (relativePath.includes("/src/components/")) {
    return "component";
  }
  if (relativePath.includes("/src/web-preview/")) {
    return "frontend-ui";
  }
  if (relativePath.includes("/src/lib/stylebooks/") || relativePath.includes("/src/lib/presets/")) {
    return "stylebook";
  }
  if (relativePath.includes("/src/lib/") || relativePath.includes("/src/creative-orchestration/")) {
    return "rendering";
  }
  if (relativePath.includes("/public/motion-assets/")) {
    return "animation-text-layer";
  }
  if (relativePath.includes("/js/text/") || relativePath.includes("/js/demo/") || relativePath.includes("/css/")) {
    return "template-system";
  }
  if (relativePath.includes("debug")) {
    return "debug";
  }
  return "unknown";
};

const inferContextRole = (relativePath: string, rawLine: string): FontContextRole => {
  const haystack = `${relativePath} ${rawLine}`.toLowerCase();

  if (/mono|debug|console|terminal/.test(haystack)) {
    return "mono";
  }
  if (/ui|panel|preview|button|label/.test(haystack)) {
    return "ui";
  }
  if (/quote/.test(haystack)) {
    return "quote";
  }
  if (/subtitle|caption|word-by-word|sidecall|docked-inverse/.test(haystack)) {
    return /subtitle/.test(haystack) ? "subtitle" : "caption";
  }
  if (/support|descriptor|helper|subline|utility/.test(haystack)) {
    return "support";
  }
  if (/accent|italic|script|keyword|emphasis/.test(haystack)) {
    return "accent";
  }
  if (/hero|headline|hook|title|transition-card|cta|statement|display/.test(haystack)) {
    return /headline/.test(haystack) ? "headline" : "hero";
  }
  return "unknown";
};

const toRoleBand = (contextRole: FontContextRole): FontRoleBand => {
  if (contextRole === "hero" || contextRole === "headline") {
    return "hero";
  }
  if (contextRole === "support" || contextRole === "ui" || contextRole === "mono") {
    return "support";
  }
  if (contextRole === "subtitle" || contextRole === "caption" || contextRole === "quote") {
    return "body";
  }
  if (contextRole === "accent") {
    return "accent";
  }
  return "unknown";
};

const inferDynamicChoice = (relativePath: string, rawLine: string): boolean => {
  const haystack = `${relativePath} ${rawLine}`;
  return /var\(|editorialDecision|fontPalette|getEditorialFontPalette|FONT_FAMILIES|FONT_CATEGORIES|typographyPresets|caption-editorial-engine|editorial-fonts|selector|text-typography-presets|font-catalog/i.test(
    haystack
  );
};

const inferActiveRuntime = (relativePath: string): boolean =>
  relativePath.startsWith("remotion-app/src/") ||
  relativePath.startsWith("remotion-app/scripts/") ||
  relativePath.startsWith("remotion-app/public/motion-assets/");

const inferFontTraits = (fontName: string): KnownFontTraits => {
  const normalized = normalizeFontName(fontName);
  const known = knownFontMap.get(normalized);
  if (known) {
    return known;
  }

  if (normalized.includes("mono") || normalized.includes("code")) {
    return {
      category: "mono",
      sourceType: "system",
      weightRange: "unknown",
      allowedRoleBands: ["support"]
    };
  }

  if (normalized.includes("script") || normalized.includes("vibes") || normalized.includes("allura")) {
    return {
      category: "script",
      sourceType: "unknown",
      weightRange: "unknown",
      limitedWeightRange: true,
      motionNoiseRisk: true,
      allowedRoleBands: ["accent"]
    };
  }

  if (normalized.includes("sans") || normalized.includes("gothic")) {
    return {
      category: normalized.includes("dm sans") || normalized.includes("manrope") ? "neutral-sans" : "display-sans",
      sourceType: systemFonts.has(normalized) ? "system" : "unknown",
      weightRange: "unknown",
      allowedRoleBands: normalized.includes("dm sans") || normalized.includes("manrope") ? ["support", "body"] : ["hero"]
    };
  }

  return {
    category: "display-serif",
    sourceType: systemFonts.has(normalized) ? "system" : "unknown",
    weightRange: "unknown",
    allowedRoleBands: ["hero", "body"]
  };
};

const createAggregate = (fontName: string): MutableFontAggregate => {
  const traits = inferFontTraits(fontName);
  return {
    id: slugify(fontName),
    name: fontName,
    normalizedName: normalizeFontName(fontName),
    category: traits.category,
    sourceTypes: new Set([traits.sourceType]),
    usageCount: 0,
    dynamicUseCount: 0,
    hardcodedUseCount: 0,
    activeRuntimeUseCount: 0,
    legacyUseCount: 0,
    files: new Set<string>(),
    stacks: new Set<string>(),
    contextRoles: new Set<FontContextRole>(),
    roleBands: new Set<FontRoleBand>(),
    qualityFlags: new Set<FontQualityFlag>(),
    qualityNotes: new Set<string>(),
    weightRange: traits.weightRange,
    allowedRoleBands: traits.allowedRoleBands,
    occurrences: []
  };
};

const addQualityFlags = (aggregate: MutableFontAggregate): void => {
  const traits = inferFontTraits(aggregate.name);
  const usesBody = aggregate.roleBands.has("body");
  const usesHero = aggregate.roleBands.has("hero");
  const usesAccent = aggregate.roleBands.has("accent");

  if (traits.limitedWeightRange) {
    aggregate.qualityFlags.add("limited-weight-range");
    aggregate.qualityNotes.add("Weight range is narrow or single-style, so this font should not be expected to cover multiple hierarchy levels.");
  }

  if (traits.motionNoiseRisk && (aggregate.usageCount > 1 || usesBody || usesHero)) {
    aggregate.qualityFlags.add("motion-noise-risk");
    aggregate.qualityNotes.add("This font is risky in animated text because fine detail or script motion can turn noisy quickly.");
  }

  if (traits.premiumConflict && usesHero) {
    aggregate.qualityFlags.add("premium-conflict");
    aggregate.qualityNotes.add("This font can flatten the premium/editorial aesthetic when promoted into the main hero role.");
  }

  if ((aggregate.category === "script" || aggregate.category === "decorative" || aggregate.category === "display-sans") && usesBody) {
    aggregate.qualityFlags.add("readability-risk");
    aggregate.qualityNotes.add("This font is showing up in body-like contexts where readability and pacing should dominate personality.");
  }

  if (traits.kerningRisk && aggregate.usageCount >= 2) {
    aggregate.qualityFlags.add("kerning-risk");
    aggregate.qualityNotes.add("Condensed display usage suggests we should visually inspect spacing and rhythm before keeping it in a premium system.");
  }

  if (aggregate.usageCount >= 10) {
    aggregate.qualityFlags.add("overused");
    aggregate.qualityNotes.add("This font appears often enough to dominate the system and should be justified by a strict role, not convenience.");
  }

  if (aggregate.roleBands.size >= 3 || (usesBody && usesHero && usesAccent)) {
    aggregate.qualityFlags.add("role-bleed");
    aggregate.qualityNotes.add("This font is spanning too many rhetorical roles, which weakens hierarchy discipline.");
  }
};

const scanFile = async (absolutePath: string): Promise<FontUsageOccurrence[]> => {
  const relativePath = normalizePath(path.relative(repoRoot, absolutePath));
  const contents = await readFile(absolutePath, "utf8");
  const lines = contents.split(/\r?\n/);
  const occurrences: FontUsageOccurrence[] = [];

  lines.forEach((line, lineIndex) => {
    const matches = new Set<string>();
    for (const pattern of lineValuePatterns) {
      let match: RegExpExecArray | null = pattern.exec(line);
      while (match) {
        matches.add(match[1] ?? "");
        match = pattern.exec(line);
      }
      pattern.lastIndex = 0;
    }

    for (const stackExpression of matches) {
      const fontNames = extractFontNamesFromStack(stackExpression);
      if (fontNames.length === 0) {
        continue;
      }

      const contextRole = inferContextRole(relativePath, line);
      const roleBand = toRoleBand(contextRole);
      const usageLayer = inferUsageLayer(relativePath);
      const dynamicChoice = inferDynamicChoice(relativePath, line);
      const activeRuntime = inferActiveRuntime(relativePath);

      for (const fontName of fontNames) {
        occurrences.push({
          filePath: relativePath,
          line: lineIndex + 1,
          stack: unescapeLiteral(stackExpression),
          fontToken: fontName,
          contextRole,
          roleBand,
          usageLayer,
          dynamicChoice,
          activeRuntime,
          rawLine: line.trim()
        });
      }
    }
  });

  return occurrences;
};

const buildIssues = (fontNodes: FontNode[], summary: TypographyAuditReport["summary"]): TypographyAuditIssue[] => {
  const issues: TypographyAuditIssue[] = [];

  const displaySansNodes = fontNodes.filter((node) => node.category === "display-sans");
  if (displaySansNodes.length >= 5) {
    issues.push({
      id: "display-sans-overlap",
      severity: "high",
      title: "Too many condensed display sans fonts are competing for the same job",
      summary: "The audit found several tall, forceful sans faces occupying the same hero/headline territory. This is classic role duplication and will make the system feel random unless we retire most of them.",
      fontNames: displaySansNodes.map((node) => node.name)
    });
  }

  const scriptNodes = fontNodes.filter((node) => node.category === "script");
  if (scriptNodes.length >= 2) {
    issues.push({
      id: "script-overlap",
      severity: "medium",
      title: "Accent script territory is duplicated",
      summary: "Multiple script fonts are present, but script should be a rare accent role. Without strict limits, this becomes faux-luxury very quickly in motion.",
      fontNames: scriptNodes.map((node) => node.name)
    });
  }

  const hardcodedNodes = fontNodes.filter((node) => node.hardcodedUseCount >= 3 && node.activeRuntimeUseCount >= 1);
  if (hardcodedNodes.length > 0) {
    issues.push({
      id: "hardcoded-escape-hatches",
      severity: "high",
      title: "Hardcoded font choices are bypassing the backend typography policy",
      summary: "Several active runtime components still embed explicit font stacks instead of routing through a single governed font system. That makes consistency impossible even with better taste rules.",
      fontNames: hardcodedNodes.map((node) => node.name)
    });
  }

  const overusedNodes = fontNodes.filter((node) => node.qualityFlags.includes("overused"));
  if (overusedNodes.length > 0) {
    issues.push({
      id: "overused-fonts",
      severity: "high",
      title: "A few fonts are carrying too many roles by repetition alone",
      summary: "The frequency pattern suggests convenience-driven reuse rather than deliberate hierarchy. That is the exact expression-over-structure trap we want to avoid.",
      fontNames: overusedNodes.map((node) => node.name)
    });
  }

  if (summary.legacyOccurrenceCount > 0 && summary.activeRuntimeOccurrenceCount > 0) {
    issues.push({
      id: "legacy-active-drift",
      severity: "high",
      title: "Legacy and active typography systems are drifting apart",
      summary: "The repo still contains a strong legacy preset layer alongside the newer editorial selector. Until they share one governed font graph, Prometheus will keep producing split-brain typography.",
      fontNames: []
    });
  }

  return issues;
};

const buildMissingCategories = (fontNodes: FontNode[]): string[] => {
  const presentCategories = new Set(fontNodes.map((node) => node.category));
  return ["display-serif", "display-sans", "script", "neutral-sans", "mono", "decorative"].filter(
    (category) => !presentCategories.has(category as FontCategory)
  );
};

const buildGovernanceGaps = (fontNodes: FontNode[]): string[] => {
  const governanceGaps: string[] = [];
  const neutralSansNodes = fontNodes.filter((node) => node.category === "neutral-sans");
  if (neutralSansNodes.length > 1) {
    governanceGaps.push(
      "neutral_sans exists, but it is not singular. DM Sans is still competing with Segoe UI and Arial Narrow in parts of the stack, so the missing piece is restriction, not discovery."
    );
  }

  const heroDisplayNodes = fontNodes.filter((node) => node.roleBands.includes("hero"));
  if (heroDisplayNodes.length > 6) {
    governanceGaps.push(
      "hero typography is overcrowded. The system needs 2-3 elite hero faces, not a broad shelf of equally expressive options."
    );
  }

  const accentNodes = fontNodes.filter((node) => node.roleBands.includes("accent"));
  if (accentNodes.length > 3) {
    governanceGaps.push(
      "accent usage is too open-ended. Script and decorative faces should be tightly quarantined to rare rhetorical moments."
    );
  }

  return governanceGaps;
};

const buildRemovalRecommendations = (fontNodes: FontNode[]): string[] => {
  const recommendations: string[] = [];
  const candidateNames = [
    "Bebas Neue",
    "Anton",
    "League Gothic",
    "Oswald",
    "Teko",
    "Great Vibes",
    "Arial Narrow"
  ];

  for (const candidateName of candidateNames) {
    const node = fontNodes.find((entry) => entry.name === candidateName);
    if (!node) {
      continue;
    }
    if (node.qualityFlags.includes("overused") || node.qualityFlags.includes("premium-conflict") || node.qualityFlags.includes("readability-risk")) {
      recommendations.push(candidateName);
    }
  }

  return recommendations;
};

const toFontNode = (aggregate: MutableFontAggregate): FontNode => ({
  id: aggregate.id,
  name: aggregate.name,
  normalizedName: aggregate.normalizedName,
  category: aggregate.category,
  sourceTypes: Array.from(aggregate.sourceTypes).sort(),
  usageCount: aggregate.usageCount,
  dynamicUseCount: aggregate.dynamicUseCount,
  hardcodedUseCount: aggregate.hardcodedUseCount,
  activeRuntimeUseCount: aggregate.activeRuntimeUseCount,
  legacyUseCount: aggregate.legacyUseCount,
  files: Array.from(aggregate.files).sort(),
  stacks: Array.from(aggregate.stacks).sort(),
  contextRoles: Array.from(aggregate.contextRoles).sort(),
  roleBands: Array.from(aggregate.roleBands).sort(),
  qualityFlags: Array.from(aggregate.qualityFlags).sort(),
  qualityNotes: Array.from(aggregate.qualityNotes),
  weightRange: aggregate.weightRange,
  allowedRoleBands: aggregate.allowedRoleBands,
  occurrences: aggregate.occurrences.sort((left, right) => {
    if (left.filePath !== right.filePath) {
      return left.filePath.localeCompare(right.filePath);
    }
    return left.line - right.line;
  })
});

const renderMarkdownReport = (report: TypographyAuditReport): string => {
  const inventoryLines = report.fontNodes
    .map((node) => `| ${node.name} | ${node.category} | ${node.usageCount} | ${node.roleBands.join(", ") || "unknown"} | ${node.qualityFlags.join(", ") || "none"} |`)
    .join("\n");

  const issueLines = report.issues.length === 0
    ? "- No systemic issues were auto-flagged."
    : report.issues
        .map((issue) => `- [${issue.severity}] ${issue.title}: ${issue.summary}${issue.fontNames.length > 0 ? ` Fonts: ${issue.fontNames.join(", ")}.` : ""}`)
        .join("\n");

  const governanceLines = report.governanceGaps.length === 0
    ? "- None."
    : report.governanceGaps.map((gap) => `- ${gap}`).join("\n");

  const removalLines = report.removalRecommendations.length === 0
    ? "- None auto-flagged."
    : report.removalRecommendations.map((name) => `- ${name}`).join("\n");

  const missingCategoryLines = report.missingCategories.length === 0
    ? "- No outright category gaps were found."
    : report.missingCategories.map((category) => `- ${category}`).join("\n");

  return `# Typography Audit

Generated: ${report.generatedAt}

## Summary

- Files scanned: ${report.summary.filesScanned}
- Font occurrences: ${report.summary.fontOccurrenceCount}
- Unique fonts: ${report.summary.uniqueFontCount}
- Dynamic occurrences: ${report.summary.dynamicOccurrenceCount}
- Hardcoded occurrences: ${report.summary.hardcodedOccurrenceCount}
- Active runtime occurrences: ${report.summary.activeRuntimeOccurrenceCount}
- Legacy occurrences: ${report.summary.legacyOccurrenceCount}

## Issues

${issueLines}

## Missing Categories

${missingCategoryLines}

## Governance Gaps

${governanceLines}

## Removal Recommendations

${removalLines}

## Font Inventory

| Font | Category | Uses | Role Bands | Flags |
| --- | --- | ---: | --- | --- |
${inventoryLines}
`;
};

const run = async (): Promise<void> => {
  const files = await listFiles(repoRoot);
  const occurrences = (await Promise.all(files.map((filePath) => scanFile(filePath)))).flat();

  const fonts = new Map<string, MutableFontAggregate>();
  for (const occurrence of occurrences) {
    const normalizedName = normalizeFontName(occurrence.fontToken);
    if (!normalizedName) {
      continue;
    }

    const existing = fonts.get(normalizedName) ?? createAggregate(occurrence.fontToken);
    existing.usageCount += 1;
    existing.files.add(occurrence.filePath);
    existing.stacks.add(occurrence.stack);
    existing.contextRoles.add(occurrence.contextRole);
    existing.roleBands.add(occurrence.roleBand);
    existing.occurrences.push(occurrence);

    const traits = inferFontTraits(existing.name);
    existing.sourceTypes.add(traits.sourceType);
    if (occurrence.dynamicChoice) {
      existing.dynamicUseCount += 1;
    } else {
      existing.hardcodedUseCount += 1;
    }
    if (occurrence.activeRuntime) {
      existing.activeRuntimeUseCount += 1;
    } else {
      existing.legacyUseCount += 1;
    }

    fonts.set(normalizedName, existing);
  }

  const fontNodes = Array.from(fonts.values())
    .map((aggregate) => {
      addQualityFlags(aggregate);
      return toFontNode(aggregate);
    })
    .sort((left, right) => right.usageCount - left.usageCount || left.name.localeCompare(right.name));

  const report: TypographyAuditReport = {
    generatedAt: new Date().toISOString(),
    repoRoot: normalizePath(repoRoot),
    summary: {
      filesScanned: files.length,
      fontOccurrenceCount: occurrences.length,
      uniqueFontCount: fontNodes.length,
      dynamicOccurrenceCount: fontNodes.reduce((total, node) => total + node.dynamicUseCount, 0),
      hardcodedOccurrenceCount: fontNodes.reduce((total, node) => total + node.hardcodedUseCount, 0),
      activeRuntimeOccurrenceCount: fontNodes.reduce((total, node) => total + node.activeRuntimeUseCount, 0),
      legacyOccurrenceCount: fontNodes.reduce((total, node) => total + node.legacyUseCount, 0)
    },
    fontNodes,
    issues: [],
    missingCategories: [],
    governanceGaps: [],
    removalRecommendations: [],
    categoryMap: {
      "display-serif": fontNodes.filter((node) => node.category === "display-serif").map((node) => node.name),
      "display-sans": fontNodes.filter((node) => node.category === "display-sans").map((node) => node.name),
      script: fontNodes.filter((node) => node.category === "script").map((node) => node.name),
      "neutral-sans": fontNodes.filter((node) => node.category === "neutral-sans").map((node) => node.name),
      mono: fontNodes.filter((node) => node.category === "mono").map((node) => node.name),
      decorative: fontNodes.filter((node) => node.category === "decorative").map((node) => node.name)
    }
  };

  report.issues = buildIssues(report.fontNodes, report.summary);
  report.missingCategories = buildMissingCategories(report.fontNodes);
  report.governanceGaps = buildGovernanceGaps(report.fontNodes);
  report.removalRecommendations = buildRemovalRecommendations(report.fontNodes);

  await mkdir(path.dirname(outputJsonPath), {recursive: true});
  await mkdir(path.dirname(outputMarkdownPath), {recursive: true});
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMarkdownPath, `${renderMarkdownReport(report)}\n`, "utf8");

  console.log(`Typography audit written to: ${normalizePath(path.relative(repoRoot, outputJsonPath))}`);
  console.log(`Typography report written to: ${normalizePath(path.relative(repoRoot, outputMarkdownPath))}`);
  console.log(`Files scanned: ${report.summary.filesScanned}`);
  console.log(`Font occurrences: ${report.summary.fontOccurrenceCount}`);
  console.log(`Unique fonts: ${report.summary.uniqueFontCount}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

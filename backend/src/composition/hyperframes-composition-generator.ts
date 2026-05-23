import path from "node:path";
import {fileURLToPath} from "node:url";
import {access, copyFile, mkdir, writeFile} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";

import {
  creativeDecisionManifestSchema,
  type CreativeDecisionManifest
} from "../contracts/creative-decision-manifest";
import {
  type RenderFeatureActivation,
  type RenderStyleAuthority
} from "../contracts/render-diagnostics";

type PremiumMotionPreset = "softSlideLeft" | "softSlideRight" | "arcRise" | "dropSettle" | "whipIn";
type PremiumAppliedStyle = "aggressive-high-contrast" | "cinematic-premium" | "modern-authority" | "luxury-cinematic";

export type HyperFramesCompositionOutput = {
  compositionDir: string;
  indexHtmlPath: string;
  assets: {
    fontsDir: string;
    videoDir: string;
    imagesDir: string;
  };
  renderCommand: string;
  diagnosticsPath: string;
  manifestPath: string;
  compositionGenerationTimeMs: number;
  diagnostics: {
    fontProof: {
      fontsRequestedFromManifest: string[];
      fontFilesResolved: string[];
      fontFilesLoadedIntoComposition: string[];
      fontCssGenerated: boolean;
      fallbackFontsUsed: string[];
      fallbackReasons: string[];
    };
    animationProof: {
      animationRequestedFromManifest: string | null;
      animationRetrievedFromMilvus: boolean;
      retrievedAnimationId: string | null;
      gsapTimelineGenerated: boolean;
      fallbackAnimationUsed: boolean;
      fallbackReasons: string[];
    };
    features: {
      gsap: RenderFeatureActivation;
      kineticTypography: RenderFeatureActivation;
      fonts: RenderFeatureActivation;
    };
    styleAuthority: RenderStyleAuthority;
  };
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const escapeJs = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const escapeCssString = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const sanitizeFileName = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.length > 0 ? normalized : "asset";
};

const isRemoteReference = (value: string): boolean => /^https?:\/\//i.test(value);

const isFileUrlReference = (value: string): boolean => /^file:\/\//i.test(value);

const normalizeCoreWord = (value: string): string =>
  value.trim().toLowerCase().replace(/^[^a-z0-9$]+|[^a-z0-9:%.]+$/gi, "");

const looksImportant = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return /\d/.test(normalized) ||
    /[$€£¥%]/.test(normalized) ||
    /^\d{1,2}:\d{2}$/.test(normalized) ||
    /^(am|pm)$/i.test(normalized);
};

const resolveLocalAssetCandidates = (relativePath: string): string[] => {
  const moduleRoot = fileURLToPath(new URL("../../..", import.meta.url));
  return [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), "..", relativePath),
    path.resolve(moduleRoot, relativePath)
  ];
};

const copyLocalAsset = async ({
  sourcePath,
  targetDir
}: {
  sourcePath: string;
  targetDir: string;
}): Promise<string> => {
  const fileName = sanitizeFileName(path.basename(sourcePath));
  const targetPath = path.join(targetDir, fileName);
  await copyFile(sourcePath, targetPath);
  return targetPath;
};

const prepareFontAsset = async ({
  candidate,
  fontsDir
}: {
  candidate: string;
  fontsDir: string;
}): Promise<{
  requestedPath: string;
  browserUrl: string | null;
  copiedPath: string | null;
}> => {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return {
      requestedPath: "",
      browserUrl: null,
      copiedPath: null
    };
  }

  if (isRemoteReference(trimmed)) {
    return {
      requestedPath: trimmed,
      browserUrl: trimmed,
      copiedPath: null
    };
  }

  if (isFileUrlReference(trimmed)) {
    throw new Error("HyperFrames typography manifest must not use file:/// URLs.");
  }

  const localPath = path.resolve(trimmed);
  if (!(await fileExists(localPath))) {
    return {
      requestedPath: trimmed,
      browserUrl: null,
      copiedPath: null
    };
  }

  const copiedPath = await copyLocalAsset({
    sourcePath: localPath,
    targetDir: fontsDir
  });

  return {
    requestedPath: trimmed,
    browserUrl: `assets/fonts/${sanitizeFileName(path.basename(copiedPath))}`,
    copiedPath
  };
};

const resolveGsapVendorSource = async (): Promise<string | null> => {
  const candidates = resolveLocalAssetCandidates("remotion-app/public/motion-assets/vendor/gsap.min.js");
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
};

const resolveEngineAssetSource = async (relativePath: string): Promise<string | null> => {
  const candidates = resolveLocalAssetCandidates(relativePath);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
};

const buildTimedLineWords = (
  manifest: CreativeDecisionManifest
): Array<{
  text: string;
  startMs: number;
  endMs: number;
  emphasis: boolean;
}[]> | null => {
  const words = manifest.source.transcriptSegment.words ?? [];
  const lines = manifest.typography.linePlan.lines;
  if (words.length === 0 || lines.length === 0) {
    return null;
  }

  const counts = lines.map((line) =>
    line
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean).length
  );
  const totalCount = counts.reduce((sum, count) => sum + count, 0);
  if (totalCount !== words.length) {
    return null;
  }

  const coreWords = new Set(manifest.typography.coreWords.map((entry) => normalizeCoreWord(entry.word)));
  let cursor = 0;
  return counts.map((count) => {
    const slice = words.slice(cursor, cursor + count);
    cursor += count;
    return slice.map((word) => ({
      text: word.text,
      startMs: word.startMs,
      endMs: word.endMs,
      emphasis: coreWords.has(normalizeCoreWord(word.text)) || looksImportant(word.text)
    }));
  });
};

const buildFeatureActivation = (input: {
  requested: boolean;
  activated: boolean;
  fallbackReason?: string;
  artifactPath?: string;
  evidence?: string[];
}): RenderFeatureActivation => {
  const fallbackUsed = input.requested && !input.activated;
  return {
    requested: input.requested,
    activated: input.activated,
    fallbackUsed,
    fallbackReason: fallbackUsed ? input.fallbackReason : undefined,
    artifactPath: input.artifactPath,
    evidence: input.evidence ?? []
  };
};

const computeSpeechRateEstimate = (manifest: CreativeDecisionManifest): number | null => {
  const explicitRate = manifest.style?.speechRateEstimate;
  if (typeof explicitRate === "number" && Number.isFinite(explicitRate) && explicitRate > 0) {
    return explicitRate;
  }

  const words = manifest.source.transcriptSegment.words ?? [];
  if (words.length === 0) {
    return null;
  }

  const durationSec = Math.max(0.6, (manifest.source.transcriptSegment.endMs - manifest.source.transcriptSegment.startMs) / 1000);
  return Number((words.length / durationSec).toFixed(2));
};

const deriveRequestedStyle = (manifest: CreativeDecisionManifest): string => {
  const requestedStyle = manifest.style?.requestedStyle?.trim();
  if (requestedStyle) {
    return requestedStyle;
  }

  const motionTier = manifest.style?.motionTier?.trim();
  if (motionTier) {
    return motionTier;
  }

  if (manifest.intent.emotionalTone === "luxury") {
    return "luxury-cinematic";
  }

  if (manifest.intent.emotionalTone === "cinematic" || manifest.intent.rhetoricalIntent === "premium_explain") {
    return "cinematic-premium-clean";
  }

  return "modern-authority";
};

const resolvePremiumMotionPlan = (manifest: CreativeDecisionManifest): {
  requestedStyle: string;
  appliedStyle: PremiumAppliedStyle;
  motionPreset: PremiumMotionPreset;
  baseDurationSec: number;
  staggerSec: number;
  speedMultiplier: number;
  lineFromRule: "left" | "right" | "top" | "bottom" | "diag-left" | "diag-right";
  wordFromRule: "left" | "right" | "top" | "bottom" | "diag-left" | "diag-right";
  styleDeviationWarnings: string[];
  evidence: string[];
} => {
  const requestedStyle = deriveRequestedStyle(manifest);
  const normalizedStyle = requestedStyle.toLowerCase();
  const speechRateEstimate = computeSpeechRateEstimate(manifest);
  const intensity = manifest.intent.intensity;
  const emphasisWeight = manifest.typography.coreWords.length;

  let appliedStyle: PremiumAppliedStyle = "modern-authority";
  if (normalizedStyle.includes("aggressive")) {
    appliedStyle = "aggressive-high-contrast";
  } else if (normalizedStyle.includes("luxury")) {
    appliedStyle = "luxury-cinematic";
  } else if (
    normalizedStyle.includes("premium") ||
    normalizedStyle.includes("cinematic") ||
    manifest.intent.emotionalTone === "cinematic"
  ) {
    appliedStyle = "cinematic-premium";
  }

  let motionPreset: PremiumMotionPreset = "softSlideRight";
  if (appliedStyle === "aggressive-high-contrast" || manifest.intent.rhetoricalIntent === "shock") {
    motionPreset = "whipIn";
  } else if (appliedStyle === "luxury-cinematic") {
    motionPreset = "arcRise";
  } else if (manifest.intent.rhetoricalIntent === "setup" || manifest.intent.rhetoricalIntent === "calm") {
    motionPreset = "dropSettle";
  } else if (manifest.intent.rhetoricalIntent === "proof" || manifest.intent.rhetoricalIntent === "premium_explain") {
    motionPreset = "softSlideRight";
  } else if (intensity >= 0.7 || emphasisWeight >= 2) {
    motionPreset = "arcRise";
  } else {
    motionPreset = "softSlideLeft";
  }

  const baseDurationSec = clamp(
    manifest.animation.entryMs / 1000 * (motionPreset === "whipIn" ? 0.82 : motionPreset === "dropSettle" ? 0.9 : 1.08),
    0.28,
    1.45
  );
  const speechRateBias = speechRateEstimate
    ? clamp((speechRateEstimate - 2.75) * 0.14, -0.16, 0.18)
    : 0;
  const speedMultiplier = clamp(
    1 + speechRateBias + (motionPreset === "whipIn" ? 0.08 : motionPreset === "arcRise" ? -0.02 : 0),
    0.82,
    1.22
  );
  const staggerSec = clamp(
    manifest.animation.staggerMs / 1000 *
      (speechRateEstimate && speechRateEstimate > 3.4 ? 0.72 : speechRateEstimate && speechRateEstimate < 2.15 ? 1.12 : 0.92) *
      (motionPreset === "whipIn" ? 0.84 : 1),
    0.026,
    0.14
  );
  const lineFromRule = motionPreset === "whipIn"
    ? "right"
    : motionPreset === "dropSettle"
      ? "top"
      : motionPreset === "arcRise"
        ? "bottom"
        : motionPreset === "softSlideRight"
          ? "right"
          : "left";
  const wordFromRule = motionPreset === "arcRise"
    ? "diag-left"
    : motionPreset === "whipIn"
      ? "diag-right"
      : lineFromRule;
  const styleDeviationWarnings: string[] = [];
  if (normalizedStyle.includes("aggressive") && motionPreset !== "whipIn") {
    styleDeviationWarnings.push("Requested aggressive tone could not map to the whipIn preset.");
  }
  if ((normalizedStyle.includes("premium") || normalizedStyle.includes("cinematic")) && appliedStyle !== "cinematic-premium") {
    styleDeviationWarnings.push(`Requested premium tone resolved to ${appliedStyle} based on transcript intent.`);
  }

  return {
    requestedStyle,
    appliedStyle,
    motionPreset,
    baseDurationSec,
    staggerSec,
    speedMultiplier,
    lineFromRule,
    wordFromRule,
    styleDeviationWarnings,
    evidence: [
      `Requested style "${requestedStyle}" resolved to ${appliedStyle}.`,
      `Motion preset ${motionPreset} selected from local js/engine/motion-presets.js.`,
      speechRateEstimate ? `Speech rate estimate ${speechRateEstimate.toFixed(2)} words/sec adjusted motion speed.` : "Speech rate estimate unavailable, so default motion pacing was used."
    ]
  };
};

const resolveSegmentMotionDialect = (manifest: CreativeDecisionManifest) => {
  return manifest.motionDialect?.segments[0] ?? null;
};

export const generateHyperFramesComposition = async ({
  manifest,
  outputRootDir,
  enableGsapMotion = true,
  enableKineticTypography = true
}: {
  manifest: CreativeDecisionManifest;
  outputRootDir: string;
  enableGsapMotion?: boolean;
  enableKineticTypography?: boolean;
}): Promise<HyperFramesCompositionOutput> => {
  const startedAt = Date.now();
  const parsed = creativeDecisionManifestSchema.parse(manifest);
  const compositionDir = path.join(outputRootDir, "composition");
  const assetsDir = path.join(compositionDir, "assets");
  const fontsDir = path.join(assetsDir, "fonts");
  const videoDir = path.join(assetsDir, "video");
  const imagesDir = path.join(assetsDir, "images");
  const vendorDir = path.join(assetsDir, "vendor");

  await mkdir(fontsDir, {recursive: true});
  await mkdir(videoDir, {recursive: true});
  await mkdir(imagesDir, {recursive: true});
  await mkdir(vendorDir, {recursive: true});

  const baseTag = `<base href="/api/edit-sessions/${escapeHtml(parsed.jobId)}/preview/">`;


  const indexHtmlPath = path.join(compositionDir, "index.html");
  const manifestPath = path.join(compositionDir, "manifest.json");
  const diagnosticsPath = path.join(compositionDir, "diagnostics.json");
  const lineCount = Math.max(parsed.typography.linePlan.lines.length, 1);
  const longestLineLength = parsed.typography.linePlan.lines.reduce((max, line) => Math.max(max, line.length), 0);
  const maxTextWidthPx = Math.round(parsed.scene.width * (parsed.layout.maxWidthPercent / 100));
  const usableHeightPx = Math.max(
    220,
    parsed.scene.height - parsed.layout.safeArea.top - parsed.layout.safeArea.bottom - 64
  );
  const widthDrivenFontPx = Math.floor(maxTextWidthPx / Math.max(longestLineLength * 0.58, 6));
  const heightDrivenFontPx = Math.floor(usableHeightPx / Math.max(lineCount * 1.18 + 0.5, 1));
  const aspectTuning = parsed.scene.height > parsed.scene.width ? 0.9 : parsed.scene.height === parsed.scene.width ? 0.95 : 1;
  const fontSizePx = clamp(Math.floor(Math.min(widthDrivenFontPx, heightDrivenFontPx) * aspectTuning), 34, 96);
  const lineGapPx = clamp(Math.round(fontSizePx * 0.14), 8, 22);
  const justifyItems = parsed.layout.alignment === "left"
    ? "start"
    : parsed.layout.alignment === "right"
      ? "end"
      : "center";

  const primaryFontRequest = parsed.typography.primaryFont.fileUrl?.trim() ?? "";
  const secondaryFontRequest = parsed.typography.secondaryFont?.fileUrl?.trim() ?? "";
  const primaryFontFamily = parsed.typography.primaryFont.family.trim() || "HyperframesPrimary";
  const primaryFontCssStack = `"${escapeCssString(primaryFontFamily)}", "DM Sans", sans-serif`;
  const premiumMotionPlan = resolvePremiumMotionPlan(parsed);
  const segmentMotionDialect = resolveSegmentMotionDialect(parsed);
  const motionDialectPayload = JSON.stringify(parsed.motionDialect ?? null);
  const [primaryFontAsset, secondaryFontAsset, gsapVendorSource, motionPresetSource, offscreenRulesSource] = await Promise.all([
    primaryFontRequest
      ? prepareFontAsset({candidate: primaryFontRequest, fontsDir})
      : Promise.resolve({requestedPath: "", browserUrl: null, copiedPath: null}),
    secondaryFontRequest
      ? prepareFontAsset({candidate: secondaryFontRequest, fontsDir})
      : Promise.resolve({requestedPath: "", browserUrl: null, copiedPath: null}),
    resolveGsapVendorSource(),
    resolveEngineAssetSource("js/engine/motion-presets.js"),
    resolveEngineAssetSource("js/engine/offscreen-rules.js")
  ]);
  const gsapVendorAssetPath = gsapVendorSource
    ? await copyLocalAsset({
        sourcePath: gsapVendorSource,
        targetDir: vendorDir
      })
    : null;
  const motionPresetsAssetPath = motionPresetSource
    ? await copyLocalAsset({
        sourcePath: motionPresetSource,
        targetDir: vendorDir
      })
    : null;
  const offscreenRulesAssetPath = offscreenRulesSource
    ? await copyLocalAsset({
        sourcePath: offscreenRulesSource,
        targetDir: vendorDir
      })
    : null;
  const gsapBrowserUrl = gsapVendorAssetPath
    ? `assets/vendor/${sanitizeFileName(path.basename(gsapVendorAssetPath))}`
    : null;
  const motionPresetsBrowserUrl = motionPresetsAssetPath
    ? `assets/vendor/${sanitizeFileName(path.basename(motionPresetsAssetPath))}`
    : null;
  const offscreenRulesBrowserUrl = offscreenRulesAssetPath
    ? `assets/vendor/${sanitizeFileName(path.basename(offscreenRulesAssetPath))}`
    : null;
  const timedLineWords = enableKineticTypography ? buildTimedLineWords(parsed) : null;
  const kineticWordTimingActive = Boolean(timedLineWords && timedLineWords.some((line) => line.length > 0));
  const gsapMotionActive = enableGsapMotion && Boolean(gsapBrowserUrl) && Boolean(motionPresetsBrowserUrl) && Boolean(offscreenRulesBrowserUrl);
  const speechRateEstimate = computeSpeechRateEstimate(parsed);

  const lineHtml = kineticWordTimingActive
    ? timedLineWords!.map((line, lineIndex) => `
        <div class="line line-words" style="--line-index:${lineIndex};" data-line-index="${lineIndex}">
          ${line.map((word, wordIndex) => `
            <span
              class="word${word.emphasis ? " is-emphasis" : ""} is-future"
              data-word-index="${wordIndex}"
              data-word-start-ms="${word.startMs}"
              data-word-end-ms="${word.endMs}"
              data-line-index="${lineIndex}"
            >${escapeHtml(word.text)}</span>
          `.trim()).join("<span class=\"word-space\" aria-hidden=\"true\"> </span>")}
        </div>
      `.trim()).join("\n")
    : parsed.typography.linePlan.lines
      .map((line, index) => `<div class="line" style="--line-index:${index};">${escapeHtml(line)}</div>`)
      .join("\n");
  const styleClass = `style-${premiumMotionPlan.appliedStyle}`;
  const lineLetterSpacing = premiumMotionPlan.appliedStyle === "aggressive-high-contrast"
    ? "-0.046em"
    : premiumMotionPlan.appliedStyle === "luxury-cinematic"
      ? "-0.022em"
      : "-0.035em";
  const lineFontWeight = premiumMotionPlan.appliedStyle === "luxury-cinematic" ? 640 : 700;
  const textShadow = premiumMotionPlan.appliedStyle === "aggressive-high-contrast"
    ? "0 3px 32px rgba(2, 6, 23, 0.92), 0 1px 6px rgba(0,0,0,0.72)"
    : premiumMotionPlan.appliedStyle === "luxury-cinematic"
      ? "0 4px 28px rgba(15, 23, 42, 0.76), 0 1px 3px rgba(0,0,0,0.4)"
      : "0 2px 24px rgba(2, 6, 23, 0.82), 0 1px 4px rgba(0,0,0,0.62)";
  const fontFaceBlocks = [
    primaryFontAsset.browserUrl
      ? `@font-face { font-family: "${escapeCssString(primaryFontFamily)}"; src: url("${escapeHtml(primaryFontAsset.browserUrl)}"); font-display: swap; }`
      : "",
    secondaryFontAsset.browserUrl
      ? `@font-face { font-family: "${escapeCssString(parsed.typography.secondaryFont?.family ?? "")}"; src: url("${escapeHtml(secondaryFontAsset.browserUrl)}"); font-display: swap; }`
      : ""
  ].filter(Boolean).join("\n");
  const supportsWordTypography = kineticWordTimingActive;
  const motionRuntimeScriptTags = gsapMotionActive && gsapBrowserUrl && motionPresetsBrowserUrl && offscreenRulesBrowserUrl
    ? `  <script src="${escapeHtml(gsapBrowserUrl)}"></script>\n` +
      `  <script src="${escapeHtml(offscreenRulesBrowserUrl)}"></script>\n` +
      `  <script src="${escapeHtml(motionPresetsBrowserUrl)}"></script>\n`
    : "";
  if (!gsapMotionActive) {
    throw new Error("Cinematic GSAP motion is required for this manifest, but the GSAP engine failed to initialize.");
  }

  const cssAnimationRules = `
    .line {
      opacity: 1;
      transform: none;
      filter: none;
      will-change: opacity, transform, filter;
    }
    .word {
      display: inline-block;
      opacity: 0.26;
      transform: translateY(10px) scale(0.985);
      filter: blur(2.6px);
      transition:
        opacity 140ms linear,
        transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1),
        filter 220ms cubic-bezier(0.22, 0.61, 0.36, 1),
        color 220ms ease;
      will-change: opacity, transform, filter;
    }
    .word.is-future {
      opacity: 0.18;
      transform: translateY(12px) scale(0.982);
      filter: blur(3.2px);
    }
    .word.is-past {
      opacity: 0.78;
      transform: translateY(0px) scale(1);
      filter: blur(0px);
    }
    .word.is-active {
      opacity: 1;
      transform: translateY(0px) scale(1.055);
      filter: blur(0px);
    }
    .${styleClass} .word.is-active {
      transform: translateY(0px) scale(${premiumMotionPlan.appliedStyle === "aggressive-high-contrast" ? "1.09" : premiumMotionPlan.appliedStyle === "luxury-cinematic" ? "1.04" : "1.055"});
    }
    .word.is-emphasis {
      color: ${premiumMotionPlan.appliedStyle === "aggressive-high-contrast" ? "#facc15" : premiumMotionPlan.appliedStyle === "luxury-cinematic" ? "#f5d48f" : "#fde68a"};
      font-weight: ${premiumMotionPlan.appliedStyle === "luxury-cinematic" ? 760 : 800};
      text-shadow: ${premiumMotionPlan.appliedStyle === "luxury-cinematic"
        ? "0 0 14px rgba(245, 212, 143, 0.16), 0 2px 16px rgba(2, 6, 23, 0.66)"
        : "0 0 18px rgba(251, 191, 36, 0.22), 0 2px 18px rgba(2, 6, 23, 0.82)"};
    }
    .word-space {
      display: inline-block;
      width: 0.28em;
    }`;

  const html = `<!doctype html>
<html lang="en">
<head>
  ${baseTag}
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HyperFrames Composition</title>
  <style>
    :root {
      --safe-top: ${parsed.layout.safeArea.top}px;
      --safe-right: ${parsed.layout.safeArea.right}px;
      --safe-bottom: ${parsed.layout.safeArea.bottom}px;
      --safe-left: ${parsed.layout.safeArea.left}px;
      --scene-width: ${parsed.scene.width}px;
      --scene-height: ${parsed.scene.height}px;
      --line-font-size: ${fontSizePx}px;
      --line-gap: ${lineGapPx}px;
      --copy-max-width: ${maxTextWidthPx}px;
      --hf-primary-font-family: ${primaryFontCssStack};
    }
    ${fontFaceBlocks}
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      color: #f8fafc;
    }
    body {
      display: grid;
      place-items: center;
    }
    #viewport {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: grid;
      place-items: center;
      background: transparent;
    }
    #root {
      position: relative;
      width: var(--scene-width);
      height: var(--scene-height);
      overflow: hidden;
      transform-origin: center center;
      will-change: transform;
    }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
    .typography-layer {
      position: absolute;
      inset: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
      display: grid;
      place-content: center;
      z-index: 20;
      text-align: ${parsed.layout.alignment};
      font-family: var(--hf-primary-font-family, "DM Sans", sans-serif);
      pointer-events: none;
    }
    .copy-block {
      width: min(100%, var(--copy-max-width));
      display: grid;
      gap: var(--line-gap);
      justify-items: ${justifyItems};
      margin: 0 auto;
    }
    .line {
      display: block;
      width: 100%;
      max-width: 100%;
      font-size: var(--line-font-size);
      line-height: 1.02;
      letter-spacing: ${lineLetterSpacing};
      font-weight: ${lineFontWeight};
      color: #f8fafc;
      text-shadow: ${textShadow};
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      text-wrap: balance;
      transform-origin: center center;
    }
    .style-aggressive-high-contrast .copy-block {
      max-width: min(100%, calc(var(--copy-max-width) * 0.92));
    }
    .style-luxury-cinematic .copy-block {
      max-width: min(100%, calc(var(--copy-max-width) * 0.98));
    }
    ${cssAnimationRules}
    #play-overlay {
      position: absolute;
      inset: 0;
      z-index: 100;
      display: none;
      place-items: center;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      cursor: pointer;
      transition: opacity 0.3s ease;
    }
    #play-overlay.is-visible {
      display: grid;
    }
    .play-button {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.95);
      display: grid;
      place-items: center;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .play-button:hover {
      transform: scale(1.12);
      background: #ffffff;
    }
    .play-button svg {
      width: 36px;
      height: 36px;
      fill: #020617;
      margin-left: 6px;
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="root" class="${escapeHtml(styleClass)}" data-premium-style="${escapeHtml(premiumMotionPlan.appliedStyle)}" data-motion-preset="${escapeHtml(premiumMotionPlan.motionPreset)}">
      <video src="${escapeHtml(parsed.source.videoUrl)}" muted playsinline preload="auto"></video>
      <div class="typography-layer">
        <div class="copy-block">${lineHtml}</div>
      </div>
      <div id="play-overlay">
        <div class="play-button">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </div>
  </div>
${motionRuntimeScriptTags}  <script>
    (() => {
      const root = document.getElementById("root");
      const video = root?.querySelector("video");
      const playOverlay = document.getElementById("play-overlay");
      const lines = Array.from(document.querySelectorAll(".line"));
      const words = Array.from(document.querySelectorAll("[data-word-start-ms]"));
      const stageEl = root;

      const showPlayOverlay = () => {
        if (playOverlay) {
          playOverlay.classList.add("is-visible");
        }
      };

      const hidePlayOverlay = () => {
        if (playOverlay) {
          playOverlay.classList.remove("is-visible");
        }
      };

      if (playOverlay && video) {
        playOverlay.addEventListener("click", () => {
          video.play().then(hidePlayOverlay).catch(console.error);
        });
      }

      const motionDialect = ${escapeJs(motionDialectPayload)};
      const selectedSegmentDialect = motionDialect?.segments?.[0]?.dialect ?? null;
      const selectedMotionPreset = selectedSegmentDialect?.motionPreset === "pauseRestraint"
        ? "arcRise"
        : "${premiumMotionPlan.motionPreset}";
      const easingMap = {
        "ease.powerOut": "power4.out",
        "ease.expoOut": "expo.out",
        "ease.sineInOut": "sine.inOut",
        "ease.backOut": "back.out(1.45)",
        "cinema.smoothCurve": "power3.out",
        "cinema.snapCurve": "expo.out",
        "cinema.whipCurve": "power4.out",
        "cinema.arcCurve": "power2.out",
        "cinema.dropCurve": "back.out(1.2)",
        "cinema.parallaxCurve": "sine.out",
        "cinema.gentle": "power2.out"
      };
      if (!root) {
        return;
      }

      const applyScale = () => {
        const scale = Math.min(
          window.innerWidth / ${parsed.scene.width},
          window.innerHeight / ${parsed.scene.height}
        );
        root.style.transform = "scale(" + Math.max(scale, 0.01).toFixed(4) + ")";
      };

      const syncWordStates = () => {
        if (!words.length || !video) {
          window.requestAnimationFrame(syncWordStates);
          return;
        }

        const currentMs = video.currentTime * 1000;
        words.forEach((node) => {
          const startMs = Number(node.getAttribute("data-word-start-ms") ?? "0");
          const endMs = Number(node.getAttribute("data-word-end-ms") ?? String(startMs));
          const durationMs = Math.max(120, endMs - startMs);
          const punctuationPauseMs = /[,.!?;:]$/.test((node.textContent ?? "").trim()) ? 90 : 0;
          const leadMs = Math.min(110, Math.max(48, durationMs * (${speechRateEstimate && speechRateEstimate > 3.25 ? "0.12" : "0.18"})));
          const tailMs = Math.min(320, Math.max(120, durationMs * (${speechRateEstimate && speechRateEstimate < 2.15 ? "0.52" : "0.42"}) + punctuationPauseMs));
          const isFuture = currentMs < startMs - leadMs;
          const isPast = currentMs > endMs + tailMs;
          const isActive = !isFuture && !isPast;

          node.classList.toggle("is-future", isFuture);
          node.classList.toggle("is-past", isPast);
          node.classList.toggle("is-active", isActive);
        });

        window.requestAnimationFrame(syncWordStates);
      };

      const activateGsapTimeline = () => {
        const gsap = window.gsap;
        const motionApi = window.CinematicMotion;
        if (!gsap || !motionApi?.createMotionPresets || !motionApi?.createOffscreenResolver || !stageEl) {
          return;
        }

        const targets = words.length > 0 ? words : lines;
        if (!targets.length) {
          return;
        }

        const offscreenResolver = motionApi.createOffscreenResolver(stageEl, {baseMargin: 140});
        const presetMap = motionApi.createMotionPresets({
          resolve: (token) => easingMap[token] || token || "power3.out"
        }, offscreenResolver);
        const preset = presetMap[selectedMotionPreset];
        if (!preset) {
          return;
        }

        const timeline = gsap.timeline({
          defaults: {
            ease: easingMap["${escapeJs(parsed.animation.easing)}"] || "${escapeJs(parsed.animation.easing)}"
          }
        });
        targets.forEach((target, index) => {
          const context = {
            stageEl,
            el: target,
            index,
            object: {
              id: target.getAttribute("data-line-index") || target.getAttribute("data-word-index") || "motion-target",
              layer: words.length > 0 ? "foreground" : "midground",
              fromRule: words.length > 0 ? "${premiumMotionPlan.wordFromRule}" : "${premiumMotionPlan.lineFromRule}",
              to: {}
            }
          };
          const fromVars = preset.from ? preset.from(context) : {};
          const toVars = preset.to ? preset.to(context) : {};
          const easeToken = toVars.easeToken || preset.easeToken || "${escapeJs(parsed.animation.easing)}";
          delete toVars.easeToken;
          delete toVars.duration;
          gsap.set(target, fromVars);
          timeline.to(
            target,
            {
              ...toVars,
              y: selectedSegmentDialect?.axis === "y" && typeof selectedSegmentDialect?.yDriftPx === "number"
                ? Number(selectedSegmentDialect.yDriftPx) * -1
                : toVars.y,
              opacity: Array.isArray(selectedSegmentDialect?.opacityRange)
                ? Number(selectedSegmentDialect.opacityRange[1] ?? 1)
                : toVars.opacity,
              duration: selectedSegmentDialect?.durationScale
                ? ${premiumMotionPlan.baseDurationSec.toFixed(3)} * Number(selectedSegmentDialect.durationScale)
                : ${premiumMotionPlan.baseDurationSec.toFixed(3)},
              ease: easingMap[easeToken] || easeToken || "power3.out"
            },
            index * (
              selectedSegmentDialect?.staggerMs
                ? Number(selectedSegmentDialect.staggerMs) / 1000
                : ${premiumMotionPlan.staggerSec.toFixed(3)}
            )
          );
        });
        timeline.timeScale(
          selectedSegmentDialect?.motionPreset === "pauseRestraint"
            ? Math.min(${premiumMotionPlan.speedMultiplier.toFixed(3)}, 0.92)
            : ${premiumMotionPlan.speedMultiplier.toFixed(3)}
        );
      };

      window.addEventListener("resize", applyScale);
      applyScale();
      syncWordStates();
      ${gsapMotionActive ? "activateGsapTimeline();" : ""}

      // Genesis Block: Notify parent that HyperFrames is materialized and ready
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "HYPERFRAMES_STATUS", status: "READY" }, "*");
      }
    })();
  </script>
  <script>
    (() => {
      window.hyperframesStatus = "loading";
      window.hyperframesErrorMessage = null;

      const video = document.querySelector("video");
      if (!video) {
        window.hyperframesStatus = "error";
        window.hyperframesErrorMessage = "Video element not found in composition.";
        return;
      }

      video.addEventListener("error", () => {
        window.hyperframesStatus = "error";
        window.hyperframesErrorMessage = "Video loading error: " + (video.error ? video.error.message : "Unknown error");
        console.error("[hyperframes] Video error:", video.error);
      });

      const startPlayback = () => {
        const maybePromise = video.play?.();
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise
            .then(() => {
              window.hyperframesStatus = "playing";
              hidePlayOverlay();
            })
            .catch((err) => {
              window.hyperframesStatus = "error";
              window.hyperframesErrorMessage = "Playback failed: " + err.message;
              console.error("[hyperframes] Playback failed:", err);
              if (err.name === "NotAllowedError") {
                showPlayOverlay();
              }
            });
        } else {
          window.hyperframesStatus = "playing";
          hidePlayOverlay();
        }
      };

      video.addEventListener("loadedmetadata", () => {
        if (window.hyperframesStatus !== "error") {
          window.hyperframesStatus = "ready";
        }
        startPlayback();
      }, {once: true});

      if (video.readyState >= 1) {
        startPlayback();
      }
    })();
  </script>
</body>
</html>
`;

  const gsapEvidence = [
    gsapVendorAssetPath ? `Copied local GSAP vendor asset to ${path.basename(gsapVendorAssetPath)}.` : null,
    motionPresetsAssetPath ? `Copied local motion preset runtime to ${path.basename(motionPresetsAssetPath)}.` : null,
    offscreenRulesAssetPath ? `Copied local offscreen resolver runtime to ${path.basename(offscreenRulesAssetPath)}.` : null,
    gsapMotionActive ? "Generated gsap.timeline() motion choreography for the composition." : null,
    gsapMotionActive ? `GSAP bridge executed the ${premiumMotionPlan.motionPreset} preset from js/engine/motion-presets.js.` : null,
    segmentMotionDialect ? `Motion dialect ${segmentMotionDialect.moment} modulated runtime GSAP parameters.` : null,
    gsapMotionActive && supportsWordTypography ? "GSAP targets timed word spans instead of only line blocks." : null
  ].filter((value): value is string => Boolean(value));
  const kineticEvidence = [
    supportsWordTypography
      ? `Rendered ${timedLineWords?.flat().length ?? 0} transcript-timed word spans into the composition.`
      : null,
    supportsWordTypography
      ? "Attached data-word-start-ms and data-word-end-ms timing attributes for runtime sync."
      : null
  ].filter((value): value is string => Boolean(value));
  const fontEvidence = [
    primaryFontAsset.copiedPath ? `Copied primary font asset to ${path.basename(primaryFontAsset.copiedPath)}.` : null,
    secondaryFontAsset.copiedPath ? `Copied secondary font asset to ${path.basename(secondaryFontAsset.copiedPath)}.` : null,
    fontFaceBlocks.length > 0 ? "Generated local @font-face rules for composition typography." : null
  ].filter((value): value is string => Boolean(value));
  const styleAuthorityDeviations = [...premiumMotionPlan.styleDeviationWarnings];
  const requestedStyleLower = premiumMotionPlan.requestedStyle.toLowerCase();
  const motionTierLower = parsed.style?.motionTier?.toLowerCase() ?? "";
  const expectsPremiumTypography =
    requestedStyleLower.includes("premium") ||
    requestedStyleLower.includes("luxury") ||
    requestedStyleLower.includes("cinematic") ||
    motionTierLower.includes("premium");
  const declaredCustomFamilies = [
    parsed.typography.primaryFont,
    parsed.typography.secondaryFont
  ]
    .filter((font): font is NonNullable<typeof font> => Boolean(font))
    .filter((font) => font.source === "custom_ingested")
    .map((font) => font.family);
  const embeddedCustomFamilies = [
    primaryFontAsset.browserUrl ? parsed.typography.primaryFont.family : null,
    secondaryFontAsset.browserUrl ? parsed.typography.secondaryFont?.family ?? null : null
  ].filter((value): value is string => Boolean(value));
  const missingEmbeddedCustomFamilies = declaredCustomFamilies.filter(
    (family) => !embeddedCustomFamilies.includes(family)
  );
  if (enableGsapMotion && !gsapMotionActive) {
    styleAuthorityDeviations.push("Requested GSAP motion but the runtime assets were unavailable, so premium motion could not fully materialize.");
  }
  if (enableGsapMotion && !html.includes("gsap.timeline(")) {
    styleAuthorityDeviations.push("Requested GSAP motion but no gsap.timeline() call was emitted into the composition HTML.");
  }
  if (expectsPremiumTypography && missingEmbeddedCustomFamilies.length > 0) {
    styleAuthorityDeviations.push(
      `Requested premium typography but custom fonts were not embedded for: ${missingEmbeddedCustomFamilies.join(", ")}.`
    );
  }
  if (expectsPremiumTypography && fontFaceBlocks.length === 0) {
    styleAuthorityDeviations.push("Requested premium typography but no @font-face rules were emitted into the composition.");
  }
  if ((parsed.source.transcriptSegment.words?.length ?? 0) > 0 && !supportsWordTypography) {
    styleAuthorityDeviations.push("Transcript word timings were present but word-level kinetic typography could not be activated.");
  }
  const styleDeviationWarnings = [
    ...premiumMotionPlan.styleDeviationWarnings,
    ...(supportsWordTypography
      ? []
      : ["Word-level kinetic typography could not be activated, so premium typography stayed on line-level fallback."])
  ];
  const styleAuthority: RenderStyleAuthority = {
    requestedStyle: premiumMotionPlan.requestedStyle,
    appliedStyle: premiumMotionPlan.appliedStyle,
    motionPreset: premiumMotionPlan.motionPreset,
    typographyMode: parsed.typography.mode,
    speechRateEstimate,
    materialChangesVerified: styleAuthorityDeviations.length === 0,
    deviations: styleAuthorityDeviations,
    styleDeviationWarnings,
    evidence: [
      ...premiumMotionPlan.evidence,
      `Typography mode ${parsed.typography.mode} rendered with ${supportsWordTypography ? "word-level kinetics" : "line-level fallback"}.`
    ]
  };

  const diagnostics = {
    fontProof: {
      fontsRequestedFromManifest: [
        parsed.typography.primaryFont.family,
        parsed.typography.secondaryFont?.family ?? null
      ].filter((value): value is string => Boolean(value)),
      fontFilesResolved: [primaryFontRequest, secondaryFontRequest].filter((value) => value.length > 0),
      fontFilesLoadedIntoComposition: [
        primaryFontAsset.browserUrl,
        secondaryFontAsset.browserUrl
      ].filter((value): value is string => Boolean(value)),
      fontCssGenerated: fontFaceBlocks.length > 0,
      fallbackFontsUsed:
        parsed.typography.primaryFont.source === "fallback"
          ? [parsed.typography.primaryFont.family]
          : [],
      fallbackReasons:
        parsed.typography.primaryFont.source === "fallback"
          ? ["Primary typography font declared as fallback in manifest."]
          : []
    },
    animationProof: {
      animationRequestedFromManifest: parsed.animation.family,
      animationRetrievedFromMilvus: parsed.animation.retrievedFromMilvus,
      retrievedAnimationId: parsed.animation.retrievedAnimationId ?? null,
      gsapTimelineGenerated: gsapMotionActive,
      fallbackAnimationUsed: enableGsapMotion && !gsapMotionActive,
      fallbackReasons: enableGsapMotion && !gsapMotionActive
        ? [gsapBrowserUrl && motionPresetsBrowserUrl && offscreenRulesBrowserUrl
          ? "GSAP was requested but the preset runtime could not be activated."
          : "Local GSAP or motion preset assets were not available, so CSS fallback motion was used."]
        : parsed.diagnostics.fallbackReasons
    },
    features: {
      gsap: buildFeatureActivation({
        requested: enableGsapMotion,
        activated: gsapMotionActive,
        fallbackReason: "Local GSAP or motion preset assets were unavailable, so the composition stayed on CSS keyframes.",
        artifactPath: path.relative(compositionDir, indexHtmlPath) || "index.html",
        evidence: gsapEvidence
      }),
      kineticTypography: buildFeatureActivation({
        requested: enableKineticTypography && (parsed.source.transcriptSegment.words?.length ?? 0) > 0,
        activated: supportsWordTypography,
        fallbackReason: "Transcript word timings were unavailable or could not be aligned to the line plan.",
        artifactPath: path.relative(compositionDir, indexHtmlPath) || "index.html",
        evidence: kineticEvidence
      }),
      fonts: buildFeatureActivation({
        requested: Boolean(primaryFontRequest || secondaryFontRequest),
        activated: fontFaceBlocks.length > 0,
        fallbackReason: "No local font asset could be embedded into the composition.",
        artifactPath: path.relative(compositionDir, indexHtmlPath) || "index.html",
        evidence: fontEvidence
      })
    },
    styleAuthority
  };

  await Promise.all([
    writeFile(indexHtmlPath, html, "utf-8"),
    writeFile(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8"),
    writeFile(
      diagnosticsPath,
      `${JSON.stringify(
        {
          sessionId: parsed.jobId,
          overlapCheckPassed: parsed.diagnostics.overlapCheckPassed ?? null,
          warnings: parsed.diagnostics.warnings,
          fontProof: diagnostics.fontProof,
          animationProof: diagnostics.animationProof,
          features: diagnostics.features,
          styleAuthority: diagnostics.styleAuthority
        },
        null,
        2
      )}\n`,
      "utf-8"
    )
  ]);

  return {
    compositionDir,
    indexHtmlPath,
    assets: {
      fontsDir,
      videoDir,
      imagesDir
    },
    renderCommand: "hyperframes render composition/index.html",
    diagnosticsPath,
    manifestPath,
    compositionGenerationTimeMs: Date.now() - startedAt,
    diagnostics
  };
};

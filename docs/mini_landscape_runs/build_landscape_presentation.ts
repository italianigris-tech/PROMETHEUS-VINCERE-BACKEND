/**
 * MINI LANDSCAPE RUNS — STAGE 8: build_landscape_presentation.ts
 *
 * LandscapeTreatmentManifest → self-contained 16:9 HTML preview studio.
 * Mirrors mini_run_studio/build_male_sequence_presentation.ts but stays
 * causally linked to THIS studio: the builder reads the Stage-7 manifest
 * and splices its data into the landscape studio template at a declared
 * seam (SEAM_BEGIN:__LANDSCAPE_RUN_DATA__), so the rendered studio plays the
 * causal treatment artifact instead of the bundled demo corpus.
 *
 * The landscape studio template (`landscape_treatment_presentation.html`) is a
 * static 16:9 renderer with NO data-loading mechanism of its own. The builder
 * is the ONLY author of its embedded data — matching the architecture verified
 * for the short-form studio (data injected at serve/render time).
 *
 * CLI:
 *   npx tsx docs/mini_landscape_runs/build_landscape_presentation.ts \
 *     --manifest docs/mini_landscape_runs/out/landscape_treatment_manifest.json \
 *     [--out docs/mini_landscape_runs/out/landscape_presentation.html] \
 *     [--run-id <id>] \
 *     [--template docs/mini_landscape_runs/landscape_treatment_presentation.html]
 *
 *   Demo mode (no --manifest): copies the template as-is to --out so the
 *   studio still renders its bundled demo corpus standalone.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  EditMove,
  LandscapeSection,
  LandscapeTreatmentManifest,
} from "./types.js";

// ---------------------------------------------------------------------------
// Paths / defaults
// ---------------------------------------------------------------------------

const studioDir = __dirname;

const DEFAULT_MANIFEST = path.join(
  studioDir,
  "out",
  "landscape_treatment_manifest.json",
);
const DEFAULT_TEMPLATE = path.join(
  studioDir,
  "landscape_treatment_presentation.html",
);

// ---------------------------------------------------------------------------
// Seam anchors (must match the studio template exactly)
// ---------------------------------------------------------------------------

const SEAM_START = "// SEAM_BEGIN:__LANDSCAPE_RUN_DATA__";
const SEAM_END = "// SEAM_END:__LANDSCAPE_RUN_DATA__";

const FONT_PROFILE_SEAM_START = "// SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__";
const FONT_PROFILE_SEAM_END = "// SEAM_END:__LANDSCAPE_FONT_PROFILES__";

const repoRoot = path.resolve(studioDir, "..", "..");

// ---------------------------------------------------------------------------
// Manifest → studio chunk derivation (causal mapping tables)
// ---------------------------------------------------------------------------

/**
 * When a section carries no transcript text (e.g. silence-cut test runs), the
 * builder still emits renderable role phrases so the studio always has content.
 * A production manifest with `section.text` populated always wins over these.
 */
import { LANDSCAPE_KINETIC_WHITELIST } from "./landscape_chunker.js";

const ROLE_FALLBACK_TEXT: Record<string, string> = {
  hook: "THIS IS THE CRITICAL METRIC THAT DEFINES SUCCESS",
  setup: "MEET THE FOUNDER BEHIND THE ENTIRE OPERATING SYSTEM",
  explain: "HERE IS PRECISELY HOW THE SYSTEM ARCHITECTURE OPERATES",
  demonstrate: "WATCH THE COMPLETE WORKFLOW EXECUTE STEP BY STEP",
  payoff: "THIS IS THE EXPONENTIAL NUMBER THAT TRULY MATTERS",
  outro: "EXECUTE THIS ONE HIGH IMPACT DISCIPLINE STARTING TODAY",
};

interface StudioChunk {
  chunkIndex: number;
  timestamp: string;
  startSec: number;
  endSec: number;
  text: string;
  emphasis: string;
  preferredProfile: string | null;
  metricValue?: number;
  metricPrefix?: string;
  metricSuffix?: string;
  wordCount?: number;
  isQuote?: boolean;
  animationPreset?: string;
  words?: Array<{
    text: string;
    charCount: number;
    wordIndex: number;
    startSec: number;
    endSec: number;
  }>;
}

function formatTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const tenth = Math.floor((safe % 1) * 10);
  return (
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    tenth
  );
}

function findMoveForSection(
  editMoves: EditMove[],
  sectionId: string,
): EditMove | undefined {
  return editMoves.find((m) => m.sectionId === sectionId);
}

function deriveChunks(manifest: LandscapeTreatmentManifest): StudioChunk[] {
  const sections = [...manifest.sections].sort(
    (a, b) => a.startSec - b.startSec,
  );

  const nonQuotePresets = [
    "dual_kinetic_phrase_convergence",
    "rise_and_deblur_compression",
    "apple_pro_display_hero_revealer",
    "pixel_blur_mask",
    "gaussian_blur_reveal_sweep",
    "compound_word_glitch_blur_reveal",
    "masked_dual_axis_text_reveal",
    "dynamic_3d_letter_flicker",
  ];

  return sections.map((section: LandscapeSection, idx: number): StudioChunk => {
    const move = findMoveForSection(manifest.editMoves, section.sectionId);
    const startSec = move ? move.startSec : section.startSec;
    const endSec = move ? move.endSec : section.endSec;

    const rawText = section.text ?? "";
    const text =
      rawText.trim().length > 0
        ? rawText.trim()
        : ROLE_FALLBACK_TEXT[section.role] || section.sectionId;

    const emphasis = move
      ? MOVE_EMPHASIS[move.moveId] || "key_point"
      : "context";

    const rawWords = text.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = rawWords.length;
    const isQuote = wordCount > 8;

    const cue = manifest.typographyPlan?.cues?.find(
      (c) => c.sectionId === section.sectionId || (move && c.moveId === move.moveId)
    );

    const animationPreset = isQuote
      ? "quote_kinetic_treatment"
      : (cue?.animationPreset && cue.animationPreset !== "quote_kinetic_treatment"
          ? cue.animationPreset
          : nonQuotePresets[idx % nonQuotePresets.length]);

    const chunkDuration = Math.max(0.1, endSec - startSec);
    const wordDuration = wordCount > 0 ? chunkDuration / wordCount : 0.3;

    const words = rawWords.map((wText, wIdx) => {
      const wStart = startSec + wIdx * wordDuration;
      const wEnd = wStart + wordDuration;
      return {
        text: wText,
        charCount: wText.length,
        wordIndex: wIdx,
        startSec: Math.round(wStart * 100) / 100,
        endSec: Math.round(wEnd * 100) / 100,
      };
    });

    const chunk: StudioChunk = {
      chunkIndex: idx + 1,
      timestamp:
        formatTimestamp(startSec) + " — " + formatTimestamp(endSec),
      startSec: Math.round(startSec * 100) / 100,
      endSec: Math.round(endSec * 100) / 100,
      text,
      wordCount,
      isQuote,
      animationPreset,
      words,
      emphasis,
      preferredProfile: null,
    };

    // Number-lock moves surface the metric so the studio's hero-metric path
    // formats it exactly like the real short-form corpus does.
    if (move && move.numberDirection && move.numberDirection !== "none") {
      const moneyMatch = text.match(/\$[\d,]+(\.\d+)?/);
      const numMatch = text.match(/\b\d[\d,]*(\.\d+)?\b/);
      if (moneyMatch) {
        chunk.metricPrefix = "$";
        chunk.metricValue = parseFloat(moneyMatch[0].replace(/[$,]/g, ""));
        chunk.metricSuffix = "";
      } else if (numMatch) {
        chunk.metricValue = parseFloat(numMatch[0].replace(/,/g, ""));
      }
    }

    return chunk;
  });
}
/** edit moveId → studio emphasis so the render core budgets attention correctly. */
const MOVE_EMPHASIS: Record<string, string> = {
  emphasize_keyword: "hero_concept",
  return_to_authority: "inflection_solution",
  explain_workflow: "context",
  value_contrast: "hero_metric",
  cta_pressure: "terminal_payoff",
  fatigue_relief: "transition",
  focus_handoff: "clause",
  proof_insert: "key_point",
  thesis_punctuation: "contrast_claim",
  momentum_death: "inflection_tension",
};

// ---------------------------------------------------------------------------
// Run data bundle
// ---------------------------------------------------------------------------

interface RunData {
  runId: string;
  title: string;
  generatedAtIso: string;
  transcriptKey: string;
  transcripts: Record<
    string,
    { id: string; title: string; chunks: StudioChunk[] }
  >;
  transitions: LandscapeTreatmentManifest["transitions"];
  typographyCueMoveIds?: LandscapeTreatmentManifest["typographyCueMoveIds"];
  typographyPlan?: LandscapeTreatmentManifest["typographyPlan"];
  subjectMatteAvailable?: boolean;
  matteSrc?: string;
  sfxCues: LandscapeTreatmentManifest["sfxCues"];
  soundtrack: LandscapeTreatmentManifest["soundtrack"];
  canvas: LandscapeTreatmentManifest["canvas"];
  governance: LandscapeTreatmentManifest["governance"];
  backgroundRigs?: LandscapeTreatmentManifest["backgroundRigs"];
  backgroundCoverages?: LandscapeTreatmentManifest["backgroundCoverages"];
  zoomPlan?: LandscapeTreatmentManifest["zoomPlan"];
  zoomCues?: LandscapeTreatmentManifest["zoomCues"];
  cameraMoves?: LandscapeTreatmentManifest["cameraMoves"];
  parallaxRig?: LandscapeTreatmentManifest["parallaxRig"];
  pipInsets?: LandscapeTreatmentManifest["pipInsets"];
  editorialCausalChain?: LandscapeTreatmentManifest["editorialCausalChain"];
  metaphorTreatments?: LandscapeTreatmentManifest["metaphorTreatments"];
  handOfGodBlueprint?: LandscapeTreatmentManifest["handOfGodBlueprint"];
  photoTreatments?: LandscapeTreatmentManifest["photoTreatments"];
  /** Repo-relative URL of the silence-cut MP4 used as the full-bleed runtime base background. */
  sourceVideo: string | null;
}

function deriveSourceVideo(manifest: LandscapeTreatmentManifest): string | null {
  // Prefer the silence-cut output; fall back to the input source path when the
  // pipeline records outputPath as null (i.e. the cut MP4 _is_ the source). The
  // media gateway serves /landscape_media/<basename> from docs/mini_landscape_runs/out/,
  // so the resolved basename must exist there for the full-bleed background to load.
  const candidate = manifest.silenceCut?.outputPath ?? manifest.silenceCut?.sourcePath;
  if (!candidate) return null;
  return "/landscape_media/" + encodeURIComponent(path.basename(candidate));
}

function deriveRunId(
  manifest: LandscapeTreatmentManifest,
  explicitRunId?: string,
): string {
  if (explicitRunId) return explicitRunId;
  const src = manifest.silenceCut?.sourcePath;
  if (src) {
    const base = path
      .basename(src)
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
    if (base) return base;
  }
  const stamp = (manifest.generatedAtIso || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  return stamp ? "landscape_run_" + stamp : "landscape_run_demo";
}

function deriveRunData(
  manifest: LandscapeTreatmentManifest,
  runId: string,
): RunData {
  const totalSec =
    manifest.sections.length > 0
      ? Math.max(...manifest.sections.map((s) => s.endSec))
      : 0;
  const title =
    "Causal Landscape Treatment — " +
    manifest.sections.length +
    " sections · " +
    manifest.canvas.aspect +
    " · " +
    totalSec.toFixed(1) +
    "s";

  return {
    runId,
    title,
    generatedAtIso: manifest.generatedAtIso,
    transcriptKey: "run1",
    transcripts: {
      run1: {
        id: "run1",
        title,
        chunks: deriveChunks(manifest),
      },
    },
    transitions: manifest.transitions,
    typographyCueMoveIds: manifest.typographyCueMoveIds,
    typographyPlan: manifest.typographyPlan,
    subjectMatteAvailable: manifest.subjectMatteAvailable,
    matteSrc: manifest.matteSrc,
    sfxCues: manifest.sfxCues,
    soundtrack: manifest.soundtrack,
    canvas: manifest.canvas,
    governance: manifest.governance,
    backgroundRigs: manifest.backgroundRigs,
    backgroundCoverages: manifest.backgroundCoverages,
    zoomPlan: manifest.zoomPlan,
    zoomCues: manifest.zoomCues,
    cameraMoves: manifest.cameraMoves,
    parallaxRig: manifest.parallaxRig,
    pipInsets: manifest.pipInsets,
    editorialCausalChain: manifest.editorialCausalChain,
    metaphorTreatments: manifest.metaphorTreatments,
    handOfGodBlueprint: manifest.handOfGodBlueprint,
    photoTreatments: manifest.photoTreatments,
    sourceVideo: deriveSourceVideo(manifest),
  };
}

// ---------------------------------------------------------------------------
// Seam injection
// ---------------------------------------------------------------------------

function toInlineScriptSafeJson(value: unknown): string {
  // Escape any `</script>` / `<` sequences so the injected payload can never
  // terminate the surrounding script tag no matter what the manifest contains.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function injectRunData(templateHtml: string, runData: unknown): string {
  const startIdx = templateHtml.indexOf(SEAM_START);
  const endIdx = templateHtml.indexOf(SEAM_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      "Landscape studio template seam markers not found. Expected the " +
        "Stage-8 spliced studio (SEAM_BEGIN:__LANDSCAPE_RUN_DATA__).",
    );
  }

  const json = toInlineScriptSafeJson(runData);
  const injectedBlock =
    SEAM_START +
    "\n    window.__LANDSCAPE_RUN_DATA__ = " +
    json +
    ";\n    " +
    SEAM_END;

  return (
    templateHtml.slice(0, startIdx) +
    injectedBlock +
    templateHtml.slice(endIdx + SEAM_END.length)
  );
}

// ---------------------------------------------------------------------------
// Authoritative font profile corpus injection
// ---------------------------------------------------------------------------

interface FontProfileEntry {
  _filename: string;
  _imageFilename: string;
  _imageUrl: string;
  _jsonUrl: string;
  _imageExists: boolean;
  /** True when the corpus filename carries the "Landscape" token — the signal that this treatment profile was authored for 16:9 long-form only, so 9:16 short-form builders can compartmentalize it away. */
  _landscapeOnly?: boolean;
  profile_name?: string;
  [key: string]: unknown;
}

/**
 * Loads the authoritative Prometheus Yuan font JSON corpus from disk with
 * paired screenshot metadata — exactly mirroring the short-form builder. This
 * is the generalized long-form pipeline: any treatment profile added to the
 * corpus directory (e.g. the white-red contrast / 1–5 word treatments) is
 * picked up automatically without touching the studio template.
 */
function loadAllFontProfiles(): FontProfileEntry[] {
  const fontJsonDir = path.join(repoRoot, "Yuan Prometheus Screenshots/font JSON");
  const fontPairsDir = path.join(repoRoot, "Yuan Prometheus Screenshots/font pairing and placement");
  const fontJsonFiles = fs.readdirSync(fontJsonDir).filter((f) => f.endsWith(".json"));

  const profiles = fontJsonFiles
    .map((filename) => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(fontJsonDir, filename), "utf8"));
        const imageFilename = filename.replace(/\.json$/i, ".png");
        const imageExists = fs.existsSync(path.join(fontPairsDir, imageFilename));
        return {
          ...raw,
          _filename: filename,
          _imageFilename: imageFilename,
          _imageUrl: `/font_pairs/${encodeURIComponent(imageFilename)}`,
          _jsonUrl: `/font_json/${encodeURIComponent(filename)}`,
          _imageExists: imageExists,
          _landscapeOnly: /Landscape/i.test(filename),
        };
      } catch (e) {
        return null;
      }
    })
    .filter((p): p is FontProfileEntry => Boolean(p));

  console.log(
    `[FONT_CORPUS_LOADER] Successfully loaded ${profiles.length} authoritative Font JSON profiles with paired screenshot metadata.`,
  );
  return profiles;
}

/**
 * Replaces the baked ALL_FONT_PROFILES array (wrapped in the template's
 * font-profile seam) with the current authoritative disk corpus so landscape
 * runs always render the latest treatment profiles.
 */
function injectFontProfiles(templateHtml: string, profiles: FontProfileEntry[]): string {
  const startIdx = templateHtml.indexOf(FONT_PROFILE_SEAM_START);
  const endIdx = templateHtml.indexOf(FONT_PROFILE_SEAM_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      "Landscape studio template font-profile seam markers not found. Expected " +
        "SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__ / SEAM_END.",
    );
  }

  const json = JSON.stringify(profiles).replace(/</g, "\\u003c");
  const injectedBlock =
    "    " + FONT_PROFILE_SEAM_START + "\n    const ALL_FONT_PROFILES = " + json + ";\n    " + FONT_PROFILE_SEAM_END;

  return (
    templateHtml.slice(0, startIdx) +
    injectedBlock +
    templateHtml.slice(endIdx + FONT_PROFILE_SEAM_END.length)
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  manifest: string | null;
  out: string | null;
  runId: string | null;
  template: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    manifest: null,
    out: null,
    runId: null,
    template: DEFAULT_TEMPLATE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--manifest" && next) {
      args.manifest = next;
      i += 1;
    } else if (arg === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (arg === "--run-id" && next) {
      args.runId = next;
      i += 1;
    } else if (arg === "--template" && next) {
      args.template = next;
      i += 1;
    }
  }
  return args;
}

function validateManifest(raw: unknown): LandscapeTreatmentManifest {
  const m = raw as LandscapeTreatmentManifest;
  const required: Array<keyof LandscapeTreatmentManifest> = [
    "version",
    "studio",
    "canvas",
    "form",
    "sections",
    "editMoves",
    "transitions",
    "typographyCueMoveIds",
    "sfxCues",
    "soundtrack",
    "governance",
  ];
  for (const key of required) {
    if (!(key in m)) {
      throw new Error("Manifest is missing required field: " + key);
    }
  }
  if (!Array.isArray(m.sections) || !Array.isArray(m.editMoves)) {
    throw new Error("Manifest sections/editMoves must be arrays.");
  }
  if (!m.governance || typeof m.governance.allCausal !== "boolean") {
    throw new Error("Manifest governance.allCausal must be present.");
  }
  return m;
}

function printGovernance(manifest: LandscapeTreatmentManifest): void {
  const g = manifest.governance;
  console.log("[STAGE 8] Manifest governance: policyVersion=" + g.policyVersion);
  console.log("[STAGE 8] allCausal=" + String(g.allCausal));
  (g.checks || []).forEach((c) => {
    console.log("  [" + (c.pass ? "x" : " ") + "] " + c.check + " — " + c.detail);
  });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.template)) {
    console.error("Template not found: " + args.template);
    process.exit(1);
  }
  let templateHtml = fs.readFileSync(args.template, "utf8");

  // Always refresh the font profile corpus from disk (generalized long-form:
  // newly added treatment profiles flow in automatically, and the standalone
  // template's baked list stays current for standalone/demo usage too).
  const allFontProfiles = loadAllFontProfiles();
  templateHtml = injectFontProfiles(templateHtml, allFontProfiles);

  // Demo mode: no manifest → emit the template with refreshed profiles only.
  if (!args.manifest) {
    const outPath =
      args.out || path.join(studioDir, "out", "landscape_presentation_demo.html");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, templateHtml);
    console.log("[STAGE 8] Demo mode: wrote standalone template → " + outPath);
    return;
  }

  if (!fs.existsSync(args.manifest)) {
    console.error("Manifest not found: " + args.manifest);
    process.exit(1);
  }
  const rawManifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  const manifest = validateManifest(rawManifest);

  printGovernance(manifest);

  const runId = deriveRunId(manifest, args.runId || undefined);
  const runData = deriveRunData(manifest, runId);

  const outPath =
    args.out ||
    path.join(studioDir, "out", "landscape_presentation_" + runId + ".html");

  const builtHtml = injectRunData(templateHtml, runData);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, builtHtml);

  // Companion run-data artifact for API consumers (Modal microservice serves
  // this as the canonical JSON for the run).
  const runDataPath = path.join(
    path.dirname(outPath),
    "landscape_run_" + runId + ".json",
  );
  fs.writeFileSync(runDataPath, JSON.stringify(runData, null, 2), "utf8");

  const chunks = runData.transcripts.run1.chunks;
  console.log(
    "[STAGE 8] Built presentation → " +
      outPath +
      " (" +
      builtHtml.length +
      " bytes)",
  );
  console.log("[STAGE 8] Run data → " + runDataPath);
  console.log(
    "[STAGE 8] " +
      chunks.length +
      " chunks, " +
      (runData.sfxCues?.length || 0) +
      " SFX cues, " +
      (runData.transitions?.length || 0) +
      " transitions",
  );
  chunks.forEach((c) => {
    console.log(
      "  chunk " +
        c.chunkIndex +
        " [" +
        c.timestamp +
        "] " +
        c.emphasis +
        " :: " +
        c.text,
    );
  });
}

main();

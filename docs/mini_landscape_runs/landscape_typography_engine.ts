/**
 * MINI LANDSCAPE RUNS — GENERATIVE TYPOGRAPHY ENGINE
 *
 * Provides full admin access to the entire font JSON corpus (all 77+ profiles,
 * including both portrait and landscape profiles) and generative kinetic treatment
 * selection for 16:9 Landscape content.
 *
 * Removes hardcoded mock labels (e.g. "THE ONE THING") and replaces them with
 * dynamic, transcript-driven and semantic-driven kinetic typography.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  EditMove,
  LandscapeSection,
  LandscapeTreatmentManifest,
} from "./types.js";
import type { TextOverlay } from "@prometheus/shared-types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const FONT_JSON_DIR = path.join(REPO_ROOT, "Yuan Prometheus Screenshots/font JSON");
const FONT_PAIRS_DIR = path.join(REPO_ROOT, "Yuan Prometheus Screenshots/font pairing and placement");

export interface LandscapeFontProfile {
  id: string;
  filename: string;
  profileName: string;
  pairedImage: string | null;
  pairedImageExists: boolean;
  typographyLayers: Array<{
    role: string;
    fontStyle: {
      family?: string;
      sizePxBase?: number;
      weight?: number;
      color?: string;
      casing?: string;
      letterSpacingEm?: number;
    };
    matchedFontCandidates?: string[];
  }>;
  totalWords: number;
  isLandscape: boolean;
  metadata?: Record<string, any>;
}

export interface LandscapeTypographyCue {
  id: string;
  moveId: EditMove["moveId"];
  sectionId: string;
  startSec: number;
  endSec: number;
  text: string;
  heroWord: string;
  fontProfileId: string;
  fontProfileName: string;
  fontFamily: string;
  accentFont: string;
  animationPreset: string;
  isQuote: boolean;
  gradient: string;
  glow: string;
  color: string;
  fontSizePx: number;
  fontWeight: number;
  casing: string;
  behindSubject: boolean;
  xPercent: string;
  yPercent: string;
}

export interface LandscapeTypographyPlan {
  cues: LandscapeTypographyCue[];
  textOverlays: TextOverlay[];
  fontProfileCount: number;
  fullCorpusAccess: true;
}

/**
 * Loads the full font JSON corpus (all 77+ profiles).
 * Landscape has Full Admin Access — permitted to load both portrait and landscape profiles.
 */
export function loadFullLandscapeFontCorpus(): LandscapeFontProfile[] {
  if (!fs.existsSync(FONT_JSON_DIR)) {
    return [];
  }

  const files = fs.readdirSync(FONT_JSON_DIR).filter((f) => f.endsWith(".json"));
  const profiles: LandscapeFontProfile[] = [];

  for (const filename of files.sort()) {
    try {
      const fullPath = path.join(FONT_JSON_DIR, filename);
      const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      const stem = filename.replace(/\.json$/, "");
      const pairedImage = stem + ".png";
      const pairedImageExists = fs.existsSync(path.join(FONT_PAIRS_DIR, pairedImage));
      const layers = raw.typography_layers || [];

      profiles.push({
        id: stem,
        filename,
        profileName: raw.profile_name || stem,
        pairedImage: pairedImageExists ? pairedImage : null,
        pairedImageExists,
        typographyLayers: layers.map((l: any) => ({
          role: l.role || "body",
          fontStyle: {
            family: l.font_style?.family,
            sizePxBase: l.font_style?.size_px_base,
            weight: l.font_style?.weight,
            color: l.font_style?.color,
            casing: l.font_style?.casing,
            letterSpacingEm: l.font_style?.letter_spacing_em,
          },
          matchedFontCandidates: l.matched_font_candidates || [],
        })),
        totalWords: raw.metadata?.total_word_count || layers.length || 1,
        isLandscape: filename.toLowerCase().includes("landscape") || (raw.profile_name || "").toLowerCase().includes("landscape"),
        metadata: raw.metadata,
      });
    } catch {
      continue;
    }
  }

  return profiles;
}

// 12 High-Tier Tall & Cinematic Display Fonts for Widescreen 16:9 Stage
export const LANDSCAPE_DISPLAY_FONTS = [
  "Playfair Display",
  "Bodoni Moda",
  "Anton",
  "Bebas Neue",
  "Big Shoulders Display",
  "Saira Extra Condensed",
  "Oswald",
  "Montserrat",
  "Italianno",
  "Pinyon Script",
  "Inter",
  "Berylium",
];

// Generative Motion Presets for 16:9 Landscape (Strict Whitelist: Master Kinetics + User HTML suites)
export const LANDSCAPE_KINETIC_PRESETS = [
  "apple_pro_display_hero_revealer",
  "pixel_blur_mask",
  "gaussian_blur_reveal_sweep",
  "compound_word_glitch_blur_reveal",
  "masked_dual_axis_text_reveal",
  "dynamic_3d_letter_flicker",
  "dual_kinetic_phrase_convergence",
  "rise_and_deblur_compression",
  "quote_kinetic_treatment",
] as const;

export type LandscapeKineticPreset = (typeof LANDSCAPE_KINETIC_PRESETS)[number];

/**
 * Dynamically derives high-impact spoken or thematic text for a section/move.
 * Optimized for 16:9 Landscape:
 * - 5-word, 7-word, and 8-word complete phrase structures
 * - Chunks > 8 words flagged for Quote kinetic treatment
 */
function resolveDynamicCopy(
  move: EditMove,
  section?: LandscapeSection,
  index = 0
): { text: string; heroWord: string; isQuote: boolean } {
  // 1. If section carries real transcript text, extract a 5 to 8 word phrase window
  if (section?.text && section.text.trim().length > 0) {
    const rawWords = section.text.trim().split(/\s+/);
    if (rawWords.length > 8 && (section.text.includes('"') || section.text.includes('“'))) {
      // Long intact quotation
      return {
        text: section.text.trim(),
        heroWord: rawWords[rawWords.length - 1],
        isQuote: true,
      };
    }
    if (rawWords.length <= 8) {
      return {
        text: section.text.trim(),
        heroWord: rawWords[rawWords.length - 1],
        isQuote: rawWords.length > 8,
      };
    }
    // Take 5-8 word window around key concept (default 7 words)
    const windowSize = Math.min(8, Math.max(5, (index % 2 === 0 ? 7 : 5)));
    const windowStart = Math.min(
      Math.max(0, rawWords.length - windowSize),
      (index * 3) % Math.max(1, rawWords.length - windowSize + 1)
    );
    const slice = rawWords.slice(windowStart, windowStart + windowSize);
    return {
      text: slice.join(" "),
      heroWord: slice[slice.length - 1],
      isQuote: false,
    };
  }

  // 2. Dynamic contextual phrases strictly in the 5 to 8 word sweet spot
  const moveRoleMap: Record<string, string[]> = {
    emphasize_keyword: [
      "THE CRITICAL METRIC THAT DEFINES SUCCESS",
      "THIS SINGLE NUMBER DRIVES THE SYSTEM",
      "WHAT MOST OPERATORS SYSTEMATICALLY OVERLOOK IN PRACTICE",
    ],
    return_to_authority: [
      "THE BLUEPRINT THAT BUILT THIS OPERATION",
      "EXPERT BREAKDOWN OF THE PRIMARY ENGINE",
      "RETURNING DIRECTLY TO CORE FIRST PRINCIPLES",
    ],
    explain_workflow: [
      "HOW THE ARCHITECTURE EXECUTES STEP BY STEP",
      "STREAMLINED PIPELINE OPERATING AT RECORD VELOCITY",
      "THE PRECISE SEQUENCE THAT DELIVERS RESULTS",
    ],
    value_contrast: [
      "EXPONENTIAL RETURN REPLACING HEAVY MANUAL OVERHEAD",
      "THE DISPROPORTIONATE ADVANTAGE OF MODERN AUTOMATION",
      "BEFORE AND AFTER STRATEGIC WORKFLOW TRANSFORMATION",
    ],
    cta_pressure: [
      "EXECUTE IMMEDIATELY BEFORE THIS WINDOW CLOSES",
      "UNLOCK ACCESS AND TRANSFORM YOUR ARCHITECTURE TODAY",
      "DO NOT WAIT FOR CONDITIONS TO CHANGE",
    ],
    thesis_punctuation: [
      "THE DEFINITIVE TURNING POINT IN THIS FIELD",
      "UNPRECEDENTED RESULTS PROVING THE ORIGINAL THESIS",
      "EVERY SINGLE METRIC SHIFTS FROM THIS MOMENT",
    ],
    proof_insert: [
      "VERIFIED DATA BACKED BY DOCUMENTED CASE STUDIES",
      "EMPIRICAL EVIDENCE CONFIRMED ACROSS LIVE PRODUCTION WORKLOADS",
      "PROVEN METRICS AUDITED UNDER STRICT PROTOCOLS",
    ],
    focus_handoff: [
      "ATTENTION SHIFTS TO THE NEXT KEY COMPONENT",
      "LOCKING IMMEDIATE FOCUS ON PRIMARY OPERATIONAL LEVERS",
      "TRANSITIONING SYSTEM CONTROL TO AUTOMATED PIPELINES",
    ],
  };

  const pool = moveRoleMap[move.moveId] || [
    "THE CRITICAL METRIC THAT DEFINES SUCCESS",
    "THE BLUEPRINT THAT BUILT THIS OPERATION",
    "HOW THE ARCHITECTURE EXECUTES STEP BY STEP",
  ];
  const text = pool[index % pool.length];
  const words = text.split(" ");
  return {
    text,
    heroWord: words[words.length - 1],
    isQuote: words.length > 8,
  };
}

/**
 * Generates the full generative typography plan for the 16:9 Landscape treatment.
 */
export function generateLandscapeTypographyPlan(
  sections: LandscapeSection[],
  editMoves: EditMove[],
  typographyMoveIds: string[],
  fps = 30
): LandscapeTypographyPlan {
  const corpus = loadFullLandscapeFontCorpus();
  const cues: LandscapeTypographyCue[] = [];
  const textOverlays: TextOverlay[] = [];

  const moveMap = new Map(editMoves.map((m) => [m.moveId, m]));
  const sectionMap = new Map(sections.map((s) => [s.sectionId, s]));

  let profileIndex = 0;

  for (let i = 0; i < typographyMoveIds.length; i++) {
    const moveId = typographyMoveIds[i] as EditMove["moveId"];
    const move = moveMap.get(moveId);
    if (!move) continue;

    const section = sectionMap.get(move.sectionId);
    const { text, heroWord, isQuote } = resolveDynamicCopy(move, section, i);

    // High-tier screenshot profile preference
    const highTierProfiles = corpus.filter((p) =>
      ["image (1)", "image (2)", "image (3)", "image (6)", "image (8)", "image (14)", "image (15)", "image (16)", "image (17)", "image (18)", "image (21)"].includes(p.id)
    );
    const profile = (highTierProfiles.length > 0 && i < highTierProfiles.length)
      ? highTierProfiles[i % highTierProfiles.length]
      : corpus[profileIndex % Math.max(1, corpus.length)] || {
          id: "image (1)",
          profileName: "Editorial Contrast Display",
          typographyLayers: [],
        };
    profileIndex++;

    const behindSubject = Boolean(move.moveId === "emphasize_keyword" && i % 2 === 0 && text.replace(/[^a-zA-Z0-9]/g, "").length >= 5);

    // Select primary & accent font from display corpus or profile candidates
    // Behind-subject text is STRICTLY tall font
    const tallFonts = ["Anton", "Bebas Neue", "Big Shoulders Display", "Six Caps", "Teko", "Saira Extra Condensed"];
    const primaryFont = behindSubject
      ? tallFonts[i % tallFonts.length]
      : LANDSCAPE_DISPLAY_FONTS[i % LANDSCAPE_DISPLAY_FONTS.length];
    const accentFont = LANDSCAPE_DISPLAY_FONTS[(i + 3) % LANDSCAPE_DISPLAY_FONTS.length];
    const animationPreset = isQuote
      ? "quote_kinetic_treatment"
      : LANDSCAPE_KINETIC_PRESETS[i % (LANDSCAPE_KINETIC_PRESETS.length - 1)];

    const glow = behindSubject
      ? "0 0 24px rgba(255, 51, 75, 0.45)"
      : "0 0 16px rgba(255, 255, 255, 0.35)";

    const startFrame = Math.round(move.startSec * fps);
    const endFrame = Math.round(move.endSec * fps);

    const cue: LandscapeTypographyCue = {
      id: `landscape-typ-${i + 1}-${move.moveId}`,
      moveId: move.moveId,
      sectionId: move.sectionId,
      startSec: move.startSec,
      endSec: move.endSec,
      text,
      heroWord,
      isQuote,
      fontProfileId: profile.id,
      fontProfileName: profile.profileName,
      fontFamily: primaryFont,
      accentFont,
      animationPreset,
      gradient: "none",
      glow,
      color: behindSubject ? "#FF334B" : "#FFFFFF",
      fontSizePx: behindSubject ? 150 : 88,
      fontWeight: behindSubject ? 900 : 800,
      casing: "uppercase",
      behindSubject,
      xPercent: "50%",
      yPercent: behindSubject ? "34%" : "68%",
    };

    cues.push(cue);

    // Build matching TextOverlay for UnifiedRenderManifest
    textOverlays.push({
      text,
      startFrame,
      endFrame,
      animation: "pop",
      color: behindSubject ? "#FF334B" : "#FFFFFF",
    });
  }


  return {
    cues,
    textOverlays,
    fontProfileCount: corpus.length,
    fullCorpusAccess: true,
  };
}

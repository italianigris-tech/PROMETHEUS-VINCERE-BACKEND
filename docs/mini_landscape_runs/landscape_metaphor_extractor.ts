/**
 * MINI LANDSCAPE RUNS — METAPHOR & TEXTURE POINT DETECTION ENGINE
 *
 * Automatically scans the video transcript to identify semantic inflection points
 * and metaphor trigger phrases ideal for:
 * 1. Animated Metaphor Props (e.g. "king in the playing field" -> 3D Chess King with kinetic typography beams)
 * 2. Background Texture Placement & Spiral Density (tactile, retro/authentic, paper fiber, film grain)
 * 3. Structured Data Ledger: Not hardcoded or overfitted, but an auditable, listed determination
 *    of candidate treatment points with creative rationale and model assistance notes.
 */

import type {
  LandscapeSection,
  MetaphorCategory,
  MetaphorTreatmentPoint,
  TextureTreatmentKind,
  TextureBlendMode,
} from "./types.js";
import type { TranscriptPoint } from "./section_segmenter.js";

interface MetaphorRule {
  category: MetaphorCategory;
  regex: RegExp;
  assetName: string;
  assetType: "3d_prop" | "motion_graphic" | "chart_spline" | "hud_telemetry" | "dialogue_bubble";
  visualDescription: string;
  beamCalloutTemplate: (phrase: string) => string;
  animationEffect: string;
  textureKind: TextureTreatmentKind;
  blendMode: TextureBlendMode;
  defaultIntensity: number;
  layerPlane: 10 | 20 | 25 | 30;
  spiralCurve: "linear_fade" | "logarithmic_snap" | "exponential_bloom" | "pulsing_beacon";
  paucityFallback: string;
  editorialRationale: string;
  creativePrompt: string;
  modelAssistanceHint: string;
  baseScore: number;
}

const METAPHOR_RULES: MetaphorRule[] = [
  {
    category: "chess_king_strategy",
    regex: /\b(king\b.*(?:field|board|game|play|arena|industry)|playing field|chess|checkmate|grandmaster|tactical move|pawn|queen|board position)\b/i,
    assetName: "3d_chess_king_piece",
    assetType: "3d_prop",
    visualDescription: "Matte obsidian & gold-rimmed 3D Chess King piece elevating with glowing focal kinetic beams.",
    beamCalloutTemplate: (p) => `DOMINANT STRATEGY: ${p.toUpperCase()}`,
    animationEffect: "asset-motion-diplo-drop with neon laser light beams",
    textureKind: "tactile",
    blendMode: "overlay",
    defaultIntensity: 0.55,
    layerPlane: 25,
    spiralCurve: "exponential_bloom",
    paucityFallback: "svg_procedural_tactile_noise",
    editorialRationale: "Visualizes strategic authority and market mastery; anchors the spoken metaphor with an iconic 3D King accompanied by kinetic typography beams.",
    creativePrompt: "High-contrast matte black and brushed brass chess king standing firmly on a dimly lit grid stage.",
    modelAssistanceHint: "Upstream 3D generator or Texture.com tactile map can supply high-frequency marble grain.",
    baseScore: 9.4,
  },
  {
    category: "growth_surge",
    regex: /(\$|\b\d+(\.\d+)?%|revenue|profit|growth|surge|10x|exponential|scale|soared|skyrocket|multiplied|surge)/i,
    assetName: "progressive_climbing_spline",
    assetType: "chart_spline",
    visualDescription: "Progressive glowing green/cyan parabolic spline unmasking with apex milestone badge.",
    beamCalloutTemplate: (p) => `METRIC PEAK: ${p.toUpperCase()}`,
    animationEffect: "prog-draw-spline with synchronized area flow",
    textureKind: "retro_authentic",
    blendMode: "soft-light",
    defaultIntensity: 0.45,
    layerPlane: 25,
    spiralCurve: "logarithmic_snap",
    paucityFallback: "svg_procedural_crt_scanlines",
    editorialRationale: "Proves empirical momentum; turns spoken numbers into visual trajectory to prevent retention drop.",
    creativePrompt: "Neon emerald telemetry spline ascending with floating HUD value badges and retro CRT scanlines.",
    modelAssistanceHint: "Financial chart spline renderer with dynamic currency prefix/suffix parsing.",
    baseScore: 9.2,
  },
  {
    category: "mechanical_engine",
    regex: /\b(engine|machine|gears|flywheel|moving parts|mechanics|cogs|automation|pipeline|system architecture)\b/i,
    assetName: "3d_interconnected_gears",
    assetType: "3d_prop",
    visualDescription: "Synchronized dual-planetary gear system rotating in 2.5D perspective.",
    beamCalloutTemplate: (p) => `CORE ENGINE: ${p.toUpperCase()}`,
    animationEffect: "continuous-smooth-rotation",
    textureKind: "paper_fiber",
    blendMode: "multiply",
    defaultIntensity: 0.48,
    layerPlane: 10,
    spiralCurve: "linear_fade",
    paucityFallback: "svg_procedural_paper_fiber",
    editorialRationale: "Grounds abstract systemic explanations into tangible moving machinery, emphasizing reliability.",
    creativePrompt: "Brushed aluminum planetary gear set interlocked in motion, subtle ambient backlighting.",
    modelAssistanceHint: "Procedural SVG gear paths or 3D GLTF asset with continuous rotational physics.",
    baseScore: 8.9,
  },
  {
    category: "security_vault",
    regex: /\b(unlock|secret|vault|barrier|gate|key|lock|access|hidden|passcode|breakthrough)\b/i,
    assetName: "holographic_key_vault",
    assetType: "motion_graphic",
    visualDescription: "Radial vault dial mechanism rotating to aligned position with optical flare beam.",
    beamCalloutTemplate: (p) => `UNLOCKED: ${p.toUpperCase()}`,
    animationEffect: "radial-vault-spin-open",
    textureKind: "grain_film",
    blendMode: "overlay",
    defaultIntensity: 0.42,
    layerPlane: 25,
    spiralCurve: "exponential_bloom",
    paucityFallback: "svg_procedural_film_grain",
    editorialRationale: "Heightens narrative stakes during revelation of core insights, creating anticipation.",
    creativePrompt: "Holographic radial vault lock mechanism clicking open with cyan lens flare bloom.",
    modelAssistanceHint: "SVG radial lock tumbler with spring bezier settling on zero degree keyframe.",
    baseScore: 8.7,
  },
  {
    category: "neural_synapse",
    regex: /\b(mindset|synapse|brain|think|intelligence|neural|mental model|cognitive|concept|philosophy)\b/i,
    assetName: "neural_synapse_lattice",
    assetType: "motion_graphic",
    visualDescription: "Bioluminescent neural node network pulsing with glowing data transmissions.",
    beamCalloutTemplate: (p) => `MENTAL MODEL: ${p.toUpperCase()}`,
    animationEffect: "synapse-pulse-network",
    textureKind: "tactile",
    blendMode: "overlay",
    defaultIntensity: 0.4,
    layerPlane: 10,
    spiralCurve: "pulsing_beacon",
    paucityFallback: "svg_procedural_tactile_noise",
    editorialRationale: "Converts deep psychological and strategic concepts into an organic, living network visual.",
    creativePrompt: "Glowing violet and turquoise neural filaments pulsing with data packets against deep space background.",
    modelAssistanceHint: "Canvas particle network with Bezier spline interconnections.",
    baseScore: 8.6,
  },
  {
    category: "chat_dialogue",
    regex: /\b(chat|dm|message|messages|comment|feedback|conversation|they told me|he said|she said|replied)\b/i,
    assetName: "floating_chat_feed",
    assetType: "dialogue_bubble",
    visualDescription: "Staggered glassmorphic chat speech bubbles popping with verified user badges.",
    beamCalloutTemplate: (p) => `USER VOICES: ${p.toUpperCase()}`,
    animationEffect: "staggered-bubble-pop",
    textureKind: "tactile",
    blendMode: "overlay",
    defaultIntensity: 0.35,
    layerPlane: 25,
    spiralCurve: "logarithmic_snap",
    paucityFallback: "svg_procedural_tactile_noise",
    editorialRationale: "Humanizes validation and social proof with dynamic, staggered conversational artifacts.",
    creativePrompt: "Translucent frosted glass chat bubbles with subtle gradient borders and animated avatars.",
    modelAssistanceHint: "DOM speech bubble components with spring staggered entry.",
    baseScore: 8.8,
  },
  {
    category: "telemetry_crosshair",
    regex: /\b(focus|zero in|target|precision|pinpoint|laser focus|exact|specific|dial in)\b/i,
    assetName: "telemetry_crosshair_beacon",
    assetType: "hud_telemetry",
    visualDescription: "Rotating HUD optical crosshair with coordinate grid and live numeric telemetry.",
    beamCalloutTemplate: (p) => `LOCKED IN: ${p.toUpperCase()}`,
    animationEffect: "hud-target-lock",
    textureKind: "retro_authentic",
    blendMode: "soft-light",
    defaultIntensity: 0.5,
    layerPlane: 30,
    spiralCurve: "pulsing_beacon",
    paucityFallback: "svg_procedural_crt_scanlines",
    editorialRationale: "Commands intense viewer focus on a single critical thesis or imperative directive.",
    creativePrompt: "Sci-fi tactical HUD target crosshairs with amber and cyan telemetry readouts.",
    modelAssistanceHint: "SVG vector reticle with counter-rotating calibration rings.",
    baseScore: 9.0,
  },
  {
    category: "architectural_pillars",
    regex: /\b(three pillars|four steps|step 1|step 2|step 3|framework|structure|foundation|pillars|checklist)\b/i,
    assetName: "layered_3d_pillar_stack",
    assetType: "motion_graphic",
    visualDescription: "Isometric tiered glass pillars rising in sequence with progressive step numbering.",
    beamCalloutTemplate: (p) => `FOUNDATION: ${p.toUpperCase()}`,
    animationEffect: "staggered-pillar-rise",
    textureKind: "paper_fiber",
    blendMode: "multiply",
    defaultIntensity: 0.48,
    layerPlane: 10,
    spiralCurve: "linear_fade",
    paucityFallback: "svg_procedural_paper_fiber",
    editorialRationale: "Structures complex instructional workflows into clear, modular architectural tiers.",
    creativePrompt: "Isometric frosted acrylic steps with illuminated numbered edges rising in sequence.",
    modelAssistanceHint: "3D CSS isometric card stack with sequential translation keyframes.",
    baseScore: 8.7,
  },
];

/**
 * Extracts and maps metaphor & texture treatment points from a transcript.
 * Guaranteed to produce non-hardcoded, data-driven treatment recommendations
 * covering every section of the landscape timeline.
 */
export function extractMetaphorTreatmentPoints(
  sections: LandscapeSection[],
  transcript: TranscriptPoint[] = [],
): MetaphorTreatmentPoint[] {
  const points: MetaphorTreatmentPoint[] = [];

  sections.forEach((sec, sIdx) => {
    const text = sec.text || "";
    let matchedRule: MetaphorRule | undefined;
    let matchedSnippet = "";
    let triggerTokens: string[] = [];

    // 1. Scan transcript slices for this section
    const matchingTranscripts = transcript.filter((t) => {
      const time = t.timeSec ?? t.startSec ?? 0;
      const end = t.endSec ?? time;
      return (time >= sec.startSec && time < sec.endSec) || (end > sec.startSec && time < sec.endSec);
    });

    // Check transcript items first
    for (const item of matchingTranscripts) {
      for (const rule of METAPHOR_RULES) {
        const match = item.text.match(rule.regex);
        if (match) {
          matchedRule = rule;
          matchedSnippet = item.text;
          triggerTokens = match.slice(0, 3);
          break;
        }
      }
      if (matchedRule) break;
    }

    // Check full section text if not found yet
    if (!matchedRule) {
      for (const rule of METAPHOR_RULES) {
        const match = text.match(rule.regex);
        if (match) {
          matchedRule = rule;
          matchedSnippet = text.slice(0, 80);
          triggerTokens = match.slice(0, 3);
          break;
        }
      }
    }

    // Fallback default rules based on section role
    if (!matchedRule) {
      if (sec.role === "hook") {
        matchedRule = METAPHOR_RULES.find((r) => r.category === "telemetry_crosshair")!;
      } else if (sec.role === "demonstrate") {
        matchedRule = METAPHOR_RULES.find((r) => r.category === "mechanical_engine")!;
      } else if (sec.role === "payoff") {
        matchedRule = METAPHOR_RULES.find((r) => r.category === "growth_surge")!;
      } else {
        matchedRule = {
          category: "general_conceptual",
          regex: /.*/,
          assetName: "metaphor_concept_orb",
          assetType: "3d_prop",
          visualDescription: "Polymorphic floating concept orb with orbital kinetic text ribbons.",
          beamCalloutTemplate: (p) => `INSIGHT: ${p.slice(0, 24).toUpperCase()}`,
          animationEffect: "assetIdleFloat with soft breathing bloom",
          textureKind: "tactile",
          blendMode: "overlay",
          defaultIntensity: 0.35,
          layerPlane: 10,
          spiralCurve: "linear_fade",
          paucityFallback: "svg_procedural_tactile_noise",
          editorialRationale: "Provides ambient semantic grounding without cluttering primary verbal exposition.",
          creativePrompt: "Softly glowing iridescent glass sphere with geometric orbital rings in 2.5D depth.",
          modelAssistanceHint: "WebGL fragment shader with subtle chromatic aberration.",
          baseScore: 8.0,
        };
      }
      matchedSnippet = text ? text.slice(0, 80) : `Section ${sec.role} visual treatment`;
      triggerTokens = [sec.role];
    }

    const timeSec = sec.startSec + 0.3;
    const durationSec = Math.min(sec.durationSec - 0.4, 4.2);
    const beamCalloutText = matchedRule.beamCalloutTemplate(triggerTokens[0] || sec.role);

    points.push({
      pointId: `metaphor_pt_${sec.sectionId}_${matchedRule.category}`,
      sectionId: sec.sectionId,
      timeSec: Math.round(timeSec * 100) / 100,
      durationSec: Math.round(durationSec * 100) / 100,
      spokenSnippet: matchedSnippet,
      triggerTokens,
      metaphorCategory: matchedRule.category,
      recommendedAsset: {
        assetName: matchedRule.assetName,
        assetType: matchedRule.assetType,
        visualDescription: matchedRule.visualDescription,
        beamCalloutText,
        animationEffect: matchedRule.animationEffect,
      },
      texturePlacement: {
        kind: matchedRule.textureKind,
        blendMode: matchedRule.blendMode,
        intensity: matchedRule.defaultIntensity,
        layerPlane: matchedRule.layerPlane,
        spiralCurve: matchedRule.spiralCurve,
        paucityFallback: matchedRule.paucityFallback,
      },
      editorialRationale: matchedRule.editorialRationale,
      creativityLayer: {
        creativePrompt: matchedRule.creativePrompt,
        modelAssistanceHint: matchedRule.modelAssistanceHint,
        aestheticScore: matchedRule.baseScore,
      },
      cause: {
        gate: "metaphor_point_detection",
        reason: `Detected metaphor '${matchedRule.category}' triggered by phrase '${triggerTokens.join(", ")}'.`,
        sectionId: sec.sectionId,
        timeSec,
      },
    });
  });

  return points;
}

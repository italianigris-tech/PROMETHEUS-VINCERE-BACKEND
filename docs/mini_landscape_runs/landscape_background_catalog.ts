/**
 * MINI LANDSCAPE RUNS — UNIFIED BACKGROUND ASSET CATALOG & COVERAGE ENGINE
 *
 * Consolidates all background utilities into one authoritative module:
 * 1. 44 High-Resolution Texturelabs Assets (Fabric, Paper, InkPaint, Grunge, Glass).
 * 2. 11 Landscape B-Roll & Proof Video Assets (Cinematic Documentary, Viral Reels, Scared of Achieving, etc.).
 * 3. 8 Dogma High-Quality Landscape Base Images.
 * 4. Dynamic Background Coverage Engine: Generates frame-accurate BackgroundCoveragePlans
 *    to orchestrate background coverages (texture overlay, video b-roll, motion stage composite, clean anchor).
 */

import type {
  BackgroundCoveragePlan,
  BackgroundCoverageType,
  BackgroundRigKind,
  ConceptAnimationKind,
  EditMove,
  HandOfGodBlueprint,
  LandscapeSection,
  TextureBlendMode,
  TextureTreatmentKind,
} from "./types.js";

// ===========================================================================
// 1. UNIFIED TEXTURE UTILITY CATALOG (44 Texturelabs Assets)
// ===========================================================================

export interface TextureAssetDefinition {
  id: string;
  name: string;
  family: "fabric" | "paper" | "ink_paint" | "grunge" | "glass";
  fileName: string;
  filePath: string;
  defaultBlendMode: TextureBlendMode;
  defaultIntensity: number;
  proceduralFallback: string;
  moodTags: string[];
}

export const UNIFIED_TEXTURE_CATALOG: readonly TextureAssetDefinition[] = [
  // Fabrics (14 assets)
  { id: "tex_fabric_120", name: "Heavy Canvas Weave", family: "fabric", fileName: "Texturelabs_Fabric_120XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_120XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.45, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["tactile", "warm", "editorial"] },
  { id: "tex_fabric_121", name: "Fine Linen Weave", family: "fabric", fileName: "Texturelabs_Fabric_121L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_121L.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.4, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["tactile", "minimal"] },
  { id: "tex_fabric_127", name: "Crosshatch Cotton", family: "fabric", fileName: "Texturelabs_Fabric_127L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_127L.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.42, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["tactile", "structured"] },
  { id: "tex_fabric_136", name: "Textured Denim", family: "fabric", fileName: "Texturelabs_Fabric_136L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_136L.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.46, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["raw", "tactile"] },
  { id: "tex_fabric_139", name: "Soft Wool Fiber", family: "fabric", fileName: "Texturelabs_Fabric_139L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_139L.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.38, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["warm", "cozy"] },
  { id: "tex_fabric_145", name: "Micro Mesh Weave", family: "fabric", fileName: "Texturelabs_Fabric_145L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_145L.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.35, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["tech", "tactile"] },
  { id: "tex_fabric_147", name: "Coarse Burlap", family: "fabric", fileName: "Texturelabs_Fabric_147L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_147L.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.5, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["raw", "organic"] },
  { id: "tex_fabric_172", name: "Pressed Wool Felt", family: "fabric", fileName: "Texturelabs_Fabric_172XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_172XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.44, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["editorial", "tactile"] },
  { id: "tex_fabric_174", name: "Vintage Twill", family: "fabric", fileName: "Texturelabs_Fabric_174XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_174XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.48, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["vintage", "classic"] },
  { id: "tex_fabric_178", name: "Silk Crepe Mesh", family: "fabric", fileName: "Texturelabs_Fabric_178XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_178XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.32, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["luxury", "smooth"] },
  { id: "tex_fabric_183", name: "Heavy Corduroy", family: "fabric", fileName: "Texturelabs_Fabric_183XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_183XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.52, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["tactile", "deep"] },
  { id: "tex_fabric_187", name: "Textured Knit", family: "fabric", fileName: "Texturelabs_Fabric_187XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_187XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.47, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["warm", "organic"] },
  { id: "tex_fabric_189", name: "Fine Satin Weave", family: "fabric", fileName: "Texturelabs_Fabric_189XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_189XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.34, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["luxury", "smooth"] },
  { id: "tex_fabric_194", name: "Distressed Velvet", family: "fabric", fileName: "Texturelabs_Fabric_194XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Fabric_194XL.jpg", defaultBlendMode: "overlay", defaultIntensity: 0.55, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["rich", "cinematic"] },

  // Glass (1 asset)
  { id: "tex_glass_121", name: "Frosted Glass Surface", family: "glass", fileName: "Texturelabs_Glass_121L.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Glass_121L.jpg", defaultBlendMode: "screen", defaultIntensity: 0.4, proceduralFallback: "svg_procedural_tactile_noise", moodTags: ["glassmorphic", "modern", "ui"] },

  // Grunge (1 asset)
  { id: "tex_grunge_146", name: "Distressed Concrete Grunge", family: "grunge", fileName: "Texturelabs_Grunge_146XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Grunge_146XL.jpg", defaultBlendMode: "soft-light", defaultIntensity: 0.5, proceduralFallback: "svg_procedural_film_grain", moodTags: ["grunge", "crisis", "raw"] },

  // Ink & Paint (4 assets)
  { id: "tex_ink_325", name: "Smoked Ink Wash", family: "ink_paint", fileName: "Texturelabs_InkPaint_325XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_InkPaint_325XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.42, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["ink", "editorial", "fluid"] },
  { id: "tex_ink_397", name: "Dark Fluid Marbling", family: "ink_paint", fileName: "Texturelabs_InkPaint_397XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_InkPaint_397XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.46, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["fluid", "abstract"] },
  { id: "tex_ink_403", name: "Acrylic Splatter Wash", family: "ink_paint", fileName: "Texturelabs_InkPaint_403XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_InkPaint_403XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.48, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["dynamic", "creative"] },
  { id: "tex_ink_404", name: "Heavy Pigment Layer", family: "ink_paint", fileName: "Texturelabs_InkPaint_404XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_InkPaint_404XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.52, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["dense", "cinematic"] },

  // Paper (24 assets)
  { id: "tex_paper_270", name: "Smooth Cardstock", family: "paper", fileName: "Texturelabs_Paper_270XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_270XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.38, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["clean", "minimal"] },
  { id: "tex_paper_271", name: "Recycled Kraft Fiber", family: "paper", fileName: "Texturelabs_Paper_271XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_271XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.45, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["kraft", "organic"] },
  { id: "tex_paper_272", name: "Heavy Watercolor Grain", family: "paper", fileName: "Texturelabs_Paper_272XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_272XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.48, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["artistic", "tactile"] },
  { id: "tex_paper_274", name: "Pressed Charcoal Pulp", family: "paper", fileName: "Texturelabs_Paper_274XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_274XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.52, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["dark", "crisis", "tactile"] },
  { id: "tex_paper_277", name: "Aged Parchment", family: "paper", fileName: "Texturelabs_Paper_277XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_277XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.44, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["vintage", "warm"] },
  { id: "tex_paper_291", name: "Off-White Cotton Sheet", family: "paper", fileName: "Texturelabs_Paper_291XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_291XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.36, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["editorial", "clean"] },
  { id: "tex_paper_293", name: "Fibrous Botanical Paper", family: "paper", fileName: "Texturelabs_Paper_293XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_293XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.47, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["organic", "botanical"] },
  { id: "tex_paper_299", name: "Crisp Bond Paper", family: "paper", fileName: "Texturelabs_Paper_299XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_299XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.34, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["minimal", "clean"] },
  { id: "tex_paper_310", name: "Rough Speckled Pulp", family: "paper", fileName: "Texturelabs_Paper_310XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_310XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.49, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["raw", "tactile"] },
  { id: "tex_paper_312", name: "Mottled Cream Stock", family: "paper", fileName: "Texturelabs_Paper_312XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_312XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.42, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["editorial", "warm"] },
  { id: "tex_paper_314", name: "Fine Tracing Vellum", family: "paper", fileName: "Texturelabs_Paper_314XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_314XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.3, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["vellum", "light"] },
  { id: "tex_paper_318", name: "Heavy Rag Board", family: "paper", fileName: "Texturelabs_Paper_318XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_318XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.54, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["structured", "board"] },
  { id: "tex_paper_337", name: "Textured Construction Paper", family: "paper", fileName: "Texturelabs_Paper_337XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_337XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.46, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["tactile", "bold"] },
  { id: "tex_paper_339", name: "Thin Newsprint", family: "paper", fileName: "Texturelabs_Paper_339XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_339XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.37, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["newsprint", "editorial"] },
  { id: "tex_paper_350", name: "Rich Charcoal Fiber Sheet", family: "paper", fileName: "Texturelabs_Paper_350XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_350XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.55, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["dark", "list_stack", "tactile"] },
  { id: "tex_paper_351", name: "Bleached Matte Paper", family: "paper", fileName: "Texturelabs_Paper_351XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_351XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.33, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["clean", "matte"] },
  { id: "tex_paper_352", name: "Dense Fiber Stock", family: "paper", fileName: "Texturelabs_Paper_352XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_352XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.44, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["structured", "tactile"] },
  { id: "tex_paper_356", name: "Fine Embossed Board", family: "paper", fileName: "Texturelabs_Paper_356XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_356XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.43, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["embossed", "luxury"] },
  { id: "tex_paper_359", name: "Handmade Deckle Edge", family: "paper", fileName: "Texturelabs_Paper_359XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_359XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.51, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["artisan", "organic"] },
  { id: "tex_paper_363", name: "Coarse Pulp Mat", family: "paper", fileName: "Texturelabs_Paper_363XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_363XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.53, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["raw", "tactile"] },
  { id: "tex_paper_369", name: "Deep Charcoal Grid Grain", family: "paper", fileName: "Texturelabs_Paper_369XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_369XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.56, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["grid", "dark", "cinematic"] },
  { id: "tex_paper_370", name: "Heavy Grain Backboard", family: "paper", fileName: "Texturelabs_Paper_370XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_370XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.52, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["heavy", "board"] },
  { id: "tex_paper_377", name: "Dark Stippled Pulp", family: "paper", fileName: "Texturelabs_Paper_377XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_377XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.57, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["dark", "stippled"] },
  { id: "tex_paper_380", name: "Maximum Texture Fiber Canvas", family: "paper", fileName: "Texturelabs_Paper_380XL.jpg", filePath: "mini_run_pipeline/textures/Texturelabs_Paper_380XL.jpg", defaultBlendMode: "multiply", defaultIntensity: 0.6, proceduralFallback: "svg_procedural_paper_fiber", moodTags: ["heavy", "tactile", "expressive"] },
];

// ===========================================================================
// 2. UNIFIED VIDEO UTILITY CATALOG (11 Landscape B-Roll Assets)
// ===========================================================================

export interface VideoAssetDefinition {
  id: string;
  name: string;
  filePath: string;
  category: "cinematic_broll" | "proof_case_study" | "talking_head_anchor" | "editorial_demonstration";
  coverMode: "fill" | "contain";
  recommendedRoleAffinity: Array<LandscapeSection["role"]>;
}

export const UNIFIED_VIDEO_CATALOG: readonly VideoAssetDefinition[] = [
  { id: "vid_dan_martell_achieving", name: "Dan Martell - Scared of Achieving", filePath: "LANDSCAPE VIDEOS FOR USE/Dan Martell, Scared of Achieving SHORT VER.mp4", category: "cinematic_broll", coverMode: "fill", recommendedRoleAffinity: ["hook", "payoff"] },
  { id: "vid_talking_head_raw", name: "Talking Head Video Raw (Akimbosd)", filePath: "LANDSCAPE VIDEOS FOR USE/Talking Head Video Raw - akimbosd (1080p, h264).mp4", category: "talking_head_anchor", coverMode: "fill", recommendedRoleAffinity: ["setup", "explain"] },
  { id: "vid_unedited_better_editor", name: "Unedited Videos Made Me a Better Editor", filePath: "LANDSCAPE VIDEOS FOR USE/Unedited Videos Made Me a Better Editor_ Here's How....mp4", category: "editorial_demonstration", coverMode: "fill", recommendedRoleAffinity: ["demonstrate", "explain"] },
  { id: "vid_joseph_gadzhi_edit", name: "How to Edit Like Gadzhi (Joseph)", filePath: "JOSEPH VIDEO PROOF/HOW TO EDIT LIKE GADZHI --JOSEPH first video.mp4", category: "proof_case_study", coverMode: "fill", recommendedRoleAffinity: ["demonstrate", "payoff"] },
  { id: "vid_joseph_cinematic_doc", name: "How to Edit Cinematic Documentary", filePath: "JOSEPH VIDEO PROOF/How_to_Edit_Cinematic_Documentary_     second video.mp4", category: "cinematic_broll", coverMode: "fill", recommendedRoleAffinity: ["hook", "payoff"] },
  { id: "vid_joseph_top_questions", name: "Top Video Editing Questions in 15min", filePath: "JOSEPH VIDEO PROOF/Answering_Your_Top_Video_Editing_Questions_in_15minutes     third video.mp4", category: "editorial_demonstration", coverMode: "fill", recommendedRoleAffinity: ["explain", "demonstrate"] },
  { id: "vid_joseph_viral_ig_reels", name: "How to Edit Viral IG Reels (4th)", filePath: "JOSEPH VIDEO PROOF/YouTube_How-to-Edit-Viral-Instagram-Reels      fourth video.mp4", category: "proof_case_study", coverMode: "fill", recommendedRoleAffinity: ["demonstrate"] },
  { id: "vid_joseph_viral_reels_5th", name: "How to Edit Viral Cinematic Reels (5th)", filePath: "JOSEPH VIDEO PROOF/How_to_Edit_Viral_Cinematic_Reels    fifth video.mp4", category: "proof_case_study", coverMode: "fill", recommendedRoleAffinity: ["hook", "payoff"] },
  { id: "vid_strong_text_use_1", name: "Strong Typography Demonstration", filePath: "Yuan Prometheus Screenshots/videos/strong text use.mp4", category: "editorial_demonstration", coverMode: "fill", recommendedRoleAffinity: ["demonstrate"] },
  { id: "vid_strong_text_use_2", name: "Strong Text Use (Variant)", filePath: "Yuan Prometheus Screenshots/videos/also strong text use.mp4", category: "editorial_demonstration", coverMode: "fill", recommendedRoleAffinity: ["demonstrate"] },
  { id: "vid_cursive_styling", name: "Cursive Text Styling Demo", filePath: "Yuan Prometheus Screenshots/videos/cursive text styling.mp4", category: "editorial_demonstration", coverMode: "fill", recommendedRoleAffinity: ["explain"] },
];

// ===========================================================================
// 3. BACKGROUND COVERAGE ENGINE
// ===========================================================================

/**
 * Computes dynamic background coverage plans across all sections:
 * Selects the optimal texture, video plate, or motion stage composite.
 */
export function scheduleBackgroundCoverages(
  sections: LandscapeSection[],
  editMoves: EditMove[],
  handOfGodBlueprint?: HandOfGodBlueprint | null,
): BackgroundCoveragePlan[] {
  const totalDurationSec =
    sections.length > 0 ? Math.max(...sections.map((s) => s.endSec)) : 0;

  // Strict Sparsity Budget:
  // <= 240s (up to 4 minutes): Max 1 background coverage moment (covering <= 15% of runtime)
  // <= 600s (up to 10 minutes): Max 2-3 moments
  // > 600s (30-40 min longform): Max 5-7 moments total (Joseph Edit Grammar)
  const maxCoverages =
    totalDurationSec <= 240 ? 1 : totalDurationSec <= 600 ? 2 : 5;

  // Score candidate sections for high-impact background coverage
  const scoredCandidates = sections.map((sec, idx) => {
    const text = (sec.text || "").toLowerCase();
    const directive =
      handOfGodBlueprint?.directives[idx] ||
      handOfGodBlueprint?.directives.find((d) => d.sectionId === sec.sectionId);

    let score = 0;
    let candidateType: BackgroundCoverageType = "clean_anchor";

    // High salience: Structured multi-pillar transformation / list stack
    if (
      directive?.macroTreatment === "list_stack" ||
      /(1\.|2\.|3\.|first|second|third|pillars|habits|steps)/i.test(text) ||
      (text.includes("clearer") && text.includes("easier"))
    ) {
      score = 100;
      candidateType = "motion_stage_composite";
    }
    // High salience: Concrete screencast workflow demonstration with PiP
    else if (
      directive?.macroTreatment === "picture_in_picture" ||
      /(screen|calendar|dashboard|workflow)/i.test(text)
    ) {
      score = 80;
      candidateType = "motion_stage_composite";
    }
    // High salience: Crisis shockwave
    else if (
      directive?.valence === "negative_crisis" ||
      /(broke|broken|gave out|collapse)/i.test(text)
    ) {
      score = 75;
      candidateType = "texture_overlay";
    }

    return {
      sec,
      idx,
      score,
      candidateType,
    };
  });

  // Select only the top K candidates within budget that score >= 75
  const eligibleCandidates = scoredCandidates
    .filter((c) => c.score >= 75)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCoverages);

  const selectedSectionIds = new Set(eligibleCandidates.map((c) => c.sec.sectionId));

  return sections.map((sec, idx) => {
    const text = (sec.text || "").toLowerCase();
    const durationSec = sec.durationSec || sec.endSec - sec.startSec;
    const isSelected = selectedSectionIds.has(sec.sectionId);
    const directive =
      handOfGodBlueprint?.directives[idx] ||
      handOfGodBlueprint?.directives.find((d) => d.sectionId === sec.sectionId);

    if (!isSelected) {
      return {
        coverageId: `coverage_${sec.sectionId}_clean_anchor`,
        sectionId: sec.sectionId,
        startSec: sec.startSec,
        endSec: sec.endSec,
        durationSec,
        coverageType: "clean_anchor",
        transition: { kind: "none", durationMs: 0 },
        causalIntent: "Clean anchor talking head presentation (default A-roll authority).",
        cause: {
          gate: "background_rig",
          reason: "Default A-roll anchor; background coverage restrained for salience.",
          sectionId: sec.sectionId,
          timeSec: sec.startSec,
        },
      };
    }

    // Process the selected high-impact background coverage
    let coverageType: BackgroundCoverageType = "motion_stage_composite";
    let textureAsset: BackgroundCoveragePlan["textureAsset"];
    let videoAsset: BackgroundCoveragePlan["videoAsset"];
    let stageComposite: BackgroundCoveragePlan["stageComposite"];
    let transitionKind: BackgroundCoveragePlan["transition"]["kind"] = "directional_slide_right";
    let causalIntent = "High-impact background motion coverage.";

    if (
      directive?.macroTreatment === "list_stack" ||
      /(1\.|2\.|3\.|first|second|third|pillars|habits|steps|clearer)/i.test(text)
    ) {
      coverageType = "motion_stage_composite";
      textureAsset = {
        id: "tex_paper_350",
        filePath: "mini_run_pipeline/textures/Texturelabs_Paper_350XL.jpg",
        family: "paper",
        blendMode: "multiply",
        intensity: 0.48,
      };
      stageComposite = {
        stageKind: "list_stack_stage",
        conceptAnimation: "animated_list",
        mattingMaskRequired: true,
        speakerOffsetX: 0.30,
      };
      transitionKind = "directional_slide_right";
      causalIntent = "Multi-pillar list stack coverage with Paper Fiber 350XL and 30% right speaker offset.";
    } else if (directive?.macroTreatment === "picture_in_picture" || /(screen|calendar|dashboard)/i.test(text)) {
      coverageType = "motion_stage_composite";
      textureAsset = {
        id: "tex_glass_121",
        filePath: "mini_run_pipeline/textures/Texturelabs_Glass_121L.jpg",
        family: "glass",
        blendMode: "screen",
        intensity: 0.35,
      };
      stageComposite = {
        stageKind: "workflow_demo",
        conceptAnimation: "animated_concept",
        mattingMaskRequired: true,
        speakerOffsetX: 0.30,
      };
      transitionKind = "directional_slide_left";
      causalIntent = "Workflow demonstration screencast coverage with Frosted Glass 121L.";
    } else {
      coverageType = "texture_overlay";
      textureAsset = {
        id: "tex_paper_274",
        filePath: "mini_run_pipeline/textures/Texturelabs_Paper_274XL.jpg",
        family: "paper",
        blendMode: "multiply",
        intensity: 0.52,
      };
      stageComposite = {
        stageKind: "concept_canvas",
        conceptAnimation: "metaphor_node",
        mattingMaskRequired: true,
        speakerOffsetX: 0.0,
      };
      transitionKind = "zoom_punch";
      causalIntent = "Crisis shockwave coverage using Pressed Charcoal Pulp 274XL with room dimming.";
    }

    return {
      coverageId: `coverage_${sec.sectionId}_${coverageType}`,
      sectionId: sec.sectionId,
      startSec: sec.startSec,
      endSec: sec.endSec,
      durationSec,
      coverageType,
      textureAsset,
      videoAsset,
      stageComposite,
      transition: {
        kind: transitionKind,
        durationMs: 650,
      },
      causalIntent,
      cause: {
        gate: "background_rig",
        reason: causalIntent,
        sectionId: sec.sectionId,
        timeSec: sec.startSec,
      },
    };
  });
}

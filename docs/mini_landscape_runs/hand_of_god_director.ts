/**
 * MINI LANDSCAPE RUNS — THE "HAND OF GOD" COMPILER & DIRECTIVE RECONCILER
 *
 * Implements the pliable macro-creative director layer (LLM "Hand of God"):
 * Covers all 14 macro domains:
 * 1. Camera zones & zooms
 * 2. Negative treatment & crisis shockwaves
 * 3. Lexicon (semantic triggers & keywords)
 * 4. Cuts (pacing & cadence)
 * 5. Animation (2.5D layer motion)
 * 6. Background (stage rigs & lighting)
 * 7. Audio change suggestion (mood, energy, risers)
 * 8. Lists (multi-pillar stacks)
 * 9. PIP treatment (presence, placement, scale)
 * 10. Picture-in-picture style & screen source
 * 11. Asset suggestion (combinatorial metaphor assets)
 * 12. Framing & reframing (speaker positioning, split-screen offsets)
 * 13. B-roll / cutaway strategy
 * 14. Color / visual treatment (textures, scanlines, fiber, grain)
 *
 * Strict Boundary Policy:
 * Typography & Text Hierarchy and Sound Design / SFX are EXCLUDED and remain
 * 100% strictly owned by Prometheus Core, the 71 QPs, and the audio engine.
 */

import type {
  BackgroundRig,
  CameraMovePlan,
  HandOfGodBlueprint,
  HandOfGodSectionDirective,
  LandscapeSection,
  MetaphorTreatmentPoint,
  PipInsetPlan,
  TextureTreatmentKind,
} from "./types.js";
import type { TranscriptPoint } from "./section_segmenter.js";

/**
 * Compiles the full 14-area Hand of God Blueprint from transcript analysis,
 * or validates and completes an injected LLM JSON blueprint.
 */
export function compileHandOfGodBlueprint(
  sections: LandscapeSection[],
  transcript: TranscriptPoint[] = [],
  injectedBlueprint?: Partial<HandOfGodBlueprint> | null,
): HandOfGodBlueprint {
  if (injectedBlueprint && Array.isArray(injectedBlueprint.directives) && injectedBlueprint.directives.length === sections.length) {
    return {
      version: "1.0.0",
      source: injectedBlueprint.source || "llm_generated",
      modelName: injectedBlueprint.modelName || "gpt-4o-director",
      globalVibe: injectedBlueprint.globalVibe || { primaryPacing: "adaptive", motionTone: "editorial" },
      directives: injectedBlueprint.directives as HandOfGodSectionDirective[],
    };
  }

  const directives: HandOfGodSectionDirective[] = sections.map((sec, idx) => {
    const text = (sec.text || "").toLowerCase();

    // 1. Lexicon extraction
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    const triggerTokens = words.filter(w => ["camera", "lens", "idea", "broke", "fail", "king", "growth", "calendar", "screen", "first", "second", "third", "tiktok"].includes(w));
    const coreKeywords = triggerTokens.slice(0, 4);

    // 2. Negative Treatment & Crisis Shockwave
    const isNegative = /(gave out|broke|broken|collapse|fail|failure|mia|emergency|loss|drop|ruin|fake)/i.test(text);
    const isPositive = /(grow|surged|10x|scale|double|unlocked|profit|transform|win|champion|king)/i.test(text);
    const isTension = sec.fatigueRisk >= 0.65 || /(wait|listen|watch|secret|crucial)/i.test(text);

    let valence: HandOfGodSectionDirective["valence"] = "neutral_exposition";
    let valenceScore = 0.0;
    let shockwaveEffect: HandOfGodSectionDirective["negativeTreatment"]["shockwaveEffect"] = "none";

    if (isNegative) {
      valence = "negative_crisis";
      valenceScore = -0.85;
      shockwaveEffect = text.includes("lens") || text.includes("camera") ? "optical_fracture" : text.includes("tiktok") ? "strike_through" : "dim_and_glitch";
    } else if (isPositive) {
      valence = "positive_breakthrough";
      valenceScore = 0.9;
    } else if (isTension) {
      valence = "tension_build";
      valenceScore = 0.4;
    }

    // 3. Lists Treatment
    const isList = /(first|second|third|1\.|2\.|3\.|enumerat|checklist|pillars|habits|hacks)/i.test(text);
    const pillarCount = isList ? 3 : undefined;

    // 4. PIP Treatment & Style
    const pipRequired = /(screen|calendar|demo|ui|dashboard|workflow|demonstrate|screencast|look at this)/i.test(text) || sec.role === "demonstrate";

    // 5. Macro Treatment Intent
    let macroTreatment: HandOfGodSectionDirective["macroTreatment"] = "anchor_dialogue";
    if (isList) {
      macroTreatment = "list_stack";
    } else if (pipRequired) {
      macroTreatment = "picture_in_picture";
    } else if (valence === "negative_crisis") {
      macroTreatment = "negative_crisis";
    } else if (/(\$|%|revenue|metrics|chart|growth)/i.test(text) || sec.role === "payoff") {
      macroTreatment = "chart_growth";
    } else if (sec.role === "hook") {
      macroTreatment = "cinematic_climax";
    } else if (/(king|playing field|machine|gears|vault|synapse|light bulb|idea)/i.test(text)) {
      macroTreatment = "metaphor_prop";
    }

    // 6. Camera Zones & Zooms
    let cameraIntent: HandOfGodSectionDirective["cameraZones"]["intent"] = "static_anchor";
    let cameraIntensity = 0.5;
    if (sec.role === "hook") {
      cameraIntent = "slow_zoom_in";
      cameraIntensity = 0.85;
    } else if (valence === "negative_crisis") {
      cameraIntent = "punch_in";
      cameraIntensity = 0.78;
    } else if (macroTreatment === "list_stack") {
      cameraIntent = "pan_right";
      cameraIntensity = 0.62;
    } else if (sec.fatigueRisk >= 0.6) {
      cameraIntent = "cinematic_drift";
      cameraIntensity = 0.42;
    }

    // 7. Framing & Reframing
    let speakerFraming: HandOfGodSectionDirective["framingReframing"]["speakerFraming"] = "center_anchor";
    let mattingMaskRequired = false;
    if (macroTreatment === "list_stack" || (pipRequired && text.includes("calendar"))) {
      speakerFraming = "split_screen_right_30";
      mattingMaskRequired = true;
    } else if (valence === "negative_crisis") {
      speakerFraming = "punch_close_up";
      mattingMaskRequired = true;
    }

    // 8. Combinatorial Asset Suggestion (Monte Carlo Tree mapping)
    let assetSuggestion: HandOfGodSectionDirective["assetSuggestion"];
    if (text.includes("light bulb") || (text.includes("idea") && valence === "negative_crisis")) {
      assetSuggestion = {
        keyword: "idea",
        suggestedAsset: "broken_light_bulb",
        placementPlane: "behind_speaker",
        visualDescription: "Fractured glass filament with red diagnostic hazard halo.",
      };
    } else if (text.includes("king") || text.includes("playing field")) {
      assetSuggestion = {
        keyword: "king",
        suggestedAsset: "tactical_chess_king",
        placementPlane: "behind_speaker",
        visualDescription: "3D obsidian Chess King with gold crown and kinetic laser beams.",
      };
    } else if (text.includes("camera") || text.includes("lens")) {
      assetSuggestion = {
        keyword: "camera_lens",
        suggestedAsset: valence === "negative_crisis" ? "fractured_lens_schematic" : "prime_cinema_lens",
        placementPlane: "flank_shoulder",
        visualDescription: "Optical assembly schematic with red failure callout tag.",
      };
    } else if (text.includes("calendar") || text.includes("schedule")) {
      assetSuggestion = {
        keyword: "calendar",
        suggestedAsset: "dynamic_time_block_spline",
        placementPlane: "full_screen_stage",
        visualDescription: "Interactive expanding buffer zone blocks in emerald green.",
      };
    } else {
      assetSuggestion = {
        keyword: sec.role,
        suggestedAsset: macroTreatment === "list_stack" ? "layered_3d_pillar_stack" : "metaphor_concept_orb",
        placementPlane: "behind_speaker",
        visualDescription: "Supportive 2.5D ambient stage node.",
      };
    }

    // 9. Background Rig & Stage Lighting
    let rigKind = sec.role === "hook" ? "cinematic_environment" : macroTreatment === "list_stack" ? "list_stack_stage" : macroTreatment === "chart_growth" ? "chart_graph_stage" : pipRequired ? "workflow_demo" : "talking_head_plate";
    let stageLighting: HandOfGodSectionDirective["background"]["stageLighting"] = valence === "negative_crisis" ? "ember_crisis" : valence === "positive_breakthrough" ? "cyan_steel" : "neutral";

    // 10. Color & Visual Treatment (Textures)
    let textureKind: TextureTreatmentKind = "none";
    let atmosphere: HandOfGodSectionDirective["colorVisualTreatment"]["atmosphereEffect"] = "clean";
    if (valence === "negative_crisis") {
      textureKind = "retro_authentic";
      atmosphere = "scanlines";
    } else if (macroTreatment === "list_stack") {
      textureKind = "paper_fiber";
      atmosphere = "paper_mesh";
    } else if (macroTreatment === "metaphor_prop" || valence === "positive_breakthrough") {
      textureKind = "tactile";
      atmosphere = "dust_grain";
    }

    return {
      sectionId: sec.sectionId,
      timeSec: sec.startSec,
      macroTreatment,
      valence,
      
      // 1. Camera zones & zooms
      cameraZones: {
        intent: cameraIntent,
        intensity: cameraIntensity,
        targetFocalPoint: sec.role === "hook" ? "host_eyes" : "motion_canvas_center",
      },

      // 2. Negative treatment
      negativeTreatment: {
        isNegative,
        valenceScore,
        shockwaveEffect,
      },

      // 3. Lexicon
      lexicon: {
        triggerTokens,
        coreKeywords,
        semanticTone: valence,
      },

      // 4. Cuts
      cuts: {
        cadence: sec.role === "hook" ? "rapid" : "deliberate",
        silencePaddingSec: 0.15,
        leadTimeSec: 0.3,
      },

      // 5. Animation
      animation: {
        motionMode: "2.5D_parallax",
        depthVelocities: { bg: 0.35, mid: 1.0, fg: 1.65 },
      },

      // 6. Background
      background: {
        rigKind: rigKind as any,
        stageLighting,
      },

      // 7. Audio change suggestion
      audioChangeSuggestion: {
        energyDelta: valence === "negative_crisis" ? -0.3 : valence === "positive_breakthrough" ? 0.35 : 0.0,
        tensionLevel: valence === "negative_crisis" ? "drop" : valence === "tension_build" ? "high" : "medium",
        riserTrigger: idx < sections.length - 1,
      },

      // 8. Lists
      lists: {
        isList,
        pillarCount,
        layoutStyle: "vertical_stack",
      },

      // 9. PIP treatment
      pipTreatment: {
        required: pipRequired,
        position: "top_right",
        scale: 0.34,
      },

      // 10. Picture-in-picture style
      pipStyle: {
        stylePreset: "screencast_feed",
        screenSource: "workflow_demo_screencast_feed",
      },

      // 11. Asset suggestion
      assetSuggestion,

      // 12. Framing & reframing
      framingReframing: {
        speakerFraming,
        mattingMaskRequired,
      },

      // 13. B-roll / cutaway strategy
      brollCutawayStrategy: {
        cutawayStrategy: pipRequired ? "split_canvas" : "none",
        thematicTopic: coreKeywords[0] || sec.role,
      },

      // 14. Color / visual treatment
      colorVisualTreatment: {
        textureKind,
        intensity: textureKind !== "none" ? 0.45 : 0.0,
        atmosphereEffect: atmosphere,
        blendMode: textureKind === "retro_authentic" ? "soft-light" : textureKind === "paper_fiber" ? "multiply" : "overlay",
      },

      reasoning: `Hand of God prescribed ${macroTreatment} (${valence}) with ${cameraIntent} camera movement and ${speakerFraming} framing.`,
    };
  });

  return {
    version: "1.0.0",
    source: "hybrid",
    modelName: "prometheus-hog-compiler-v1",
    globalVibe: {
      primaryPacing: "adaptive",
      motionTone: "editorial",
    },
    directives,
  };
}

/**
 * Reconciles Hand of God macro directives with the deterministic engine:
 * Ensures macro intent influences background rigs, camera zooms, PiP, framing, and assets,
 * while preserving 100% system ownership over micro typography stylizations.
 */
export function applyHandOfGodDirectives(
  blueprint: HandOfGodBlueprint,
  sections: LandscapeSection[],
  backgroundRigs: BackgroundRig[],
  cameraMoves: CameraMovePlan[],
  pipInsets: PipInsetPlan[],
  metaphorTreatments: MetaphorTreatmentPoint[],
): {
  reconciledRigs: BackgroundRig[];
  reconciledCameraMoves: CameraMovePlan[];
  reconciledPipInsets: PipInsetPlan[];
  reconciledMetaphors: MetaphorTreatmentPoint[];
} {
  const reconciledRigs = backgroundRigs.map((rig, idx) => {
    const directive = blueprint.directives[idx] || blueprint.directives.find((d) => d.sectionId === rig.sectionId);
    if (!directive) return rig;

    let kind = rig.kind;
    let conceptAnimation = rig.conceptAnimation;

    if (directive.macroTreatment === "list_stack") {
      kind = "list_stack_stage";
      conceptAnimation = "animated_list";
    } else if (directive.macroTreatment === "chart_growth") {
      kind = "chart_graph_stage";
      conceptAnimation = "animated_graph";
    } else if (directive.macroTreatment === "picture_in_picture") {
      kind = "workflow_demo";
      conceptAnimation = "animated_concept";
    } else if (directive.macroTreatment === "negative_crisis") {
      kind = "concept_canvas";
      conceptAnimation = "metaphor_node";
    }

    const textureTreatment = { ...rig.textureTreatment };
    if (directive.colorVisualTreatment && directive.colorVisualTreatment.textureKind !== "none") {
      textureTreatment.kind = directive.colorVisualTreatment.textureKind;
      textureTreatment.intensity = directive.colorVisualTreatment.intensity || 0.45;
      textureTreatment.blendMode = directive.colorVisualTreatment.blendMode || textureTreatment.blendMode;
    }

    return {
      ...rig,
      kind,
      conceptAnimation,
      textureTreatment,
    };
  });

  const reconciledCameraMoves = cameraMoves.map((cam, idx) => {
    const directive = blueprint.directives[idx] || blueprint.directives.find((d) => d.sectionId === cam.sectionId);
    if (!directive) return cam;

    let kind = cam.kind;
    if (directive.cameraZones.intent === "slow_zoom_in" || directive.cameraZones.intent === "punch_in") {
      kind = "push_in";
    } else if (directive.cameraZones.intent === "pan_left") {
      kind = "pan_left";
    } else if (directive.cameraZones.intent === "pan_right") {
      kind = "pan_right";
    } else if (directive.cameraZones.intent === "cinematic_drift") {
      kind = "cinematic_drift";
    }

    return {
      ...cam,
      kind,
      intensity: directive.cameraZones.intensity,
    };
  });

  const reconciledPipInsets = pipInsets.map((pip, idx) => {
    const directive = blueprint.directives[idx] || blueprint.directives.find((d) => d.sectionId === pip.sectionId);
    if (!directive || !directive.pipTreatment) return pip;

    return {
      ...pip,
      enabled: directive.pipTreatment.required,
      scale: directive.pipTreatment.scale || pip.scale,
    };
  });

  const reconciledMetaphors = metaphorTreatments.map((met, idx) => {
    const directive = blueprint.directives[idx] || blueprint.directives.find((d) => d.sectionId === met.sectionId);
    if (!directive || !directive.assetSuggestion) return met;

    const { suggestedAsset, keyword, placementPlane, visualDescription } = directive.assetSuggestion;
    const layerPlane = placementPlane === "behind_speaker" ? 25 : placementPlane === "foreground_hud" ? 30 : 10;

    return {
      ...met,
      spokenSnippet: met.spokenSnippet || keyword,
      recommendedAsset: {
        ...met.recommendedAsset,
        assetName: suggestedAsset,
        visualDescription: visualDescription || `Hand of God prescribed ${suggestedAsset} (${directive.valence}) placed ${placementPlane}.`,
      },
      texturePlacement: {
        ...met.texturePlacement,
        kind: directive.colorVisualTreatment?.textureKind || met.texturePlacement.kind,
        layerPlane,
      },
    };
  });

  return {
    reconciledRigs,
    reconciledCameraMoves,
    reconciledPipInsets,
    reconciledMetaphors,
  };
}

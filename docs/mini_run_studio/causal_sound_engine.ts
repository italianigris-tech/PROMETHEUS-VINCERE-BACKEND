/**
 * PROMETHEUS CORE — DETERMINISTIC CAUSAL SOUND DESIGN ENGINE
 * 
 * Implements deterministic sound effects generation with modular families,
 * 4 nephew variants per category, acoustic semblance rotation constraints,
 * word-length gear triggers, and speed-consonant camera whooshes.
 */

import { AUTHORITATIVE_SFX_FAMILIES, SfxFamilyKey, SfxSynthesisPreset, SFX_TAXONOMY_MANIFEST } from "./sfx_governance_schema.js";
import { selectTransitionTreatments, selectTypographyCueIndexes } from "./composition_director.js";

export interface DeterministicCausalSoundCue {
  id: string;
  chunkIndex: number;
  timeSec: number;
  durationSec: number;
  familyKey: SfxFamilyKey;
  variantId: string;
  variantIndex: 1 | 2 | 3 | 4;
  label: string;
  triggerReason: string;
  spatialPan: number; // -1.0 (Left) to +1.0 (Right)
  depthPlane: 10 | 20 | 30; // 10 = Behind Subject, 30 = Foreground
  lowpassCutoffHz: number;
  gain: number;
  synthParams: {
    oscType: "sine" | "triangle" | "sawtooth" | "square";
    startFreqHz: number;
    endFreqHz: number;
    attackSec: number;
    decaySec: number;
    sustainLevel: number;
    releaseSec: number;
    noiseBurst?: boolean;
    filterType?: "lowpass" | "highpass" | "bandpass" | "notch";
    filterCutoffHz?: number;
    filterQ?: number;
  };
}

export interface FamilyStateTracker {
  activeVariantIndex: number; // 0 to 3
  repetitionCount: number; // How many times this variant has been consecutively used
}

/**
 * Deterministically resolves the next variant in an acoustic family,
 * maintaining semblance by repeating 2-3 times before advancing to nephew variant.
 */
export function resolveFamilyVariant(familyKey: SfxFamilyKey, state: FamilyStateTracker): SfxSynthesisPreset {
  const family = AUTHORITATIVE_SFX_FAMILIES[familyKey];
  if (!family) {
    return AUTHORITATIVE_SFX_FAMILIES.text_click_family.variants[0];
  }

  // If consecutive repetitions exceed limit, advance to next nephew variant
  if (state.repetitionCount >= family.maxConsecutiveRepetitions) {
    state.activeVariantIndex = (state.activeVariantIndex + 1) % family.variants.length;
    state.repetitionCount = 1;
  } else {
    state.repetitionCount += 1;
  }

  return family.variants[state.activeVariantIndex];
}

/**
 * Builds the complete Deterministic Causal Sound Manifest across all chunks
 */
export function buildDeterministicCausalSoundManifest(compiledSequence: any[]): DeterministicCausalSoundCue[] {
  const cues: DeterministicCausalSoundCue[] = [];
  const typographyCueIndexes = selectTypographyCueIndexes(compiledSequence, 0.6);
  const transitionByChunkIndex = new Map(
    selectTransitionTreatments(compiledSequence).map(treatment => [treatment.chunkIndex, treatment]),
  );

  // Track state per family
  const familyTrackers: Record<SfxFamilyKey, FamilyStateTracker> = {
    text_click_family: { activeVariantIndex: 0, repetitionCount: 0 },
    text_typing_family: { activeVariantIndex: 0, repetitionCount: 0 },
    text_glitch_family: { activeVariantIndex: 0, repetitionCount: 0 },
    lengthy_text_gear_family: { activeVariantIndex: 0, repetitionCount: 0 },
    camera_motion_whoosh_family: { activeVariantIndex: 0, repetitionCount: 0 },
    transition_action_family: { activeVariantIndex: 0, repetitionCount: 0 },
    sub_bass_tension_family: { activeVariantIndex: 0, repetitionCount: 0 },
    telemetry_arpeggio_family: { activeVariantIndex: 0, repetitionCount: 0 }
  };

  compiledSequence.forEach((chunk, idx) => {
    const t = chunk.startSec || (idx * 2.0);
    const chunkDuration = chunk.endSec ? (chunk.endSec - chunk.startSec) : 2.0;
    const text = chunk.text || "";
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    const fontName = chunk.profileName || chunk.fontProfile?.profile_name || "";
    const fontLower = fontName.toLowerCase();
    const fxPreset = chunk.layers?.[0]?.fxPreset || "";

    const isGlitch = fxPreset.includes("glitch") || fxPreset.includes("displace") || fontLower.includes("glitch");
    const isMono = fontLower.includes("mono") || fontLower.includes("elite") || fontLower.includes("typewriter") || fontLower.includes("vt323") || fxPreset.includes("typewriter");
    const isLengthyText = wordCount >= 5;

    // =========================================================================
    // 1. TYPOGRAPHY TEXT ANIMATION SFX
    // =========================================================================
    if (typographyCueIndexes.has(idx) && isGlitch) {
      const preset = resolveFamilyVariant("text_glitch_family", familyTrackers.text_glitch_family);
      cues.push({
        id: `cue_glitch_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.04,
        durationSec: preset.durationSec,
        familyKey: "text_glitch_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `Kinetic Glitch Animation [${fxPreset || fontName}]`,
        spatialPan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    } else if (typographyCueIndexes.has(idx) && isLengthyText) {
      // 5-7 words lengthy text flow -> Mechanical Gear Ratchet / System Flow
      const preset = resolveFamilyVariant("lengthy_text_gear_family", familyTrackers.lengthy_text_gear_family);
      cues.push({
        id: `cue_gear_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.05,
        durationSec: preset.durationSec,
        familyKey: "lengthy_text_gear_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `Lengthy Sequential Text Flow (${wordCount} Words: "${text.slice(0, 24)}...")`,
        spatialPan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    } else if (typographyCueIndexes.has(idx) && isMono) {
      // Monospace / Keystroke Typewriter
      const preset = resolveFamilyVariant("text_typing_family", familyTrackers.text_typing_family);
      cues.push({
        id: `cue_typing_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.04,
        durationSec: preset.durationSec,
        familyKey: "text_typing_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `Monospace Keystroke Reveal [${fontName}]`,
        spatialPan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    } else if (typographyCueIndexes.has(idx)) {
      // Standard Typography Tactile Mouse Click
      const preset = resolveFamilyVariant("text_click_family", familyTrackers.text_click_family);
      cues.push({
        id: `cue_click_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.03,
        durationSec: preset.durationSec,
        familyKey: "text_click_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `Standard Kinetic Text Reveal [${fontName || "Sans"}]`,
        spatialPan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    }

    // =========================================================================
    // 2. CAMERA / VIEWPORT MOTION WHOOSHES (SPEED-CONSONANT)
    // =========================================================================
    // Check if chunk has camera movement (e.g. initial zoom, major transition, or asset pan)
    if (idx === 0 || idx === 10 || chunk.backgroundAsset) {
      const isSlowMove = chunkDuration >= 2.0;
      const isFastSnap = chunkDuration < 0.8;
      
      const whooshFamily = AUTHORITATIVE_SFX_FAMILIES.camera_motion_whoosh_family;
      let selectedPreset: SfxSynthesisPreset;
      if (isSlowMove) {
        selectedPreset = whooshFamily.variants[0]; // Slow 2.2s ambient glide
      } else if (isFastSnap) {
        selectedPreset = whooshFamily.variants[2]; // Fast 0.38s whip pan cut
      } else {
        selectedPreset = whooshFamily.variants[1]; // Medium 1.0s cinematic swoosh
      }

      const isLeft = chunk.backgroundAsset ? ((chunk.backgroundAsset.position?.leftPercent ?? 50) < 30) : false;
      const pan = chunk.backgroundAsset ? (isLeft ? -0.75 : 0.75) : 0.0;

      cues.push({
        id: `cue_whoosh_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.08,
        durationSec: selectedPreset.durationSec,
        familyKey: "camera_motion_whoosh_family",
        variantId: selectedPreset.variantId,
        variantIndex: selectedPreset.variantIndex,
        label: `${selectedPreset.name} (${selectedPreset.variantId})`,
        triggerReason: `Speed-Consonant Viewport Motion [Duration: ${chunkDuration.toFixed(1)}s]`,
        spatialPan: pan,
        depthPlane: 10,
        lowpassCutoffHz: selectedPreset.filterCutoffHz,
        gain: selectedPreset.baseGain,
        synthParams: {
          oscType: selectedPreset.oscType,
          startFreqHz: selectedPreset.startFreqHz,
          endFreqHz: selectedPreset.endFreqHz,
          attackSec: selectedPreset.attackSec,
          decaySec: selectedPreset.decaySec,
          sustainLevel: selectedPreset.sustainLevel,
          releaseSec: selectedPreset.releaseSec,
          noiseBurst: selectedPreset.noiseBurst,
          filterType: selectedPreset.filterType,
          filterCutoffHz: selectedPreset.filterCutoffHz,
          filterQ: selectedPreset.filterQ
        }
      });
    }

    // =========================================================================
    // 3. SEMANTIC TENSION INFLECTION BRAAAMS
    // =========================================================================
    if (chunk.emphasis === "inflection_tension" || text.includes("breaks") || text.includes("problem") || text.includes("bottleneck")) {
      const preset = resolveFamilyVariant("sub_bass_tension_family", familyTrackers.sub_bass_tension_family);
      cues.push({
        id: `cue_braaam_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.12,
        durationSec: preset.durationSec,
        familyKey: "sub_bass_tension_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `Semantic Tension Inflection / Problem Point`,
        spatialPan: 0.0,
        depthPlane: 10,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    }

    // =========================================================================
    // 4. ANIMA CHARTS & TELEMETRY LASER ARPEGGIOS
    // =========================================================================
    if (chunk.backgroundAsset && chunk.backgroundAsset.renderMode === "dom_component") {
      const preset = resolveFamilyVariant("telemetry_arpeggio_family", familyTrackers.telemetry_arpeggio_family);
      cues.push({
        id: `cue_telemetry_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.35,
        durationSec: preset.durationSec,
        familyKey: "telemetry_arpeggio_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `ANIMA #04 Dynamic Vector Chart Spline Drawing`,
        spatialPan: 0.75,
        depthPlane: 10,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    }

    // =========================================================================
    // 5. FORWARD-COMPATIBLE TRANSITIONS (BONE SNAPS & SHUTTERS)
    // =========================================================================
    const transitionTreatment = transitionByChunkIndex.get(chunk.chunkIndex ?? idx + 1);
    if (transitionTreatment) {
      const preset = resolveFamilyVariant("transition_action_family", familyTrackers.transition_action_family);
      cues.push({
        id: `cue_trans_${idx + 1}`,
        chunkIndex: chunk.chunkIndex,
        timeSec: t + 0.02,
        durationSec: preset.durationSec,
        familyKey: "transition_action_family",
        variantId: preset.variantId,
        variantIndex: preset.variantIndex,
        label: `${preset.name} (${preset.variantId})`,
        triggerReason: `${transitionTreatment.effect.label}: ${transitionTreatment.reason}`,
        spatialPan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: preset.filterCutoffHz,
        gain: preset.baseGain,
        synthParams: {
          oscType: preset.oscType,
          startFreqHz: preset.startFreqHz,
          endFreqHz: preset.endFreqHz,
          attackSec: preset.attackSec,
          decaySec: preset.decaySec,
          sustainLevel: preset.sustainLevel,
          releaseSec: preset.releaseSec,
          noiseBurst: preset.noiseBurst,
          filterType: preset.filterType,
          filterCutoffHz: preset.filterCutoffHz,
          filterQ: preset.filterQ
        }
      });
    }
  });

  return cues;
}

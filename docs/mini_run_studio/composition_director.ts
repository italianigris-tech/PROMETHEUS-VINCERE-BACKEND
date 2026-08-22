/**
 * Composition Director
 *
 * The caller owns depth, editorial restraint, and the sound-design brief.
 * Animators receive an already-resolved placement and never decide occlusion.
 */

export type AssetPlacement = "behind_principal_speaker" | "foreground_callout" | "standalone";
export type TransitionEffectId = "light_burn" | "hot_burn" | "soft_flash" | "hard_flash" | "light_sweep" | "luma_wash";

export interface CompositionInput {
  hasMattedPrincipalSpeaker: boolean;
  assetRole: "brand" | "tool" | "map" | "reference" | "chart" | "other";
  requiresForegroundInteraction?: boolean;
}

export interface CompositionDecision {
  owner: "composition_director";
  placement: AssetPlacement;
  zIndex: 10 | 30;
  occludedByPrincipalSpeaker: boolean;
  reason: string;
}

export interface EditorialChunk {
  chunkIndex?: number;
  startSec?: number;
  endSec?: number;
  text?: string;
  emphasis?: string;
  backgroundAsset?: unknown;
  layers?: Array<{ fxPreset?: string }>;
  profileName?: string;
}

export interface TransitionTreatment {
  chunkIndex: number;
  timeSec: number;
  effect: {
    id: TransitionEffectId;
    label: string;
    overlayOnly: true;
    affectsSourceVideo: false;
  };
  reason: string;
}

export const TRANSITION_EFFECTS: ReadonlyArray<TransitionTreatment["effect"]> = [
  { id: "light_burn", label: "Light Burn", overlayOnly: true, affectsSourceVideo: false },
  { id: "hot_burn", label: "Hot Burn", overlayOnly: true, affectsSourceVideo: false },
  { id: "soft_flash", label: "Soft Flash", overlayOnly: true, affectsSourceVideo: false },
  { id: "hard_flash", label: "Hard Flash", overlayOnly: true, affectsSourceVideo: false },
  { id: "light_sweep", label: "Light Sweep", overlayOnly: true, affectsSourceVideo: false },
  { id: "luma_wash", label: "Luma Wash", overlayOnly: true, affectsSourceVideo: false },
];

export function decideAssetComposition(input: CompositionInput): CompositionDecision {
  if (input.hasMattedPrincipalSpeaker && !input.requiresForegroundInteraction) {
    return {
      owner: "composition_director",
      placement: "behind_principal_speaker",
      zIndex: 10,
      occludedByPrincipalSpeaker: true,
      reason: `${input.assetRole} asset is supportive; the matted principal speaker remains the foreground plane.`,
    };
  }
  if (input.requiresForegroundInteraction) {
    return {
      owner: "composition_director",
      placement: "foreground_callout",
      zIndex: 30,
      occludedByPrincipalSpeaker: false,
      reason: "Explicit subject interaction requires a foreground callout.",
    };
  }
  return {
    owner: "composition_director",
    placement: "standalone",
    zIndex: 10,
    occludedByPrincipalSpeaker: false,
    reason: "No matted principal speaker is available for occlusion.",
  };
}

export function selectTypographyCueIndexes(chunks: EditorialChunk[], targetRate = 0.6): Set<number> {
  const eligible = chunks
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => Boolean(chunk.text?.trim()));
  const targetCount = Math.round(eligible.length * targetRate);

  return new Set(
    eligible
      .map(({ chunk, index }) => ({
        index,
        // Semantic prominence wins; the deterministic tiebreaker prevents a repeated cadence.
        score: typographyProminence(chunk) * 1000 + ((index * 37 + eligible.length * 13) % 101),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, targetCount)
      .map(({ index }) => index),
  );
}

export function selectTransitionTreatments(chunks: EditorialChunk[]): TransitionTreatment[] {
  const candidates = chunks
    .map((chunk, index) => ({ chunk, index, score: transitionProminence(chunk) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const budget = Math.floor(candidates.length * 0.5);
  const selected: TransitionTreatment[] = [];

  for (const candidate of candidates) {
    if (selected.length >= budget) break;
    const previous = selected[selected.length - 1];
    const timeSec = candidate.chunk.startSec ?? candidate.index * 2;
    if (previous && timeSec - previous.timeSec < 3) continue;
    selected.push({
      chunkIndex: candidate.chunk.chunkIndex ?? candidate.index + 1,
      timeSec,
      effect: effectFor(candidate.chunk, selected.length),
      reason: "Selected from a semantic inflection candidate under the transition restraint budget.",
    });
  }
  return selected;
}

export function buildGeminiMusicRequest(chunks: EditorialChunk[], targetDurationSec: number) {
  const typographyCueIndexes = selectTypographyCueIndexes(chunks);
  const transitions = selectTransitionTreatments(chunks);
  const brief = {
    targetDurationSec,
    speechFirst: true,
    typographySfxCoverageTarget: 0.6,
    typographyCueChunkIndexes: [...typographyCueIndexes],
    transitions,
    voiceDucking: { enabled: true, reductionDb: -6, attackSec: 0.04, releaseSec: 0.25 },
    instruction: "Create only the musical underscore. Preserve silence around speech and do not add a cue where the plan has none.",
  };
  return {
    model: "lyria-3-pro-preview",
    input: `Generate a ${targetDurationSec}-second instrumental soundtrack for a spoken video. Follow this editorial brief exactly:\n${JSON.stringify(brief)}`,
    response_format: { type: "audio" },
    brief,
  };
}

function typographyProminence(chunk: EditorialChunk): number {
  const emphasis = chunk.emphasis || "";
  const preset = chunk.layers?.[0]?.fxPreset || "";
  const wordCount = chunk.text?.trim().split(/\s+/).length || 0;
  return (emphasis.includes("inflection") ? 4 : 0) +
    (preset.includes("glitch") || preset.includes("typewriter") ? 3 : 0) +
    (wordCount >= 5 ? 2 : 1);
}

function transitionProminence(chunk: EditorialChunk): number {
  const emphasis = chunk.emphasis || "";
  if (emphasis === "inflection_tension" || emphasis === "inflection_solution") return 3;
  if (emphasis === "transition" && chunk.backgroundAsset) return 2;
  if (chunk.backgroundAsset) return 1;
  return 0;
}

function effectFor(chunk: EditorialChunk, ordinal: number): TransitionTreatment["effect"] {
  if (chunk.emphasis === "inflection_tension") return TRANSITION_EFFECTS[1];
  if (chunk.emphasis === "inflection_solution") return TRANSITION_EFFECTS[0];
  if (chunk.backgroundAsset) return TRANSITION_EFFECTS[4];
  return TRANSITION_EFFECTS[(ordinal + 1) % TRANSITION_EFFECTS.length];
}

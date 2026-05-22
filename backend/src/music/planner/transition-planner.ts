import {transitionEventSchema, type TransitionEvent} from "../schemas/audio-plan.schema";

export type PlanTransitionInput = {
  id: string;
  videoStartSec: number;
  videoEndSec: number;
  fromTrackId?: string | null;
  toTrackId?: string | null;
  intensity?: number;
  beatAligned?: boolean;
  downbeatTargetSec?: number | null;
};

export const planTransition = (input: PlanTransitionInput): TransitionEvent => {
  const intensity = Math.max(0, Math.min(1, input.intensity ?? 0.4));
  const type =
    !input.fromTrackId || !input.toTrackId || input.fromTrackId === input.toTrackId
      ? "none"
      : intensity >= 0.75
        ? "riser_into_impact"
        : intensity >= 0.5
          ? "beat_crossfade"
          : "lowpass_sweep";

  return transitionEventSchema.parse({
    id: input.id,
    type,
    videoStartSec: input.videoStartSec,
    videoEndSec: input.videoEndSec,
    fromTrackId: input.fromTrackId ?? null,
    toTrackId: input.toTrackId ?? null,
    intensity,
    beatAligned: input.beatAligned ?? Boolean(input.downbeatTargetSec),
    downbeatTargetSec: input.downbeatTargetSec ?? null,
    settings: {
      source: "phase1_placeholder"
    }
  });
};

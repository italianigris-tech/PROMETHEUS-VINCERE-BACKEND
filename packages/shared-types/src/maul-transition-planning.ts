export type MaulTransitionKind = "light_flash" | "whip_pan" | "dip_to_color";

export type MaulTransitionSemanticRole =
  | "hook"
  | "orientation"
  | "context"
  | "claim"
  | "escalation"
  | "proof"
  | "contrast"
  | "transition"
  | "reveal"
  | "payoff"
  | "cta";

export type MaulTransitionBeat = {
  beatId: string;
  role: MaulTransitionSemanticRole;
  outputStartMs: number;
  outputEndMs: number;
  protectedPause: boolean;
  intensity: number;
};

export type MaulTransitionEvent = {
  transitionId: string;
  kind: MaulTransitionKind;
  outputMs: number;
  durationMs: number;
  intensity: number;
  reason: string;
};

const transitionRoles = new Set<MaulTransitionSemanticRole>([
  "contrast",
  "transition",
  "reveal",
  "payoff",
  "cta",
]);

export const buildMaulTransitionPlan = ({
  treatmentId,
  permittedTransitions,
  beats,
  maxTransitions = 2,
}: {
  treatmentId: string;
  permittedTransitions: readonly string[];
  beats: readonly MaulTransitionBeat[];
  maxTransitions?: number;
}): MaulTransitionEvent[] => {
  const themePermitsTransitions = permittedTransitions.some(
    (transition) => transition !== "none",
  );
  if (!themePermitsTransitions || maxTransitions <= 0) return [];

  return beats
    .filter(
      (beat) => !beat.protectedPause && transitionRoles.has(beat.role),
    )
    .slice(0, maxTransitions)
    .map((beat) => {
      const minimal = treatmentId === "minimal_expert";
      const kind: MaulTransitionKind = minimal
        ? "dip_to_color"
        : ["contrast", "transition", "reveal"].includes(beat.role)
          ? "light_flash"
          : "whip_pan";
      return {
        transitionId: `maul_transition_${beat.beatId}`,
        kind,
        outputMs: beat.outputStartMs,
        durationMs: minimal ? 280 : kind === "light_flash" ? 400 : 340,
        intensity: Math.min(
          minimal ? 0.38 : 0.82,
          Math.max(0.2, beat.intensity),
        ),
        reason: `${beat.role} semantic state change motivates ${kind}; ${permittedTransitions.join(", ")} theme grammar permits transition treatment.`,
      };
    });
};

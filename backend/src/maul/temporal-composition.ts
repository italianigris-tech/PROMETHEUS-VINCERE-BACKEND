export const MIN_COMPOSITION_HOLD_MS = 850;
export const MIN_VISIBLE_TEXT_MS = 700;
export const MIN_ANIMATION_READ_MS = 300;
export const MIN_HERO_HOLD_MS = 1800;

export type MaulCompositionPurpose =
  | "HOOK"
  | "SETUP"
  | "TENSION"
  | "REVEAL"
  | "ESCALATION"
  | "PAYOFF";

export type MaulCompositionHold = {
  holdId: string;
  startMs: number;
  endMs: number;
  geometryKey: string;
  typographyProfileId: string;
  purpose: MaulCompositionPurpose;
};

export type MaulPerceptualDurationKind =
  | "composition_hold"
  | "visible_text"
  | "animation"
  | "hero_hold";

const minimumFor = (kind: MaulPerceptualDurationKind): number => {
  switch (kind) {
    case "composition_hold": return MIN_COMPOSITION_HOLD_MS;
    case "visible_text": return MIN_VISIBLE_TEXT_MS;
    case "animation": return MIN_ANIMATION_READ_MS;
    case "hero_hold": return MIN_HERO_HOLD_MS;
  }
};

export const assertPerceptualDuration = (
  durationMs: number,
  kind: MaulPerceptualDurationKind,
): void => {
  const minimumMs = minimumFor(kind);
  if (!Number.isFinite(durationMs) || durationMs < minimumMs) {
    throw new Error(
      `${kind} requires at least ${minimumMs}ms; received ${durationMs}ms.`,
    );
  }
};

export const mergeAdjacentCompositionHolds = (
  holds: readonly MaulCompositionHold[],
): MaulCompositionHold[] => holds
  .slice()
  .sort((left, right) => left.startMs - right.startMs || left.holdId.localeCompare(right.holdId))
  .reduce<MaulCompositionHold[]>((merged, hold) => {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.endMs === hold.startMs &&
      previous.geometryKey === hold.geometryKey &&
      previous.typographyProfileId === hold.typographyProfileId &&
      previous.purpose === hold.purpose
    ) {
      previous.endMs = hold.endMs;
      return merged;
    }
    merged.push({...hold});
    return merged;
  }, []);

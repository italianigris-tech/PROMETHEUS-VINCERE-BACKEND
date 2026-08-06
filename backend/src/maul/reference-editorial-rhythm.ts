import type {MaulTextAnimationTreatment} from "@prometheus/shared-types";

export const MAUL_EDITORIAL_FONT_SYSTEM_IDS = [
  "grotesk_editorial_hinge",
  "condensed_kinetic_hinge",
  "serif_editorial_hinge",
] as const;

export type MaulEditorialFontSystemId =
  (typeof MAUL_EDITORIAL_FONT_SYSTEM_IDS)[number];

export type ReferenceEditorialRhythmSegment = {
  segmentId: string;
  treatment: MaulTextAnimationTreatment;
  preserveReadableHold: boolean;
};

export type ReferenceEditorialRhythm = {
  schemaVersion: "maul-reference-editorial-rhythm/v1";
  fontSystemId: MaulEditorialFontSystemId;
  traitReceipt: string[];
  segments: ReferenceEditorialRhythmSegment[];
};

type ReferenceEditorialRhythmInput = {
  referenceTraits: readonly string[];
  primaryTypeRole: "neutral_grotesk" | "editorial_display";
  selectionSeed: string;
  segments: readonly {
    segmentId: string;
    semanticRole: string;
    emphasisLevel: "support" | "key" | "hero";
    wordCount: number;
    outputStartMs: number;
    outputEndMs: number;
    holdAcrossProtectedPause: boolean;
  }[];
};

const canonicalTraitFor = (trait: string): string | null => {
  const normalized = trait
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/phrase/.test(normalized) && /hierarch|lockup|lock-up/.test(normalized)) {
    return "phrase_hierarchy";
  }
  if (/serif/.test(normalized) && /contrast|hinge|italic/.test(normalized)) {
    return "editorial_serif_hinge";
  }
  if (/hold|dwell|breath/.test(normalized) && /deliberate|readable|protect/.test(normalized)) {
    return "deliberate_readable_holds";
  }
  if (/semantic/.test(normalized) && /hinge|emphasis|emphasise/.test(normalized)) {
    return "semantic_hinge_emphasis";
  }
  if (/cut/.test(normalized) && /tempo|pace|rhythm|led/.test(normalized)) {
    return "cut_led_tempo";
  }
  return null;
};

const canonicalTraitsFor = (traits: readonly string[]): string[] => [
  ...new Set(
    traits
      .map(canonicalTraitFor)
      .filter((trait): trait is string => trait !== null),
  ),
].sort();

const fontSystemFor = ({
  primaryTypeRole,
  traits,
}: {
  primaryTypeRole: ReferenceEditorialRhythmInput["primaryTypeRole"];
  traits: readonly string[];
}): MaulEditorialFontSystemId => {
  if (primaryTypeRole === "neutral_grotesk") {
    return "grotesk_editorial_hinge";
  }
  if (
    traits.includes("phrase_hierarchy") &&
    traits.includes("editorial_serif_hinge") &&
    traits.includes("cut_led_tempo")
  ) {
    return "condensed_kinetic_hinge";
  }
  return "serif_editorial_hinge";
};

const candidatesFor = ({
  semanticRole,
  emphasisLevel,
  preserveReadableHold,
}: {
  semanticRole: string;
  emphasisLevel: "support" | "key" | "hero";
  preserveReadableHold: boolean;
}): MaulTextAnimationTreatment[] => {
  if (preserveReadableHold) {
    return ["cinematic_focus_lock", "documentary-soft-lock"];
  }
  if (semanticRole === "hook" || emphasisLevel === "hero") {
    return [
      "two_word_cinematic_pair",
      "two_word_focus_pivot",
      "three_word_ref_lockup",
    ];
  }
  if (semanticRole === "payoff") {
    return [
      "two_word_focus_pivot",
      "three_word_ref_last_punch",
      "cinematic_focus_lock",
    ];
  }
  return [
    "documentary-soft-lock",
    "three_word_ref_lockup",
    "cinematic_focus_lock",
  ];
};

const seededIndex = (seed: string, length: number): number => {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % length;
};

const selectTreatment = ({
  candidates,
  selectionSeed,
  previous,
  used,
}: {
  candidates: readonly MaulTextAnimationTreatment[];
  selectionSeed: string;
  previous: MaulTextAnimationTreatment | null;
  used: ReadonlySet<MaulTextAnimationTreatment>;
}): MaulTextAnimationTreatment => {
  const unused = candidates.filter(
    (candidate) => candidate !== previous && !used.has(candidate),
  );
  const nonRepeating = candidates.filter((candidate) => candidate !== previous);
  const pool =
    unused.length > 0
      ? unused
      : nonRepeating.length > 0
        ? nonRepeating
        : candidates;
  return pool[seededIndex(selectionSeed, pool.length)]!;
};

export const deriveReferenceEditorialRhythm = (
  input: ReferenceEditorialRhythmInput,
): ReferenceEditorialRhythm => {
  const traitReceipt = canonicalTraitsFor(input.referenceTraits);
  const fontSystemId = fontSystemFor({
    primaryTypeRole: input.primaryTypeRole,
    traits: traitReceipt,
  });
  let previous: MaulTextAnimationTreatment | null = null;
  const used = new Set<MaulTextAnimationTreatment>();
  const hasReferenceSignal = traitReceipt.length > 0;
  const segments = input.segments.map((segment) => {
    const preserveReadableHold =
      hasReferenceSignal && segment.holdAcrossProtectedPause;
    const treatment = hasReferenceSignal
      ? selectTreatment({
          candidates: candidatesFor({
            semanticRole: segment.semanticRole,
            emphasisLevel: segment.emphasisLevel,
            preserveReadableHold,
          }),
          selectionSeed: `${input.selectionSeed}:${segment.segmentId}:${segment.wordCount}`,
          previous,
          used,
        })
      : "documentary-soft-lock";
    previous = treatment;
    used.add(treatment);
    return {segmentId: segment.segmentId, treatment, preserveReadableHold};
  });

  return {
    schemaVersion: "maul-reference-editorial-rhythm/v1",
    fontSystemId,
    traitReceipt,
    segments,
  };
};

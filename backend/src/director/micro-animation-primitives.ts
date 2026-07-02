import type {
  MicroAnimationAudit,
  MicroAnimationFamily,
  MicroAnimationRenderFallback,
  MicroAnimationSelection,
  TextOverlay,
  UnifiedRenderManifest,
} from "@prometheus/shared-types";

type MicroAnimationRole = MicroAnimationSelection["role"];
type SemanticRole = MicroAnimationSelection["semanticRole"];

export type JosephMicroAnimationTaxonomyEntry = {
  family: MicroAnimationFamily;
  namingConvention: string;
  referenceBehaviors: readonly string[];
  usageConditions: readonly string[];
  antiPatterns: readonly string[];
};

export type JosephMicroAnimationPrimitive = {
  id: string;
  label: string;
  family: MicroAnimationFamily;
  role: MicroAnimationRole;
  renderFallback: MicroAnimationRenderFallback;
  combinationGroup: string;
  referenceBehavior: string;
  timingSignature: string;
  anchorBehavior: string;
  hierarchyBehavior: string;
  usageConditions: readonly string[];
  antiPatterns: readonly string[];
  allowedSemanticRoles: readonly SemanticRole[];
  doctrineAffinity: readonly string[];
  parameterDefaults: MicroAnimationSelection["parameters"];
};

export type TimedMicroAnimationSelection = MicroAnimationSelection & {
  startFrame: number;
  endFrame: number;
};

export type MicroAnimationQuality = {
  score: number;
  failures: string[];
  warnings: string[];
  fixIntents: string[];
};

export type MicroAnimationSelectionInput = {
  rng: () => number;
  doctrineId?: string;
  semanticRole: SemanticRole;
  energy: number;
  overlayIndex: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const JOSEPH_MICRO_ANIMATION_TAXONOMY: readonly JosephMicroAnimationTaxonomyEntry[] = [
  {
    family: "text_emphasis",
    namingConvention: "text-emphasis.<motion-or-mark>",
    referenceBehaviors: [
      "hero words receive a visible but brief emphasis mark",
      "highlight motion resolves before the next spoken beat",
      "emphasis supports semantic hierarchy instead of decorating every word",
    ],
    usageConditions: [
      "high-confidence thesis words",
      "CTA verbs and conversion nouns",
      "moments where the viewer needs a single eye-trace target",
    ],
    antiPatterns: [
      "stacking multiple highlights on one support word",
      "leaving a highlight alive across a cut",
      "using glow as a substitute for hierarchy",
    ],
  },
  {
    family: "text_entry",
    namingConvention: "text-entry.<entry-motion>",
    referenceBehaviors: [
      "words enter on breath, beat, or onset with readable anticipation",
      "entry motion is short enough to preserve caption comprehension",
      "support words use lower intensity than hero words",
    ],
    usageConditions: [
      "first appearance of caption words",
      "phrase starts after cuts",
      "restrained sections needing motion without visual noise",
    ],
    antiPatterns: [
      "replaying the same entrance on every word",
      "large entry travel on filler words",
      "entry motion that lands after the spoken word ends",
    ],
  },
  {
    family: "text_mutation",
    namingConvention: "text-mutation.<semantic-change>",
    referenceBehaviors: [
      "weight, color, or scale changes mark a semantic turn",
      "mutation hands emphasis from one word to another",
      "changes happen after the base word is readable",
    ],
    usageConditions: [
      "contrast words",
      "phrase reversals",
      "CTA escalation and reveal moments",
    ],
    antiPatterns: [
      "mutating support words without semantic reason",
      "scale pulses on adjacent words",
      "color inversion during dense text overlap",
    ],
  },
  {
    family: "accent_motion",
    namingConvention: "accent-motion.<supporting-mark>",
    referenceBehaviors: [
      "small lines, brackets, cursors, or rails clarify the active word",
      "accent motion is subordinate to typography",
      "accents exit cleanly before camera or transition events compete",
    ],
    usageConditions: [
      "single-word hero emphasis",
      "anchor handoff between text and subject",
      "dense sections needing eye-trace guidance",
    ],
    antiPatterns: [
      "accent marks crossing the reading path",
      "multiple directional accents at once",
      "decorative accents without an anchored target",
    ],
  },
  {
    family: "spatial_micro_motion",
    namingConvention: "spatial-motion.<subtle-depth-behavior>",
    referenceBehaviors: [
      "idle drift keeps held text from feeling static",
      "parallax stays below the threshold where reading suffers",
      "spatial motion is smooth and frame-stable",
    ],
    usageConditions: [
      "held cinematic phrases",
      "support words that need presence but not emphasis",
      "low-density moments between major beats",
    ],
    antiPatterns: [
      "floating text away from the safe zone",
      "idle movement during camera shake",
      "foreground shimmer on small text",
    ],
  },
];

export const JOSEPH_MICRO_ANIMATION_CATALOG: readonly JosephMicroAnimationPrimitive[] = [
  {
    id: "text-entry.word-riser",
    label: "Word Riser",
    family: "text_entry",
    role: "entry",
    renderFallback: "slide_up",
    combinationGroup: "entry",
    referenceBehavior: "hero word rises from below with a short ease-out settle",
    timingSignature: "260-420ms, beat/onset aligned",
    anchorBehavior: "word baseline",
    hierarchyBehavior: "hero and CTA words may travel farther than support words",
    usageConditions: ["phrase start", "beat-aligned hero word"],
    antiPatterns: ["support word overtravel", "entry repeated on every adjacent word"],
    allowedSemanticRoles: ["support", "hero", "cta"],
    doctrineAffinity: ["kinetic-pulse"],
    parameterDefaults: { intensity: 0.66, durationMs: 360, delayMs: 0, anchor: "word", direction: "up" },
  },
  {
    id: "text-entry.letter-riser",
    label: "Letter Riser",
    family: "text_entry",
    role: "entry",
    renderFallback: "typewriter",
    combinationGroup: "entry",
    referenceBehavior: "letters resolve upward in a tight stagger",
    timingSignature: "300-520ms, per-letter stagger",
    anchorBehavior: "word baseline",
    hierarchyBehavior: "best for short hero words",
    usageConditions: ["short thesis word", "cinematic reveal"],
    antiPatterns: ["long support phrases", "fast transcript sections"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["restrained-cinematic"],
    parameterDefaults: { intensity: 0.56, durationMs: 460, delayMs: 0, anchor: "word", direction: "up" },
  },
  {
    id: "text-entry.soft-letter-tracking",
    label: "Soft Letter Tracking Reveal",
    family: "text_entry",
    role: "entry",
    renderFallback: "typewriter",
    combinationGroup: "entry",
    referenceBehavior: "letters spread slightly, then settle into readable tracking",
    timingSignature: "420-640ms, slow ease",
    anchorBehavior: "line center",
    hierarchyBehavior: "restrained support for cinematic phrases",
    usageConditions: ["medium energy", "held phrase", "low density"],
    antiPatterns: ["hook impact word", "dense beat stack"],
    allowedSemanticRoles: ["support", "hero"],
    doctrineAffinity: ["restrained-cinematic"],
    parameterDefaults: { intensity: 0.42, durationMs: 560, delayMs: 0, anchor: "line", direction: "center" },
  },
  {
    id: "text-entry.velocity-slide-reveal",
    label: "Velocity Slide Reveal",
    family: "text_entry",
    role: "entry",
    renderFallback: "slide_up",
    combinationGroup: "entry",
    referenceBehavior: "word enters quickly with directional velocity and a clipped settle",
    timingSignature: "180-300ms, high velocity",
    anchorBehavior: "word bounding box",
    hierarchyBehavior: "only hero or CTA words should receive full travel",
    usageConditions: ["high energy hook", "beat drop"],
    antiPatterns: ["slow cinematic phrase", "three adjacent velocity entries"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["kinetic-pulse"],
    parameterDefaults: { intensity: 0.78, durationMs: 260, delayMs: 0, anchor: "word", direction: "up" },
  },
  {
    id: "text-entry.clipped-mask-reveal",
    label: "Clipped Mask Reveal",
    family: "text_entry",
    role: "entry",
    renderFallback: "slide_up",
    combinationGroup: "entry",
    referenceBehavior: "word appears through an invisible mask edge",
    timingSignature: "320-480ms, clean mask edge",
    anchorBehavior: "line mask",
    hierarchyBehavior: "cleanest on phrase starts",
    usageConditions: ["new caption line", "restrained emphasis"],
    antiPatterns: ["glitch sections", "overlapping with wipe transitions"],
    allowedSemanticRoles: ["support", "hero", "cta"],
    doctrineAffinity: ["restrained-cinematic", "spotlight-swap"],
    parameterDefaults: { intensity: 0.5, durationMs: 380, delayMs: 0, anchor: "line", direction: "up" },
  },
  {
    id: "text-emphasis.underline-reveal",
    label: "Underline Reveal",
    family: "text_emphasis",
    role: "emphasis",
    renderFallback: "slide_up",
    combinationGroup: "emphasis-mark",
    referenceBehavior: "thin underline draws under the thesis word",
    timingSignature: "180-300ms, resolves before word exit",
    anchorBehavior: "word baseline",
    hierarchyBehavior: "clear but restrained hero emphasis",
    usageConditions: ["single hero noun", "medium energy"],
    antiPatterns: ["two adjacent underlines", "low contrast underline color"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["restrained-cinematic", "spotlight-swap"],
    parameterDefaults: { intensity: 0.62, durationMs: 240, delayMs: 40, anchor: "word", direction: "right" },
  },
  {
    id: "text-emphasis.sweep-highlight",
    label: "Sweep Highlight",
    family: "text_emphasis",
    role: "emphasis",
    renderFallback: "pop",
    combinationGroup: "emphasis-mark",
    referenceBehavior: "highlight plate sweeps behind a hero word and clears quickly",
    timingSignature: "220-360ms, horizontal sweep",
    anchorBehavior: "word box",
    hierarchyBehavior: "hero-only unless CTA",
    usageConditions: ["high-confidence thesis word", "hook beat"],
    antiPatterns: ["filler words", "already red text with glitch"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["kinetic-pulse"],
    parameterDefaults: { intensity: 0.72, durationMs: 300, delayMs: 20, anchor: "word", direction: "right" },
  },
  {
    id: "text-emphasis.capsule-highlight",
    label: "Capsule Highlight",
    family: "text_emphasis",
    role: "emphasis",
    renderFallback: "elastic_scale",
    combinationGroup: "emphasis-mark",
    referenceBehavior: "rounded capsule forms around a short phrase",
    timingSignature: "300-460ms, scale and opacity settle",
    anchorBehavior: "phrase box",
    hierarchyBehavior: "CTA or core proposition",
    usageConditions: ["CTA phrase", "two-word hero phrase"],
    antiPatterns: ["long sentence", "combined with marker stroke"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["spotlight-swap"],
    parameterDefaults: { intensity: 0.7, durationMs: 420, delayMs: 30, anchor: "phrase", direction: "center" },
  },
  {
    id: "text-emphasis.marker-stroke",
    label: "Marker Stroke Emphasis",
    family: "text_emphasis",
    role: "emphasis",
    renderFallback: "pop",
    combinationGroup: "emphasis-mark",
    referenceBehavior: "imperfect stroke lands behind an urgent word",
    timingSignature: "160-280ms, hand-drawn snap",
    anchorBehavior: "word baseline",
    hierarchyBehavior: "rare urgent emphasis",
    usageConditions: ["urgent hook verb", "aggressive profile"],
    antiPatterns: ["premium restrained sections", "more than once per phrase"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["kinetic-pulse"],
    parameterDefaults: { intensity: 0.84, durationMs: 220, delayMs: 0, anchor: "word", direction: "right" },
  },
  {
    id: "text-emphasis.semantic-glow",
    label: "Semantic Glow Emphasis",
    family: "text_emphasis",
    role: "emphasis",
    renderFallback: "elastic_scale",
    combinationGroup: "emphasis-mark",
    referenceBehavior: "soft glow blooms around a concept word, then falls back",
    timingSignature: "420-700ms, slow bloom",
    anchorBehavior: "word center",
    hierarchyBehavior: "concept word in lower-density scenes",
    usageConditions: ["cinematic thesis word", "low or medium visual density"],
    antiPatterns: ["high-energy glitch stack", "small support word"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["restrained-cinematic", "spotlight-swap"],
    parameterDefaults: { intensity: 0.58, durationMs: 560, delayMs: 40, anchor: "word", direction: "radial" },
  },
  {
    id: "text-mutation.weight-escalation",
    label: "Weight Escalation",
    family: "text_mutation",
    role: "mutation",
    renderFallback: "elastic_scale",
    combinationGroup: "semantic-mutation",
    referenceBehavior: "word weight and scale step up after the semantic turn",
    timingSignature: "260-420ms, delayed escalation",
    anchorBehavior: "word center",
    hierarchyBehavior: "strong for contrast and promise words",
    usageConditions: ["semantic turn", "spotlight doctrine"],
    antiPatterns: ["support word escalation", "repeating on adjacent words"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["spotlight-swap"],
    parameterDefaults: { intensity: 0.76, durationMs: 360, delayMs: 80, anchor: "word", direction: "center" },
  },
  {
    id: "text-mutation.emphasis-handoff",
    label: "Emphasis Handoff",
    family: "text_mutation",
    role: "mutation",
    renderFallback: "pop",
    combinationGroup: "semantic-mutation",
    referenceBehavior: "attention transfers from one word to the next without both peaking",
    timingSignature: "300-500ms, handoff overlap under 120ms",
    anchorBehavior: "phrase center",
    hierarchyBehavior: "two-word contrast or CTA handoff",
    usageConditions: ["paired thesis words", "CTA escalation"],
    antiPatterns: ["single isolated word", "three-way handoff"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["spotlight-swap"],
    parameterDefaults: { intensity: 0.7, durationMs: 420, delayMs: 60, anchor: "phrase", direction: "center" },
  },
  {
    id: "accent-motion.bracket-lock",
    label: "Bracket Lock",
    family: "accent_motion",
    role: "accent",
    renderFallback: "pop",
    combinationGroup: "accent-guide",
    referenceBehavior: "brackets snap around the active word and release",
    timingSignature: "220-360ms, snap and hold",
    anchorBehavior: "word box",
    hierarchyBehavior: "single active target only",
    usageConditions: ["spotlight target", "dense moment needing eye-trace"],
    antiPatterns: ["multiple bracket locks at once", "support word target"],
    allowedSemanticRoles: ["hero", "cta"],
    doctrineAffinity: ["spotlight-swap", "kinetic-pulse"],
    parameterDefaults: { intensity: 0.68, durationMs: 300, delayMs: 20, anchor: "word", direction: "center" },
  },
  {
    id: "accent-motion.caption-rail",
    label: "Caption Rail",
    family: "accent_motion",
    role: "accent",
    renderFallback: "slide_up",
    combinationGroup: "accent-guide",
    referenceBehavior: "thin rail guides a held caption line without stealing focus",
    timingSignature: "480-800ms, slow settle",
    anchorBehavior: "line edge",
    hierarchyBehavior: "supporting structure for restrained lines",
    usageConditions: ["held phrase", "cinematic doctrine"],
    antiPatterns: ["fast cuts", "large red hero text"],
    allowedSemanticRoles: ["support", "hero"],
    doctrineAffinity: ["restrained-cinematic"],
    parameterDefaults: { intensity: 0.36, durationMs: 620, delayMs: 0, anchor: "line", direction: "right" },
  },
  {
    id: "spatial-motion.anchored-drift",
    label: "Anchored Drift",
    family: "spatial_micro_motion",
    role: "spatial",
    renderFallback: "slide_up",
    combinationGroup: "idle-spatial",
    referenceBehavior: "held word drifts subtly while staying anchored to safe composition",
    timingSignature: "600-900ms, sub-pixel smoothness",
    anchorBehavior: "safe zone",
    hierarchyBehavior: "supportive presence, not impact",
    usageConditions: ["low density hold", "minimal profile"],
    antiPatterns: ["camera shake overlap", "small text shimmer"],
    allowedSemanticRoles: ["support", "hero"],
    doctrineAffinity: ["restrained-cinematic"],
    parameterDefaults: { intensity: 0.28, durationMs: 720, delayMs: 0, anchor: "safe_zone", direction: "center" },
  },
] as const;

export const JOSEPH_MICRO_ANIMATION_COMBINATION_RULES = [
  {
    id: "one-entry-per-word",
    failureTag: "micro_entry_collision",
    description: "Only one text-entry primitive may own a word at a time.",
  },
  {
    id: "one-emphasis-mark-per-target",
    failureTag: "micro_emphasis_collision",
    description: "Underline, marker, glow, and capsule highlights are mutually exclusive on one target.",
  },
  {
    id: "mutation-after-readability",
    failureTag: "micro_mutation_collision",
    description: "Mutation primitives cannot stack during the same readability window.",
  },
  {
    id: "visual-chaos-cap",
    failureTag: "micro_animation_visual_chaos",
    description: "More than three overlapping primitives risks visual chaos.",
  },
  {
    id: "semantic-role-fit",
    failureTag: "micro_animation_semantic_mismatch",
    description: "High-intensity emphasis and mutation primitives require hero or CTA words.",
  },
] as const;

export const MICRO_ANIMATION_FIX_INTENTS: Record<string, string> = {
  micro_entry_collision: "Use one entry primitive per word or stagger entry ownership before the next readable beat.",
  micro_entry_overlap: "Stagger entry primitives so overlapping words keep readable ownership.",
  micro_emphasis_collision: "Choose one emphasis mark per target word and remove competing highlight or accent primitives.",
  micro_mutation_collision: "Delay mutation primitives until the word is readable and avoid overlapping semantic mutation windows.",
  micro_animation_visual_chaos: "Lower primitive concurrency or intensity until the stack has a clear visual hierarchy.",
  micro_animation_semantic_mismatch: "Move high-intensity emphasis or mutation to hero/CTA words, or reduce support-word intensity.",
  micro_animation_unknown_primitive: "Replace unsupported primitive IDs with curated Joseph micro-animation primitives or governed fallbacks.",
  micro_animation_monotony: "Vary approved primitive families across adjacent beats to avoid repetition fatigue.",
  micro_animation_family_overuse: "Vary primitive families across the sequence instead of leaning on one visual habit.",
  micro_animation_intensity_budget_hot: "Reduce high-intensity primitive count before the moment loses readable hierarchy.",
};

export const microAnimationFixIntentsFor = (tags: readonly string[]): string[] =>
  [...new Set(tags.map((tag) => MICRO_ANIMATION_FIX_INTENTS[tag]).filter((intent): intent is string => Boolean(intent)))].sort();
const CATALOG_BY_ID = new Map(JOSEPH_MICRO_ANIMATION_CATALOG.map((primitive) => [primitive.id, primitive]));

const pick = <T>(rng: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty micro-animation primitive pool");
  }
  return item;
};

const targetFamilies = (semanticRole: SemanticRole, energy: number): MicroAnimationFamily[] => {
  if (semanticRole === "cta") {
    return ["text_mutation", "text_emphasis", "accent_motion", "text_entry"];
  }

  if (semanticRole === "hero" && energy >= 0.72) {
    return ["text_emphasis", "text_entry", "text_mutation", "accent_motion"];
  }

  if (semanticRole === "hero") {
    return ["text_entry", "text_emphasis", "spatial_micro_motion"];
  }

  return energy < 0.45
    ? ["text_entry", "spatial_micro_motion", "accent_motion"]
    : ["text_entry", "accent_motion"];
};

export const selectMicroAnimationPrimitive = ({
  rng,
  doctrineId,
  semanticRole,
  energy,
  overlayIndex,
}: MicroAnimationSelectionInput): MicroAnimationSelection => {
  const families = targetFamilies(semanticRole, energy);
  const preferred = JOSEPH_MICRO_ANIMATION_CATALOG.filter(
    (primitive) =>
      families.includes(primitive.family) &&
      primitive.allowedSemanticRoles.includes(semanticRole) &&
      (!doctrineId || primitive.doctrineAffinity.includes(doctrineId)),
  );
  const fallback = JOSEPH_MICRO_ANIMATION_CATALOG.filter(
    (primitive) =>
      families.includes(primitive.family) &&
      primitive.allowedSemanticRoles.includes(semanticRole),
  );
  const pool = preferred.length > 0 ? preferred : fallback;
  const primitive = pick(rng, pool);
  const intensityBias = semanticRole === "support" ? -0.12 : semanticRole === "cta" ? 0.08 : 0;
  const energyBias = (energy - 0.5) * 0.18;

  return {
    primitiveId: primitive.id,
    family: primitive.family,
    role: primitive.role,
    renderFallback: primitive.renderFallback,
    combinationGroup: primitive.combinationGroup,
    semanticRole,
    parameters: {
      ...primitive.parameterDefaults,
      intensity: clamp01(primitive.parameterDefaults.intensity + intensityBias + energyBias),
      delayMs: primitive.parameterDefaults.delayMs + (overlayIndex % 3) * 20,
    },
  };
};

const overlaps = (left: TimedMicroAnimationSelection, right: TimedMicroAnimationSelection): boolean =>
  left.startFrame <= right.endFrame && right.startFrame <= left.endFrame;

const consecutiveRepeatFailures = (selections: readonly TimedMicroAnimationSelection[]): string[] => {
  let streak = 0;
  let prior = "";
  for (const selection of selections) {
    if (selection.primitiveId === prior) {
      streak += 1;
    } else {
      prior = selection.primitiveId;
      streak = 1;
    }

    if (streak >= 4) {
      return ["micro_animation_monotony"];
    }
  }

  return [];
};

export const evaluateMicroAnimationSelections = (
  selections: readonly TimedMicroAnimationSelection[],
): MicroAnimationQuality => {
  if (selections.length === 0) {
    return { score: 1, failures: [], warnings: [], fixIntents: [] };
  }

  const failures = new Set<string>();
  const warnings = new Set<string>();
  const ordered = [...selections].sort((left, right) => left.startFrame - right.startFrame);

  for (const selection of ordered) {
    if (!CATALOG_BY_ID.has(selection.primitiveId)) {
      failures.add("micro_animation_unknown_primitive");
    }

    if (
      selection.semanticRole === "support" &&
      selection.parameters.intensity > 0.72 &&
      (selection.role === "emphasis" || selection.role === "mutation")
    ) {
      failures.add("micro_animation_semantic_mismatch");
    }
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const selection = ordered[index];
    if (!selection) {
      continue;
    }

    const overlapping = ordered.filter((candidate) => overlaps(selection, candidate));
    const overlappingIntensity = overlapping.reduce(
      (sum, candidate) => sum + candidate.parameters.intensity,
      0,
    );
    const hotOverlaps = overlapping.filter(
      (candidate) => candidate.parameters.intensity > 0.6,
    ).length;
    if (overlapping.length > 3 && (overlappingIntensity > 2.1 || hotOverlaps >= 3)) {
      failures.add("micro_animation_visual_chaos");
    }

    const sameGroup = overlapping.filter(
      (candidate) =>
        candidate !== selection &&
        candidate.combinationGroup === selection.combinationGroup,
    );
    if (sameGroup.length === 0) {
      continue;
    }

    if (selection.combinationGroup === "entry") {
      const sameStartEntry = sameGroup.some(
        (candidate) => candidate.startFrame === selection.startFrame,
      );
      if (sameStartEntry) {
        failures.add("micro_entry_collision");
      } else {
        warnings.add("micro_entry_overlap");
      }
    }
    if (selection.combinationGroup === "emphasis-mark") {
      failures.add("micro_emphasis_collision");
    }
    if (selection.combinationGroup === "semantic-mutation") {
      failures.add("micro_mutation_collision");
    }
  }

  consecutiveRepeatFailures(ordered).forEach((failure) => failures.add(failure));

  const familyCounts = new Map<MicroAnimationFamily, number>();
  ordered.forEach((selection) => {
    familyCounts.set(selection.family, (familyCounts.get(selection.family) ?? 0) + 1);
  });
  const dominantFamilyCount = Math.max(...familyCounts.values());
  if (ordered.length >= 5 && dominantFamilyCount / ordered.length > 0.75) {
    warnings.add("micro_animation_family_overuse");
  }

  const highIntensityCount = ordered.filter((selection) => selection.parameters.intensity > 0.8).length;
  if (highIntensityCount >= 3) {
    warnings.add("micro_animation_intensity_budget_hot");
  }

  const sortedFailures = [...failures].sort();
  const sortedWarnings = [...warnings].sort();

  return {
    score: clamp01(1 - failures.size * 0.18 - warnings.size * 0.04),
    failures: sortedFailures,
    warnings: sortedWarnings,
    fixIntents: microAnimationFixIntentsFor([...sortedFailures, ...sortedWarnings]),
  };
};

export const timedSelectionsFromOverlays = (
  overlays: readonly TextOverlay[],
): TimedMicroAnimationSelection[] =>
  overlays.flatMap((overlay) =>
    overlay.microAnimation
      ? [{
          ...overlay.microAnimation,
          startFrame: overlay.startFrame,
          endFrame: overlay.endFrame,
        }]
      : [],
  );

export const buildMicroAnimationAudit = (
  overlays: readonly TextOverlay[],
): MicroAnimationAudit => {
  const timedSelections = timedSelectionsFromOverlays(overlays);
  const quality = evaluateMicroAnimationSelections(timedSelections);
  return {
    taxonomyVersion: "joseph-micro-animation-v1",
    primitiveIds: [...new Set(timedSelections.map((selection) => selection.primitiveId))],
    score: quality.score,
    failures: quality.failures,
    warnings: quality.warnings,
    fixIntents: quality.fixIntents,
  };
};

export const evaluateManifestMicroAnimationQuality = (
  manifest: UnifiedRenderManifest,
): MicroAnimationQuality => {
  const overlayQuality = evaluateMicroAnimationSelections(timedSelectionsFromOverlays(manifest.textOverlays));
  const auditFailures = manifest.microAnimationAudit?.failures ?? [];
  const auditWarnings = manifest.microAnimationAudit?.warnings ?? [];
  const auditFixIntents = manifest.microAnimationAudit?.fixIntents ?? [];
  const failures = [...new Set([...overlayQuality.failures, ...auditFailures])].sort();
  const warnings = [...new Set([...overlayQuality.warnings, ...auditWarnings])].sort();

  return {
    score: Math.min(overlayQuality.score, manifest.microAnimationAudit?.score ?? 1),
    failures,
    warnings,
    fixIntents: [...new Set([...overlayQuality.fixIntents, ...auditFixIntents, ...microAnimationFixIntentsFor([...failures, ...warnings])])].sort(),
  };
};

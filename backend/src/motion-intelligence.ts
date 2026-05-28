import {createHash} from "node:crypto";

export type MotionSceneType =
  | "comparison"
  | "stats"
  | "high_emotion"
  | "hook"
  | "explain"
  | "generic";

export type MotionPrimitiveCategory =
  | "physical"
  | "natural"
  | "secondary"
  | "micro"
  | "depth";

export type MotionTransform = "x" | "y" | "scale" | "rotation" | "opacity";
export type MotionOwnerPriority = "primary" | "secondary" | "micro";

export type MotionProfile = {
  energy: number;
  intensity: number;
  chaos: number;
  clarity: number;
  depth: number;
  pacing: number;
  creatorStyle: string;
  semanticWeights: {
    clarity: number;
    emotion: number;
    novelty: number;
    restraint: number;
  };
};

export type MotionPrimitive = {
  id: string;
  label: string;
  category: MotionPrimitiveCategory;
  semanticTags: string[];
  transformClaims: MotionTransform[];
  ownerPriority: MotionOwnerPriority;
  readabilityCost: number;
  energyCost: number;
};

export type SelectedMotionPrimitive = MotionPrimitive & {
  score: number;
  mutationParameters: Record<string, number | string>;
};

export type RejectedMotionPrimitive = {
  id: string;
  reason: string;
  score: number;
};

export type MotionTransformOwnership = Partial<Record<MotionTransform, {
  primitiveId: string;
  owner: MotionOwnerPriority;
}>>;

export type MotionIntelligencePlan = {
  version: string;
  seed: string;
  continuityVector: string;
  motionProfile: MotionProfile;
  selectedPrimitives: SelectedMotionPrimitive[];
  rejectedPrimitives: RejectedMotionPrimitive[];
  transformOwnership: MotionTransformOwnership;
  driverPlan: {
    seed: string;
    continuityVector: string;
    keyframePolicy: "baked-parameters";
    rendererInterpolation: "deterministic";
    maxSelectedPrimitives: number;
    safetyConstraints: {
      maxScale: number;
      maxRotationDeg: number;
      minOpacity: number;
      safeZonePaddingPx: number;
      readabilityFloor: number;
    };
  };
  semanticReasoning: string[];
  traceLog: string;
};

export type MotionIntelligenceInput = {
  transcript: string;
  creatorProfile?: string | null;
  motionProfileVersion?: string;
  sceneMetadata?: {
    sceneId?: string;
    sceneType?: MotionSceneType | string;
    semanticIntent?: string;
    brandConstraints?: string[];
    creatorStyle?: string;
    startMs?: number;
    endMs?: number;
  };
};

const MOTION_PROFILE_VERSION = "motion-profile-v1";

const PRIMITIVES: MotionPrimitive[] = [
  {
    id: "spring-rise",
    label: "Spring Rise",
    category: "physical",
    semanticTags: ["hook", "energy", "contrast"],
    transformClaims: ["y", "scale"],
    ownerPriority: "primary",
    readabilityCost: 0.28,
    energyCost: 0.68
  },
  {
    id: "compression-pop",
    label: "Compression Pop",
    category: "physical",
    semanticTags: ["emphasis", "hook", "payoff"],
    transformClaims: ["scale"],
    ownerPriority: "primary",
    readabilityCost: 0.32,
    energyCost: 0.74
  },
  {
    id: "breathing-hold",
    label: "Breathing Hold",
    category: "natural",
    semanticTags: ["stats", "clarity", "restraint", "premium"],
    transformClaims: ["scale", "opacity"],
    ownerPriority: "micro",
    readabilityCost: 0.08,
    energyCost: 0.22
  },
  {
    id: "drift-line",
    label: "Drift Line",
    category: "natural",
    semanticTags: ["explain", "comparison", "continuity"],
    transformClaims: ["x", "y"],
    ownerPriority: "secondary",
    readabilityCost: 0.18,
    energyCost: 0.34
  },
  {
    id: "anticipation-nudge",
    label: "Anticipation Nudge",
    category: "secondary",
    semanticTags: ["comparison", "before-after", "emphasis"],
    transformClaims: ["x"],
    ownerPriority: "secondary",
    readabilityCost: 0.16,
    energyCost: 0.42
  },
  {
    id: "settle-lock",
    label: "Settle Lock",
    category: "secondary",
    semanticTags: ["stats", "clarity", "proof", "restraint"],
    transformClaims: ["y", "opacity"],
    ownerPriority: "primary",
    readabilityCost: 0.1,
    energyCost: 0.28
  },
  {
    id: "micro-parallax",
    label: "Micro Parallax",
    category: "micro",
    semanticTags: ["depth", "premium", "continuity"],
    transformClaims: ["x"],
    ownerPriority: "micro",
    readabilityCost: 0.12,
    energyCost: 0.25
  },
  {
    id: "pulse-emphasis",
    label: "Pulse Emphasis",
    category: "micro",
    semanticTags: ["emotion", "emphasis", "hook"],
    transformClaims: ["scale", "opacity"],
    ownerPriority: "micro",
    readabilityCost: 0.2,
    energyCost: 0.48
  },
  {
    id: "camera-push",
    label: "Camera Push",
    category: "depth",
    semanticTags: ["high_emotion", "hook", "depth"],
    transformClaims: ["scale"],
    ownerPriority: "primary",
    readabilityCost: 0.26,
    energyCost: 0.62
  },
  {
    id: "focus-pull",
    label: "Focus Pull",
    category: "depth",
    semanticTags: ["stats", "proof", "clarity", "depth"],
    transformClaims: ["opacity", "scale"],
    ownerPriority: "secondary",
    readabilityCost: 0.14,
    energyCost: 0.36
  },
  {
    id: "jitter-spark",
    label: "Jitter Spark",
    category: "micro",
    semanticTags: ["chaos", "shock", "novelty"],
    transformClaims: ["x", "y", "rotation"],
    ownerPriority: "micro",
    readabilityCost: 0.58,
    energyCost: 0.8
  },
  {
    id: "orbit-sweep",
    label: "Orbit Sweep",
    category: "natural",
    semanticTags: ["novelty", "depth", "showcase"],
    transformClaims: ["x", "y", "rotation"],
    ownerPriority: "secondary",
    readabilityCost: 0.44,
    energyCost: 0.66
  }
];

const PRIORITY_SCORE: Record<MotionOwnerPriority, number> = {
  primary: 3,
  secondary: 2,
  micro: 1
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const round = (value: number, digits = 3): number => Math.round(value * 10 ** digits) / 10 ** digits;

const normalizeText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

const seededUnit = (seed: string, key: string): number => {
  const hex = hash(`${seed}:${key}`).slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
};

const normalizeSceneType = (value: string | undefined): MotionSceneType => {
  const normalized = normalizeText(value ?? "");
  if (/compare|before|after|versus|vs/.test(normalized)) return "comparison";
  if (/stat|metric|number|proof|chart/.test(normalized)) return "stats";
  if (/emotion|climax|story|personal/.test(normalized)) return "high_emotion";
  if (/hook|intro|opening/.test(normalized)) return "hook";
  if (/explain|teach|walkthrough/.test(normalized)) return "explain";
  return "generic";
};

const buildSemanticReasoning = ({
  sceneType,
  semanticIntent,
  brandConstraints
}: {
  sceneType: MotionSceneType;
  semanticIntent: string;
  brandConstraints: string[];
}): string[] => {
  const reasoning = [`scene_type=${sceneType}`];
  if (semanticIntent) {
    reasoning.push(`semantic_intent=${semanticIntent}`);
  }
  if (brandConstraints.length > 0) {
    reasoning.push(`brand_constraints=${brandConstraints.join("|")}`);
  }
  if (sceneType === "comparison") {
    reasoning.push("comparison scene: clarity weighted heavily and motion lanes are restrained.");
  }
  if (sceneType === "stats") {
    reasoning.push("stats scene: chaos capped so numbers remain readable.");
  }
  if (sceneType === "high_emotion") {
    reasoning.push("high emotion scene: additional depth and energy are allowed within readability limits.");
  }
  return reasoning;
};

const generateMotionProfile = ({
  input,
  sceneType
}: {
  input: MotionIntelligenceInput;
  sceneType: MotionSceneType;
}): MotionProfile => {
  const normalizedTranscript = normalizeText(input.transcript);
  const semanticIntent = normalizeText(input.sceneMetadata?.semanticIntent ?? "");
  const brandConstraints = (input.sceneMetadata?.brandConstraints ?? []).map(normalizeText);
  const creatorStyle = input.sceneMetadata?.creatorStyle ?? input.creatorProfile ?? "default";
  const urgent = /urgent|shock|fast|aggressive|now|critical/.test(`${normalizedTranscript} ${semanticIntent}`);
  const premium = /premium|luxury|calm|restraint|operator/.test(`${creatorStyle} ${brandConstraints.join(" ")}`);
  const emotional = /feel|story|wrong|truth|personal|climax|emotion/.test(`${normalizedTranscript} ${semanticIntent}`);

  let energy = urgent ? 0.72 : premium ? 0.38 : 0.52;
  let intensity = urgent ? 0.7 : premium ? 0.42 : 0.54;
  let chaos = urgent ? 0.32 : 0.18;
  let clarity = premium ? 0.82 : 0.74;
  let depth = premium ? 0.62 : 0.46;
  let pacing = urgent ? 0.74 : 0.52;
  const semanticWeights = {
    clarity: 0.72,
    emotion: emotional ? 0.64 : 0.38,
    novelty: 0.34,
    restraint: premium ? 0.7 : 0.48
  };

  if (sceneType === "comparison") {
    clarity = Math.max(clarity, 0.84);
    chaos = Math.min(chaos, 0.28);
    semanticWeights.clarity = 0.9;
    semanticWeights.restraint = Math.max(semanticWeights.restraint, 0.62);
  } else if (sceneType === "stats") {
    clarity = Math.max(clarity, 0.9);
    chaos = Math.min(chaos, 0.2);
    intensity = Math.min(intensity, 0.48);
    semanticWeights.clarity = 0.94;
    semanticWeights.novelty = 0.18;
    semanticWeights.restraint = Math.max(semanticWeights.restraint, 0.78);
  } else if (sceneType === "high_emotion") {
    energy = Math.max(energy, 0.68);
    intensity = Math.max(intensity, 0.64);
    depth = Math.max(depth, 0.72);
    semanticWeights.emotion = 0.84;
  }

  if (brandConstraints.some((constraint) => /low chaos|lowchaos|low-chaos/.test(constraint))) {
    chaos = Math.min(chaos, 0.14);
  }
  if (brandConstraints.some((constraint) => /readability|clear|legible/.test(constraint))) {
    clarity = Math.max(clarity, 0.9);
  }

  return {
    energy: round(clamp01(energy)),
    intensity: round(clamp01(intensity)),
    chaos: round(clamp01(chaos)),
    clarity: round(clamp01(clarity)),
    depth: round(clamp01(depth)),
    pacing: round(clamp01(pacing)),
    creatorStyle,
    semanticWeights: {
      clarity: round(clamp01(semanticWeights.clarity)),
      emotion: round(clamp01(semanticWeights.emotion)),
      novelty: round(clamp01(semanticWeights.novelty)),
      restraint: round(clamp01(semanticWeights.restraint))
    }
  };
};

const scorePrimitive = ({
  primitive,
  sceneType,
  semanticIntent,
  motionProfile,
  seed
}: {
  primitive: MotionPrimitive;
  sceneType: MotionSceneType;
  semanticIntent: string;
  motionProfile: MotionProfile;
  seed: string;
}): number => {
  const semanticCorpus = normalizeText([sceneType, semanticIntent, ...primitive.semanticTags].join(" "));
  const semanticFit = primitive.semanticTags.some((tag) => semanticCorpus.includes(normalizeText(tag))) ? 0.24 : 0;
  const sceneFit = primitive.semanticTags.includes(sceneType) ? 0.26 : 0;
  const clarityFit = (1 - primitive.readabilityCost) * motionProfile.semanticWeights.clarity * 0.32;
  const energyFit = (1 - Math.abs(motionProfile.energy - primitive.energyCost)) * 0.16;
  const noveltyMutation = seededUnit(seed, primitive.id) * motionProfile.semanticWeights.novelty * 0.12;

  return round(semanticFit + sceneFit + clarityFit + energyFit + noveltyMutation);
};

const mutationParametersFor = ({
  primitive,
  motionProfile,
  seed
}: {
  primitive: MotionPrimitive;
  motionProfile: MotionProfile;
  seed: string;
}): Record<string, number | string> => {
  const amplitude = round(0.08 + motionProfile.intensity * 0.22 + seededUnit(seed, `${primitive.id}:amp`) * 0.08);
  const durationScale = round(1.18 - motionProfile.pacing * 0.28 + seededUnit(seed, `${primitive.id}:dur`) * 0.08);
  const delayMs = Math.round(seededUnit(seed, `${primitive.id}:delay`) * 90);
  return {
    amplitude,
    durationScale,
    delayMs,
    interpolation: "cubic"
  };
};

const selectPrimitives = ({
  seed,
  sceneType,
  semanticIntent,
  motionProfile
}: {
  seed: string;
  sceneType: MotionSceneType;
  semanticIntent: string;
  motionProfile: MotionProfile;
}): {
  selected: SelectedMotionPrimitive[];
  rejected: RejectedMotionPrimitive[];
} => {
  const readabilityCeiling = motionProfile.clarity >= 0.9 ? 0.34 : 0.48;
  const chaosCeiling = 0.24 + motionProfile.chaos * 0.8;
  const scored = PRIMITIVES.map((primitive) => ({
    primitive,
    score: scorePrimitive({
      primitive,
      sceneType,
      semanticIntent,
      motionProfile,
      seed
    })
  })).sort((left, right) => right.score - left.score || left.primitive.id.localeCompare(right.primitive.id));

  const selected: SelectedMotionPrimitive[] = [];
  const rejected: RejectedMotionPrimitive[] = [];
  const claimedTransforms = new Set<MotionTransform>();

  for (const {primitive, score} of scored) {
    if (primitive.readabilityCost > readabilityCeiling) {
      rejected.push({id: primitive.id, reason: "readability_cost_exceeds_scene_limit", score});
      continue;
    }
    if (primitive.energyCost > chaosCeiling && motionProfile.chaos <= 0.2) {
      rejected.push({id: primitive.id, reason: "energy_cost_exceeds_low_chaos_scene_limit", score});
      continue;
    }
    const conflicts = primitive.transformClaims.filter((claim) => claimedTransforms.has(claim));
    if (conflicts.length > 0 && primitive.ownerPriority !== "micro") {
      rejected.push({id: primitive.id, reason: `transform_conflict:${conflicts.join("|")}`, score});
      continue;
    }
    selected.push({
      ...primitive,
      score,
      mutationParameters: mutationParametersFor({primitive, motionProfile, seed})
    });
    primitive.transformClaims.forEach((claim) => claimedTransforms.add(claim));
    if (selected.length >= 3) {
      break;
    }
  }

  if (!selected.some((primitive) => primitive.transformClaims.includes("opacity"))) {
    const opacityPrimitive = PRIMITIVES.find((primitive) => primitive.id === "breathing-hold");
    if (opacityPrimitive && opacityPrimitive.readabilityCost <= readabilityCeiling) {
      selected.push({
        ...opacityPrimitive,
        score: scorePrimitive({primitive: opacityPrimitive, sceneType, semanticIntent, motionProfile, seed}),
        mutationParameters: mutationParametersFor({primitive: opacityPrimitive, motionProfile, seed})
      });
    }
  }

  return {selected, rejected};
};

const resolveTransformOwnership = (selected: SelectedMotionPrimitive[]): MotionTransformOwnership => {
  const ownership: MotionTransformOwnership = {};
  for (const primitive of selected) {
    for (const transform of primitive.transformClaims) {
      const current = ownership[transform];
      if (!current || PRIORITY_SCORE[primitive.ownerPriority] > PRIORITY_SCORE[current.owner]) {
        ownership[transform] = {
          primitiveId: primitive.id,
          owner: primitive.ownerPriority
        };
      }
    }
  }
  return ownership;
};

const buildTraceLog = (plan: Omit<MotionIntelligencePlan, "traceLog">): string => {
  return [
    `motion_profile_version=${plan.version}`,
    `seed=${plan.seed}`,
    `continuity_vector=${plan.continuityVector}`,
    `motion_profile=${JSON.stringify(plan.motionProfile)}`,
    `semantic_reasoning=${plan.semanticReasoning.join(" ; ")}`,
    `chosen_primitives=${plan.selectedPrimitives.map((primitive) => primitive.id).join(",")}`,
    `rejected_primitives=${plan.rejectedPrimitives.map((primitive) => `${primitive.id}:${primitive.reason}`).join(",")}`,
    `ownership=${JSON.stringify(plan.transformOwnership)}`,
    `mutation_parameters=${JSON.stringify(Object.fromEntries(plan.selectedPrimitives.map((primitive) => [primitive.id, primitive.mutationParameters])))}`,
    `driver_plan=${JSON.stringify(plan.driverPlan)}`
  ].join("\n");
};

export const buildMotionIntelligencePlan = (input: MotionIntelligenceInput): MotionIntelligencePlan => {
  const version = input.motionProfileVersion ?? MOTION_PROFILE_VERSION;
  const sceneType = normalizeSceneType(input.sceneMetadata?.sceneType);
  const semanticIntent = input.sceneMetadata?.semanticIntent ?? "";
  const brandConstraints = input.sceneMetadata?.brandConstraints ?? [];
  const continuityVector = hash([
    input.transcript,
    input.creatorProfile ?? "",
    version
  ].join("\n")).slice(0, 16);
  const seed = hash([
    continuityVector,
    stableJson(input.sceneMetadata ?? {}),
    version
  ].join("\n")).slice(0, 16);
  const motionProfile = generateMotionProfile({input, sceneType});
  const semanticReasoning = buildSemanticReasoning({
    sceneType,
    semanticIntent,
    brandConstraints
  });
  const {selected, rejected} = selectPrimitives({
    seed,
    sceneType,
    semanticIntent,
    motionProfile
  });
  const transformOwnership = resolveTransformOwnership(selected);
  const driverPlan = {
    seed,
    continuityVector,
    keyframePolicy: "baked-parameters" as const,
    rendererInterpolation: "deterministic" as const,
    maxSelectedPrimitives: 3,
    safetyConstraints: {
      maxScale: round(1.04 + motionProfile.intensity * 0.12),
      maxRotationDeg: Math.round(2 + motionProfile.chaos * 8),
      minOpacity: round(Math.max(0.62, 0.9 - motionProfile.chaos * 0.4)),
      safeZonePaddingPx: motionProfile.clarity >= 0.9 ? 96 : 72,
      readabilityFloor: round(Math.max(0.72, motionProfile.clarity))
    }
  };
  const withoutTrace = {
    version,
    seed,
    continuityVector,
    motionProfile,
    selectedPrimitives: selected,
    rejectedPrimitives: rejected,
    transformOwnership,
    driverPlan,
    semanticReasoning
  };
  const traceLog = buildTraceLog(withoutTrace);

  return {
    ...withoutTrace,
    traceLog
  };
};

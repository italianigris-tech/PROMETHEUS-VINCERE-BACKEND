import type {
  JosephBackgroundLayeringRules,
  JosephBackgroundPlan,
  JosephBackgroundPrimitiveFamily,
  JosephBackgroundPrimitiveLayer,
  JosephBackgroundPrimitiveParameters,
  JosephBackgroundPrimitiveSelection,
} from "@prometheus/shared-types";
import {seededRandom} from "@prometheus/shared-types";
import type {DirectorInput} from "./joseph-director";

export type JosephBackgroundPrimitiveDefinition = {
  primitiveId: string;
  label: string;
  family: JosephBackgroundPrimitiveFamily;
  role: JosephBackgroundPrimitiveSelection["role"];
  layer: JosephBackgroundPrimitiveLayer;
  blendMode: JosephBackgroundPrimitiveSelection["blendMode"];
  doctrineAffinity: readonly string[];
  profileAffinity: readonly DirectorInput["profile"][];
  densityAffinity: ReadonlyArray<"low" | "medium" | "high">;
  defaultParameters: JosephBackgroundPrimitiveParameters;
};

export type JosephBackgroundPrimitivePlanInput = {
  seed: number;
  profile: DirectorInput["profile"];
  doctrineId?: string;
  visualDensityPlan: "low" | "medium" | "high" | string;
  hasPiP: boolean;
  durationFrames: number;
};

const CATALOG_VERSION = "2026.06";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const params = (
  colorFamily: JosephBackgroundPrimitiveParameters["colorFamily"],
  speed: number,
  noiseIntensity: number,
  bloomIntensity: number,
  distortionAmount: number,
  contrast: number,
  density: number,
  opacity: number,
): JosephBackgroundPrimitiveParameters => ({
  colorFamily,
  speed,
  noiseIntensity,
  bloomIntensity,
  distortionAmount,
  contrast,
  density,
  opacity,
});

export const JOSEPH_BACKGROUND_PRIMITIVE_CATALOG: readonly JosephBackgroundPrimitiveDefinition[] = [
  {
    primitiveId: "shader.depth-vignette",
    label: "Depth Vignette",
    family: "shader_background",
    role: "background",
    layer: "foundation",
    blendMode: "normal",
    doctrineAffinity: ["restrained-cinematic", "spotlight-swap"],
    profileAffinity: ["joseph_cinematic", "joseph_minimal", "joseph_aggressive"],
    densityAffinity: ["low", "medium", "high"],
    defaultParameters: params("cinematic_cool", 0.18, 0.22, 0.18, 0.08, 0.68, 0.42, 0.92),
  },
  {
    primitiveId: "lightfield.cinematic-bloom",
    label: "Cinematic Bloom Field",
    family: "abstract_light_field",
    role: "atmosphere",
    layer: "atmosphere",
    blendMode: "screen",
    doctrineAffinity: ["restrained-cinematic", "spotlight-swap"],
    profileAffinity: ["joseph_cinematic", "joseph_minimal"],
    densityAffinity: ["low", "medium"],
    defaultParameters: params("warm_spotlight", 0.16, 0.18, 0.48, 0.04, 0.56, 0.34, 0.72),
  },
  {
    primitiveId: "particle.micro-dust",
    label: "Micro Dust Atmosphere",
    family: "particle_atmosphere",
    role: "atmosphere",
    layer: "atmosphere",
    blendMode: "screen",
    doctrineAffinity: ["restrained-cinematic"],
    profileAffinity: ["joseph_cinematic", "joseph_minimal"],
    densityAffinity: ["low", "medium"],
    defaultParameters: params("neutral_contrast", 0.14, 0.28, 0.22, 0.02, 0.52, 0.3, 0.54),
  },
  {
    primitiveId: "backplate.editorial-glass",
    label: "Editorial Glass Backplate",
    family: "editorial_backplate",
    role: "backplate",
    layer: "overlay_support",
    blendMode: "soft_light",
    doctrineAffinity: ["spotlight-swap", "restrained-cinematic"],
    profileAffinity: ["joseph_cinematic", "joseph_minimal"],
    densityAffinity: ["medium", "high"],
    defaultParameters: params("neutral_contrast", 0.08, 0.18, 0.26, 0.04, 0.72, 0.44, 0.68),
  },
  {
    primitiveId: "vignette.safe-text-halo",
    label: "Safe Text Halo",
    family: "vignette_surface",
    role: "backplate",
    layer: "overlay_support",
    blendMode: "multiply",
    doctrineAffinity: ["kinetic-pulse", "spotlight-swap", "restrained-cinematic"],
    profileAffinity: ["joseph_aggressive", "joseph_cinematic", "joseph_minimal"],
    densityAffinity: ["low", "medium", "high"],
    defaultParameters: params("neutral_contrast", 0.05, 0.12, 0.08, 0.02, 0.82, 0.38, 0.74),
  },
  {
    primitiveId: "focus.radial-tunnel",
    label: "Radial Focus Tunnel",
    family: "focus_tunnel",
    role: "background",
    layer: "foundation",
    blendMode: "overlay",
    doctrineAffinity: ["spotlight-swap", "kinetic-pulse"],
    profileAffinity: ["joseph_aggressive", "joseph_cinematic"],
    densityAffinity: ["medium", "high"],
    defaultParameters: params("electric_blue", 0.42, 0.24, 0.34, 0.18, 0.66, 0.58, 0.78),
  },
  {
    primitiveId: "accent.editorial-rails",
    label: "Editorial Rails",
    family: "accent_geometry",
    role: "accent",
    layer: "accent",
    blendMode: "screen",
    doctrineAffinity: ["kinetic-pulse", "spotlight-swap"],
    profileAffinity: ["joseph_aggressive", "joseph_cinematic"],
    densityAffinity: ["medium", "high"],
    defaultParameters: params("kinetic_crimson", 0.38, 0.12, 0.3, 0.08, 0.7, 0.5, 0.64),
  },
  {
    primitiveId: "shader.kinetic-grid",
    label: "Kinetic Grid Surface",
    family: "shader_background",
    role: "background",
    layer: "foundation",
    blendMode: "overlay",
    doctrineAffinity: ["kinetic-pulse"],
    profileAffinity: ["joseph_aggressive"],
    densityAffinity: ["high"],
    defaultParameters: params("kinetic_crimson", 0.58, 0.32, 0.3, 0.2, 0.72, 0.66, 0.74),
  },
  {
    primitiveId: "lightfield.electric-rim",
    label: "Electric Rim Light",
    family: "abstract_light_field",
    role: "accent",
    layer: "accent",
    blendMode: "screen",
    doctrineAffinity: ["kinetic-pulse"],
    profileAffinity: ["joseph_aggressive"],
    densityAffinity: ["high"],
    defaultParameters: params("electric_blue", 0.44, 0.18, 0.56, 0.1, 0.64, 0.52, 0.58),
  },
  {
    primitiveId: "particle.impact-sparks",
    label: "Impact Sparks",
    family: "particle_atmosphere",
    role: "accent",
    layer: "accent",
    blendMode: "screen",
    doctrineAffinity: ["kinetic-pulse"],
    profileAffinity: ["joseph_aggressive"],
    densityAffinity: ["high"],
    defaultParameters: params("kinetic_crimson", 0.62, 0.26, 0.4, 0.1, 0.66, 0.48, 0.5),
  },
];

const normalizeDensity = (value: string): "low" | "medium" | "high" =>
  value === "low" || value === "medium" || value === "high" ? value : "medium";

const governParameters = (
  primitive: JosephBackgroundPrimitiveDefinition,
  input: JosephBackgroundPrimitivePlanInput,
): {parameters: JosephBackgroundPrimitiveParameters; clamped: number} => {
  const density = normalizeDensity(input.visualDensityPlan);
  const profileBoost = input.profile === "joseph_aggressive" ? 0.12 : input.profile === "joseph_minimal" ? -0.12 : 0;
  const densityBoost = density === "high" ? 0.1 : density === "low" ? -0.1 : 0;
  const durationDampen = input.durationFrames > 900 ? -0.08 : 0;
  const pipDampen = input.hasPiP && primitive.layer === "accent" ? -0.08 : 0;
  const raw = {
    ...primitive.defaultParameters,
    speed: primitive.defaultParameters.speed + profileBoost + durationDampen,
    noiseIntensity: primitive.defaultParameters.noiseIntensity + densityBoost / 2,
    bloomIntensity: primitive.defaultParameters.bloomIntensity + profileBoost / 2,
    distortionAmount: primitive.defaultParameters.distortionAmount + profileBoost / 2,
    density: primitive.defaultParameters.density + densityBoost,
    opacity: primitive.defaultParameters.opacity + pipDampen,
  };

  let clamped = 0;
  const clamp = (value: number): number => {
    const next = clamp01(value);
    if (next !== value) {
      clamped += 1;
    }
    return next;
  };

  return {
    parameters: {
      colorFamily: raw.colorFamily,
      speed: clamp(raw.speed),
      noiseIntensity: clamp(raw.noiseIntensity),
      bloomIntensity: clamp(raw.bloomIntensity),
      distortionAmount: clamp(raw.distortionAmount),
      contrast: clamp(raw.contrast),
      density: clamp(raw.density),
      opacity: clamp(raw.opacity),
    },
    clamped,
  };
};

const scorePrimitive = (
  primitive: JosephBackgroundPrimitiveDefinition,
  input: JosephBackgroundPrimitivePlanInput,
): number => {
  const density = normalizeDensity(input.visualDensityPlan);
  let score = 0;
  if (primitive.profileAffinity.includes(input.profile)) score += 3;
  if (input.doctrineId && primitive.doctrineAffinity.includes(input.doctrineId)) score += 3;
  if (primitive.densityAffinity.includes(density)) score += 2;
  if (input.hasPiP && primitive.role === "backplate") score += 1;
  if (input.hasPiP && primitive.layer === "accent") score -= 0.5;
  return score;
};

const selectedDefinitions = (
  input: JosephBackgroundPrimitivePlanInput,
): JosephBackgroundPrimitiveDefinition[] => {
  const rng = seededRandom(input.seed + 1777);
  const ranked = [...JOSEPH_BACKGROUND_PRIMITIVE_CATALOG]
    .map((primitive) => ({primitive, score: scorePrimitive(primitive, input) + rng() * 0.2}))
    .sort((left, right) => right.score - left.score)
    .map(({primitive}) => primitive);

  const selection: JosephBackgroundPrimitiveDefinition[] = [];
  const addFirst = (predicate: (primitive: JosephBackgroundPrimitiveDefinition) => boolean) => {
    const primitive = ranked.find((candidate) => predicate(candidate) && !selection.includes(candidate));
    if (primitive) selection.push(primitive);
  };

  addFirst((primitive) => primitive.layer === "foundation");
  addFirst((primitive) => primitive.layer === "atmosphere");
  if (input.hasPiP) {
    addFirst((primitive) => primitive.role === "backplate" || primitive.family === "vignette_surface");
  }
  addFirst((primitive) => primitive.layer === "accent");

  const max = input.profile === "joseph_minimal" ? 3 : 4;
  return selection.slice(0, max);
};

const layeringRulesFor = (input: JosephBackgroundPrimitivePlanInput): JosephBackgroundLayeringRules => ({
  sourceFootageMode: input.hasPiP ? "pip_protected" : "full_bleed",
  textProtection: input.visualDensityPlan === "high" ? "contrast_and_clearance" : "contrast_scrim",
  pipProtection: input.hasPiP ? "reserved_safe_zone" : "none",
  overlayInteraction: "accent_below_text",
  maxActivePrimitives: input.profile === "joseph_minimal" ? 3 : 4,
});

export const buildJosephBackgroundPrimitivePlan = (
  input: JosephBackgroundPrimitivePlanInput,
): JosephBackgroundPlan => {
  const definitions = selectedDefinitions(input);
  let clampedParameterCount = 0;
  const primitives = definitions.map((definition) => {
    const governed = governParameters(definition, input);
    clampedParameterCount += governed.clamped;
    return {
      primitiveId: definition.primitiveId,
      family: definition.family,
      role: definition.role,
      layer: definition.layer,
      blendMode: definition.blendMode,
      renderStrategy: "curated_mesh",
      parameters: governed.parameters,
    } satisfies JosephBackgroundPrimitiveSelection;
  });

  return {
    version: "joseph-background-v1",
    catalogVersion: CATALOG_VERSION,
    selectedPrimitiveIds: primitives.map((primitive) => primitive.primitiveId),
    primitives,
    layeringRules: layeringRulesFor(input),
    parameterAudit: {
      governed: true,
      clampedParameterCount,
      warnings: primitives.length === 0 ? ["no_background_primitives_selected"] : [],
    },
  };
};

export type ParticlePresetName = "burst" | "sparkle" | "floating";
export type ParticleSeed = string | number;
export type Vector3 = readonly [number, number, number];
export type NumberRange = readonly [number, number];
export type ParticleBlendingMode = "AdditiveBlending" | "NormalBlending";

export type ParticleShaderConfig = {
  baseMaterial: "MeshBasicMaterial";
  blending: ParticleBlendingMode;
  transparent: boolean;
  depthWrite: boolean;
  uniforms: readonly string[];
  attributes: readonly string[];
  vertexPrelude: string;
  fragmentPrelude: string;
};

export type ParticlePresetConfig = {
  preset: ParticlePresetName;
  count: number;
  origin: Vector3;
  spawnRadius: NumberRange;
  velocitySeconds: NumberRange;
  lifetimeSeconds: NumberRange;
  delaySeconds: NumberRange;
  sizePixels: NumberRange;
  palette: readonly string[];
  gravity: Vector3;
  drag: number;
  turbulence: number;
  alpha: NumberRange;
  loop: boolean;
  blending: ParticleBlendingMode;
};

export type ParticleSystemInput = {
  preset: ParticlePresetName;
  count?: number;
  seed?: ParticleSeed;
  origin?: Vector3;
  palette?: readonly string[];
  startTimeSeconds?: number;
};

export type ResolvedParticleConfig = ParticlePresetConfig & {
  seed: ParticleSeed;
  startTimeSeconds: number;
};

export type ParticleMetadata = {
  id: number;
  seed: number;
  position: Vector3;
  velocity: Vector3;
  lifetimeSeconds: number;
  delaySeconds: number;
  sizePixels: number;
  color: string;
  alpha: number;
  phase: number;
};

export type ParticleSystem = {
  config: ResolvedParticleConfig;
  shader: ParticleShaderConfig;
  particles: readonly ParticleMetadata[];
};

export type ParticleSample = {
  id: number;
  alive: boolean;
  cycle: number;
  ageSeconds: number;
  normalizedAge: number;
  position: Vector3;
  velocity: Vector3;
  sizePixels: number;
  color: string;
  opacity: number;
};

export type ParticleRenderCostEstimate = {
  particleCount: number;
  drawCalls: number;
  vertices: number;
  triangles: number;
  attributeFloats: number;
  uniforms: number;
  estimatedFillPixels: number;
  material: ParticleShaderConfig["baseMaterial"];
  blending: ParticleBlendingMode;
};

type RandomSource = () => number;

const TAU = Math.PI * 2;
const DEFAULT_SEED = "prometheus-particles";

const PARTICLE_ATTRIBUTES = [
  "particlePosition",
  "particleVelocity",
  "particleLifetime",
  "particleDelay",
  "particleSize",
  "particleColor",
  "particlePhase"
] as const;

const PARTICLE_UNIFORMS = ["uTime", "uPixelRatio"] as const;

const PARTICLE_VERTEX_PRELUDE = `
attribute vec3 particlePosition;
attribute vec3 particleVelocity;
attribute float particleLifetime;
attribute float particleDelay;
attribute float particleSize;
attribute vec4 particleColor;
attribute float particlePhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec4 vParticleColor;
varying float vParticleOpacity;

vec3 applyParticleMotion(vec3 transformed) {
  float particleAge = clamp(uTime - particleDelay, 0.0, particleLifetime);
  float normalizedAge = particleAge / max(particleLifetime, 0.0001);
  transformed += particlePosition + particleVelocity * particleAge;
  vParticleColor = particleColor;
  vParticleOpacity = particleColor.a * (1.0 - smoothstep(0.78, 1.0, normalizedAge));
  return transformed;
}
`.trim();

const PARTICLE_FRAGMENT_PRELUDE = `
varying vec4 vParticleColor;
varying float vParticleOpacity;

void applyParticleColor(inout vec4 diffuseColor) {
  diffuseColor *= vec4(vParticleColor.rgb, vParticleOpacity);
}
`.trim();

export const PARTICLE_PRESETS: Record<ParticlePresetName, ParticlePresetConfig> = {
  burst: {
    preset: "burst",
    count: 96,
    origin: [0, 0, 0],
    spawnRadius: [0, 0.14],
    velocitySeconds: [1.8, 4.2],
    lifetimeSeconds: [0.55, 1.25],
    delaySeconds: [0, 0.1],
    sizePixels: [8, 24],
    palette: ["#FFFFFF", "#FFE66D", "#FF7A1A", "#FF2E63"],
    gravity: [0, -3.2, 0],
    drag: 0.58,
    turbulence: 0.045,
    alpha: [0.75, 1],
    loop: false,
    blending: "AdditiveBlending"
  },
  sparkle: {
    preset: "sparkle",
    count: 48,
    origin: [0, 0, 0],
    spawnRadius: [0.02, 0.42],
    velocitySeconds: [0.32, 1.1],
    lifetimeSeconds: [0.7, 2.1],
    delaySeconds: [0, 0.55],
    sizePixels: [3, 11],
    palette: ["#FFFFFF", "#BDEBFF", "#FFF2A8", "#FFB8E8"],
    gravity: [0, -0.35, 0],
    drag: 0.18,
    turbulence: 0.075,
    alpha: [0.55, 1],
    loop: false,
    blending: "AdditiveBlending"
  },
  floating: {
    preset: "floating",
    count: 72,
    origin: [0, 0, 0],
    spawnRadius: [0.25, 1.5],
    velocitySeconds: [0.04, 0.16],
    lifetimeSeconds: [4.5, 7.5],
    delaySeconds: [0, 1.8],
    sizePixels: [10, 28],
    palette: ["#E8F8FF", "#D8FFE6", "#F7E9FF", "#FFF7D6"],
    gravity: [0, 0.025, 0],
    drag: 0.04,
    turbulence: 0.12,
    alpha: [0.25, 0.62],
    loop: true,
    blending: "NormalBlending"
  }
};

export const buildParticleSystem = (input: ParticleSystemInput): ParticleSystem => {
  const preset = PARTICLE_PRESETS[input.preset];
  const palette = input.palette && input.palette.length > 0 ? [...input.palette] : [...preset.palette];
  const config: ResolvedParticleConfig = {
    ...preset,
    count: normalizeCount(input.count ?? preset.count),
    seed: input.seed ?? DEFAULT_SEED,
    origin: input.origin ?? preset.origin,
    palette,
    startTimeSeconds: input.startTimeSeconds ?? 0
  };

  const particles = Array.from({length: config.count}, (_, id) => createParticleMetadata(config, id));

  return {
    config,
    shader: createParticleShader(config.blending),
    particles
  };
};

export const sampleParticlesAtFrame = (
  system: ParticleSystem,
  frame: number,
  framesPerSecond: number
): ParticleSample[] => {
  if (framesPerSecond <= 0) {
    throw new Error("framesPerSecond must be greater than 0");
  }
  return sampleParticlesAtTime(system, frame / framesPerSecond);
};

export const sampleParticlesAtTime = (system: ParticleSystem, timeSeconds: number): ParticleSample[] => {
  const localTimeSeconds = Math.max(0, timeSeconds - system.config.startTimeSeconds);
  return system.particles.map((particle) => sampleParticle(system.config, particle, localTimeSeconds));
};

export const estimateParticleRenderCost = (system: ParticleSystem): ParticleRenderCostEstimate => {
  const particleCount = system.particles.length;
  const attributeFloatsPerParticle = 3 + 3 + 1 + 1 + 1 + 4 + 1;
  const estimatedFillPixels = Math.ceil(
    system.particles.reduce((total, particle) => total + particle.sizePixels * particle.sizePixels, 0)
  );

  return {
    particleCount,
    drawCalls: particleCount > 0 ? 1 : 0,
    vertices: particleCount * 4,
    triangles: particleCount * 2,
    attributeFloats: particleCount * attributeFloatsPerParticle,
    uniforms: system.shader.uniforms.length,
    estimatedFillPixels,
    material: system.shader.baseMaterial,
    blending: system.shader.blending
  };
};

const createParticleShader = (blending: ParticleBlendingMode): ParticleShaderConfig => ({
  baseMaterial: "MeshBasicMaterial",
  blending,
  transparent: true,
  depthWrite: false,
  uniforms: PARTICLE_UNIFORMS,
  attributes: PARTICLE_ATTRIBUTES,
  vertexPrelude: PARTICLE_VERTEX_PRELUDE,
  fragmentPrelude: PARTICLE_FRAGMENT_PRELUDE
});

const createParticleMetadata = (config: ResolvedParticleConfig, id: number): ParticleMetadata => {
  const seed = hashSeed(`${config.seed}:${config.preset}:${id}`);
  const random = createRandom(seed);
  const direction = randomUnitVector(random);
  const radius = lerpRange(config.spawnRadius, random());
  const speed = lerpRange(config.velocitySeconds, random());
  const position = addVectors(config.origin, scaleVector(direction, radius));
  const velocity = createPresetVelocity(config.preset, direction, speed, random);

  return {
    id,
    seed,
    position: roundVector(position),
    velocity: roundVector(velocity),
    lifetimeSeconds: roundNumber(lerpRange(config.lifetimeSeconds, random())),
    delaySeconds: roundNumber(lerpRange(config.delaySeconds, random())),
    sizePixels: roundNumber(lerpRange(config.sizePixels, random())),
    color: pickColor(config.palette, random()),
    alpha: roundNumber(lerpRange(config.alpha, random())),
    phase: roundNumber(random() * TAU)
  };
};

const createPresetVelocity = (
  preset: ParticlePresetName,
  direction: Vector3,
  speed: number,
  random: RandomSource
): Vector3 => {
  if (preset === "burst") {
    return scaleVector(direction, speed);
  }

  if (preset === "sparkle") {
    const upward = normalizeVector([direction[0] * 0.42, Math.abs(direction[1]) + 0.45, direction[2] * 0.42]);
    return scaleVector(upward, speed);
  }

  return [
    (random() - 0.5) * speed,
    speed * (0.55 + random() * 0.45),
    (random() - 0.5) * speed
  ];
};

const sampleParticle = (
  config: ResolvedParticleConfig,
  particle: ParticleMetadata,
  localTimeSeconds: number
): ParticleSample => {
  const rawAgeSeconds = localTimeSeconds - particle.delaySeconds;
  const cycleLength = Math.max(particle.lifetimeSeconds, 0.0001);
  const cycle = rawAgeSeconds > 0 ? Math.floor(rawAgeSeconds / cycleLength) : 0;
  const wrappedAgeSeconds = config.loop && rawAgeSeconds >= 0 ? rawAgeSeconds % cycleLength : rawAgeSeconds;
  const alive = wrappedAgeSeconds >= 0 && (config.loop || wrappedAgeSeconds <= particle.lifetimeSeconds);
  const ageSeconds = alive ? wrappedAgeSeconds : Math.max(0, Math.min(wrappedAgeSeconds, particle.lifetimeSeconds));
  const normalizedAge = clamp(ageSeconds / cycleLength, 0, 1);
  const dampedAge = config.drag > 0 ? ageSeconds / (1 + config.drag * ageSeconds) : ageSeconds;
  const gravityOffset = scaleVector(config.gravity, 0.5 * ageSeconds * ageSeconds);
  const velocityOffset = scaleVector(particle.velocity, dampedAge);
  const turbulenceOffset = createTurbulenceOffset(config, particle, ageSeconds, normalizedAge);
  const position = addVectors(addVectors(addVectors(particle.position, velocityOffset), gravityOffset), turbulenceOffset);
  const sizePixels = particle.sizePixels * createSizeMultiplier(config.preset, particle.phase, ageSeconds, normalizedAge);
  const opacity = alive ? particle.alpha * createOpacityMultiplier(config.preset, particle.phase, ageSeconds, normalizedAge) : 0;

  return {
    id: particle.id,
    alive,
    cycle,
    ageSeconds: roundNumber(ageSeconds),
    normalizedAge: roundNumber(normalizedAge),
    position: roundVector(position),
    velocity: particle.velocity,
    sizePixels: roundNumber(sizePixels),
    color: particle.color,
    opacity: roundNumber(opacity)
  };
};

const createTurbulenceOffset = (
  config: ResolvedParticleConfig,
  particle: ParticleMetadata,
  ageSeconds: number,
  normalizedAge: number
): Vector3 => {
  const amount = config.turbulence * (config.preset === "floating" ? 1 : normalizedAge);
  if (amount === 0) {
    return [0, 0, 0];
  }

  return [
    Math.sin(particle.phase + ageSeconds * 1.7) * amount,
    Math.cos(particle.phase * 0.7 + ageSeconds * 1.3) * amount * 0.5,
    Math.sin(particle.phase * 1.3 + ageSeconds * 1.1) * amount
  ];
};

const createSizeMultiplier = (
  preset: ParticlePresetName,
  phase: number,
  ageSeconds: number,
  normalizedAge: number
): number => {
  if (preset === "burst") {
    return 1 + normalizedAge * 0.65;
  }

  const pulse = 0.9 + Math.sin(phase + ageSeconds * TAU * (preset === "sparkle" ? 7 : 0.45)) * 0.1;
  return preset === "sparkle" ? pulse : 1 + (pulse - 0.9) * 0.6;
};

const createOpacityMultiplier = (
  preset: ParticlePresetName,
  phase: number,
  ageSeconds: number,
  normalizedAge: number
): number => {
  const fadeIn = smoothstep(0, 0.12, normalizedAge);
  const fadeOut = 1 - smoothstep(0.78, 1, normalizedAge);
  if (preset === "sparkle") {
    return fadeIn * fadeOut * (0.72 + Math.sin(phase + ageSeconds * TAU * 8) * 0.28);
  }
  if (preset === "floating") {
    return fadeIn * fadeOut * (0.84 + Math.sin(phase + ageSeconds * TAU * 0.35) * 0.16);
  }
  return fadeIn * fadeOut;
};

const normalizeCount = (count: number): number => Math.max(0, Math.floor(count));

const pickColor = (palette: readonly string[], randomValue: number): string => {
  const fallback = palette[0] ?? "#FFFFFF";
  return palette[Math.floor(randomValue * palette.length)] ?? fallback;
};

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed: number): RandomSource => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const randomUnitVector = (random: RandomSource): Vector3 => {
  const z = random() * 2 - 1;
  const angle = random() * TAU;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return [Math.cos(angle) * radius, z, Math.sin(angle) * radius];
};

const normalizeVector = (vector: Vector3): Vector3 => {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length === 0) {
    return [0, 1, 0];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
};

const addVectors = (left: Vector3, right: Vector3): Vector3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2]
];

const scaleVector = (vector: Vector3, scalar: number): Vector3 => [
  vector[0] * scalar,
  vector[1] * scalar,
  vector[2] * scalar
];

const lerpRange = (range: NumberRange, amount: number): number => range[0] + (range[1] - range[0]) * amount;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

const roundVector = (vector: Vector3): Vector3 => [
  roundNumber(vector[0]),
  roundNumber(vector[1]),
  roundNumber(vector[2])
];

const roundNumber = (value: number): number => {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
};

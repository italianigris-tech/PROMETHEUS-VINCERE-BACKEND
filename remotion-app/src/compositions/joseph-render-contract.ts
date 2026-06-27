import type {
  CameraMove,
  JosephBackgroundPlan,
  JosephBackgroundPrimitiveSelection,
  JosephPiPBackgroundLayer,
  JosephPiPFrame,
  JosephPiPPlan,
  MicroAnimationRenderFallback,
  TextOverlay,
} from '@prometheus/shared-types';
import {hashSeed, seededRandom} from '@prometheus/shared-types';

export type RenderVector3 = [number, number, number];

export type JosephTextTransform = {
  position: RenderVector3;
  scale: RenderVector3;
  rotation: RenderVector3;
  reveal?: number;
};

export type JosephMicroAnimationRenderBranch =
  | 'word-riser'
  | 'letter-riser'
  | 'soft-letter-tracking'
  | 'velocity-slide-reveal'
  | 'clipped-mask-reveal'
  | 'underline-reveal'
  | 'sweep-highlight'
  | 'capsule-highlight'
  | 'marker-stroke'
  | 'semantic-glow'
  | 'weight-escalation'
  | 'emphasis-handoff'
  | 'bracket-lock'
  | 'caption-rail'
  | 'anchored-drift'
  | 'governed-fallback';

export type JosephMicroAnimationObservable = {
  opacity: number;
  accentKind: 'none' | 'underline' | 'sweep' | 'capsule' | 'marker' | 'glow' | 'bracket' | 'rail';
  accentOpacity: number;
  accentColor: string;
  accentScale: RenderVector3;
  accentOffset: RenderVector3;
  clipProgress: number;
  fontSizeScale: number;
  glowOpacity: number;
  tracking: number;
  renderOrder: number;
};

export type JosephMicroAnimationRenderContract = {
  primitiveId: string;
  renderBranch: JosephMicroAnimationRenderBranch;
  fallbackUsed: boolean;
  governedFallback: MicroAnimationRenderFallback;
  transform: JosephTextTransform;
  observable: JosephMicroAnimationObservable;
};

export type JosephPiPBackgroundLayerRenderContract = JosephPiPBackgroundLayer & {
  frameRect: JosephPiPFrame;
  z: number;
  opacity: number;
  color: string;
  renderOrder: number;
};

export type JosephPiPRenderContract = {
  frame: JosephPiPFrame & {
    sourceZ: number;
    chromeZ: number;
    matteZ: number;
    matteOpacity: number;
    cornerRadiusRatio: number;
    renderOrder: number;
  };
  motion: {
    behavior: JosephPiPPlan['activeMotion'][number]['behavior'];
    progress: number;
    scale: number;
  };
  layers: JosephPiPBackgroundLayerRenderContract[];
  coexistence: JosephPiPPlan['coexistenceRules'];
};

export type JosephBackgroundLayerRenderContract = JosephBackgroundPrimitiveSelection & {
  z: number;
  color: string;
  opacity: number;
  scale: [number, number];
  renderOrder: number;
};

export type JosephBackgroundRenderContract = {
  layers: JosephBackgroundLayerRenderContract[];
  rules: {
    sourceVideoOpacity: number;
    contrastScrimOpacity: number;
    reservePiPSafeZone: boolean;
    accentRenderOrder: number;
    textRenderOrder: number;
    maxActivePrimitives: number;
  };
};

type CameraMoveWithVelocity = CameraMove & {
  entryVelocity?: number;
  exitVelocity?: number;
};

export type JosephCameraRenderContract = {
  activeMove: CameraMoveWithVelocity | null;
  position: RenderVector3;
  rotation: RenderVector3;
  progress: number;
  velocity: {
    entryVelocity: number;
    exitVelocity: number;
    currentVelocity: number;
  };
};

export const KNOWN_JOSEPH_MICRO_ANIMATION_IDS = [
  'text-entry.word-riser',
  'text-entry.letter-riser',
  'text-entry.soft-letter-tracking',
  'text-entry.velocity-slide-reveal',
  'text-entry.clipped-mask-reveal',
  'text-emphasis.underline-reveal',
  'text-emphasis.sweep-highlight',
  'text-emphasis.capsule-highlight',
  'text-emphasis.marker-stroke',
  'text-emphasis.semantic-glow',
  'text-mutation.weight-escalation',
  'text-mutation.emphasis-handoff',
  'accent-motion.bracket-lock',
  'accent-motion.caption-rail',
  'spatial-motion.anchored-drift',
] as const;

const MICRO_ANIMATION_RENDER_BRANCHES: Record<string, JosephMicroAnimationRenderBranch> = {
  'text-entry.word-riser': 'word-riser',
  'text-entry.letter-riser': 'letter-riser',
  'text-entry.soft-letter-tracking': 'soft-letter-tracking',
  'text-entry.velocity-slide-reveal': 'velocity-slide-reveal',
  'text-entry.clipped-mask-reveal': 'clipped-mask-reveal',
  'text-emphasis.underline-reveal': 'underline-reveal',
  'text-emphasis.sweep-highlight': 'sweep-highlight',
  'text-emphasis.capsule-highlight': 'capsule-highlight',
  'text-emphasis.marker-stroke': 'marker-stroke',
  'text-emphasis.semantic-glow': 'semantic-glow',
  'text-mutation.weight-escalation': 'weight-escalation',
  'text-mutation.emphasis-handoff': 'emphasis-handoff',
  'accent-motion.bracket-lock': 'bracket-lock',
  'accent-motion.caption-rail': 'caption-rail',
  'spatial-motion.anchored-drift': 'anchored-drift',
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * clamp01(progress);
const easeOutCubic = (value: number): number => 1 - Math.pow(1 - clamp01(value), 3);
const easeInOutCubic = (value: number): number => {
  const progress = clamp01(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
};
const sineInOut = (value: number): number => 0.5 - Math.cos(clamp01(value) * Math.PI) / 2;
const parkMiller = (seed: number): number => seededRandom(seed)();

const frameProgress = (item: {startFrame: number; endFrame: number}, frame: number): number => {
  const span = Math.max(1, item.endFrame - item.startFrame);
  return clamp01((frame - item.startFrame) / span);
};

const directionSign = (direction: string | undefined): {x: number; y: number} => {
  if (direction === 'left') return {x: -1, y: 0};
  if (direction === 'right') return {x: 1, y: 0};
  if (direction === 'down') return {x: 0, y: -1};
  return {x: 0, y: 1};
};

const fallbackTransform = ({
  overlay,
  fallback,
  frame,
  wordIndex,
  wordCount,
}: {
  overlay: TextOverlay;
  fallback: MicroAnimationRenderFallback;
  frame: number;
  wordIndex: number;
  wordCount: number;
}): JosephTextTransform => {
  const progress = frameProgress(overlay, frame);
  const eased = easeOutCubic(progress);
  const baseX = (wordIndex - (wordCount - 1) / 2) * 0.72;

  if (fallback === 'pop') {
    const scale = 0.5 + eased * 0.9;
    return {
      position: [baseX, 0.9 - (1 - eased) * 0.3, 0.35],
      scale: [scale, scale, scale],
      rotation: [0, 0, 0],
    };
  }

  if (fallback === 'slide_up') {
    return {
      position: [baseX, -0.8 + eased * 1.4, 0.3],
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
    };
  }

  if (fallback === 'glitch') {
    const jitterSeed = hashSeed(frame + 1, wordIndex + overlay.startFrame + 1);
    const jitterX = (parkMiller(jitterSeed) - 0.5) * 0.12;
    const jitterY = (parkMiller(jitterSeed + 17) - 0.5) * 0.08;
    return {
      position: [baseX + jitterX, 0.65 + jitterY, 0.32],
      scale: [1.05, 1.05, 1.05],
      rotation: [0, 0, (parkMiller(jitterSeed + 31) - 0.5) * 0.08],
    };
  }

  if (fallback === 'typewriter') {
    const wordLength = Math.max(1, overlay.text.split(/\s+/).filter(Boolean)[wordIndex]?.length ?? 1);
    const reveal = Math.max(1, Math.ceil(wordLength * eased));
    return {
      position: [baseX, 0.35, 0.3],
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
      reveal,
    };
  }

  const elastic = 1 + Math.sin(eased * Math.PI) * 0.35;
  return {
    position: [baseX, 0.5, 0.34],
    scale: [elastic, elastic, elastic],
    rotation: [0, 0, 0],
  };
};

const baseObservable = (progress: number): JosephMicroAnimationObservable => ({
  opacity: Math.max(0.12, easeOutCubic(progress)),
  accentKind: 'none',
  accentOpacity: 0,
  accentColor: '#FFFFFF',
  accentScale: [1, 1, 1],
  accentOffset: [0, -0.35, -0.03],
  clipProgress: easeOutCubic(progress),
  fontSizeScale: 1,
  glowOpacity: 0,
  tracking: 0,
  renderOrder: 40,
});

export const resolveMicroAnimationRenderContract = ({
  overlay,
  frame,
  wordIndex,
  wordCount,
}: {
  overlay: TextOverlay;
  frame: number;
  wordIndex: number;
  wordCount: number;
}): JosephMicroAnimationRenderContract => {
  const selection = overlay.microAnimation;
  const governedFallback = selection?.renderFallback ?? overlay.animation;
  const primitiveId = selection?.primitiveId ?? `legacy.${governedFallback}`;
  const renderBranch = selection ? MICRO_ANIMATION_RENDER_BRANCHES[selection.primitiveId] : undefined;
  const progress = frameProgress(overlay, frame);
  const eased = easeOutCubic(progress);
  const intensity = selection?.parameters.intensity ?? 0.5;
  const words = overlay.text.split(/\s+/).filter(Boolean);
  const word = words[wordIndex] ?? overlay.text;
  const wordLength = Math.max(1, word.length);
  const baseX = (wordIndex - (wordCount - 1) / 2) * 0.72;
  const base = fallbackTransform({overlay, fallback: governedFallback, frame, wordIndex, wordCount});
  const observable = baseObservable(progress);

  if (!renderBranch) {
    return {
      primitiveId,
      renderBranch: 'governed-fallback',
      fallbackUsed: true,
      governedFallback,
      transform: base,
      observable,
    };
  }

  const travel = 0.34 + intensity * 0.42;
  let transform: JosephTextTransform = base;

  switch (renderBranch) {
    case 'word-riser': {
      const settle = Math.sin(eased * Math.PI) * 0.08 * intensity;
      transform = {
        position: [baseX, 0.48 - (1 - eased) * travel + settle, 0.36],
        scale: [0.92 + eased * 0.12, 0.92 + eased * 0.12, 1],
        rotation: [0, 0, 0],
      };
      observable.opacity = eased;
      break;
    }
    case 'letter-riser': {
      const reveal = Math.max(1, Math.ceil(wordLength * eased));
      transform = {
        position: [baseX, 0.42 - (1 - eased) * 0.22, 0.35],
        scale: [1, 0.96 + eased * 0.04, 1],
        rotation: [0, 0, 0],
        reveal,
      };
      observable.tracking = (1 - eased) * 0.08;
      break;
    }
    case 'soft-letter-tracking': {
      transform = {
        position: [baseX, 0.44, 0.35],
        scale: [1 + (1 - eased) * 0.16, 1, 1],
        rotation: [0, 0, 0],
      };
      observable.tracking = (1 - eased) * 0.16;
      observable.opacity = 0.35 + eased * 0.65;
      break;
    }
    case 'velocity-slide-reveal': {
      const direction = directionSign(selection?.parameters.direction);
      const overshoot = Math.sin(eased * Math.PI) * 0.1 * intensity;
      transform = {
        position: [baseX - direction.x * (1 - eased) * travel, 0.5 - direction.y * (1 - eased) * travel + overshoot, 0.37],
        scale: [1 + overshoot, 1 + overshoot, 1],
        rotation: [0, 0, direction.x * (1 - eased) * -0.08],
      };
      observable.clipProgress = eased;
      break;
    }
    case 'clipped-mask-reveal': {
      transform = {
        position: [baseX, 0.48 - (1 - eased) * 0.18, 0.35],
        scale: [1, 1, 1],
        rotation: [0, 0, 0],
        reveal: Math.max(1, Math.ceil(wordLength * eased)),
      };
      observable.clipProgress = eased;
      break;
    }
    case 'underline-reveal':
      transform = {...base, position: [baseX, 0.48, 0.38]};
      observable.accentKind = 'underline';
      observable.accentOpacity = 0.3 + eased * 0.55;
      observable.accentColor = '#FFFFFF';
      observable.accentScale = [eased, 0.18, 1];
      break;
    case 'sweep-highlight':
      transform = {...fallbackTransform({overlay, fallback: 'pop', frame, wordIndex, wordCount}), position: [baseX, 0.52, 0.39]};
      observable.accentKind = 'sweep';
      observable.accentOpacity = Math.sin(clamp01(progress) * Math.PI) * (0.35 + intensity * 0.35);
      observable.accentColor = '#FF0040';
      observable.accentScale = [0.35 + eased * 0.9, 0.72, 1];
      break;
    case 'capsule-highlight':
      transform = {...base, position: [baseX, 0.5, 0.39], scale: [1 + Math.sin(eased * Math.PI) * 0.12, 1 + Math.sin(eased * Math.PI) * 0.12, 1]};
      observable.accentKind = 'capsule';
      observable.accentOpacity = 0.18 + eased * 0.24;
      observable.accentColor = '#111827';
      observable.accentScale = [1 + intensity * 0.2, 0.86, 1];
      break;
    case 'marker-stroke':
      transform = {...fallbackTransform({overlay, fallback: 'pop', frame, wordIndex, wordCount}), position: [baseX, 0.52, 0.39]};
      observable.accentKind = 'marker';
      observable.accentOpacity = 0.22 + eased * 0.42;
      observable.accentColor = '#F6C85F';
      observable.accentScale = [eased, 0.36, 1];
      observable.accentOffset = [0, -0.08, -0.035];
      break;
    case 'semantic-glow':
      transform = {...base, position: [baseX, 0.5, 0.39]};
      observable.accentKind = 'glow';
      observable.accentOpacity = Math.sin(progress * Math.PI) * (0.22 + intensity * 0.2);
      observable.glowOpacity = observable.accentOpacity;
      observable.accentColor = '#2F6BFF';
      observable.accentScale = [1.35, 1.1, 1];
      break;
    case 'weight-escalation': {
      const escalation = sineInOut(progress);
      transform = {
        position: [baseX, 0.5, 0.39],
        scale: [1 + escalation * 0.22 * intensity, 1 + escalation * 0.22 * intensity, 1],
        rotation: [0, 0, 0],
      };
      observable.fontSizeScale = 1 + escalation * 0.16;
      observable.renderOrder = 42;
      break;
    }
    case 'emphasis-handoff': {
      const handoff = Math.sin(progress * Math.PI);
      transform = {
        position: [baseX + (wordIndex % 2 === 0 ? -1 : 1) * (1 - eased) * 0.12, 0.5, 0.39],
        scale: [1 + handoff * 0.12, 1 + handoff * 0.12, 1],
        rotation: [0, 0, (wordIndex % 2 === 0 ? -1 : 1) * handoff * 0.025],
      };
      observable.accentKind = 'sweep';
      observable.accentOpacity = handoff * 0.18;
      observable.accentColor = '#FFFFFF';
      break;
    }
    case 'bracket-lock':
      transform = {...base, position: [baseX, 0.5, 0.4]};
      observable.accentKind = 'bracket';
      observable.accentOpacity = 0.25 + eased * 0.45;
      observable.accentColor = '#FFFFFF';
      observable.accentScale = [1 + intensity * 0.22, 1.12, 1];
      observable.renderOrder = 43;
      break;
    case 'caption-rail':
      transform = {...fallbackTransform({overlay, fallback: 'slide_up', frame, wordIndex, wordCount}), position: [baseX, 0.36 + eased * 0.08, 0.36]};
      observable.accentKind = 'rail';
      observable.accentOpacity = 0.18 + eased * 0.28;
      observable.accentColor = '#2F6BFF';
      observable.accentScale = [1.1, 0.18, 1];
      observable.accentOffset = [0, -0.42, -0.035];
      break;
    case 'anchored-drift': {
      const drift = Math.sin(progress * Math.PI * 2) * 0.04 * intensity;
      transform = {
        position: [baseX + drift, 0.44 + Math.cos(progress * Math.PI * 2) * 0.025 * intensity, 0.36],
        scale: [1, 1, 1],
        rotation: [0, 0, drift * 0.06],
      };
      observable.opacity = 0.72 + eased * 0.28;
      break;
    }
    default:
      transform = base;
  }

  return {
    primitiveId,
    renderBranch,
    fallbackUsed: false,
    governedFallback,
    transform,
    observable,
  };
};

const frameFromLayer = (layer: JosephPiPBackgroundLayer): JosephPiPFrame => ({
  leftPercent: layer.leftPercent,
  topPercent: layer.topPercent,
  widthPercent: layer.widthPercent,
  heightPercent: layer.heightPercent,
  borderRadiusPx: 0,
  safeMarginPercent: 0,
  depth: 'background',
});

const pipDepthZ: Record<JosephPiPFrame['depth'], {sourceZ: number; chromeZ: number; matteZ: number; renderOrder: number}> = {
  background: {sourceZ: 0.1, chromeZ: 0.18, matteZ: 0.02, renderOrder: 12},
  subject: {sourceZ: 0.28, chromeZ: 0.4, matteZ: 0.18, renderOrder: 24},
  foreground: {sourceZ: 0.58, chromeZ: 0.74, matteZ: 0.46, renderOrder: 36},
};

const pipLayerColor = (role: JosephPiPBackgroundLayer['role']): string => {
  if (role === 'focus_field') return '#2F6BFF';
  if (role === 'asset_board') return '#F6C85F';
  return '#111827';
};

const motionProgress = (plan: JosephPiPPlan, frame: number) => {
  const activeMotion = plan.activeMotion.find((segment) => frame >= segment.startFrame && frame <= segment.endFrame) ?? plan.activeMotion.at(-1);
  if (!activeMotion) {
    return {behavior: 'dock' as const, progress: 1, scale: 1};
  }
  const raw = frame >= activeMotion.startFrame && frame <= activeMotion.endFrame
    ? frameProgress(activeMotion, frame)
    : 1;
  const progress = activeMotion.easing === 'ease_in_out'
    ? easeInOutCubic(raw)
    : activeMotion.easing === 'ease_in'
      ? Math.pow(clamp01(raw), 3)
      : activeMotion.easing === 'linear'
        ? clamp01(raw)
        : easeOutCubic(raw);
  const scale = activeMotion.behavior === 'expand'
    ? 1 + progress * 0.08
    : activeMotion.behavior === 'collapse'
      ? 1.04 - progress * 0.06
      : activeMotion.behavior === 'handoff'
        ? 1 + Math.sin(progress * Math.PI) * 0.04
        : 0.96 + progress * 0.04;
  return {behavior: activeMotion.behavior, progress, scale};
};

export const resolvePiPRenderContract = ({plan, frame}: {plan: JosephPiPPlan; frame: number}): JosephPiPRenderContract => {
  const z = pipDepthZ[plan.frame.depth];
  const motion = motionProgress(plan, frame);
  const matteOpacity = clamp01(
    0.14 +
      plan.frame.safeMarginPercent / 100 +
      plan.coexistenceRules.backgroundDefocus * 0.32 +
      (plan.frame.depth === 'foreground' ? 0.08 : 0),
  );
  const roleOrder: Record<JosephPiPBackgroundLayer['role'], number> = {
    backplate: 0,
    asset_board: 1,
    focus_field: 2,
  };

  return {
    frame: {
      ...plan.frame,
      sourceZ: z.sourceZ,
      chromeZ: z.chromeZ,
      matteZ: z.matteZ,
      matteOpacity,
      cornerRadiusRatio: clamp01(plan.frame.borderRadiusPx / 96),
      renderOrder: z.renderOrder,
    },
    motion,
    layers: plan.backgroundLayers.map((layer, index) => ({
      ...layer,
      frameRect: frameFromLayer(layer),
      z: z.matteZ - 0.14 + roleOrder[layer.role] * 0.055 + index * 0.006,
      opacity: clamp01(0.1 + layer.intensity * 0.24),
      color: pipLayerColor(layer.role),
      renderOrder: z.renderOrder - 3 + roleOrder[layer.role],
    })),
    coexistence: plan.coexistenceRules,
  };
};

const backgroundLayerZ: Record<JosephBackgroundPrimitiveSelection['layer'], number> = {
  foundation: -0.42,
  atmosphere: -0.34,
  accent: 0.22,
  overlay_support: 0.44,
};

const colorByFamily = (colorFamily: JosephBackgroundPrimitiveSelection['parameters']['colorFamily']): string => {
  if (colorFamily === 'kinetic_crimson') return '#8F1232';
  if (colorFamily === 'electric_blue') return '#2F6BFF';
  if (colorFamily === 'warm_spotlight') return '#F6C85F';
  if (colorFamily === 'neutral_contrast') return '#D7DEE8';
  return '#152238';
};

export const resolveBackgroundRenderContract = (plan: JosephBackgroundPlan | undefined): JosephBackgroundRenderContract => {
  if (!plan) {
    return {
      layers: [],
      rules: {
        sourceVideoOpacity: 1,
        contrastScrimOpacity: 0,
        reservePiPSafeZone: false,
        accentRenderOrder: 20,
        textRenderOrder: 40,
        maxActivePrimitives: 0,
      },
    };
  }

  const maxActivePrimitives = Math.min(plan.layeringRules.maxActivePrimitives, plan.primitives.length);
  const activePrimitives = plan.primitives.slice(0, maxActivePrimitives);
  const sourceVideoOpacity = plan.layeringRules.sourceFootageMode === 'full_bleed'
    ? 1
    : plan.layeringRules.sourceFootageMode === 'pip_protected'
      ? 0.92
      : 0.86;
  const contrastScrimOpacity = plan.layeringRules.textProtection === 'contrast_scrim'
    ? 0.18
    : plan.layeringRules.textProtection === 'clearance_band'
      ? 0.12
      : 0.24;
  const accentRenderOrder = plan.layeringRules.overlayInteraction === 'accent_below_text'
    ? 28
    : plan.layeringRules.overlayInteraction === 'accent_above_background'
      ? 18
      : 34;

  return {
    layers: activePrimitives.map((primitive, index) => ({
      ...primitive,
      z: backgroundLayerZ[primitive.layer] + index * 0.008,
      color: colorByFamily(primitive.parameters.colorFamily),
      opacity: clamp01(primitive.parameters.opacity * (0.42 + primitive.parameters.contrast * 0.3 + primitive.parameters.bloomIntensity * 0.16)),
      scale: [
        1 + primitive.parameters.density * 0.28 + primitive.parameters.distortionAmount * 0.16,
        1 + primitive.parameters.noiseIntensity * 0.18,
      ],
      renderOrder: primitive.layer === 'foundation'
        ? 1
        : primitive.layer === 'atmosphere'
          ? 4
          : accentRenderOrder,
    })),
    rules: {
      sourceVideoOpacity,
      contrastScrimOpacity,
      reservePiPSafeZone: plan.layeringRules.pipProtection !== 'none',
      accentRenderOrder,
      textRenderOrder: 40,
      maxActivePrimitives,
    },
  };
};

export const resolveCameraRenderContract = ({
  cameraMoves,
  frame,
  seed,
}: {
  cameraMoves: readonly CameraMoveWithVelocity[];
  frame: number;
  seed: number;
}): JosephCameraRenderContract => {
  const activeMove = cameraMoves.find((move) => frame >= move.startFrame && frame <= move.endFrame) ?? null;
  if (!activeMove) {
    return {
      activeMove: null,
      position: [0, 0, 5],
      rotation: [0, 0, 0],
      progress: 0,
      velocity: {entryVelocity: 1, exitVelocity: 1, currentVelocity: 0},
    };
  }

  const progress = frameProgress(activeMove, frame);
  const entryVelocity = activeMove.entryVelocity ?? 0.55;
  const exitVelocity = activeMove.exitVelocity ?? 0.55;
  const currentVelocity = lerp(entryVelocity, exitVelocity, progress);
  const weightedProgress = clamp01(easeOutCubic(progress) * (0.82 + currentVelocity * 0.18));
  const position: RenderVector3 = [0, 0, 5];
  const rotation: RenderVector3 = [0, 0, 0];

  if (activeMove.type === 'push_in') {
    position[2] = 5 - weightedProgress * 3;
  }

  if (activeMove.type === 'dutch') {
    rotation[2] = 0.15 * weightedProgress;
  }

  if (activeMove.type === 'shake') {
    const baseSeed = hashSeed(seed, frame + 1);
    const amplitude = 0.65 + currentVelocity * 0.35;
    position[0] = (parkMiller(baseSeed) - 0.5) * 0.16 * amplitude;
    position[1] = (parkMiller(baseSeed + 1) - 0.5) * 0.12 * amplitude;
  }

  return {
    activeMove,
    position,
    rotation,
    progress: weightedProgress,
    velocity: {entryVelocity, exitVelocity, currentVelocity},
  };
};
import type {ReactElement} from "react";

export type PrimitiveKind = "pill" | "badge" | "button";

export type PrimitiveState = "idle" | "hover" | "active" | "loading" | "disabled" | "success" | "error";

export type PrimitiveDimensions = {
  width: number;
  height: number;
  radius: number;
};

export type PrimitiveStyle = {
  fill: string;
  stroke: string;
  text: string;
  opacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  scale?: number;
  translateZ?: number;
  shimmer?: number;
};

export type ResolvedPrimitiveStyle = Required<Pick<PrimitiveStyle, "fill" | "stroke" | "text" | "opacity" | "strokeOpacity" | "strokeWidth">> & {
  scale: number;
  translateZ: number;
  shimmer?: number;
};

export type PrimitiveTiming = {
  entranceFrame: number;
  entranceDuration: number;
  holdDuration: number;
  exitDuration: number;
};

export type PrimitiveAnimationConfig = {
  hook: string;
  tracks: readonly string[];
};

export type UiPrimitiveConfig = {
  id: string;
  label: string;
  dimensions: PrimitiveDimensions;
  baseStyle: PrimitiveStyle;
  stateStyles?: Partial<Record<Exclude<PrimitiveState, "idle">, Partial<PrimitiveStyle>>>;
  state?: PrimitiveState;
  disabled?: boolean;
  timing: PrimitiveTiming;
  animation: PrimitiveAnimationConfig;
};

export type PrimitiveAnimationPhase = {
  from: number;
  to: number;
  progress: number;
};

export type PrimitiveAnimationState = {
  hook: string;
  state: PrimitiveState;
  frame: number;
  phases: {
    entrance: PrimitiveAnimationPhase;
    hold: PrimitiveAnimationPhase;
    exit: PrimitiveAnimationPhase;
  };
  tracks: readonly string[];
};

export type PrimitiveRenderCostEstimate = {
  drawCalls: number;
  geometries: number;
  materials: number;
  troikaTextNodes: number;
  transparentSurfaces: number;
};

export type PrimitiveComponentProps = {
  config?: UiPrimitiveConfig;
  frame?: number;
  state?: PrimitiveState;
};

export type PrimitiveComponent = ((props: PrimitiveComponentProps) => ReactElement | null) & {
  uiPrimitive: {
    kind: PrimitiveKind;
    animationHook: string;
  };
};

const DEFAULT_TRANSLATE_Z = 0;
const DEFAULT_SCALE = 1;

export const resolvePrimitiveStyle = (
  config: UiPrimitiveConfig,
  requestedState: PrimitiveState = config.state ?? "idle"
): ResolvedPrimitiveStyle => {
  const state = config.disabled ? "disabled" : requestedState;
  const overlay = state === "idle" ? undefined : config.stateStyles?.[state];
  const merged = {...config.baseStyle, ...overlay};

  return {
    fill: merged.fill,
    stroke: merged.stroke,
    text: merged.text,
    opacity: merged.opacity,
    strokeOpacity: merged.strokeOpacity,
    strokeWidth: merged.strokeWidth,
    scale: merged.scale ?? DEFAULT_SCALE,
    translateZ: merged.translateZ ?? DEFAULT_TRANSLATE_Z,
    ...(merged.shimmer === undefined ? {} : {shimmer: merged.shimmer})
  };
};

export const buildPrimitiveAnimation = (
  config: UiPrimitiveConfig,
  frame: number,
  requestedState: PrimitiveState = config.state ?? "idle"
): PrimitiveAnimationState => {
  const entranceFrom = config.timing.entranceFrame;
  const entranceTo = entranceFrom + config.timing.entranceDuration;
  const holdTo = entranceTo + config.timing.holdDuration;
  const exitTo = holdTo + config.timing.exitDuration;

  return {
    hook: config.animation.hook,
    state: config.disabled ? "disabled" : requestedState,
    frame,
    phases: {
      entrance: phaseProgress(frame, entranceFrom, entranceTo),
      hold: phaseProgress(frame, entranceTo, holdTo),
      exit: phaseProgress(frame, holdTo, exitTo)
    },
    tracks: config.animation.tracks
  };
};

export const estimatePrimitiveRenderCost = (_config: UiPrimitiveConfig): PrimitiveRenderCostEstimate => ({
  drawCalls: 3,
  geometries: 2,
  materials: 3,
  troikaTextNodes: 1,
  transparentSurfaces: 3
});

const phaseProgress = (frame: number, from: number, to: number): PrimitiveAnimationPhase => ({
  from,
  to,
  progress: clamp01((frame - from) / Math.max(1, to - from))
});

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const createPrimitiveComponent = (kind: PrimitiveKind, animationHook: string): PrimitiveComponent => {
  const Component = ((_props: PrimitiveComponentProps) => null) as PrimitiveComponent;
  Component.uiPrimitive = {kind, animationHook};
  return Component;
};

export const Pill = createPrimitiveComponent("pill", "ui.primitive.pill.pop");
export const Badge = createPrimitiveComponent("badge", "ui.primitive.badge.pop");
export const Button = createPrimitiveComponent("button", "ui.primitive.button.press");

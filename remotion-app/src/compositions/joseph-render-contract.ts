import type {
  CameraMove,
  JosephBackgroundPlan,
  JosephBackgroundPrimitiveSelection,
  JosephMacroRigPlan,
  JosephPiPBackgroundLayer,
  JosephPiPFrame,
  JosephPiPPlan,
  JosephTypography,
  JosephTypographyIntelligencePlan,
  JosephTypographyLine,
  JosephTypographyRoleStyle,
  MicroAnimationRenderFallback,
  TextOverlay,
} from '@prometheus/shared-types';
import {hashSeed, seededRandom} from '@prometheus/shared-types';

export type RenderVector3 = [number, number, number];
export type PercentRect = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export type JosephTypographyFallbackReason =
  | 'manifest_typography_missing'
  | 'local_font_asset_not_browser_safe'
  | 'font_asset_not_browser_safe';

export type JosephTypographyRoleStyleObservable = {
  fontFamily: string;
  fontAssetUrl: string;
  fontWeight: number;
  letterSpacing: string;
  trackingEm: number;
  lineHeight: number;
  hierarchyLevel: number;
  hierarchyScale: number;
  renderOrder: number;
};

export type JosephTypographyLineRenderContract = JosephTypographyLine & JosephTypographyRoleStyleObservable & {
  safeRect: PercentRect;
  estimatedWidthPercent: number;
  textClipped: boolean;
  intersectsProtectedSubject: boolean;
  failureTags: string[];
};

export type JosephTypographyRenderContract = JosephTypography & {
  fallbackUsed: boolean;
  fallbackReason: JosephTypographyFallbackReason | null;
  governedFallback: JosephTypography;
  observable: {
    textFontFamily: string;
    fallbackFamily: string;
    fontAssetUrl: string;
    renderOrder: number;
    roleStyles: Partial<Record<JosephTypographyRoleStyle['role'], JosephTypographyRoleStyleObservable>>;
    lines: JosephTypographyLineRenderContract[];
    readability: {
      failureTags: string[];
    };
    pixelProofSignature: string;
  };
};

export const DEFAULT_JOSEPH_TYPOGRAPHY: JosephTypography = {
  fontId: 'hero-berylium-regular',
  fontFamily: 'PrometheusHeroBerylium',
  fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
  fallbackFamily: 'Arial, sans-serif',
};

const isLocalFileUrl = (value: string): boolean => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string): boolean => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);
const isBrowserSafeTypographyAsset = (value: string): boolean => /^https?:\/\//i.test(value) || value.startsWith('/');

const resolveTypographyFallbackReason = (typography: JosephTypography | undefined): JosephTypographyFallbackReason | null => {
  if (!typography) {
    return 'manifest_typography_missing';
  }

  if (isLocalFileUrl(typography.fontAssetUrl) || isLocalAbsolutePath(typography.fontAssetUrl)) {
    return 'local_font_asset_not_browser_safe';
  }

  if (!isBrowserSafeTypographyAsset(typography.fontAssetUrl)) {
    return 'font_asset_not_browser_safe';
  }

  return null;
};

const formatTracking = (trackingEm: number): string => `${trackingEm.toFixed(3)}em`;

const typographyRenderOrderFor = (role: JosephTypographyRoleStyle['role']): number => {
  if (role === 'hero') return 42;
  if (role === 'cta') return 41;
  return 40;
};

const fontSelectionForRoleStyle = (
  style: JosephTypographyRoleStyle,
  plan?: JosephTypographyIntelligencePlan,
) => {
  if (style.fontRole === 'support') {
    return plan?.fontPairing?.secondary ?? plan?.fontPairing?.primary;
  }
  return plan?.fontPairing?.primary;
};

const fontFamilyForRoleStyle = (
  style: JosephTypographyRoleStyle,
  typography: JosephTypography,
  plan?: JosephTypographyIntelligencePlan,
): string => fontSelectionForRoleStyle(style, plan)?.family ?? typography.fontFamily;

const fontAssetUrlForRoleStyle = (
  style: JosephTypographyRoleStyle,
  typography: JosephTypography,
  plan?: JosephTypographyIntelligencePlan,
): string => fontSelectionForRoleStyle(style, plan)?.fontAssetUrl ?? typography.fontAssetUrl;

const resolveTypographyRoleStyleObservables = (
  typography: JosephTypography,
  plan?: JosephTypographyIntelligencePlan,
): Partial<Record<JosephTypographyRoleStyle['role'], JosephTypographyRoleStyleObservable>> => {
  const roleStyles = plan?.roleStyles ?? [];
  return roleStyles.reduce<Partial<Record<JosephTypographyRoleStyle['role'], JosephTypographyRoleStyleObservable>>>((resolved, style) => {
    resolved[style.role] = {
      fontFamily: fontFamilyForRoleStyle(style, typography, plan),
      fontAssetUrl: fontAssetUrlForRoleStyle(style, typography, plan),
      fontWeight: style.weight,
      letterSpacing: formatTracking(style.trackingEm),
      trackingEm: style.trackingEm,
      lineHeight: style.lineHeight,
      hierarchyLevel: style.hierarchyLevel,
      hierarchyScale: style.hierarchyScale,
      renderOrder: typographyRenderOrderFor(style.role),
    };
    return resolved;
  }, {});
};

const defaultTypographySafeRectFor = (line: JosephTypographyLine, index: number): PercentRect => ({
  leftPercent: line.role === 'support' ? 9 : 7,
  topPercent: 14 + index * 18,
  widthPercent: line.role === 'support' ? 52 : 46,
  heightPercent: line.role === 'support' ? 14 : 18,
});

const typographyZoneForLine = (
  line: JosephTypographyLine,
  index: number,
  pipPlan?: JosephPiPPlan,
): PercentRect => {
  const zone = pipPlan?.typographyZones.find((candidate) => (
    candidate.role === line.role || (candidate.role === 'caption' && line.role === 'support')
  ));
  if (!zone) {
    return defaultTypographySafeRectFor(line, index);
  }
  return {
    leftPercent: zone.leftPercent,
    topPercent: zone.topPercent,
    widthPercent: zone.widthPercent,
    heightPercent: zone.heightPercent,
  };
};

const fallbackRoleStyleForLine = (
  line: JosephTypographyLine,
  typography: JosephTypography,
): JosephTypographyRoleStyleObservable => ({
  fontFamily: typography.fontFamily,
  fontAssetUrl: typography.fontAssetUrl,
  fontWeight: line.role === 'support' ? 500 : 760,
  letterSpacing: formatTracking(line.role === 'support' ? 0.04 : -0.02),
  trackingEm: line.role === 'support' ? 0.04 : -0.02,
  lineHeight: line.role === 'support' ? 1.08 : 0.96,
  hierarchyLevel: line.hierarchyLevel,
  hierarchyScale: line.role === 'support' ? 1 : 1.18,
  renderOrder: typographyRenderOrderFor(line.role),
});

const estimateTypographyLineWidthPercent = (
  line: JosephTypographyLine,
  style: JosephTypographyRoleStyleObservable,
): number => {
  const glyphWidth = line.role === 'support' ? 1.18 : 1.72;
  const trackingWidth = Math.abs(style.trackingEm) * 95;
  return Number((line.text.length * glyphWidth * style.hierarchyScale + trackingWidth).toFixed(3));
};

const resolveTypographyLineContracts = ({
  typography,
  plan,
  pipPlan,
  roleStyles,
}: {
  typography: JosephTypography;
  plan?: JosephTypographyIntelligencePlan;
  pipPlan?: JosephPiPPlan;
  roleStyles: Partial<Record<JosephTypographyRoleStyle['role'], JosephTypographyRoleStyleObservable>>;
}): JosephTypographyLineRenderContract[] => {
  const protectedSubjectRect = pipPlan
    ? expandPercentRect(
        pipPlan.frame,
        Math.max(
          pipPlan.frame.safeMarginPercent,
          pipPlan.coexistenceRules.textClearancePercent,
          ...pipPlan.typographyZones.map((zone) => zone.minClearancePercent),
        ),
      )
    : null;

  return (plan?.lines ?? []).map((line, index) => {
    const style = roleStyles[line.role] ?? fallbackRoleStyleForLine(line, typography);
    const safeRect = typographyZoneForLine(line, index, pipPlan);
    const estimatedWidthPercent = estimateTypographyLineWidthPercent(line, style);
    const textClipped = line.text.length > line.maxCharacters || estimatedWidthPercent > safeRect.widthPercent;
    const intersectsProtectedSubject = Boolean(
      pipPlan?.coexistenceRules.protectTypography &&
      protectedSubjectRect &&
      rectsIntersect(safeRect, protectedSubjectRect),
    );
    const failureTags = [
      ...(textClipped ? ['typography_line_clipping'] : []),
      ...(intersectsProtectedSubject ? ['typography_pip_overlap'] : []),
    ];

    return {
      ...line,
      ...style,
      safeRect,
      estimatedWidthPercent,
      textClipped,
      intersectsProtectedSubject,
      failureTags,
    };
  });
};

const typographyPixelProofSignatureFor = (lines: readonly JosephTypographyLineRenderContract[]): string =>
  lines.map((line) => [
    line.role,
    line.text,
    line.fontFamily,
    line.fontAssetUrl,
    line.fontWeight,
    line.trackingEm.toFixed(3),
    line.hierarchyScale.toFixed(2),
    line.safeRect.leftPercent,
    line.safeRect.topPercent,
    line.safeRect.widthPercent,
    line.safeRect.heightPercent,
  ].join(':')).join('|');

export const resolveTypographyRenderContract = (
  typography?: JosephTypography,
  typographyPlan?: JosephTypographyIntelligencePlan,
  pipPlan?: JosephPiPPlan,
): JosephTypographyRenderContract => {
  const fallbackReason = resolveTypographyFallbackReason(typography);
  const selected: JosephTypography = fallbackReason || !typography
    ? DEFAULT_JOSEPH_TYPOGRAPHY
    : {
        ...DEFAULT_JOSEPH_TYPOGRAPHY,
        ...typography,
        fallbackFamily: typography.fallbackFamily || DEFAULT_JOSEPH_TYPOGRAPHY.fallbackFamily,
      };
  const roleStyles = resolveTypographyRoleStyleObservables(selected, typographyPlan);
  const lines = resolveTypographyLineContracts({typography: selected, plan: typographyPlan, pipPlan, roleStyles});
  const failureTags = uniqueStrings(lines.flatMap((line) => line.failureTags));

  return {
    ...selected,
    fallbackUsed: fallbackReason !== null,
    fallbackReason,
    governedFallback: DEFAULT_JOSEPH_TYPOGRAPHY,
    observable: {
      textFontFamily: selected.fontFamily,
      fallbackFamily: selected.fallbackFamily,
      fontAssetUrl: selected.fontAssetUrl,
      renderOrder: 40,
      roleStyles,
      lines,
      readability: {
        failureTags,
      },
      pixelProofSignature: typographyPixelProofSignatureFor(lines),
    },
  };
};

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
  failureTags: string[];
  evidencePointer: string;
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
export type JosephPiPMatteCompositorInput = {
  available: boolean;
  planeZ?: number;
  fallbackTags?: readonly string[];
};

export type JosephPiPVisibleLayerRole = JosephPiPBackgroundLayer['role'] | 'subject' | 'frame_chrome';

export type JosephPiPVisibleLayer = {
  role: JosephPiPVisibleLayerRole;
  z: number;
  renderOrder: number;
  opacity: number;
  respectsSubjectMatte: boolean;
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
  clearance: {
    protectedSubjectRect: PercentRect;
    typographyZones: Array<JosephPiPPlan['typographyZones'][number] & {
      protectedClearancePercent: number;
      intersectsProtectedSubject: boolean;
      failureTags: string[];
    }>;
    camera: {
      activeMoveType: CameraMove['type'] | null;
      currentVelocity: number;
      subjectFocusRisk: boolean;
      failureTags: string[];
    };
    failureTags: string[];
  };
  compositor: {
    depthMode: '2.5d-pip';
    subjectMatte: {
      available: boolean;
      alphaSource: 'rvm_matte' | 'flat_subject';
      planeZ: number;
      renderOrder: number;
      fallbackTags: string[];
    };
    visibleLayerOrder: JosephPiPVisibleLayer[];
    failureTags: string[];
    depthSignature: string;
  };
};

export type JosephMacroRigRenderLayer = {
  role: 'speaker_pip' | JosephMacroRigPlan['renderFields']['typographySlots'][number]['role'] | JosephMacroRigPlan['renderFields']['assetPlacements'][number]['role'];
  frameRect: PercentRect;
  z: number;
  renderOrder: number;
  label: string;
};

export type JosephMacroRigRenderContract = {
  active: boolean;
  rigId: JosephMacroRigPlan['rigId'] | null;
  triggerSignals: string[];
  pip: JosephPiPRenderContract | null;
  layers: JosephMacroRigRenderLayer[];
  fallbackTags: string[];
  pixelProofSignature: string;
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

export type JosephSourcePresentationContract = {
  mode: 'full_bleed' | 'pip';
  frameRect: JosephPiPFrame | undefined;
  opacity: number;
  showPiPScaffolding: boolean;
  fallbackTags: string[];
};

export const resolveSourcePresentationContract = ({
  pipPlan,
  matteAvailable,
  sourceVideoOpacity,
}: {
  pipPlan: JosephPiPPlan | undefined;
  matteAvailable: boolean;
  sourceVideoOpacity: number;
}): JosephSourcePresentationContract => {
  if (!pipPlan || matteAvailable) {
    return {
      mode: pipPlan ? 'pip' : 'full_bleed',
      frameRect: pipPlan?.frame,
      opacity: Math.max(0, Math.min(1, pipPlan ? sourceVideoOpacity : 1)),
      showPiPScaffolding: Boolean(pipPlan),
      fallbackTags: [],
    };
  }

  // A flat PiP without a matte hides most of the speaker behind empty scaffolding.
  // Full-bleed footage is the useful pre-IRL fallback and keeps the upload watchable.
  return {
    mode: 'full_bleed',
    frameRect: undefined,
    opacity: 1,
    showPiPScaffolding: false,
    fallbackTags: ['compiler_matte_unavailable', 'flat_pip_promoted_to_full_bleed'],
  };
};

export type JosephKineticTextLayout = {
  fontSize: number;
  position: RenderVector3;
  maxWidth: number;
  renderedWidth: number;
  renderedHeight: number;
  safeMarginX: number;
  safeMarginY: number;
};

const kineticGlyphWidthEm = (character: string): number => {
  if (/\s/.test(character)) return 0.3;
  if ('ilIjt'.includes(character)) return 0.32;
  if ('mwMW'.includes(character)) return 0.86;
  if (/[A-Z0-9]/.test(character)) return 0.66;
  return 0.52;
};

export const resolveKineticTextLayout = ({
  text,
  viewportWidth,
  viewportHeight,
  preferredFontSize,
  textScale,
  trackingEm,
  normalizedPosition,
  motionPosition,
}: {
  text: string;
  viewportWidth: number;
  viewportHeight: number;
  preferredFontSize: number;
  textScale: number;
  trackingEm: number;
  normalizedPosition: {x: number; y: number};
  motionPosition: RenderVector3;
}): JosephKineticTextLayout => {
  const safeMarginX = viewportWidth * 0.08;
  const safeMarginY = viewportHeight * 0.08;
  const maxWidth = Math.max(0.1, viewportWidth - safeMarginX * 2);
  const characters = Array.from(text || ' ');
  const glyphWidthEm = characters.reduce((sum, character) => sum + kineticGlyphWidthEm(character), 0);
  const trackingWidthEm = Math.max(0, characters.length - 1) * Math.max(0, trackingEm);
  const naturalWidth = Math.max(0.1, (glyphWidthEm + trackingWidthEm) * preferredFontSize * Math.max(0.1, textScale));
  const fitScale = Math.min(1, maxWidth / naturalWidth);
  const fontSize = Math.max(0.01, preferredFontSize * fitScale);
  const renderedWidth = naturalWidth * fitScale;
  const renderedHeight = fontSize * 1.2 * Math.max(0.1, textScale);
  const anchorX = (Math.max(0, Math.min(1, normalizedPosition.x)) - 0.5) * viewportWidth;
  const anchorY = (0.5 - Math.max(0, Math.min(1, normalizedPosition.y))) * viewportHeight;
  const motionX = motionPosition[0];
  const motionY = motionPosition[1] - 0.5;
  const minX = -viewportWidth / 2 + safeMarginX + renderedWidth / 2;
  const maxX = viewportWidth / 2 - safeMarginX - renderedWidth / 2;
  const minY = -viewportHeight / 2 + safeMarginY + renderedHeight / 2;
  const maxY = viewportHeight / 2 - safeMarginY - renderedHeight / 2;
  const position: RenderVector3 = [
    Math.max(minX, Math.min(maxX, anchorX + motionX)),
    Math.max(minY, Math.min(maxY, anchorY + motionY)),
    motionPosition[2],
  ];

  return {fontSize, position, maxWidth, renderedWidth, renderedHeight, safeMarginX, safeMarginY};
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
const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
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
      failureTags: ['micro_animation_unsupported_variant'],
      evidencePointer: `render-contract://micro-animation/${primitiveId}/fallback/${governedFallback}`,
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
    failureTags: [],
    evidencePointer: `render-contract://micro-animation/${primitiveId}/${renderBranch}`,
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

const expandPercentRect = (rect: PercentRect, paddingPercent: number): PercentRect => {
  const left = clampPercent(rect.leftPercent - paddingPercent);
  const top = clampPercent(rect.topPercent - paddingPercent);
  const right = clampPercent(rect.leftPercent + rect.widthPercent + paddingPercent);
  const bottom = clampPercent(rect.topPercent + rect.heightPercent + paddingPercent);

  return {
    leftPercent: left,
    topPercent: top,
    widthPercent: Math.max(0, right - left),
    heightPercent: Math.max(0, bottom - top),
  };
};

const rectsIntersect = (leftRect: PercentRect, rightRect: PercentRect): boolean => {
  const leftRight = leftRect.leftPercent + leftRect.widthPercent;
  const leftBottom = leftRect.topPercent + leftRect.heightPercent;
  const rightRight = rightRect.leftPercent + rightRect.widthPercent;
  const rightBottom = rightRect.topPercent + rightRect.heightPercent;

  return (
    leftRect.leftPercent < rightRight &&
    leftRight > rightRect.leftPercent &&
    leftRect.topPercent < rightBottom &&
    leftBottom > rightRect.topPercent
  );
};

const uniqueStrings = (items: string[]): string[] => [...new Set(items)];

const resolvePiPClearanceContract = ({
  plan,
  frame,
  cameraMoves = [],
}: {
  plan: JosephPiPPlan;
  frame: number;
  cameraMoves?: readonly CameraMoveWithVelocity[];
}): JosephPiPRenderContract['clearance'] => {
  const protectedClearancePercent = Math.max(
    plan.frame.safeMarginPercent,
    plan.coexistenceRules.textClearancePercent,
    ...plan.typographyZones.map((zone) => zone.minClearancePercent),
  );
  const protectedSubjectRect = expandPercentRect(plan.frame, protectedClearancePercent);
  const typographyZones = plan.typographyZones.map((zone) => {
    const intersectsProtectedSubject = rectsIntersect(zone, protectedSubjectRect);
    const failureTags = plan.coexistenceRules.protectTypography && intersectsProtectedSubject
      ? ['pip_typography_subject_occlusion']
      : [];

    return {
      ...zone,
      protectedClearancePercent,
      intersectsProtectedSubject,
      failureTags,
    };
  });

  const activeMove = cameraMoves.find((move) => frame >= move.startFrame && frame <= move.endFrame) ?? null;
  const currentVelocity = activeMove
    ? lerp(activeMove.entryVelocity ?? 0.55, activeMove.exitVelocity ?? 0.55, frameProgress(activeMove, frame))
    : 0;
  const subjectFocusRisk = Boolean(
    plan.coexistenceRules.preserveSubjectFocus &&
      activeMove &&
      (
        (activeMove.type === 'shake' && currentVelocity >= 0.85) ||
        (activeMove.type === 'push_in' && currentVelocity >= 0.95)
      ),
  );
  const cameraFailureTags = subjectFocusRisk ? ['pip_camera_subject_focus_risk'] : [];
  const failureTags = uniqueStrings([
    ...typographyZones.flatMap((zone) => zone.failureTags),
    ...cameraFailureTags,
  ]);

  return {
    protectedSubjectRect,
    typographyZones,
    camera: {
      activeMoveType: activeMove?.type ?? null,
      currentVelocity,
      subjectFocusRisk,
      failureTags: cameraFailureTags,
    },
    failureTags,
  };
};

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

export const resolvePiPRenderContract = ({
  plan,
  frame,
  cameraMoves,
  matte,
}: {
  plan: JosephPiPPlan;
  frame: number;
  cameraMoves?: readonly CameraMoveWithVelocity[];
  matte?: JosephPiPMatteCompositorInput;
}): JosephPiPRenderContract => {
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

  const layers = plan.backgroundLayers.map((layer, index) => ({
    ...layer,
    frameRect: frameFromLayer(layer),
    z: z.matteZ - 0.14 + roleOrder[layer.role] * 0.055 + index * 0.006,
    opacity: clamp01(0.1 + layer.intensity * 0.24),
    color: pipLayerColor(layer.role),
    renderOrder: z.renderOrder - 3 + roleOrder[layer.role],
  }));
  const clearance = resolvePiPClearanceContract({plan, frame, cameraMoves});
  const matteFallbackTags = matte?.fallbackTags && matte.fallbackTags.length > 0
    ? [...matte.fallbackTags]
    : ['compiler_matte_unavailable'];
  const alphaSource: JosephPiPRenderContract['compositor']['subjectMatte']['alphaSource'] = matte?.available ? 'rvm_matte' : 'flat_subject';
  const subjectMatte: JosephPiPRenderContract['compositor']['subjectMatte'] = {
    available: matte?.available ?? false,
    alphaSource,
    planeZ: matte?.planeZ ?? z.matteZ,
    renderOrder: z.renderOrder,
    fallbackTags: matte?.available ? [] : matteFallbackTags,
  };
  const visibleLayers: JosephPiPVisibleLayer[] = [
    ...layers.map((layer): JosephPiPVisibleLayer => ({
      role: layer.role as JosephPiPVisibleLayerRole,
      z: layer.z,
      renderOrder: layer.renderOrder,
      opacity: layer.opacity,
      respectsSubjectMatte: false,
    })),
    {role: 'subject' as const, z: z.sourceZ, renderOrder: z.renderOrder, opacity: 1, respectsSubjectMatte: subjectMatte.available},
    {role: 'frame_chrome' as const, z: z.chromeZ, renderOrder: z.renderOrder + 1, opacity: 0.2 + motion.progress * 0.12, respectsSubjectMatte: false},
  ];
  const visibleLayerOrder = [...visibleLayers].sort((left, right) => left.renderOrder - right.renderOrder || left.z - right.z);
  const depthSignature = visibleLayerOrder
    .map((layer) => `${layer.role}:${layer.renderOrder}:${layer.z.toFixed(3)}:${layer.opacity.toFixed(3)}:${layer.respectsSubjectMatte ? 'matte' : 'flat'}`)
    .join('|');

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
    layers,
    coexistence: plan.coexistenceRules,
    clearance,
    compositor: {
      depthMode: '2.5d-pip',
      subjectMatte,
      visibleLayerOrder,
      failureTags: clearance.failureTags,
      depthSignature,
    },
  };
};

const inactiveMacroRigContract = (fallbackTags: string[] = ['macro_rig_semantic_trigger_missing']): JosephMacroRigRenderContract => ({
  active: false,
  rigId: null,
  triggerSignals: [],
  pip: null,
  layers: [],
  fallbackTags,
  pixelProofSignature: 'macro-rig:inactive',
});

const macroRigPixelProofSignatureFor = (
  macroRig: JosephMacroRigPlan,
  layers: readonly JosephMacroRigRenderLayer[],
): string => [
  macroRig.rigId,
  macroRig.semanticTrigger.matchedSignals.join(','),
  layers.map((layer) => `${layer.role}:${layer.frameRect.leftPercent}:${layer.frameRect.topPercent}:${layer.frameRect.widthPercent}:${layer.frameRect.heightPercent}:${layer.renderOrder}`).join('|'),
].join(':');

export const resolveMacroRigRenderContract = ({
  macroRig,
  frame,
  cameraMoves,
}: {
  macroRig?: JosephMacroRigPlan | null;
  frame: number;
  cameraMoves?: readonly CameraMoveWithVelocity[];
}): JosephMacroRigRenderContract => {
  if (!macroRig || !macroRig.semanticTrigger.valid) {
    return inactiveMacroRigContract();
  }

  const pip = resolvePiPRenderContract({plan: macroRig.renderFields.pipPlan, frame, cameraMoves});
  const layers: JosephMacroRigRenderLayer[] = [
    {
      role: 'speaker_pip',
      frameRect: macroRig.renderFields.pipPlan.frame,
      z: pip.frame.sourceZ,
      renderOrder: pip.frame.renderOrder,
      label: macroRig.inputs.sourceTrackId,
    },
    ...macroRig.renderFields.assetPlacements.map((placement) => ({
      role: placement.role,
      frameRect: {
        leftPercent: placement.leftPercent,
        topPercent: placement.topPercent,
        widthPercent: placement.widthPercent,
        heightPercent: placement.heightPercent,
      },
      z: 0.24 + placement.zIndex / 100,
      renderOrder: placement.zIndex,
      label: placement.role,
    })),
    ...macroRig.renderFields.typographySlots.map((slot) => ({
      role: slot.role,
      frameRect: {
        leftPercent: slot.leftPercent,
        topPercent: slot.topPercent,
        widthPercent: slot.widthPercent,
        heightPercent: slot.heightPercent,
      },
      z: 0.34 + slot.zIndex / 100,
      renderOrder: slot.zIndex,
      label: slot.text,
    })),
  ];
  const fallbackTags = uniqueStrings([
    ...macroRig.failureFallbacks.map((fallback) => fallback.tag),
    ...pip.clearance.failureTags,
  ]);

  return {
    active: true,
    rigId: macroRig.rigId,
    triggerSignals: macroRig.semanticTrigger.matchedSignals,
    pip,
    layers,
    fallbackTags,
    pixelProofSignature: macroRigPixelProofSignatureFor(macroRig, layers),
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

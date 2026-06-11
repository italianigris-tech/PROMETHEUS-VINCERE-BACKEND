export type TranscribedWord = {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
};

export type ThreeWordLayoutVariant =
  | "inline"
  | "dream-big-now"
  | "your-master-mind"
  | "take-action-now"
  | "build-legacy-your";

export type NonThreeWordLayoutVariant =
  | "quad-banner"
  | "quad-split"
  | "quad-serif"
  | "quad-outline"
  | "quad-duo-depth"
  | "fourplus-grid";

export type CaptionLayoutVariant = ThreeWordLayoutVariant | NonThreeWordLayoutVariant;

export type ChunkIntent = "default" | "name-callout" | "punch-emphasis";

export type NameSpan = {
  startWord: number;
  endWord: number;
  text: string;
};

export type ChunkSemanticMeta = {
  intent: ChunkIntent;
  nameSpans: NameSpan[];
  isVariation: boolean;
  suppressDefault: boolean;
};

export type CaptionChunk = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: TranscribedWord[];
  styleKey: string;
  motionKey: string;
  layoutVariant: CaptionLayoutVariant;
  emphasisWordIndices: number[];
  profileId?: CaptionStyleProfileId;
  semantic?: ChunkSemanticMeta;
  suppressDefault?: boolean;
  governedPhysics?: {
    aggression: number;
    motion: number;
    scale: number;
    dominance: number;
    opacity: number;
    timing: number;
    pacing: number;
    silence: number;
  };
};

export type CaptionPolicy = {
  chunking: {
    hardMinWords: number;
    hardMaxWords: number;
    softMinWords: number;
    softMaxWords: number;
    pauseBreakMs: number;
    strongPauseMs: number;
    maxLineChars: number;
    hardMaxLineChars: number;
  };
  styling: {
    baseStyleProfile: "uppercase-cinematic";
    uppercaseByDefault: boolean;
    keepProperCaseNames: boolean;
    forbidSplitContrast: boolean;
    wordHighlightMode: "chunk-only" | "word-timed";
  };
  variation: {
    enabled: boolean;
    maxRatio: number;
    minGapChunks: number;
    mode: "replace-default" | "overlay-accent";
  };
  singleActiveChunk: boolean;
};

export type VideoMetadata = {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  durationInFrames: number;
};

export type CaptionStyleProfileId =
  | "slcp"
  | "hormozi_word_lock_v1"
  | "svg_typography_v1"
  | "longform_svg_typography_v1"
  | "longform_eve_typography_v1"
  | "longform_docked_inverse_v1"
  | "longform_semantic_sidecall_v1";
export type MotionTier = "minimal" | "editorial" | "premium" | "hero";
export type MotionIntensity = MotionTier;
export type PreviewPerformanceMode = "full" | "balanced" | "turbo";
export type CaptionVerticalBias = "top" | "middle" | "bottom";
export type PresentationMode = "reel" | "long-form";
export type PresentationModeSetting = PresentationMode | "auto";
export type MotionAssetRole = "background" | "showcase";
export type MotionShowcasePlacementHint = "left" | "right" | "center" | "corner" | "auto";
export type AnimationTriggerType = "timeline" | "word-level" | "syllable-level";
export type AnimationLayerChannel = "base" | "accent" | "overlay" | "mask" | "host";
export type AnimationLayeringRule = {
  id: string;
  channel: AnimationLayerChannel;
  zIndex: number;
  order?: number;
  blendMode?: string;
  note?: string;
};
export type MotionShowcasePlacement =
  | "landscape-left"
  | "landscape-right"
  | "portrait-top-left"
  | "portrait-top-right"
  | "portrait-bottom-left"
  | "portrait-bottom-right"
  | "portrait-center";
export type MotionAssetRenderMode = "image" | "iframe";
export type MotionAssetSourceKind =
  | "local-public"
  | "authoring-batch"
  | "god-generated"
  | "showcase-cache"
  | "remote-cache"
  | "generated-placeholder";
export type MotionAssetFamily =
  | "frame"
  | "light-sweep"
  | "panel"
  | "grid"
  | "texture"
  | "flare"
  | "depth-mask"
  | "foreground-element";
export type MotionAssetAlphaMode = "opaque" | "straight" | "premultiplied" | "luma-mask";
export type MotionAssetLifecycle = MotionAssetDurationPolicy | "authoring";
export type MotionAssetAccessPolicy = {
  visibility: "public" | "internal" | "authoring";
  requiresSourceBundle: boolean;
  allowsRuntimeParameterOverrides: boolean;
  lockedFields: string[];
};
export type MotionAssetRuntimeParams = {
  opacity?: number;
  depth?: number;
  crop?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  parallax?: number;
  loop?: boolean;
  reveal?: number;
  timingOffsetMs?: number;
};
export type MotionAssetPlacementZone =
  | "full-frame"
  | "edge-frame"
  | "upper-perimeter"
  | "side-panels"
  | "lower-third"
  | "background-depth"
  | "foreground-cross";
export type MotionAssetDurationPolicy = "scene-span" | "entry-only" | "exit-only" | "ping-pong";
export type MotionAssetSafeArea = "avoid-caption-region" | "edge-safe" | "full-frame";
export type MotionCaptionMode = "existing-profile" | "svg-only" | "cinematic-only" | "hidden";
export type MotionMoodTag = "neutral" | "warm" | "cool" | "calm" | "kinetic" | "authority" | "heroic";
export type MotionGradeProfileId = "neutral" | "warm-cinematic" | "premium-contrast" | "cool-editorial";
export type MotionAssetSource = "local" | "supabase" | "drive";
export type MotionMatteMode = "off" | "auto" | "prefer-matte";
export type Motion3DMode = "off" | "editorial" | "showcase";
export type Motion3DLayerKind = "background" | "card" | "text" | "image" | "accent";
export type Motion3DCameraPresetId =
  | "subtlePushIn"
  | "subtlePullBack"
  | "comparisonPan"
  | "focusDriftLeft"
  | "focusDriftRight"
  | "quoteRevealCameraEase"
  | "cardDepthSlide"
  | "parallaxHold"
  | "heroLayerPush"
  | "gentleOrbit";
export type Motion3DLayerSpec = {
  id: string;
  kind: Motion3DLayerKind;
  src?: string;
  text?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotateZ: number;
  opacity: number;
  groupId?: string;
  parallax: number;
};
export type Motion3DSceneSpec = {
  id: string;
  startMs: number;
  endMs: number;
  cameraPreset: Motion3DCameraPresetId;
  focusLayerId?: string;
  layers: Motion3DLayerSpec[];
  reasons: string[];
};
export type Motion3DPlan = {
  enabled: boolean;
  mode: Motion3DMode;
  scenes: Motion3DSceneSpec[];
  sceneMap: Record<string, Motion3DSceneSpec>;
  reasons: string[];
};
export type MotionSceneKind = "comparison" | "quote" | "stat" | "feature-highlight" | "cta";
export type MotionChoreographyPresetId =
  | "comparison-lateral-sweep"
  | "quote-side-drift"
  | "stat-shallow-push"
  | "feature-depth-slide"
  | "cta-resolved-hold";
export type MotionPrimitiveId = "typewriter" | "blur-reveal" | "highlight-word" | "circle-reveal" | "blur-underline";
export type MotionCompositeId = "core-replaceable-word";
export type MotionChoreographyLane = "text" | "overlay" | "camera";
export type MotionChoreographyTargetType = "headline" | "subtext" | "asset" | "camera-stage";
export type MotionInstructionPhase = "enter" | "settle" | "hold" | "exit";
export type MotionInstructionEasing = "linear" | "ease-out" | "ease-in-out" | "back-out";
export type MotionTransformValue = {
  translateX: number;
  translateY: number;
  scale: number;
  opacity: number;
  rotateDeg: number;
  depth: number;
  blurPx: number;
  reveal: number;
};
export type ReferenceMotionSample = {
  frame: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotateDeg: number;
  depth: number;
  opacity: number;
  blurPx?: number;
  velocityX?: number;
  velocityY?: number;
};
export type ReferenceMotionTargetTrace = {
  targetId: string;
  samples: ReferenceMotionSample[];
};
export type ReferenceMotionTrace = {
  id: string;
  fps: number;
  targetTraces: ReferenceMotionTargetTrace[];
};
export type MotionTimelineInstruction = {
  id: string;
  targetId: string;
  targetType: MotionChoreographyTargetType;
  lane: MotionChoreographyLane;
  phase: MotionInstructionPhase;
  order: number;
  startMs: number;
  endMs: number;
  easing: MotionInstructionEasing;
  primitiveId?: MotionPrimitiveId;
  from: MotionTransformValue;
  to: MotionTransformValue;
};
export type MotionChoreographyDepthTreatment = "flat" | "depth-worthy";
export type MotionChoreographyLayerRole = "primary" | "secondary" | "accent";
export type MotionChoreographyLayerBinding = {
  targetId: string;
  targetType: Exclude<MotionChoreographyTargetType, "camera-stage">;
  role: MotionChoreographyLayerRole;
  sourceAssetId?: string;
  primitiveId?: MotionPrimitiveId;
  depthTreatment: MotionChoreographyDepthTreatment;
};
export type MotionPreviewStageTransform = {
  translateX: number;
  translateY: number;
  scale: number;
  rotateDeg: number;
  opacity: number;
};
export type MotionChoreographyContinuity = {
  carryCamera: boolean;
  carryFocusOffset: boolean;
  anchorTargetId?: string;
};
export type MotionPrimitiveContract = {
  id: MotionPrimitiveId;
  sourceKind: "html-prototype-placeholder";
  sourcePrototypeFileName: string;
  expectedComponentName: string;
  status: "planned";
  notes: string;
  label?: string;
  category?: string;
  triggerType?: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith?: string[];
  layeringRules?: AnimationLayeringRule[];
  graphTags?: string[];
  aliases?: string[];
};
export type MotionChoreographyScenePlan = {
  sceneId: string;
  sceneKind: MotionSceneKind;
  choreographyPresetId: MotionChoreographyPresetId;
  focusTargetId: string;
  headlineText: string;
  subtextText?: string;
  primitiveIds: MotionPrimitiveId[];
  layerBindings: MotionChoreographyLayerBinding[];
  timelineInstructions: MotionTimelineInstruction[];
  previewStageInstructions: MotionTimelineInstruction[];
  continuity: MotionChoreographyContinuity;
};
export type MotionChoreographyPlan = {
  enabled: boolean;
  scenes: MotionChoreographyScenePlan[];
  sceneMap: Record<string, MotionChoreographyScenePlan>;
  primitiveRegistry: MotionPrimitiveContract[];
  reasons: string[];
};
export type TemplateGraphicCategory =
  | "graph-chart"
  | "number-counter-kpi"
  | "timeline-calendar"
  | "blueprint-workflow";
export type GovernorAction =
  | "suppress"
  | "text-only-accent"
  | "asset-backed-cue"
  | "template-graphic-cue";
export type MotionShowcaseCueSource = "direct-asset" | "template-graphic" | "typography-only";
export type GovernorReasonCode =
  | "semantic-weight-strong"
  | "semantic-weight-low"
  | "title-context-match"
  | "emphasis-boost"
  | "duration-strong"
  | "numeric-signal"
  | "asset-coverage-strong"
  | "asset-coverage-weak"
  | "template-coverage-available"
  | "template-preferred"
  | "typography-fallback"
  | "screen-pressure-high"
  | "cooldown-active"
  | "nearby-cue"
  | "repeated-category"
  | "repeated-asset"
  | "abstract-held"
  | "density-budget";
export type CinematicGovernorPolicy = {
  id: string;
  version: string;
  tone: "restrained-luxe";
  directAssetMinScore: number;
  templateMinScore: number;
  textOnlyMinScore: number;
  overTargetSelectionScore: number;
  strongAssetScore: number;
  usableAssetScore: number;
  weakAssetCoverageScore: number;
  templatePreferredAssetCeiling: number;
  cooldownMs: number;
  screenPressureWordCount: number;
  screenPressurePenalty: number;
};
export type GovernorDecision = {
  action: GovernorAction;
  cueSource: MotionShowcaseCueSource | null;
  score: number;
  reasonCodes: GovernorReasonCode[];
  templateGraphicCategory?: TemplateGraphicCategory | null;
};
export type MissingAssetCategoryRecord = {
  categoryId: string;
  conceptId: string;
  label: string;
  aliases: string[];
  examplePhrase: string;
  requestedPack: string;
  count: number;
  lastSeenAt?: string;
};
export type ZoomTimingFamily = "assertive" | "bobby" | "glide" | "linger" | "reveal";
export type MotionCameraCue = {
  id: string;
  mode: "none" | "punch-in-out";
  timingFamily: ZoomTimingFamily;
  startMs: number;
  zoomInMs: number;
  peakStartMs: number;
  holdMs: number;
  peakEndMs: number;
  zoomOutMs: number;
  endMs: number;
  peakScale: number;
  panX: number;
  panY: number;
  reason?: string;
  triggerText?: string;
  triggerPatternIds?: string[];
};

export type MotionShowcaseMatchKind =
  | "exact"
  | "singular"
  | "search-term"
  | "synonym"
  | "fallback"
  | "template"
  | "typography";

export type MotionShowcaseCue = {
  id: string;
  assetId: string;
  asset: MotionAssetManifest;
  canonicalLabel: string;
  cueSource: MotionShowcaseCueSource;
  matchedText: string;
  matchedWordIndex: number;
  matchedStartMs: number;
  matchedEndMs: number;
  startMs: number;
  peakStartMs: number;
  peakEndMs: number;
  endMs: number;
  leadMs: number;
  holdMs: number;
  exitMs: number;
  placement: MotionShowcasePlacement;
  showLabelPlate: boolean;
  score: number;
  matchKind: MotionShowcaseMatchKind;
  templateGraphicCategory?: TemplateGraphicCategory | null;
  governorAction?: GovernorAction;
  governorReasonCodes?: GovernorReasonCode[];
  governorScore?: number;
  reason?: string;
};

export type MotionShowcasePlan = {
  aspectRatio: number;
  layoutMode: "landscape-callout" | "portrait-safe";
  cues: MotionShowcaseCue[];
  selectedAssets: MotionAssetManifest[];
  reasons: string[];
};

export type MotionBackgroundOverlayAsset = {
  id: string;
  label: string;
  src: string;
  originalFileName: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  themeTags?: MotionMoodTag[];
};

export type MotionBackgroundOverlayFitStrategy = {
  rotateDeg: 0 | 90;
  baseScale: number;
  orientedWidth: number;
  orientedHeight: number;
  sourceAspectRatio: number;
  targetAspectRatio: number;
  focusOffsetX: number;
  focusOffsetY: number;
  rationale: string;
};

export type MotionBackgroundOverlayCue = {
  id: string;
  assetId: string;
  asset: MotionBackgroundOverlayAsset;
  sourceBoundaryId: string;
  sourceChunkId: string;
  sourceChunkText: string;
  startMs: number;
  peakStartMs: number;
  peakEndMs: number;
  endMs: number;
  score: number;
  boundaryGapMs: number;
  boundarySafety: "unsafe" | "guarded" | "clear";
  reasoning: string;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  fitStrategy: MotionBackgroundOverlayFitStrategy;
};

export type MotionBackgroundOverlayPlan = {
  enabled: boolean;
  aspectRatio: number;
  layoutMode: "disabled" | "landscape-cover" | "vertical-cover";
  targetCueCount: number;
  minGapMs: number;
  cues: MotionBackgroundOverlayCue[];
  selectedAssets: MotionBackgroundOverlayAsset[];
  reasons: string[];
};

export type TransitionOverlayMode = "off" | "standard" | "fast-intro";
export type TransitionOverlayOrientation = "landscape" | "vertical" | "both";
export type TransitionOverlayBlendMode = "normal" | "screen" | "lighten" | "overlay" | "soft-light";
export type TransitionOverlayFadePreference = "soft" | "balanced" | "snappy";

export type TransitionOverlayTrimWindow = {
  startSeconds: number;
  endSeconds: number;
};

export type TransitionOverlayAsset = {
  id: string;
  label: string;
  src: string;
  originalFileName: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  orientation: TransitionOverlayOrientation;
  orientationSource?: "filename-tag" | "folder-tag" | "manual" | "dimensions";
  category?: string;
  styleTags: string[];
  recommendedDurationSeconds?: number;
  preferredTrimWindow?: TransitionOverlayTrimWindow;
  blendMode?: TransitionOverlayBlendMode;
  fadePreference?: TransitionOverlayFadePreference;
  opacity?: number;
};

export type TransitionOverlayFitStrategy = {
  rotateDeg: 0 | 90;
  overlayScale: number;
  coverScale: number;
  orientedWidth: number;
  orientedHeight: number;
  sourceAspectRatio: number;
  targetAspectRatio: number;
  rationale: string;
};

export type TransitionOverlayCue = {
  id: string;
  assetId: string;
  asset: TransitionOverlayAsset;
  sourceBoundaryId: string;
  sourceChunkId: string;
  sourceChunkText: string;
  mode: TransitionOverlayMode;
  startMs: number;
  peakStartMs: number;
  peakEndMs: number;
  endMs: number;
  score: number;
  silenceGapMs: number;
  boundarySafety: "unsafe" | "guarded" | "clear";
  reasoning: string;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  fitStrategy: TransitionOverlayFitStrategy;
  blendMode: TransitionOverlayBlendMode;
  peakOpacity: number;
  fadeInFrames: number;
  fadeOutFrames: number;
};

export type TransitionOverlayPlan = {
  enabled: boolean;
  mode: TransitionOverlayMode;
  aspectRatio: number;
  layoutMode: "disabled" | "landscape-cover" | "vertical-cover";
  targetCueCount: number;
  minSilenceMs: number;
  cooldownMs: number;
  maxTransitionsPerWindow: number;
  windowMs: number;
  overlayScale: number;
  preferredDurationMs: number;
  maxDurationMs: number;
  cues: TransitionOverlayCue[];
  selectedAssets: TransitionOverlayAsset[];
  reasons: string[];
};

export type MotionSoundLibrarySection =
  | "clock"
  | "drone"
  | "music"
  | "impact-hit"
  | "riser"
  | "snap"
  | "text"
  | "transition"
  | "ui"
  | "whoosh";

export type MotionSoundCueCategory =
  | "music-bed"
  | "text-typing"
  | "showcase-sweep"
  | "overlay-transition"
  | "camera-whoosh"
  | "impact-hit"
  | "time-tick"
  | "ui-accent"
  | "drone-bed"
  | "riser";

export type MotionSoundCueTrigger =
  | "soundtrack-bed"
  | "caption-chunk"
  | "showcase-cue"
  | "background-overlay"
  | "camera-cue"
  | "semantic-time"
  | "semantic-emphasis";

export type MotionSoundIntensity = "soft" | "medium" | "hard";

export type MotionSoundAsset = {
  id: string;
  label: string;
  src: string;
  sourceFileName: string;
  librarySection: MotionSoundLibrarySection;
  durationSeconds: number;
  tags: string[];
  intensity: MotionSoundIntensity;
};

export type MotionSoundCue = {
  id: string;
  assetId: string;
  asset: MotionSoundAsset;
  category: MotionSoundCueCategory;
  trigger: MotionSoundCueTrigger;
  startMs: number;
  peakStartMs: number;
  peakEndMs: number;
  endMs: number;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  playFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  baseVolume: number;
  maxVolume: number;
  priority: number;
  sourceRefId?: string;
  sourceText?: string;
  reasoning: string;
};

export type MotionAudioMixTargets = {
  sourceVideoVolume: number;
  musicBedVolume: number;
  soundEffectBaseVolume: number;
  soundEffectCeilingVolume: number;
};

export type MotionSoundDesignPlan = {
  enabled: boolean;
  cueDensityPerMinute: number;
  minGapMs: number;
  cues: MotionSoundCue[];
  musicCues: MotionSoundCue[];
  selectedAssets: MotionSoundAsset[];
  mixTargets: MotionAudioMixTargets;
  reasons: string[];
};

export type MotionSceneSpec = {
  id: string;
  startMs: number;
  endMs: number;
  tier: MotionTier;
  assetIds: string[];
  transitionIn: string;
  transitionOut: string;
  gradeProfile: MotionGradeProfileId;
  captionMode: MotionCaptionMode;
  matteId?: string;
  moodTags: MotionMoodTag[];
  safeArea: MotionAssetSafeArea;
  sourceChunkId?: string;
  cameraCue?: MotionCameraCue;
};

export type MotionAssetStructuralRegion = {
  id: string;
  label: string;
  role: string;
  selector?: string;
  revealMode: "always" | "optional" | "partial" | "progressive" | "hidden";
  hideable: boolean;
  optional: boolean;
  canBeShownAlone: boolean;
  importance: number;
  notes?: string;
};

export type MotionAssetCoverageStatus = "complete" | "partial" | "untagged" | "review" | "unsupported";

export type MotionAssetManifest = {
  id: string;
  assetRole?: MotionAssetRole;
  canonicalLabel?: string;
  showcasePlacementHint?: MotionShowcasePlacementHint;
  templateGraphicCategory?: TemplateGraphicCategory | null;
  virtualAsset?: boolean;
  sourceKind?: MotionAssetSourceKind;
  sourceFile?: string;
  sourceHtml?: string;
  sourceBatch?: string;
  family: MotionAssetFamily;
  tier: MotionTier;
  src: string;
  alphaMode: MotionAssetAlphaMode;
  placementZone: MotionAssetPlacementZone;
  durationPolicy: MotionAssetDurationPolicy;
  themeTags: MotionMoodTag[];
  searchTerms?: string[];
  semanticTags?: string[];
  subjectTags?: string[];
  emotionalTags?: MotionMoodTag[];
  functionalTags?: string[];
  semanticTriggers?: string[];
  visualWeight?: number;
  idealDurationMs?: number;
  placementPreference?: string[];
  reuseFrequencyLimit?: number;
  conflictRules?: string[];
  redundancyRiskScore?: number;
  structuralRegions?: MotionAssetStructuralRegion[];
  partialRevealSupported?: boolean;
  replaceableTextSlots?: number;
  replaceableNumericSlots?: number;
  showMode?: "full" | "partial" | "background" | "accent";
  metadataConfidence?: number;
  coverageStatus?: MotionAssetCoverageStatus;
  lifecycle?: MotionAssetLifecycle;
  accessPolicy?: MotionAssetAccessPolicy;
  preloadPriority?: number;
  runtimeParams?: MotionAssetRuntimeParams;
  renderMode?: MotionAssetRenderMode;
  safeArea: MotionAssetSafeArea;
  loopable: boolean;
  blendMode: string;
  opacity: number;
  source?: MotionAssetSource;
  sourceId?: string;
  remoteUrl?: string;
  score?: number;
  triggerType?: AnimationTriggerType | AnimationTriggerType[];
  compatibleWith?: string[];
  layeringRules?: AnimationLayeringRule[];
  graphTags?: string[];
  aliases?: string[];
};

export type CinematicPiPLayoutPreset =
  | "pip-left-content-right"
  | "pip-right-content-left"
  | "pip-small-corner-large-text"
  | "pip-floating-multi-ui";

export type CinematicPiPSubjectAnchorSource = "heuristic" | "provided" | "model";

export type CinematicPiPSubjectAnchor = {
  xPercent: number;
  yPercent: number;
  confidence: number;
  source: CinematicPiPSubjectAnchorSource;
  rationale: string;
};

export type CinematicPiPCardBox = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  borderRadiusPx: number;
};

export type CinematicPiPFreeSpaceRole = "headline" | "support" | "asset-stack" | "callout";

export type CinematicPiPFreeSpaceZone = {
  id: string;
  role: CinematicPiPFreeSpaceRole;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  align: "left" | "center" | "right";
};

export type CinematicPiPMotionAssetFlavor = "float" | "drift" | "pulse" | "glow" | "slide";

export type CinematicPiPMotionAssetPlacement = {
  asset: MotionAssetManifest;
  zoneId: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  revealDelayFrames: number;
  motionFlavor: CinematicPiPMotionAssetFlavor;
  opacity: number;
  scale: number;
};

export type CinematicPiPPlan = {
  layoutPreset: CinematicPiPLayoutPreset;
  subjectAnchor: CinematicPiPSubjectAnchor;
  cardBox: CinematicPiPCardBox;
  freeSpaceZones: CinematicPiPFreeSpaceZone[];
  motionAssetPlacements: CinematicPiPMotionAssetPlacement[];
  entrance: {
    fullFrameFrames: number;
    settleFrames: number;
    freeSpaceRevealFrames: number;
    assetStaggerFrames: number;
  };
  shadow: {
    blurPx: number;
    offsetYPx: number;
    spreadPx: number;
    opacity: number;
  };
  reasons: string[];
};

export type MotionCombatRole = "primary-attacker" | "secondary-attacker" | "support" | "utility";
export type MotionCombatRange = "short-range" | "long-range";
export type MotionCombatTierLabel = "S" | "A" | "B" | "C";
export type MotionCombatElementKind = "caption" | "asset" | "overlay" | "ui" | "background" | "pip" | "utility";
export type MotionCombatMotionStyle =
  | "cinematic-scale-fade"
  | "keyword-burst"
  | "letter-by-letter"
  | "underline-sweep"
  | "support-glow"
  | "soft-drift"
  | "blur-reveal"
  | "dolly-reveal";

export type MotionCombatElement = {
  id: string;
  label: string;
  kind: MotionCombatElementKind;
  role: MotionCombatRole;
  range: MotionCombatRange;
  tier: MotionCombatTierLabel;
  motionStyle: MotionCombatMotionStyle;
  score: number;
  reason: string[];
  chunkId?: string;
  assetId?: string;
  keywords?: string[];
  tags?: string[];
  emphasis?: boolean;
};

export type MotionCombatChunkPlan = {
  chunkId: string;
  chunkText: string;
  primary: MotionCombatElement | null;
  secondary: MotionCombatElement[];
  supporters: MotionCombatElement[];
  utilities: MotionCombatElement[];
  longRange: MotionCombatElement[];
  shortRange: MotionCombatElement[];
  keywordPhrases: string[];
  score: number;
  reasons: string[];
};

export type MotionCompositionCombatPlan = {
  version: string;
  tier: MotionTier;
  elements: MotionCombatElement[];
  chunkPlans: MotionCombatChunkPlan[];
  primaryAttackers: MotionCombatElement[];
  secondaryAttackers: MotionCombatElement[];
  supporters: MotionCombatElement[];
  utilities: MotionCombatElement[];
  longRangeElements: MotionCombatElement[];
  shortRangeElements: MotionCombatElement[];
  synergyScore: number;
  hierarchyScore: number;
  supportCoverageScore: number;
  motionVarietyScore: number;
  readabilityScore: number;
  overExecutionScore: number;
  roleCounts: Record<MotionCombatRole, number>;
  validity: {
    hasPrimary: boolean;
    hasSupport: boolean;
    hasUtility: boolean;
    hasLongRange: boolean;
    invalidReasons: string[];
  };
  reasons: string[];
};

export type TransitionRuleSet = {
  videoScaleFrom: number;
  videoScaleTo: number;
  overlayOpacityFrom: number;
  overlayOpacityTo: number;
  translateXFrom: number;
  translateXTo: number;
  translateYFrom: number;
  translateYTo: number;
  clipMode: "none" | "left-to-right" | "center-out" | "top-down" | "bottom-up";
};

export type TransitionPreset = {
  id: string;
  family: "cut" | "fade" | "wipe" | "panel" | "grid" | "layered-sweep" | "foreground-cross";
  tier: MotionTier;
  durationFrames: number;
  easing: "linear" | "ease-in-out" | "ease-out" | "back-out";
  entryRules: TransitionRuleSet;
  exitRules: TransitionRuleSet;
  captionCompatibility: {
    protectSafeZone: boolean;
    safeZoneOpacityCap: number;
    allowForegroundCross: boolean;
  };
};

export type GradeProfile = {
  id: MotionGradeProfileId;
  label: string;
  contrast: number;
  saturation: number;
  brightness: number;
  temperature: number;
  lift: number;
  gamma: number;
  gain: number;
  vignette: number;
  bloom: number;
  grain: number;
  shadowTint: string;
  highlightTint: string;
};

export type MatteManifest = {
  id: string;
  sourceVideo: string;
  alphaSrc?: string | null;
  foregroundSrc?: string | null;
  width: number;
  height: number;
  fps: number;
  status: "missing" | "partial" | "ready";
  provider: "offline-cache";
  cacheDir?: string;
  updatedAt: string;
};

export type AppEnv = {
  ASSEMBLYAI_API_KEY: string;
  CAPTION_STYLE_PROFILE: CaptionStyleProfileId;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;
  SUPABASE_STORAGE_PREFIX: string;
  SUPABASE_ASSETS_TABLE: string;
  SUPABASE_ASSETS_SELECT: string;
  SUPABASE_ASSETS_SCAN_LIMIT: number;
  MOTION_ASSET_MANIFEST_URL: string;
  ASSET_BRAIN_ENABLED: boolean;
  CREATIVE_ORCHESTRATION_V1: boolean;
  VIDEO_SOURCE_PATH: string;
};

export type AssemblyTranscriptStatus =
  | "queued"
  | "processing"
  | "completed"
  | "error";

export type AssemblyWord = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
};

export type AssemblyTranscript = {
  id: string;
  status: AssemblyTranscriptStatus;
  error?: string | null;
  words?: AssemblyWord[] | null;
};

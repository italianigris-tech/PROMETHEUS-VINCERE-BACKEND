import {z} from "zod";
import {
  rankedAssetCandidateSchema,
  retrievalEnforcementSummarySchema,
  retrievalTraceSchema,
  vectorSearchRequestSchema,
  vectorSearchResponseSchema
} from "../../lib/vector/schemas";

export const rhetoricalPurposeSchema = z.enum([
  "authority",
  "proof",
  "emotional-punch",
  "curiosity",
  "escalation",
  "tension",
  "payoff",
  "transformative",
  "urgency",
  "luxury-premium",
  "trust",
  "aspiration",
  "education",
  "motivation",
  "objection-handling",
  "resolution",
  "contrast"
]);

export type RhetoricalPurpose = z.infer<typeof rhetoricalPurposeSchema>;

export const emotionalSpineSchema = z.enum([
  "calm",
  "tension",
  "urgency",
  "authority",
  "aspiration",
  "trust",
  "luxury",
  "vulnerability",
  "excitement",
  "confidence",
  "surprise",
  "desire"
]);

export type EmotionalSpine = z.infer<typeof emotionalSpineSchema>;

export const visualPrioritySubjectSchema = z.enum([
  "speaker-face",
  "punch-word",
  "headline-phrase",
  "supporting-phrase",
  "product-object",
  "proof-element",
  "symbolic-visual",
  "matte-background-text",
  "supporting-motion-graphics",
  "negative-space"
]);

export type VisualPrioritySubject = z.infer<typeof visualPrioritySubjectSchema>;

export const frameRegionSchema = z.enum([
  "left-third",
  "center",
  "right-third",
  "upper-third",
  "lower-third",
  "top-safe",
  "bottom-safe",
  "full-frame"
]);

export type FrameRegion = z.infer<typeof frameRegionSchema>;

export const minimalismLevelSchema = z.enum([
  "minimal",
  "restrained",
  "balanced",
  "expressive"
]);

export type MinimalismLevel = z.infer<typeof minimalismLevelSchema>;

export const visualDensityProfileSchema = z.enum([
  "quiet",
  "balanced",
  "loud"
]);

export type VisualDensityProfile = z.infer<typeof visualDensityProfileSchema>;

export const sequenceTrendSchema = z.enum([
  "rising",
  "falling",
  "steady",
  "volatile"
]);

export type SequenceTrend = z.infer<typeof sequenceTrendSchema>;

export const contrastDirectionSchema = z.enum([
  "maintain",
  "escalate",
  "restrain",
  "reset",
  "invert"
]);

export type ContrastDirection = z.infer<typeof contrastDirectionSchema>;

export const escalationStageSchema = z.enum([
  "setup",
  "build",
  "hold",
  "release",
  "reset"
]);

export type EscalationStage = z.infer<typeof escalationStageSchema>;

export const treatmentFamilySchema = z.enum([
  "safe-premium",
  "expressive-premium",
  "luxury-minimal",
  "high-authority",
  "emotional-cinematic",
  "educational-prestige",
  "aggressive-conversion",
  "elegant-founder-brand",
  "high-contrast-experimental"
]);

export type TreatmentFamily = z.infer<typeof treatmentFamilySchema>;

export const creativeTreatmentSchema = z.enum([
  "no-treatment",
  "caption-only",
  "keyword-emphasis",
  "asset-supported",
  "asset-led",
  "title-card",
  "background-overlay",
  "cinematic-transition",
  "behind-speaker-depth"
]);

export type CreativeTreatment = z.infer<typeof creativeTreatmentSchema>;

export const proposalTypeSchema = z.enum([
  "text",
  "asset",
  "motion",
  "sound",
  "background",
  "camera",
  "matting",
  "layout",
  "transition",
  "render",
  "memory"
]);

export type JudgmentProposalType = z.infer<typeof proposalTypeSchema>;

export const renderCostSchema = z.enum(["low", "medium", "high"]);
export type RenderCost = z.infer<typeof renderCostSchema>;

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);
export type RuleSeverity = z.infer<typeof severitySchema>;

export const emphasisEffectSchema = z.enum([
  "underline",
  "glow",
  "scale",
  "contrast",
  "background-text",
  "masking"
]);

export type EmphasisEffect = z.infer<typeof emphasisEffectSchema>;

export const retrievalActionSchema = z.enum([
  "skip",
  "retrieve-typography-only",
  "retrieve-motion-only",
  "retrieve-matte-related-treatments",
  "retrieve-reference-inspiration-only",
  "retrieve-diverse-treatment-families",
  "retrieve-full-support"
]);

export type RetrievalAction = z.infer<typeof retrievalActionSchema>;

export const libraryTargetSchema = z.enum([
  "typography-library",
  "motion-library",
  "matte-treatment-library",
  "premium-reference-library",
  "asset-memory-library",
  "gsap-library",
  "showcase-library"
]);

export type LibraryTarget = z.infer<typeof libraryTargetSchema>;

export const matchStrategySchema = z.enum(["single-strong", "diverse-set"]);
export type MatchStrategy = z.infer<typeof matchStrategySchema>;

export const matteUsageSchema = z.enum([
  "none",
  "supporting-depth",
  "behind-subject-text"
]);

export type MatteUsage = z.infer<typeof matteUsageSchema>;

export const backgroundTextModeSchema = z.enum([
  "none",
  "subtle",
  "hero"
]);

export type BackgroundTextMode = z.infer<typeof backgroundTextModeSchema>;

export const placementModeSchema = z.enum([
  "center-stage",
  "left-anchor",
  "right-anchor",
  "behind-subject",
  "full-frame",
  "floating-callout"
]);

export type PlacementMode = z.infer<typeof placementModeSchema>;

export const judgmentWordSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
});

export type JudgmentWord = z.infer<typeof judgmentWordSchema>;

export const judgmentMomentSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  transcriptText: z.string().default(""),
  words: z.array(judgmentWordSchema).default([]),
  momentType: z.string().default("ambient"),
  energy: z.number().min(0).max(1).default(0.5),
  importance: z.number().min(0).max(1).default(0.5),
  density: z.number().nonnegative().default(0),
  suggestedIntensity: z.enum(["minimal", "medium", "high", "hero"]).default("medium")
});

export type JudgmentMoment = z.infer<typeof judgmentMomentSchema>;

export const judgmentProposalSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  momentId: z.string().min(1),
  type: proposalTypeSchema,
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  priority: z.number(),
  confidence: z.number().min(0).max(1),
  renderCost: renderCostSchema,
  requiresMatting: z.boolean().optional(),
  requiresVideoFrames: z.boolean().optional(),
  compatibleWith: z.array(z.string()).optional(),
  conflictsWith: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  reasoning: z.string().default("")
});

export type JudgmentProposal = z.infer<typeof judgmentProposalSchema>;

export const speakerMetadataSchema = z.object({
  placementRegion: frameRegionSchema.optional(),
  faceOccupancy: z.number().min(0).max(1).optional(),
  faceCount: z.number().int().nonnegative().optional(),
  faceLandmarkVisibility: z.number().min(0).max(1).optional(),
  dominantSpeaker: z.boolean().optional()
});

export type SpeakerMetadata = z.infer<typeof speakerMetadataSchema>;

export const sceneAnalysisSchema = z.object({
  sceneDensity: z.number().min(0).max(1).default(0.45),
  motionDensity: z.number().min(0).max(1).default(0.35),
  backgroundComplexity: z.number().min(0).max(1).default(0.35),
  brightness: z.number().min(0).max(1).default(0.5),
  negativeSpaceScore: z.number().min(0).max(1).default(0.5),
  occlusionRisk: z.number().min(0).max(1).default(0.2),
  mobileReadabilityRisk: z.number().min(0).max(1).default(0.2),
  activeFocalElements: z.number().int().nonnegative().default(1),
  safeZones: z.array(frameRegionSchema).default(["center", "top-safe", "bottom-safe"]),
  busyRegions: z.array(frameRegionSchema).default([]),
  sceneType: z.string().optional()
});

export type SceneAnalysis = z.infer<typeof sceneAnalysisSchema>;

export const subjectSegmentationSchema = z.object({
  matteConfidence: z.number().min(0).max(1).default(0.5),
  subjectRegion: frameRegionSchema.optional(),
  behindSubjectTextSupported: z.boolean().optional()
});

export type SubjectSegmentation = z.infer<typeof subjectSegmentationSchema>;

export const creatorStyleProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  preferredTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  forbiddenTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  noveltyPreference: z.number().min(0).max(1).default(0.45),
  consistencyPreference: z.number().min(0).max(1).default(0.55),
  premiumBias: z.number().min(0).max(1).default(0.8),
  eleganceBias: z.number().min(0).max(1).default(0.78),
  reducedMotionPreference: z.number().min(0).max(1).default(0.3),
  humanMadeFeelBias: z.number().min(0).max(1).default(0.8),
  avoidCliches: z.boolean().default(true)
});

export type CreatorStyleProfile = z.infer<typeof creatorStyleProfileSchema>;

export const previousOutputMemorySchema = z.object({
  recentTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  repeatedKeywords: z.array(z.string()).default([]),
  recentlyUsedAssetIds: z.array(z.string()).default([]),
  recentlyUsedProposalIds: z.array(z.string()).default([])
});

export type PreviousOutputMemory = z.infer<typeof previousOutputMemorySchema>;

export const typographyMetadataSchema = z.object({
  defaultFontFamily: z.string().optional(),
  allowsCursive: z.boolean().default(false),
  longCopyThresholdWords: z.number().int().positive().default(10),
  premiumProfiles: z.array(z.string()).default([]),
  blockedProfiles: z.array(z.string()).default([])
});

export type TypographyMetadata = z.infer<typeof typographyMetadataSchema>;

export const motionGraphicsMetadataSchema = z.object({
  availableModes: z.array(z.string()).default(["gentle-drift", "blur-slide-up", "depth-card-float"]),
  maxSimultaneousFocalElements: z.number().int().positive().default(3),
  gsapSupported: z.boolean().default(true),
  threeJsAllowed: z.boolean().default(true)
});

export type MotionGraphicsMetadata = z.infer<typeof motionGraphicsMetadataSchema>;

export const gsapAnimationMetadataSchema = z.object({
  availablePresets: z.array(z.string()).default([]),
  premiumPresets: z.array(z.string()).default([]),
  heavyPresets: z.array(z.string()).default([])
});

export type GsapAnimationMetadata = z.infer<typeof gsapAnimationMetadataSchema>;

export const retrievalResultSchema = z.object({
  assetId: z.string(),
  library: libraryTargetSchema,
  score: z.number().min(0).max(1),
  why: z.string().default("")
});

export type RetrievalResult = z.infer<typeof retrievalResultSchema>;

export const feedbackEventTypeSchema = z.enum([
  "user-approval",
  "rejection-reason",
  "manual-override",
  "typography-replacement",
  "reduced-motion-edit",
  "watch-retention-proxy",
  "engagement-proxy",
  "creator-preference-pattern"
]);

export type FeedbackEventType = z.infer<typeof feedbackEventTypeSchema>;

export const feedbackLogEntrySchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  signalType: feedbackEventTypeSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
  reason: z.string().optional(),
  timestamp: z.string().optional()
});

export type FeedbackLogEntry = z.infer<typeof feedbackLogEntrySchema>;

export const assetFingerprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  naturalLanguageDescription: z.string(),
  structuredTags: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  compatibilityTags: z.array(z.string()).default([]),
  rhetoricalRoles: z.array(rhetoricalPurposeSchema).default([]),
  emotionalRoles: z.array(emotionalSpineSchema).default([]),
  intensity: z.number().min(0).max(1).default(0.5),
  tempo: z.number().min(0).max(1).default(0.5),
  placementRegions: z.array(frameRegionSchema).default([]),
  renderCost: renderCostSchema,
  usageHistory: z.array(z.string()).default([]),
  creatorPerformanceHistory: z.array(z.object({
    creatorId: z.string(),
    score: z.number().min(0).max(1),
    notes: z.string().optional()
  })).default([]),
  styleFingerprint: z.record(z.string(), z.unknown()).default({}),
  previewStills: z.array(z.string()).default([]),
  referenceFrames: z.array(z.string()).default([]),
  beforeAfterReferences: z.array(z.string()).default([]),
  failureHistory: z.array(z.string()).default([]),
  pairingCompatibility: z.array(z.string()).default([]),
  forbiddenPairings: z.array(z.string()).default([]),
  embeddingVectors: z.array(z.number()).default([]),
  supportedAspectRatios: z.array(z.string()).default([]),
  supportedSceneTypes: z.array(z.string()).default([])
});

export type AssetFingerprint = z.infer<typeof assetFingerprintSchema>;

export const visualPriorityEntrySchema = z.object({
  subject: visualPrioritySubjectSchema,
  score: z.number().min(0).max(1),
  reason: z.string()
});

export type VisualPriorityEntry = z.infer<typeof visualPriorityEntrySchema>;

export const emphasisTargetsSchema = z.object({
  punchWord: z.string().nullable(),
  supportingTextNeeded: z.boolean(),
  isolatePunchWord: z.boolean(),
  useBackgroundText: z.boolean(),
  preferMinimalism: z.boolean(),
  allowedEffects: z.array(emphasisEffectSchema).default([]),
  blockedEffects: z.array(emphasisEffectSchema).default([]),
  reason: z.string()
});

export type EmphasisTargets = z.infer<typeof emphasisTargetsSchema>;

export const editorialCaptainSchema = z.enum([
  "text",
  "asset",
  "background",
  "restraint"
]);

export type EditorialCaptain = z.infer<typeof editorialCaptainSchema>;

export const conceptReductionModeSchema = z.enum([
  "literal-caption",
  "hero-word",
  "hero-phrase",
  "sequential-keywords"
]);

export type ConceptReductionMode = z.infer<typeof conceptReductionModeSchema>;

export const supportToolBudgetSchema = z.enum([
  "none",
  "single",
  "paired"
]);

export type SupportToolBudget = z.infer<typeof supportToolBudgetSchema>;

export const editorialDoctrineSchema = z.object({
  captain: editorialCaptainSchema,
  conceptReductionMode: conceptReductionModeSchema,
  heroText: z.string().nullable(),
  supportText: z.string().nullable(),
  concreteNounCandidate: z.string().nullable(),
  primaryVisualSubject: visualPrioritySubjectSchema,
  allowTextAssetPairing: z.boolean(),
  allowIndependentTypography: z.boolean(),
  supportToolBudget: supportToolBudgetSchema,
  preferTextOnlyForAbstractMoments: z.boolean(),
  rationale: z.array(z.string()).default([])
});

export type EditorialDoctrine = z.infer<typeof editorialDoctrineSchema>;

export const spatialConstraintsSchema = z.object({
  safeZones: z.array(frameRegionSchema).default([]),
  riskyZones: z.array(frameRegionSchema).default([]),
  speakerBlockedZones: z.array(frameRegionSchema).default([]),
  behindSubjectTextLegal: z.boolean(),
  denseTextAllowed: z.boolean(),
  frameNeedsRestraint: z.boolean(),
  busyFrame: z.boolean(),
  occlusionRisk: z.number().min(0).max(1),
  mobileReadabilityRisk: z.number().min(0).max(1),
  notes: z.array(z.string()).default([])
});

export type SpatialConstraints = z.infer<typeof spatialConstraintsSchema>;

export const retrievalTargetSchema = z.object({
  library: libraryTargetSchema,
  reason: z.string(),
  priority: z.number().int().positive(),
  intent: z.enum(["typography", "motion", "matte", "reference", "asset"])
});

export type RetrievalTarget = z.infer<typeof retrievalTargetSchema>;

export const retrievalDecisionSchema = z.object({
  needed: z.boolean(),
  action: retrievalActionSchema,
  skipReason: z.string().nullable(),
  targets: z.array(retrievalTargetSchema).default([]),
  matchStrategy: matchStrategySchema,
  noveltyBias: z.number().min(0).max(1),
  consistencyBias: z.number().min(0).max(1),
  allowedLibraries: z.array(libraryTargetSchema).default([])
});

export type RetrievalDecision = z.infer<typeof retrievalDecisionSchema>;

export const candidateTreatmentProfileSchema = z.object({
  id: z.string(),
  family: treatmentFamilySchema,
  finalTreatment: creativeTreatmentSchema,
  typographyMode: z.string(),
  motionMode: z.string(),
  emphasisMode: z.string(),
  matteUsage: matteUsageSchema,
  backgroundTextMode: backgroundTextModeSchema,
  placementMode: placementModeSchema,
  intensity: minimalismLevelSchema,
  noveltyLevel: z.number().min(0).max(1),
  consistencyLevel: z.number().min(0).max(1),
  allowedProposalTypes: z.array(proposalTypeSchema).default([]),
  blockedProposalTypes: z.array(proposalTypeSchema).default([]),
  allowedTextModes: z.array(z.string()).default([]),
  preferredProposalIds: z.array(z.string()).default([]),
  preferredLibraries: z.array(libraryTargetSchema).default([]),
  reasoning: z.array(z.string()).default([])
});

export type CandidateTreatmentProfile = z.infer<typeof candidateTreatmentProfileSchema>;

export const retrievalIntentSchema = z.enum([
  "skip",
  "reuse-existing",
  "reuse-with-variation",
  "search-deeper"
]);

export type RetrievalIntent = z.infer<typeof retrievalIntentSchema>;

export const godEscalationIntentSchema = z.enum([
  "forbidden",
  "allowed-if-no-fit",
  "preferred-for-precision"
]);

export type GodEscalationIntent = z.infer<typeof godEscalationIntentSchema>;

export const doctrineBranchKindSchema = z.enum([
  "primary",
  "alternate-captain",
  "alternate-reduction"
]);

export type DoctrineBranchKind = z.infer<typeof doctrineBranchKindSchema>;

export const doctrineBranchSchema = z.object({
  id: z.string(),
  kind: doctrineBranchKindSchema,
  label: z.string(),
  priority: z.number().int().positive(),
  editorialDoctrine: editorialDoctrineSchema,
  rationale: z.array(z.string()).default([])
});

export type DoctrineBranch = z.infer<typeof doctrineBranchSchema>;

const deepFreeze = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  return value;
};

export const observationSnapshotFactsSchema = z.object({
  scene: z.object({
    segmentId: z.string(),
    momentId: z.string(),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    durationMs: z.number().nonnegative(),
    momentType: z.string()
  }),
  transcript: z.object({
    text: z.string(),
    wordCount: z.number().int().nonnegative(),
    firstWordMs: z.number().nonnegative().nullable(),
    lastWordMs: z.number().nonnegative().nullable()
  }),
  audio: z.object({
    energy: z.number().min(0).max(1),
    importance: z.number().min(0).max(1),
    density: z.number().nonnegative()
  }),
  visual: z.object({
    sceneDensity: z.number().min(0).max(1).nullable(),
    motionDensity: z.number().min(0).max(1).nullable(),
    backgroundComplexity: z.number().min(0).max(1).nullable(),
    safeZones: z.array(frameRegionSchema),
    busyRegions: z.array(frameRegionSchema),
    subjectRegion: frameRegionSchema.nullable(),
    matteConfidence: z.number().min(0).max(1).nullable()
  }),
  production: z.object({
    assetFingerprintCount: z.number().int().nonnegative(),
    retrievalResultCount: z.number().int().nonnegative()
  }),
  constraints: z.object({
    safeZones: z.array(frameRegionSchema),
    riskyZones: z.array(frameRegionSchema),
    speakerBlockedZones: z.array(frameRegionSchema),
    behindSubjectTextLegal: z.boolean(),
    denseTextAllowed: z.boolean(),
    frameNeedsRestraint: z.boolean(),
    busyFrame: z.boolean(),
    occlusionRisk: z.number().min(0).max(1),
    mobileReadabilityRisk: z.number().min(0).max(1)
  })
});

export type ObservationSnapshotFacts = z.infer<typeof observationSnapshotFactsSchema>;

export const observationSnapshotSchema = z.object({
  version: z.literal("observation-snapshot-v1"),
  id: z.string(),
  fingerprint: z.string(),
  facts: observationSnapshotFactsSchema,
  segmentId: z.string(),
  moment: judgmentMomentSchema,
  speakerMetadata: speakerMetadataSchema.optional(),
  sceneAnalysis: sceneAnalysisSchema.optional(),
  subjectSegmentation: subjectSegmentationSchema.optional(),
  spatialConstraints: spatialConstraintsSchema,
  emphasisTargets: emphasisTargetsSchema,
  recentDecisionPlans: z.array(z.lazy(() => sequenceDecisionSummarySchema)).default([]),
  recentVisualPatterns: z.array(z.lazy(() => sequenceVisualPatternSchema)).default([]),
  recentSequenceMetrics: z.lazy(() => sequenceMetricsSchema),
  assetFingerprintCount: z.number().int().nonnegative().default(0),
  retrievalResultCount: z.number().int().nonnegative().default(0)
}).transform((snapshot) => deepFreeze(snapshot));

export type ObservationSnapshot = z.infer<typeof observationSnapshotSchema>;

export const archiveDimensionSchema = z.enum([
  "intensity",
  "visual-density",
  "motion-energy",
  "editorial-role"
]);

export type ArchiveDimension = z.infer<typeof archiveDimensionSchema>;

export const motionEnergyProfileSchema = z.enum(["none", "subtle", "active"]);
export type MotionEnergyProfile = z.infer<typeof motionEnergyProfileSchema>;

export const archiveEditorialRoleSchema = z.enum(["setup", "explain", "tension", "payoff"]);
export type ArchiveEditorialRole = z.infer<typeof archiveEditorialRoleSchema>;

export const archiveCellSchema = z.object({
  key: z.string(),
  intensity: minimalismLevelSchema,
  visualDensity: visualDensityProfileSchema,
  motionEnergy: motionEnergyProfileSchema,
  editorialRole: archiveEditorialRoleSchema
});

export type ArchiveCell = z.infer<typeof archiveCellSchema>;

export const treatmentGenomeV1Schema = candidateTreatmentProfileSchema.extend({
  doctrineBranchId: z.string(),
  retrievalIntent: retrievalIntentSchema,
  godEscalationIntent: godEscalationIntentSchema,
  noveltyBias: z.number().min(0).max(1),
  consistencyBias: z.number().min(0).max(1),
  archiveCell: archiveCellSchema,
  editorialRole: archiveEditorialRoleSchema
});

export type TreatmentGenomeV1 = z.infer<typeof treatmentGenomeV1Schema>;

export const archiveEntrySchema = z.object({
  cell: archiveCellSchema,
  genome: treatmentGenomeV1Schema,
  plannerScore: z.number().min(0).max(1),
  source: z.enum(["generated", "archive"])
});

export type ArchiveEntry = z.infer<typeof archiveEntrySchema>;

export const planningSnapshotSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  observationSnapshotId: z.string(),
  primaryDoctrine: editorialDoctrineSchema,
  doctrineBranches: z.array(doctrineBranchSchema).default([]),
  allowedTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  blockedTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  archiveDimensions: z.array(archiveDimensionSchema).default([
    "intensity",
    "visual-density",
    "motion-energy",
    "editorial-role"
  ]),
  lookaheadMoments: z.number().int().positive().default(3),
  lookaheadSeconds: z.number().positive().default(8),
  genomeBudgetPerBranch: z.number().int().positive().default(6),
  archiveReuseBudgetPerBranch: z.number().int().positive().default(3),
  beamWidth: z.number().int().positive().default(6)
});

export type PlanningSnapshot = z.infer<typeof planningSnapshotSchema>;

export const plannerScoreBreakdownSchema = z.object({
  sequenceConsequence: z.number().min(0).max(1),
  repetitionAvoidance: z.number().min(0).max(1),
  doctrineCoherence: z.number().min(0).max(1),
  surprisePreservation: z.number().min(0).max(1),
  climaxBudgetPreservation: z.number().min(0).max(1),
  retrievalPracticality: z.number().min(0).max(1),
  finalScore: z.number().min(0).max(1)
});

export type PlannerScoreBreakdown = z.infer<typeof plannerScoreBreakdownSchema>;

export const plannerBeamCandidateSchema = z.object({
  genomeId: z.string(),
  doctrineBranchId: z.string(),
  archiveCellKey: z.string(),
  scoreBreakdown: plannerScoreBreakdownSchema,
  pruned: z.boolean().default(false),
  reasons: z.array(z.string()).default([])
});

export type PlannerBeamCandidate = z.infer<typeof plannerBeamCandidateSchema>;

export const plannerSelectedPathSchema = z.object({
  genomeIds: z.array(z.string()).default([]),
  doctrineBranchIds: z.array(z.string()).default([]),
  scoreBreakdown: plannerScoreBreakdownSchema,
  lookaheadMomentsEvaluated: z.number().int().nonnegative().default(1)
});

export type PlannerSelectedPath = z.infer<typeof plannerSelectedPathSchema>;

export const plannerAuditSchema = z.object({
  observationSnapshot: observationSnapshotSchema,
  planningSnapshot: planningSnapshotSchema,
  archiveEntries: z.array(archiveEntrySchema).default([]),
  shortlist: z.array(treatmentGenomeV1Schema).default([]),
  beamCandidates: z.array(plannerBeamCandidateSchema).default([]),
  selectedPath: plannerSelectedPathSchema,
  fallbackUsed: z.boolean().default(false),
  trace: z.array(z.lazy(() => traceEntrySchema)).default([])
});

export type PlannerAudit = z.infer<typeof plannerAuditSchema>;

export const treatmentFingerprintSchema = z.object({
  segmentId: z.string(),
  treatmentFamily: treatmentFamilySchema,
  typographyMode: z.string(),
  motionMode: z.string(),
  emphasisMode: z.string(),
  placementMode: placementModeSchema,
  matteUsage: matteUsageSchema,
  backgroundTextMode: backgroundTextModeSchema,
  visualDensity: visualDensityProfileSchema,
  intensity: minimalismLevelSchema,
  rhetoricalPurpose: rhetoricalPurposeSchema,
  emotionalSpine: emotionalSpineSchema,
  retrievalAction: retrievalActionSchema,
  heroMoment: z.boolean().default(false),
  visualClimax: z.boolean().default(false),
  emotionalPeak: z.boolean().default(false),
  focalStructure: z.array(visualPrioritySubjectSchema).default([]),
  premiumTricks: z.array(z.string()).default([]),
  negativeGrammarRuleIds: z.array(z.string()).default([])
});

export type TreatmentFingerprint = z.infer<typeof treatmentFingerprintSchema>;

export const sequenceDecisionSummarySchema = z.object({
  segmentId: z.string(),
  rhetoricalPurpose: rhetoricalPurposeSchema,
  emotionalSpine: emotionalSpineSchema,
  treatmentFamily: treatmentFamilySchema,
  typographyMode: z.string(),
  motionMode: z.string(),
  emphasisMode: z.string(),
  placementMode: placementModeSchema,
  matteUsage: matteUsageSchema,
  backgroundTextMode: backgroundTextModeSchema,
  intensity: minimalismLevelSchema,
  minimalismLevel: minimalismLevelSchema,
  visualDensity: visualDensityProfileSchema,
  finalScore: z.number().min(0).max(1),
  retrievalAction: retrievalActionSchema.default("skip"),
  negativeGrammarRuleIds: z.array(z.string()).default([]),
  heroMoment: z.boolean().default(false),
  visualClimax: z.boolean().default(false),
  emotionalPeak: z.boolean().default(false),
  focalStructure: z.array(visualPrioritySubjectSchema).default([]),
  premiumTricks: z.array(z.string()).default([]),
  momentType: z.string().optional(),
  momentEnergy: z.number().min(0).max(1).optional(),
  momentImportance: z.number().min(0).max(1).optional()
});

export type SequenceDecisionSummary = z.infer<typeof sequenceDecisionSummarySchema>;

export const sequenceVisualPatternSchema = z.object({
  segmentId: z.string(),
  treatmentFamily: treatmentFamilySchema,
  typographyMode: z.string(),
  motionMode: z.string(),
  emphasisMode: z.string(),
  placementMode: placementModeSchema,
  matteUsage: matteUsageSchema,
  backgroundTextMode: backgroundTextModeSchema,
  intensity: minimalismLevelSchema,
  visualDensity: visualDensityProfileSchema,
  rhetoricalPurpose: rhetoricalPurposeSchema.optional(),
  emotionalSpine: emotionalSpineSchema.optional(),
  retrievalAction: retrievalActionSchema.default("skip"),
  heroMoment: z.boolean().default(false),
  visualClimax: z.boolean().default(false),
  emotionalPeak: z.boolean().default(false),
  focalStructure: z.array(visualPrioritySubjectSchema).default([]),
  premiumTricks: z.array(z.string()).default([]),
  negativeGrammarRuleIds: z.array(z.string()).default([])
});

export type SequenceVisualPattern = z.infer<typeof sequenceVisualPatternSchema>;

export const creativeContrastRecordSchema = z.object({
  segmentId: z.string(),
  comparedToSegmentId: z.string().nullable().default(null),
  direction: contrastDirectionSchema.default("maintain"),
  changedTypography: z.boolean().default(false),
  changedMotion: z.boolean().default(false),
  changedPlacement: z.boolean().default(false),
  changedDensity: z.boolean().default(false),
  changedEmotionalCadence: z.boolean().default(false),
  changedRhetoricalRhythm: z.boolean().default(false),
  notes: z.array(z.string()).default([])
});

export type CreativeContrastRecord = z.infer<typeof creativeContrastRecordSchema>;

export const escalationHistoryEntrySchema = z.object({
  segmentId: z.string(),
  stage: escalationStageSchema.default("setup"),
  energy: z.number().min(0).max(1).default(0.5),
  importance: z.number().min(0).max(1).default(0.5),
  visualDensity: visualDensityProfileSchema,
  intensity: minimalismLevelSchema,
  heroMoment: z.boolean().default(false),
  visualClimax: z.boolean().default(false),
  emotionalPeak: z.boolean().default(false)
});

export type EscalationHistoryEntry = z.infer<typeof escalationHistoryEntrySchema>;

export const sequenceMetricsSchema = z.object({
  lookbackWindow: z.number().int().positive().default(3),
  recentEnergyTrend: sequenceTrendSchema.default("steady"),
  recentVisualDensityTrend: sequenceTrendSchema.default("steady"),
  recentAverageEnergy: z.number().min(0).max(1).default(0.5),
  recentAverageImportance: z.number().min(0).max(1).default(0.5),
  consecutiveHighIntensityMoments: z.number().int().nonnegative().default(0),
  consecutiveQuietMoments: z.number().int().nonnegative().default(0),
  consecutiveBehindSubjectTextMoments: z.number().int().nonnegative().default(0),
  consecutiveExpressiveTypographyMoments: z.number().int().nonnegative().default(0),
  consecutiveRepeatedTypographyModeMoments: z.number().int().nonnegative().default(0),
  consecutiveRepeatedMotionSignatureMoments: z.number().int().nonnegative().default(0),
  consecutiveRepeatedPlacementMoments: z.number().int().nonnegative().default(0),
  consecutiveEmotionalPeakMoments: z.number().int().nonnegative().default(0),
  consecutiveVisualClimaxMoments: z.number().int().nonnegative().default(0),
  consecutiveHeroMoments: z.number().int().nonnegative().default(0),
  consecutiveRestrainedMoments: z.number().int().nonnegative().default(0),
  recentHeroBackgroundTextCount: z.number().int().nonnegative().default(0),
  recentHeroMomentCount: z.number().int().nonnegative().default(0),
  recentVisualClimaxCount: z.number().int().nonnegative().default(0),
  repetitionPressure: z.number().min(0).max(1).default(0),
  emotionalPeakPressure: z.number().min(0).max(1).default(0),
  surpriseBudgetRemaining: z.number().min(0).max(1).default(1),
  climaxBudgetRemaining: z.number().min(0).max(1).default(1),
  restraintBalance: z.number().min(0).max(1).default(0.5),
  needsContrastNext: z.boolean().default(false),
  preferRestraintNext: z.boolean().default(false),
  rhetoricalProgression: z.array(rhetoricalPurposeSchema).default([]),
  emotionalProgression: z.array(emotionalSpineSchema).default([]),
  recentDominantTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  recentRetrievalActions: z.array(retrievalActionSchema).default([]),
  recentNegativeGrammarRuleIds: z.array(z.string()).default([]),
  recentTreatmentFingerprintHistory: z.array(treatmentFingerprintSchema).default([]),
  recentCreativeContrastHistory: z.array(creativeContrastRecordSchema).default([]),
  recentEscalationHistory: z.array(escalationHistoryEntrySchema).default([])
});

export type SequenceMetrics = z.infer<typeof sequenceMetricsSchema>;

export const antiRepetitionSummarySchema = z.object({
  repeatedTreatmentFamilyCount: z.number().int().nonnegative().default(0),
  repeatedTypographyModeCount: z.number().int().nonnegative().default(0),
  repeatedMotionModeCount: z.number().int().nonnegative().default(0),
  repeatedPlacementModeCount: z.number().int().nonnegative().default(0),
  repeatedEmphasisModeCount: z.number().int().nonnegative().default(0),
  repeatedMatteUsageCount: z.number().int().nonnegative().default(0),
  repeatedHeroBackgroundTextCount: z.number().int().nonnegative().default(0),
  repeatedVisualDensityCount: z.number().int().nonnegative().default(0),
  repeatedRhetoricalPurposeCount: z.number().int().nonnegative().default(0),
  repeatedEmotionalSpineCount: z.number().int().nonnegative().default(0),
  repeatedVisualClimaxCount: z.number().int().nonnegative().default(0),
  repeatedPremiumTrickCount: z.number().int().nonnegative().default(0),
  repeatedHeroMomentCount: z.number().int().nonnegative().default(0),
  consecutiveLoudBeatCount: z.number().int().nonnegative().default(0),
  repetitionPenalty: z.number().min(0).max(1).default(0),
  recommendRestraint: z.boolean().default(false),
  forceContrast: z.boolean().default(false),
  reasons: z.array(z.string()).default([]),
  diversityRecommendations: z.array(z.string()).default([]),
  preferredContrastDirections: z.array(contrastDirectionSchema).default([]),
  escalationWarnings: z.array(z.string()).default([]),
  restraintRecommendations: z.array(z.string()).default([])
});

export type AntiRepetitionSummary = z.infer<typeof antiRepetitionSummarySchema>;

export const negativeGrammarViolationSchema = z.object({
  ruleId: z.string(),
  message: z.string(),
  severity: severitySchema,
  blocking: z.boolean(),
  penalty: z.number().nonnegative(),
  candidateId: z.string().nullable().optional(),
  affectedRegions: z.array(frameRegionSchema).default([])
});

export type NegativeGrammarViolation = z.infer<typeof negativeGrammarViolationSchema>;

export const scoringBreakdownSchema = z.object({
  readabilityScore: z.number().min(0).max(1),
  semanticAlignmentScore: z.number().min(0).max(1),
  rhetoricalAlignmentScore: z.number().min(0).max(1),
  emotionalAlignmentScore: z.number().min(0).max(1),
  premiumFeelScore: z.number().min(0).max(1),
  eleganceScore: z.number().min(0).max(1),
  nonRepetitionScore: z.number().min(0).max(1),
  noveltyScore: z.number().min(0).max(1),
  clutterPenalty: z.number().min(0).max(1),
  breathingRoomScore: z.number().min(0).max(1),
  visualHierarchyScore: z.number().min(0).max(1),
  renderabilityScore: z.number().min(0).max(1),
  timingAlignmentScore: z.number().min(0).max(1),
  retentionPotentialScore: z.number().min(0).max(1),
  creatorStyleAdherenceScore: z.number().min(0).max(1),
  humanMadeFeelScore: z.number().min(0).max(1),
  sequenceContrastScore: z.number().min(0).max(1),
  escalationFitScore: z.number().min(0).max(1),
  surprisePreservationScore: z.number().min(0).max(1),
  repetitionPenalty: z.number().min(0).max(1),
  pacingVariationScore: z.number().min(0).max(1),
  restraintBalanceScore: z.number().min(0).max(1),
  emotionalProgressionScore: z.number().min(0).max(1),
  climaxBudgetScore: z.number().min(0).max(1),
  noveltyAcrossSequenceScore: z.number().min(0).max(1),
  finalScore: z.number().min(0).max(1)
});

export type ScoringBreakdown = z.infer<typeof scoringBreakdownSchema>;

export const pairwiseTasteDimensionScoreSchema = z.object({
  candidateA: z.number().min(0).max(1),
  candidateB: z.number().min(0).max(1),
  advantage: z.number().min(-1).max(1),
  favoredCandidateId: z.string().nullable().default(null)
});

export type PairwiseTasteDimensionScore = z.infer<typeof pairwiseTasteDimensionScoreSchema>;

export const pairwiseTasteDimensionsSchema = z.object({
  premiumFeel: pairwiseTasteDimensionScoreSchema,
  cinematicIntentionality: pairwiseTasteDimensionScoreSchema,
  readability: pairwiseTasteDimensionScoreSchema,
  emotionalAlignment: pairwiseTasteDimensionScoreSchema,
  rhetoricalClarity: pairwiseTasteDimensionScoreSchema,
  restraint: pairwiseTasteDimensionScoreSchema,
  noveltyWithoutChaos: pairwiseTasteDimensionScoreSchema,
  sequenceFit: pairwiseTasteDimensionScoreSchema,
  nonClicheExecution: pairwiseTasteDimensionScoreSchema,
  humanMadeFeel: pairwiseTasteDimensionScoreSchema,
  creatorStyleFit: pairwiseTasteDimensionScoreSchema,
  renderPracticality: pairwiseTasteDimensionScoreSchema
});

export type PairwiseTasteDimensions = z.infer<typeof pairwiseTasteDimensionsSchema>;

export const pairwiseTasteComparisonSchema = z.object({
  candidateAId: z.string(),
  candidateBId: z.string(),
  winnerCandidateId: z.string(),
  loserCandidateId: z.string(),
  margin: z.number().min(0).max(1),
  baseScoreDelta: z.number().min(-1).max(1).default(0),
  criticScoreDelta: z.number().min(-1).max(1).default(0),
  reasons: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  tasteDimensions: pairwiseTasteDimensionsSchema
});

export type PairwiseTasteComparison = z.infer<typeof pairwiseTasteComparisonSchema>;

export const traceEntrySchema = z.object({
  step: z.string(),
  summary: z.string(),
  data: z.record(z.string(), z.unknown()).default({})
});

export type TraceEntry = z.infer<typeof traceEntrySchema>;

export const rejectedTreatmentSchema = z.object({
  candidateId: z.string(),
  family: treatmentFamilySchema,
  reason: z.string(),
  violations: z.array(negativeGrammarViolationSchema).default([]),
  score: z.number().min(0).max(1)
});

export type RejectedTreatment = z.infer<typeof rejectedTreatmentSchema>;

export const agentGovernanceSchema = z.object({
  approvedProposalIds: z.array(z.string()).default([]),
  rejectedProposalIds: z.array(z.string()).default([]),
  blockedProposalIds: z.array(z.string()).default([]),
  allowedAgentTypes: z.array(proposalTypeSchema).default([]),
  blockedAgentTypes: z.array(proposalTypeSchema).default([]),
  rationale: z.array(z.string()).default([])
});

export type AgentGovernance = z.infer<typeof agentGovernanceSchema>;

export const agentJudgmentDirectiveSchema = z.object({
  segmentId: z.string(),
  rhetoricalPurpose: rhetoricalPurposeSchema,
  emotionalSpine: emotionalSpineSchema,
  minimalismLevel: minimalismLevelSchema,
  editorialDoctrine: editorialDoctrineSchema,
  retrievalDecision: retrievalDecisionSchema,
  emphasisTargets: emphasisTargetsSchema,
  spatialConstraints: spatialConstraintsSchema,
  allowedTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  blockedTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  blockedAgentTypes: z.array(proposalTypeSchema).default([]),
  requestedAgentTypes: z.array(proposalTypeSchema).default([]),
  requestedPlacementModes: z.array(z.string()).default([]),
  recentSequenceMetrics: sequenceMetricsSchema,
  sequenceRecommendations: z.array(z.string()).default([]),
  preferredContrastDirections: z.array(contrastDirectionSchema).default([]),
  retrievalEnforcementSummary: retrievalEnforcementSummarySchema.optional(),
  approvedAssetCandidates: z.array(rankedAssetCandidateSchema).default([]),
  rejectedAssetCandidates: z.array(rankedAssetCandidateSchema).default([]),
  milvusSearchRequests: z.array(vectorSearchRequestSchema).default([]),
  milvusSearchResults: z.array(vectorSearchResponseSchema).default([]),
  retrievalTrace: retrievalTraceSchema.optional(),
  trace: z.array(traceEntrySchema).default([])
});

export type AgentJudgmentDirective = z.infer<typeof agentJudgmentDirectiveSchema>;

export const judgmentAuditRecordSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  selectedCandidateId: z.string(),
  selectedTreatmentFamily: treatmentFamilySchema,
  confidence: z.number().min(0).max(1),
  sequenceMetrics: sequenceMetricsSchema,
  antiRepetitionSummary: antiRepetitionSummarySchema,
  pairwiseTasteComparisons: z.array(pairwiseTasteComparisonSchema).default([]),
  criticSelectedCandidateId: z.string(),
  criticRationale: z.array(z.string()).default([]),
  tasteRiskFlags: z.array(z.string()).default([]),
  retrievalEnforcementSummary: retrievalEnforcementSummarySchema.optional(),
  milvusSearchRequests: z.array(vectorSearchRequestSchema).default([]),
  milvusSearchResults: z.array(vectorSearchResponseSchema).default([]),
  rankedAssetCandidates: z.array(rankedAssetCandidateSchema).default([]),
  rejectedAssetCandidates: z.array(rankedAssetCandidateSchema).default([]),
  selectedAssetCandidateIds: z.array(z.string()).default([]),
  retrievalTrace: retrievalTraceSchema.optional(),
  plannerAudit: plannerAuditSchema.optional(),
  trace: z.array(traceEntrySchema).default([]),
  createdAt: z.string().optional()
});

export type JudgmentAuditRecord = z.infer<typeof judgmentAuditRecordSchema>;

export const editDecisionPlanSchema = z.object({
  segmentId: z.string(),
  rhetoricalPurpose: rhetoricalPurposeSchema,
  emotionalSpine: emotionalSpineSchema,
  editorialDoctrine: editorialDoctrineSchema,
  visualPriorityRanking: z.array(visualPriorityEntrySchema).default([]),
  emphasisTargets: emphasisTargetsSchema,
  foregroundAssignments: z.array(z.string()).default([]),
  midgroundAssignments: z.array(z.string()).default([]),
  backgroundAssignments: z.array(z.string()).default([]),
  minimalismLevel: minimalismLevelSchema,
  retrievalDecision: retrievalDecisionSchema,
  retrievalTargets: z.array(retrievalTargetSchema).default([]),
  candidateTreatments: z.array(candidateTreatmentProfileSchema).default([]),
  selectedTreatment: candidateTreatmentProfileSchema,
  rejectedTreatments: z.array(rejectedTreatmentSchema).default([]),
  rejectionReasons: z.array(z.string()).default([]),
  pairwiseTasteComparisons: z.array(pairwiseTasteComparisonSchema).default([]),
  criticSelectedCandidateId: z.string(),
  criticRationale: z.array(z.string()).default([]),
  tasteRiskFlags: z.array(z.string()).default([]),
  recentSelectedTreatments: z.array(candidateTreatmentProfileSchema).default([]),
  recentDecisionPlans: z.array(sequenceDecisionSummarySchema).default([]),
  recentVisualPatterns: z.array(sequenceVisualPatternSchema).default([]),
  recentSequenceMetrics: sequenceMetricsSchema,
  recentTreatmentFingerprintHistory: z.array(treatmentFingerprintSchema).default([]),
  recentCreativeContrastHistory: z.array(creativeContrastRecordSchema).default([]),
  recentEscalationHistory: z.array(escalationHistoryEntrySchema).default([]),
  antiRepetitionSummary: antiRepetitionSummarySchema,
  negativeGrammarViolations: z.array(negativeGrammarViolationSchema).default([]),
  spatialConstraints: spatialConstraintsSchema,
  assetSelectionHints: z.array(z.string()).default([]),
  typographySelectionHints: z.array(z.string()).default([]),
  motionSelectionHints: z.array(z.string()).default([]),
  retrievalEnforcementSummary: retrievalEnforcementSummarySchema.optional(),
  milvusSearchRequests: z.array(vectorSearchRequestSchema).default([]),
  milvusSearchResults: z.array(vectorSearchResponseSchema).default([]),
  rankedAssetCandidates: z.array(rankedAssetCandidateSchema).default([]),
  rejectedAssetCandidates: z.array(rankedAssetCandidateSchema).default([]),
  selectedAssetCandidateIds: z.array(z.string()).default([]),
  assetRankingRationale: z.array(z.string()).default([]),
  retrievalTrace: retrievalTraceSchema.optional(),
  scoringBreakdown: scoringBreakdownSchema,
  feedbackSignals: z.array(feedbackLogEntrySchema).default([]),
  confidence: z.number().min(0).max(1),
  governance: agentGovernanceSchema,
  plannerAudit: plannerAuditSchema.optional(),
  trace: z.array(traceEntrySchema).default([]),
  audit: judgmentAuditRecordSchema
});

export type EditDecisionPlan = z.infer<typeof editDecisionPlanSchema>;

export const judgmentEngineInputSchema = z.object({
  segmentId: z.string(),
  moment: judgmentMomentSchema,
  transcriptSegment: z.string().default(""),
  speakerMetadata: speakerMetadataSchema.optional(),
  sceneAnalysis: sceneAnalysisSchema.optional(),
  subjectSegmentation: subjectSegmentationSchema.optional(),
  creatorStyleProfile: creatorStyleProfileSchema.optional(),
  previousOutputMemory: previousOutputMemorySchema.optional(),
  assetFingerprints: z.array(assetFingerprintSchema).default([]),
  typographyMetadata: typographyMetadataSchema.optional(),
  motionGraphicsMetadata: motionGraphicsMetadataSchema.optional(),
  gsapAnimationMetadata: gsapAnimationMetadataSchema.optional(),
  retrievalResults: z.array(retrievalResultSchema).default([]),
  feedbackHistory: z.array(feedbackLogEntrySchema).default([]),
  agentProposals: z.array(judgmentProposalSchema).default([]),
  recentSelectedTreatments: z.array(candidateTreatmentProfileSchema).default([]),
  recentDecisionPlans: z.array(sequenceDecisionSummarySchema).default([]),
  recentVisualPatterns: z.array(sequenceVisualPatternSchema).default([]),
  recentSequenceMetrics: sequenceMetricsSchema.optional(),
  recentTreatmentFingerprintHistory: z.array(treatmentFingerprintSchema).default([]),
  recentCreativeContrastHistory: z.array(creativeContrastRecordSchema).default([]),
  recentEscalationHistory: z.array(escalationHistoryEntrySchema).default([])
});

export type JudgmentEngineInput = z.infer<typeof judgmentEngineInputSchema>;

export const preJudgmentSnapshotSchema = z.object({
  segmentId: z.string(),
  rhetoricalPurpose: rhetoricalPurposeSchema,
  emotionalSpine: emotionalSpineSchema,
  editorialDoctrine: editorialDoctrineSchema,
  visualPriorityRanking: z.array(visualPriorityEntrySchema).default([]),
  emphasisTargets: emphasisTargetsSchema,
  minimalismLevel: minimalismLevelSchema,
  spatialConstraints: spatialConstraintsSchema,
  retrievalDecision: retrievalDecisionSchema,
  allowedTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  blockedTreatmentFamilies: z.array(treatmentFamilySchema).default([]),
  recentSelectedTreatments: z.array(candidateTreatmentProfileSchema).default([]),
  recentDecisionPlans: z.array(sequenceDecisionSummarySchema).default([]),
  recentVisualPatterns: z.array(sequenceVisualPatternSchema).default([]),
  recentSequenceMetrics: sequenceMetricsSchema,
  recentTreatmentFingerprintHistory: z.array(treatmentFingerprintSchema).default([]),
  recentCreativeContrastHistory: z.array(creativeContrastRecordSchema).default([]),
  recentEscalationHistory: z.array(escalationHistoryEntrySchema).default([]),
  trace: z.array(traceEntrySchema).default([])
});

export type PreJudgmentSnapshot = z.infer<typeof preJudgmentSnapshotSchema>;

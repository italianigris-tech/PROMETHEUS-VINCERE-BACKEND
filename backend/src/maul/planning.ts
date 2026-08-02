import { createHash } from "node:crypto";

import {
  maulAdapterDecisionPayloadSchema,
  maulArtDirectionPlanPayloadSchema,
  maulCandidateNarrativePayloadSchema,
  maulCapabilitySelectionPayloadSchema,
  maulContextAssemblyPlanPayloadSchema,
  maulDialogueAudioPlanPayloadSchema,
  maulEditorialBeatMapPayloadSchema,
  maulFramingCameraPlanPayloadSchema,
  maulObservationSnapshotPayloadSchema,
  maulPlanningBundlePayloadSchema,
  maulRevisionPlanPayloadSchema,
  maulShotIntentMatrixPayloadSchema,
  maulTextOpportunityPlanPayloadSchema,
  maulTypographyMotionPlanPayloadSchema,
  maulUnifiedShortRenderManifestSchema,
  maulVisualPlanPayloadSchema,
  type MaulArtifactRecord,
  type MaulPlanningBundlePayload,
  type MaulProject,
  type MaulShortRenderRequest,
  type MaulUnifiedShortRenderManifest,
  type ShortsTextChunkPlan,
} from "@prometheus/shared-types";

import type { VideoAwareAudioPlan } from "../music/index.js";
import type { MaulRenderCaption } from "./render-engine.js";

type SourceArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "source_asset" }
>;
type AnalysisArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "analysis" }
>;
type TimelineArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "editorial_timeline" }
>;
type CandidateArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "candidate" }
>;
type TreatmentArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "treatment_genome" }
>;

export type MaulPlanningInputs = {
  project: MaulProject;
  source: SourceArtifact;
  analysis: AnalysisArtifact;
  timeline: TimelineArtifact;
  candidate: CandidateArtifact;
  treatment: TreatmentArtifact;
  textChunkPlan: ShortsTextChunkPlan | null;
};

const stableHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const executionNative = (
  nativeBranch: string,
  evidenceRequirement: string,
) => ({
  executionStatus: "native" as const,
  nativeBranch,
  fallback: null,
  evidenceRequirement,
});

const executionFallback = (fallback: string, evidenceRequirement: string) => ({
  executionStatus: "governed_fallback" as const,
  nativeBranch: null,
  fallback,
  evidenceRequirement,
});

const basePlan = (inputs: MaulPlanningInputs, planVersion: string) => ({
  sourceAssetId: inputs.source.artifactId,
  analysisArtifactId: inputs.analysis.artifactId,
  timelineArtifactId: inputs.timeline.artifactId,
  candidateArtifactId: inputs.candidate.artifactId,
  treatmentGenomeArtifactId: inputs.treatment.artifactId,
  planVersion,
  replayKey: stableHash({
    planVersion,
    sourceSha256: inputs.source.payload.sha256,
    timelineArtifactId: inputs.timeline.artifactId,
    candidateArtifactId: inputs.candidate.artifactId,
    treatmentReplayKey: inputs.treatment.payload.replayKey,
    textChunkPlanHash: inputs.textChunkPlan
      ? stableHash(inputs.textChunkPlan)
      : null,
  }),
  authority: {
    authorityClass: "deterministic" as const,
    stageId: planVersion.replaceAll("/", "_"),
    confidence: 0.72,
    inferenceReceiptId: null,
  },
  warnings: [] as string[],
  fallbacks: [
    {
      condition: "A richer mandatory dependency is unavailable or unverified.",
      action:
        "Use the named restrained fallback and keep the release quality gate closed.",
      status: "available" as const,
    },
  ],
});

const wordsForCandidate = (inputs: MaulPlanningInputs) =>
  inputs.analysis.payload.transcript.words.filter(
    (word) =>
      word.endMs > inputs.candidate.payload.sourceStartMs &&
      word.startMs < inputs.candidate.payload.sourceEndMs,
  );

const textOf = (words: ReturnType<typeof wordsForCandidate>): string =>
  words
    .map((word) => word.text)
    .join(" ")
    .trim();

export const mapMaulSourceMsToOutput = (
  timestampMap: TimelineArtifact["payload"]["timestampMap"],
  sourceMs: number,
): number | null => {
  for (const segment of timestampMap) {
    if (
      segment.mode !== "cut" &&
      sourceMs >= segment.sourceStartMs &&
      sourceMs <= segment.sourceEndMs
    ) {
      return Math.round(
        segment.outputStartMs +
          (sourceMs - segment.sourceStartMs) *
            ((segment.outputEndMs - segment.outputStartMs) /
              (segment.sourceEndMs - segment.sourceStartMs)),
      );
    }
  }
  return null;
};

export const mapMaulTranscriptWordsToOutput = ({
  timestampMap,
  words,
}: {
  timestampMap: TimelineArtifact["payload"]["timestampMap"];
  words: AnalysisArtifact["payload"]["transcript"]["words"];
}): AnalysisArtifact["payload"]["transcript"]["words"] => {
  if (words.length === 0) {
    throw new Error("The selected transcript contains no words to chunk.");
  }

  let previousSourceEndMs = -1;
  let previousOutputEndMs = -1;
  return words.map((word, wordIndex) => {
    if (!word.text.trim()) {
      throw new Error(`Transcript word ${wordIndex} is empty.`);
    }
    if (word.endMs <= word.startMs) {
      throw new Error(
        `Transcript word ${wordIndex} must have positive duration.`,
      );
    }
    if (word.startMs < previousSourceEndMs) {
      throw new Error(
        `Transcript word ${wordIndex} overlaps the preceding source word.`,
      );
    }

    const containingSegment = timestampMap.find(
      (segment) =>
        segment.mode !== "cut" &&
        word.startMs >= segment.sourceStartMs &&
        word.endMs <= segment.sourceEndMs,
    );
    if (!containingSegment) {
      throw new Error(
        `Transcript word ${wordIndex} must fit inside a single kept output-timeline segment.`,
      );
    }

    const startMs = mapMaulSourceMsToOutput(timestampMap, word.startMs);
    const endMs = mapMaulSourceMsToOutput(timestampMap, word.endMs);
    if (startMs === null || endMs === null) {
      throw new Error(
        `Transcript word ${wordIndex} does not map completely onto the output timeline.`,
      );
    }
    if (endMs <= startMs) {
      throw new Error(
        `Transcript word ${wordIndex} has no positive output duration.`,
      );
    }
    if (startMs < previousOutputEndMs) {
      throw new Error(
        `Transcript word ${wordIndex} overlaps the preceding output word.`,
      );
    }

    previousSourceEndMs = word.endMs;
    previousOutputEndMs = endMs;
    return {...word, startMs, endMs};
  });
};

export const buildMaulPlanningPayloads = (inputs: MaulPlanningInputs) => {
  const candidateWords = wordsForCandidate(inputs);
  const midpoint = Math.max(1, Math.ceil(candidateWords.length / 2));
  const narrativeGroups = [
    { role: "hook" as const, words: candidateWords.slice(0, midpoint) },
    { role: "payoff" as const, words: candidateWords.slice(midpoint) },
  ].filter((group) => group.words.length > 0);
  const nonCutSegments = inputs.timeline.payload.timestampMap.filter(
    (segment) => segment.mode !== "cut",
  );
  const beatRecords = nonCutSegments.map((segment, index) => {
    const segmentWords = candidateWords.filter(
      (word) =>
        word.endMs > segment.sourceStartMs &&
        word.startMs < segment.sourceEndMs,
    );
    const role =
      index === 0
        ? ("hook" as const)
        : index === nonCutSegments.length - 1
          ? ("payoff" as const)
          : ("proof" as const);
    return {
      beatId: `maul_beat_${index + 1}`,
      role,
      sourceStartMs: segment.sourceStartMs,
      sourceEndMs: segment.sourceEndMs,
      outputStartMs: segment.outputStartMs,
      outputEndMs: segment.outputEndMs,
      spokenIdea: textOf(segmentWords) || "Protected source-grounded pause",
      intensity: role === "hook" ? 0.82 : role === "payoff" ? 0.9 : 0.66,
      informationDensity: Math.min(1, segmentWords.length / 8),
      dominantFocus:
        segment.mode === "protected_pause"
          ? ("deliberate_stillness" as const)
          : ("speaker" as const),
      allowedEvents:
        segment.mode === "protected_pause"
          ? (["music"] as const)
          : (["caption", "camera", "music"] as const),
      protectedPause: segment.mode === "protected_pause",
      rationale:
        segment.mode === "protected_pause"
          ? "Preserve the verified rhetorical pause without visual competition."
          : `Carry the ${role} through source-faithful speech and one dominant focus.`,
      confidence: 0.78,
    };
  });
  const firstCrop = inputs.timeline.payload.speakerCropTracks[0]?.crop;
  const observationSnapshot = maulObservationSnapshotPayloadSchema.parse({
    ...basePlan(inputs, "maul-observation-snapshot/v1"),
    schemaVersion: "maul-observation-snapshot/v1",
    facts: {
      language: inputs.analysis.payload.transcript.language,
      transcriptWordCount: inputs.analysis.payload.transcript.words.length,
      verifiedVoiceSpanCount: inputs.analysis.payload.voiceSpans.filter(
        (span) => span.verified,
      ).length,
      verifiedSilenceSpanCount: inputs.analysis.payload.silenceSpans.filter(
        (span) => span.verified,
      ).length,
      shotCount: inputs.analysis.payload.shots.length,
      speakerTrackCount: inputs.analysis.payload.speakerTracks.length,
      sourceDurationMs: inputs.source.payload.durationMs,
      sourceWidth: inputs.source.payload.width,
      sourceHeight: inputs.source.payload.height,
      sourceFps: inputs.source.payload.fps,
    },
    unavailableSignals: [
      "prosody",
      "gesture",
      "motion",
      "source_quality_grade",
      "temporal_visual_probe",
    ],
    warnings: [
      "Current MAUL analysis does not provide multimodal prosody, gesture, motion, or temporal visual authority.",
    ],
  });
  const candidateNarrative = maulCandidateNarrativePayloadSchema.parse({
    ...basePlan(inputs, "maul-candidate-narrative/v1"),
    schemaVersion: "maul-candidate-narrative/v1",
    coherentThesis: inputs.candidate.payload.transcriptText,
    segments: narrativeGroups.map((group) => ({
      role: group.role,
      claim: textOf(group.words),
      sourceStartMs: group.words[0]!.startMs,
      sourceEndMs: group.words.at(-1)!.endMs,
      sourceSupported: true,
      transcriptWordStartIndex:
        inputs.analysis.payload.transcript.words.indexOf(group.words[0]!),
      transcriptWordEndIndex: inputs.analysis.payload.transcript.words.indexOf(
        group.words.at(-1)!,
      ),
    })),
    unsupportedClaims: [],
  });
  const beatMap = maulEditorialBeatMapPayloadSchema.parse({
    ...basePlan(inputs, "maul-editorial-beat-map/v1"),
    schemaVersion: "maul-editorial-beat-map/v1",
    beats: beatRecords,
    sharedAttentionBudget: {
      maxConcurrentDominantEvents: 1,
      collisionPolicy:
        "Camera, editorial type, evidence, and SFX may not compete for dominant attention.",
    },
  });
  const chunkCaptionGroups = inputs.textChunkPlan?.chunks.flatMap((chunk) => {
    if (chunk.endMs <= chunk.startMs) {
      return [];
    }
    return [
      {
        text: chunk.text,
        outputStartMs: chunk.startMs,
        outputEndMs: chunk.endMs,
        sourceGrounded: true as const,
        role: "dialogue_caption" as const,
      },
    ];
  });
  const typographyMotion = maulTypographyMotionPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-typography-motion-plan/v1"),
    schemaVersion: "maul-typography-motion-plan/v1",
    textChunkPlan: inputs.textChunkPlan,
    textChunkAuthority: inputs.textChunkPlan
      ? {
          authorityClass:
            inputs.textChunkPlan.inference.status === "invoked"
              ? ("invoked_model" as const)
              : ("governed_fallback" as const),
          decisionScope:
            "semantic_boundaries_roles_and_emphasis_only" as const,
          decisionFields: [
            "textChunkPlan.chunks[].startWordIndex" as const,
            "textChunkPlan.chunks[].endWordIndex" as const,
            "textChunkPlan.chunks[].semanticRole" as const,
            "textChunkPlan.chunks[].emphasis.wordIndices" as const,
            "textChunkPlan.chunks[].emphasis.level" as const,
          ],
          inferenceReceiptPath: "textChunkPlan.inference" as const,
        }
      : null,
    captionGroups:
      chunkCaptionGroups && chunkCaptionGroups.length > 0
        ? chunkCaptionGroups
        : beatRecords
            .filter(
              (beat) => beat.spokenIdea !== "Protected source-grounded pause",
            )
            .map((beat) => ({
              text: beat.spokenIdea,
              outputStartMs: beat.outputStartMs,
              outputEndMs: beat.outputEndMs,
              sourceGrounded: true as const,
              role: "dialogue_caption" as const,
            })),
    editorialStatements: [],
    editorialTextWithheldReason:
      "The current deterministic planner has no governed editorial-writing authority; it will not relabel dialogue as authored hero copy.",
    fontResolution: {
      requestedRole: "utility",
      selectedFamily: "Arial",
      selectedAssetId: null,
      status: "governed_fallback",
      reason:
        "The Stage 4 eligible font runtime bridge is not yet connected; fallback is explicit and blocks a cinematic release label.",
    },
    motionPrograms: [
      {
        capabilityId: "maul_caption_page_spring",
        semanticRole:
          "Make dialogue captions readable without inventing emphasis.",
        outputStartMs: 0,
        outputEndMs: inputs.timeline.payload.outputDurationMs,
        execution: executionNative(
          "MaulShort.CaptionPage.spring",
          "Rendered frame probes must distinguish the caption spring from a no-op and fallback.",
        ),
      },
    ],
    warnings: [
      "Eligible custom-font loading and measured final-pixel typography are not yet available.",
    ],
  });
  const camera = maulFramingCameraPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-framing-camera-plan/v1"),
    schemaVersion: "maul-framing-camera-plan/v1",
    events: beatRecords.map((beat, index) => ({
      eventId: `maul_camera_${index + 1}`,
      outputStartMs: beat.outputStartMs,
      outputEndMs: beat.outputEndMs,
      cropCenterX: firstCrop ? firstCrop.x + firstCrop.width / 2 : 0.5,
      cropCenterY: firstCrop ? firstCrop.y + firstCrop.height / 2 : 0.5,
      startScale: 1,
      endScale: Math.min(
        inputs.treatment.payload.rendererInputs.framing.maxPunchInScale,
        1 +
          (inputs.treatment.payload.treatmentId === "minimal_expert"
            ? 0.008
            : 0.018),
      ),
      motivatedByBeatId: beat.beatId,
      rationale: beat.protectedPause
        ? "Settle rather than restart motion across the protected pause."
        : "Use one restrained continuous push to support the spoken beat.",
      execution: executionNative(
        "MaulShort.SourceSegment.continuousPush",
        "Encoded crop and scale probes must show continuity without segment resets.",
      ),
    })),
    continuityPolicy:
      "Camera state carries across kept source segments; protected pauses settle instead of pumping.",
    maxScale: inputs.treatment.payload.rendererInputs.framing.maxPunchInScale,
  });
  const visual = maulVisualPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-visual-plan/v1"),
    schemaVersion: "maul-visual-plan/v1",
    scenes: [
      {
        sceneId: "maul_scene_speaker_source",
        outputStartMs: 0,
        outputEndMs: inputs.timeline.payload.outputDurationMs,
        mode: "speaker_only",
        purpose:
          "Preserve source fidelity while no licensed evidence or B-roll has been selected.",
        assetArtifactId: inputs.source.artifactId,
        provenanceStatus: "source",
        referencePixelsExcluded: true,
        execution: executionNative(
          "MaulShort.SourceSegment.video",
          "Contact sheets must prove that only the authoritative source pixels entered the scene.",
        ),
      },
    ],
    neededButUnavailable: [
      "No governed evidence/B-roll retrieval result exists for this deterministic planning pass.",
    ],
    warnings: [
      "Speaker-only visual mode is an explicit restrained fallback, not evidence of cinematic visual planning.",
    ],
  });
  const audio = maulDialogueAudioPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-dialogue-audio-plan/v1"),
    schemaVersion: "maul-dialogue-audio-plan/v1",
    dialoguePriority: true,
    targetLufs: -14,
    musicPolicy: inputs.treatment.payload.rendererInputs.audio.musicBehavior,
    duckingDb: inputs.treatment.payload.rendererInputs.audio.duckingDb,
    sfxIntents: [],
    execution: executionFallback(
      "Static dialogue-first source/music/SFX nodes; treatment ducking automation remains unimplemented.",
      "Decoded-audio probes must verify dialogue dominance and disclose missing automation.",
    ),
    warnings: [
      "The current native MAUL composition does not execute the full ducking envelope from the video-aware audio plan.",
    ],
  });
  const capabilitySelection = maulCapabilitySelectionPayloadSchema.parse({
    ...basePlan(inputs, "maul-capability-selection/v1"),
    schemaVersion: "maul-capability-selection/v1",
    selections: [
      {
        capabilityId: "maul_source_timestamp_mapping",
        semanticRole: "Execute factual source-to-output mapping.",
        selected: true,
        execution: executionNative(
          "MaulShort.SourceSegment.video",
          "Frame probes must match the Authoritative Editorial Timeline.",
        ),
      },
      {
        capabilityId: "maul_caption_page_spring",
        semanticRole: "Present dialogue captions with a stable readable hold.",
        selected: true,
        execution: executionNative(
          "MaulShort.CaptionPage.spring",
          "Caption entry, hold, and exit frames must be visually distinct and safe.",
        ),
      },
    ],
    unknownCapabilityIds: [],
  });
  const adapterDecision = maulAdapterDecisionPayloadSchema.parse({
    ...basePlan(inputs, "maul-adapter-decision/v1"),
    schemaVersion: "maul-adapter-decision/v1",
    adapterId: "maul-portrait-format-adapter/v1",
    platform: inputs.project.intake.platform,
    canvas: { width: 1080, height: 1920, fps: 30 },
    safeRegion: { topPx: 120, rightPx: 72, bottomPx: 330, leftPx: 72 },
    preservedIntent: [
      "Source claims",
      "Selected clip window",
      "Protected pauses",
      "Narrative roles",
      "Dialogue priority",
    ],
    adaptedConstraints: [
      {
        field: "canvas",
        from: "format-neutral",
        to: "1080x1920 portrait",
        reason:
          "Resolve the shared intent for the selected short-form platform.",
      },
      {
        field: "caption_safe_region",
        from: "format-neutral",
        to: "platform-reserved lower-third region",
        reason: "Protect mobile reading and platform UI clearance.",
      },
    ],
    silentIntentMutations: [],
  });
  const artDirection = maulArtDirectionPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-art-direction-plan/v1"),
    schemaVersion: "maul-art-direction-plan/v1",
    audienceIntent: `Help ${inputs.project.intake.platform} viewers understand the selected idea immediately while preserving the speaker's authority.`,
    emotionalTemperature:
      inputs.treatment.payload.treatmentId === "premium_direct_response"
        ? "urgent_confident"
        : inputs.treatment.payload.treatmentId === "founder_podcast"
          ? "warm_intimate"
          : "calm_authoritative",
    sourceRespectStance:
      "Treat the principal speaker as the factual and visual anchor; never manufacture emotion, claims, or evidence.",
    theme: `${inputs.treatment.payload.catalogEntryName}: one clear idea moving from hook to earned payoff.`,
    paletteIntent: [
      "Warm neutral source image",
      "High-contrast ivory typography",
      "Restrained amber accent reserved for hierarchy",
    ],
    typeRoles: [
      {
        role: "dialogue_caption",
        intent:
          "Fast, legible transcription that remains subordinate to the speaker.",
      },
      {
        role: "editorial_hero",
        intent:
          "Withheld until a governed editorial-writing capability can support it.",
      },
      {
        role: "utility",
        intent: "Quiet provenance and platform-safe information only.",
      },
    ],
    layoutAndNegativeSpaceLogic:
      "Keep the speaker in the dominant portrait field and reserve a stable lower-third safe region; never fill negative space merely to create activity.",
    imageryAndBackgroundLanguage:
      "Use only authoritative source pixels in this pass, with restrained tonal shaping and no unlicensed B-roll or reference-image pixels.",
    cameraBehavior:
      "Continuous, motivated portrait reframing with small pushes at rhetorical turns and settled motion through protected pauses.",
    motionPhysics:
      "Critically damped caption entry, continuous camera state, and no decorative overshoot that competes with speech.",
    annotationGrammar:
      "Annotations are unavailable and therefore withheld; any future mark must point to source-supported evidence.",
    soundWorld:
      "Dialogue-first mix with restrained licensed music and sparse event-specific SFX only when a verified timing intent exists.",
    motifArc: {
      introduction:
        "Introduce the amber accent once as the hook establishes the idea.",
      development:
        "Reduce the accent while the speaker carries proof and context.",
      recall:
        "Return the same accent at the payoff without adding a new motif.",
    },
    treatmentVariation: `Apply the ${inputs.treatment.payload.treatmentId} treatment through governed framing, pacing, audio, and hierarchy inputs, not through silent intent changes.`,
    explicitProhibitions: [
      "No reference-image pixels in the render.",
      "No unlicensed evidence, B-roll, music, or SFX.",
      "No kinetic typography spam or word-by-word novelty motion.",
      "No unsupported factual, emotional, or causal claim.",
    ],
  });
  const candidateStartMs = inputs.candidate.payload.sourceStartMs;
  const candidateEndMs = inputs.candidate.payload.sourceEndMs;
  const precedingWords = inputs.analysis.payload.transcript.words.filter(
    (word) => word.endMs <= candidateStartMs,
  );
  const followingWords = inputs.analysis.payload.transcript.words.filter(
    (word) => word.startMs >= candidateEndMs,
  );
  const contextAssembly = maulContextAssemblyPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-context-assembly-plan/v1"),
    schemaVersion: "maul-context-assembly-plan/v1",
    wholeSourceSynopsis:
      inputs.analysis.payload.transcript.text.trim() ||
      "Transcript text is unavailable; only timed candidate words can be assembled.",
    narrativePhases: [
      {
        phase: "available_transcript",
        sourceStartMs: 0,
        sourceEndMs: inputs.source.payload.durationMs,
        summary:
          inputs.analysis.payload.transcript.text.trim() ||
          "No full-source transcript synopsis is available.",
      },
    ],
    candidateNeighborhood: {
      sourceStartMs: candidateStartMs,
      sourceEndMs: candidateEndMs,
      precedingContext: textOf(precedingWords.slice(-24)),
      followingContext: textOf(followingWords.slice(0, 24)),
    },
    localTranscript: inputs.candidate.payload.transcriptText,
    namedFacts: [],
    callbacks: [],
    setupPayoffDependencies: [
      "The selected hook and payoff must remain in their source chronology.",
    ],
    chronologyConstraints: [
      "Do not reorder words inside a kept source segment.",
      "Preserve the Authoritative Editorial Timeline timestamp map.",
    ],
    sourceQualityChanges: [],
    unresolvedUncertainty: [
      "Prosody, gesture, gaze, and temporal visual quality are not present in the current analysis contract.",
    ],
    omissionReports: [
      {
        contextClass: "multimodal_whole_source_context",
        reason:
          "The current analysis supplies transcript and structural spans but no governed temporal visual/prosody interpretation.",
        effect: "degraded_authority",
      },
    ],
  });
  const textOpportunities = beatRecords.map((beat, index) => ({
    opportunityId: `maul_text_opportunity_${index + 1}`,
    beatId: beat.beatId,
    kind: beat.protectedPause
      ? ("deliberate_absence" as const)
      : ("dialogue_caption" as const),
    communicationBenefit: beat.protectedPause
      ? "Protect the rhetorical pause from competing reading demand."
      : "Make the source-grounded spoken idea readable on mobile.",
    sourceSupport: beat.protectedPause
      ? "Authoritative timeline marks a protected pause."
      : beat.spokenIdea,
    viewerReadingLoad: Math.min(1, beat.informationDensity),
    availableNegativeSpace: "unknown" as const,
    subjectOcclusionRisk: "unknown" as const,
    speechRate: "unknown" as const,
    concurrentImagery: "Authoritative principal-speaker source video",
    durationMs: beat.outputEndMs - beat.outputStartMs,
    hierarchyOwner: beat.protectedPause
      ? ("speaker" as const)
      : ("caption" as const),
    decision: beat.protectedPause ? ("withhold" as const) : ("use" as const),
    rationale: beat.protectedPause
      ? "Silence and stillness are the intended communication event."
      : "Dialogue captions are source-supported; authored editorial copy is not yet authorized.",
  }));
  const textOpportunity = maulTextOpportunityPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-text-opportunity-plan/v1"),
    schemaVersion: "maul-text-opportunity-plan/v1",
    opportunities: textOpportunities,
    quotaUsed: false,
  });
  const shotIntentMatrix = maulShotIntentMatrixPayloadSchema.parse({
    ...basePlan(inputs, "maul-shot-intent-matrix/v1"),
    schemaVersion: "maul-shot-intent-matrix/v1",
    shots: beatRecords.map((beat, index) => ({
      shotId: `maul_shot_${index + 1}`,
      sourceStartMs: beat.sourceStartMs,
      sourceEndMs: beat.sourceEndMs,
      outputStartMs: beat.outputStartMs,
      outputEndMs: beat.outputEndMs,
      editorialPurpose: beat.rationale,
      rhetoricalRole: beat.role,
      inReason:
        index === 0
          ? "Enter on the selected hook."
          : "Continue into the next governed rhetorical beat.",
      outReason:
        index === beatRecords.length - 1
          ? "Exit after the selected payoff completes."
          : "Yield to the next governed rhetorical beat.",
      continuityRelationship:
        "Preserve source chronology and carry camera state across the implementation boundary.",
      screenDirection: "unknown",
      poseAndGestureState:
        "Unavailable in the current analysis contract; do not infer.",
      eyeLine: "unknown",
      cropAndCameraTarget:
        "Track the verified principal speaker using the governed portrait crop and restrained continuous push.",
      evidenceBackgroundDockingState:
        "Speaker-only fallback; no evidence panel or background asset is authorized.",
      textOpportunityId: textOpportunities[index]!.opportunityId,
      audioHandlesMs: { pre: 0, post: 0 },
      colorMatchIntent:
        "Maintain one continuous source treatment without synthetic shot-to-shot color discontinuity.",
      transition:
        index === 0 ? "Direct source entry" : "Continuous cutless source carry",
      confidence: 0.72,
      fallback:
        "If governed crop execution is unavailable, render the source-fit portrait without inventing a new crop.",
    })),
    implementationSegmentsAreShots: false,
  });
  const revision = maulRevisionPlanPayloadSchema.parse({
    ...basePlan(inputs, "maul-revision-plan/v1"),
    schemaVersion: "maul-revision-plan/v1",
    immutableFields: [
      "Source claims and transcript wording",
      "Authoritative Editorial Timeline source mapping",
      "Rights and provenance state",
      "Approved candidate and treatment identity",
      "S4 release thresholds",
    ],
    allowedMutations: [
      "Caption line grouping within the governed safe region",
      "Camera scale within treatment maximums",
      "Audio mix levels without weakening dialogue priority",
      "Explicit fallback selection",
    ],
    repairOptions: [
      {
        failureClass: "caption_safety_or_legibility",
        permittedAction:
          "Regroup captions or reduce caption scale within the safe region.",
        affectedGates: ["typography", "composition_and_hierarchy"],
      },
      {
        failureClass: "camera_continuity",
        permittedAction:
          "Reduce or remove the governed push without changing source timing.",
        affectedGates: ["framing_and_camera", "continuity"],
      },
      {
        failureClass: "dialogue_masking",
        permittedAction:
          "Lower music or SFX gain while retaining the licensed assets.",
        affectedGates: ["dialogue_and_audio"],
      },
    ],
    maximumAttempts: 2,
    maximumWallClockMs: 300000,
    maximumCostUsd: 1,
    criticMustBeIndependent: true,
    noProgressDetection:
      "Stop when a retry does not improve every failing gate targeted by that repair.",
    oscillationDetection:
      "Stop when a later attempt recreates a previously observed gate score and failure signature.",
    humanCheckpoint:
      "Require human review before changing immutable source, rights, timeline, candidate, treatment, or threshold fields.",
    stopReasons: [
      "Attempt, wall-clock, or cost budget exhausted.",
      "No-progress or oscillation detected.",
      "A repair would require immutable-field mutation or threshold reduction.",
    ],
    thresholdReductionAllowed: false,
  });

  return {
    observationSnapshot,
    candidateNarrative,
    beatMap,
    typographyMotion,
    camera,
    visual,
    audio,
    capabilitySelection,
    adapterDecision,
    artDirection,
    contextAssembly,
    shotIntentMatrix,
    textOpportunity,
    revision,
  };
};

export type MaulPlanningPayloads = ReturnType<typeof buildMaulPlanningPayloads>;

export const buildMaulPlanningBundlePayload = ({
  inputs,
  planArtifactIds,
}: {
  inputs: MaulPlanningInputs;
  planArtifactIds: MaulPlanningBundlePayload["planArtifactIds"];
}): MaulPlanningBundlePayload =>
  maulPlanningBundlePayloadSchema.parse({
    ...basePlan(inputs, "maul-planning-bundle/v1"),
    schemaVersion: "maul-planning-bundle/v1",
    planArtifactIds,
    rendererReadiness: "governed_with_explicit_fallbacks",
    blockingReasons: [],
    warnings: [
      "Planning is deterministic and carries explicit font, visual, and audio fallbacks; it is not an S4 or cinematic claim.",
    ],
  });

type PlanningArtifacts = {
  observationSnapshot: Extract<
    MaulArtifactRecord,
    { artifactType: "observation_snapshot" }
  >;
  candidateNarrative: Extract<
    MaulArtifactRecord,
    { artifactType: "candidate_narrative" }
  >;
  beatMap: Extract<MaulArtifactRecord, { artifactType: "editorial_beat_map" }>;
  typographyMotion: Extract<
    MaulArtifactRecord,
    { artifactType: "typography_motion_plan" }
  >;
  camera: Extract<MaulArtifactRecord, { artifactType: "framing_camera_plan" }>;
  visual: Extract<MaulArtifactRecord, { artifactType: "visual_plan" }>;
  audio: Extract<MaulArtifactRecord, { artifactType: "dialogue_audio_plan" }>;
  capabilitySelection: Extract<
    MaulArtifactRecord,
    { artifactType: "capability_selection" }
  >;
  adapterDecision: Extract<
    MaulArtifactRecord,
    { artifactType: "adapter_decision" }
  >;
  artDirection: Extract<
    MaulArtifactRecord,
    { artifactType: "art_direction_plan" }
  >;
  contextAssembly: Extract<
    MaulArtifactRecord,
    { artifactType: "context_assembly_plan" }
  >;
  shotIntentMatrix: Extract<
    MaulArtifactRecord,
    { artifactType: "shot_intent_matrix" }
  >;
  textOpportunity: Extract<
    MaulArtifactRecord,
    { artifactType: "text_opportunity_plan" }
  >;
  revision: Extract<MaulArtifactRecord, { artifactType: "revision_plan" }>;
};

export const compileMaulUnifiedShortRenderManifest = ({
  inputs,
  planningBundle,
  planningArtifacts,
  captions,
  audioPlan,
  request,
  createdAt,
}: {
  inputs: MaulPlanningInputs;
  planningBundle: Extract<
    MaulArtifactRecord,
    { artifactType: "planning_bundle" }
  >;
  planningArtifacts: PlanningArtifacts;
  captions: MaulRenderCaption[];
  audioPlan: VideoAwareAudioPlan;
  request: MaulShortRenderRequest;
  createdAt: string;
}): MaulUnifiedShortRenderManifest => {
  const planExecution: MaulUnifiedShortRenderManifest["planExecution"] = [
    {
      planArtifactId: planningArtifacts.observationSnapshot.artifactId,
      planType: "observation_snapshot",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Observation facts remain provenance context; the thin renderer does not yet interpret multimodal observations.",
    },
    {
      planArtifactId: planningArtifacts.candidateNarrative.artifactId,
      planType: "candidate_narrative",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Candidate narrative is executed through the source-faithful timeline and captions.",
    },
    {
      planArtifactId: planningArtifacts.beatMap.artifactId,
      planType: "editorial_beat_map",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Beat timing is reduced to the authoritative timeline; unsupported event types remain withheld.",
    },
    {
      planArtifactId: planningArtifacts.typographyMotion.artifactId,
      planType: "typography_motion_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.CaptionPage.spring",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.camera.artifactId,
      planType: "framing_camera_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.SourceSegment.continuousPush",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.visual.artifactId,
      planType: "visual_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.SourceSegment.video",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.audio.artifactId,
      planType: "dialogue_audio_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Static dialogue-first source/music/SFX nodes without the unimplemented ducking envelope.",
    },
    {
      planArtifactId: planningArtifacts.capabilitySelection.artifactId,
      planType: "capability_selection",
      executionStatus: "native",
      nativeBranch: "MaulShort.capabilityDispatch.v1",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.adapterDecision.artifactId,
      planType: "adapter_decision",
      executionStatus: "native",
      nativeBranch: "MaulShort.portrait1080x1920",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.artDirection.artifactId,
      planType: "art_direction_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "The manifest preserves the art-direction thesis, but the thin renderer currently executes only treatment-level style inputs.",
    },
    {
      planArtifactId: planningArtifacts.contextAssembly.artifactId,
      planType: "context_assembly_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "Assembled context remains governed planning provenance; the renderer consumes only the approved timeline and source mapping.",
    },
    {
      planArtifactId: planningArtifacts.shotIntentMatrix.artifactId,
      planType: "shot_intent_matrix",
      executionStatus: "native",
      nativeBranch: "MaulShort.SourceSegment.video",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.textOpportunity.artifactId,
      planType: "text_opportunity_plan",
      executionStatus: "native",
      nativeBranch: "MaulShort.CaptionPage.spring",
      fallback: null,
    },
    {
      planArtifactId: planningArtifacts.revision.artifactId,
      planType: "revision_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback:
        "The bounded revision policy is preserved for the quality controller; this render invocation performs no autonomous retry cycle.",
    },
  ];
  const replayKey = stableHash({
    sourceSha256: inputs.source.payload.sha256,
    timelineReplay: inputs.timeline.payload.timestampMap,
    treatmentReplayKey: inputs.treatment.payload.replayKey,
    planningBundleReplayKey: planningBundle.payload.replayKey,
    audioPlanId: audioPlan.id,
    musicTrackId: request.musicTrack.id,
    sfx: request.sfxAssets.map((asset) => [asset.id, asset.sourceMs]),
  });
  return maulUnifiedShortRenderManifestSchema.parse({
    schemaVersion: "maul-unified-short-render-manifest/v1",
    rendererInputKind: "unified_short_render_manifest_only",
    planningBundleArtifactId: planningBundle.artifactId,
    planArtifactIds: planningBundle.payload.planArtifactIds,
    source: {
      sourceAssetId: inputs.source.artifactId,
      storagePath: inputs.source.payload.storageKey,
      sha256: inputs.source.payload.sha256,
    },
    timeline: inputs.timeline.payload,
    treatment: inputs.treatment.payload,
    captions,
    audio: {
      planId: audioPlan.id,
      planMode: "render_ready",
      musicTrack: request.musicTrack,
      sfxAssets: request.sfxAssets.flatMap((sfx) => {
        const outputMs = mapMaulSourceMsToOutput(
          inputs.timeline.payload.timestampMap,
          sfx.sourceMs,
        );
        return outputMs === null
          ? []
          : [
              {
                id: sfx.id,
                storagePath: sfx.storagePath,
                licenseType: sfx.licenseType,
                commercialAllowed: sfx.commercialAllowed,
                licenseVerified: sfx.licenseVerified,
                renderSafe: sfx.renderSafe,
                eventType: sfx.eventType,
                outputMs,
              },
            ];
      }),
    },
    plans: {
      observationSnapshot: planningArtifacts.observationSnapshot.payload,
      candidateNarrative: planningArtifacts.candidateNarrative.payload,
      beatMap: planningArtifacts.beatMap.payload,
      typographyMotion: planningArtifacts.typographyMotion.payload,
      camera: planningArtifacts.camera.payload,
      visual: planningArtifacts.visual.payload,
      audio: planningArtifacts.audio.payload,
      capabilitySelection: planningArtifacts.capabilitySelection.payload,
      adapterDecision: planningArtifacts.adapterDecision.payload,
      artDirection: planningArtifacts.artDirection.payload,
      contextAssembly: planningArtifacts.contextAssembly.payload,
      shotIntentMatrix: planningArtifacts.shotIntentMatrix.payload,
      textOpportunity: planningArtifacts.textOpportunity.payload,
      revision: planningArtifacts.revision.payload,
    },
    planExecution,
    output: { width: 1080, height: 1920, fps: 30, codec: "h264" },
    replayKey,
    createdAt,
  });
};

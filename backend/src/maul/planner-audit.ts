import type { MaulPlannerAuditPayload } from "@prometheus/shared-types";

import type { ModelRoute, ModelRoutingTable } from "../model-routing/index.js";

type PlannerAuditInput = {
  sourceAssetId: string;
  analysisArtifactId: string;
  timelineArtifactId: string;
  candidateArtifactIds: string[];
  generatedAt: string;
  modelRoutes: ModelRoutingTable;
};

const configuredRouteEntry = ({
  stageId,
  route,
  reason,
  unavailable = false,
  limitations,
}: {
  stageId: string;
  route: ModelRoute;
  reason: string;
  unavailable?: boolean;
  limitations: string[];
}): MaulPlannerAuditPayload["entries"][number] => ({
  stageId,
  module: "backend-model-routing",
  moduleVersion: "1",
  authorityClass:
    unavailable || !route.configured ? "unavailable" : "configured_not_invoked",
  configured: unavailable ? false : route.configured,
  executed: false,
  provider: route.provider,
  model: route.model,
  reason,
  decisionFields: [],
  limitations,
  inferenceReceipt: null,
});

export const buildMaulPlannerAuditPayload = ({
  sourceAssetId,
  analysisArtifactId,
  timelineArtifactId,
  candidateArtifactIds,
  generatedAt,
  modelRoutes,
}: PlannerAuditInput): MaulPlannerAuditPayload => {
  const entries: MaulPlannerAuditPayload["entries"] = [
    {
      stageId: "maul_media_analysis",
      module: "maul-editorial-timeline",
      moduleVersion: "1",
      authorityClass: "deterministic",
      configured: true,
      executed: true,
      provider: "local-deterministic",
      model: "maul-media-analysis/v1",
      reason:
        "Transcript, verified silence evidence, shots, and supplied speaker detections are compiled deterministically.",
      decisionFields: [
        "analysis.transcript",
        "analysis.voiceSpans",
        "analysis.silenceSpans",
        "analysis.shots",
        "analysis.speakerTracks",
      ],
      limitations: [
        "No multimodal model interpreted composition, gesture, lighting, or source quality.",
      ],
      inferenceReceipt: null,
    },
    {
      stageId: "maul_editorial_timeline",
      module: "maul-editorial-timeline",
      moduleVersion: "1",
      authorityClass: "deterministic",
      configured: true,
      executed: true,
      provider: "local-deterministic",
      model: "maul-editorial-timeline/v1",
      reason:
        "Cut candidates, protected pauses, timestamp mapping, and crop tracks are deterministic transforms of supplied evidence.",
      decisionFields: [
        "editorialTimeline.selectedClipWindows",
        "editorialTimeline.cutCandidates",
        "editorialTimeline.protectedRanges",
        "editorialTimeline.timestampMap",
        "editorialTimeline.speakerCropTracks",
      ],
      limitations: [
        "Current cadence logic is rules-based and does not constitute cinematic semantic judgment.",
      ],
      inferenceReceipt: null,
    },
    {
      stageId: "maul_candidate_scoring",
      module: "maul-candidate-scorer",
      moduleVersion: "1",
      authorityClass: "deterministic",
      configured: true,
      executed: true,
      provider: "local-deterministic",
      model: "maul-shallow-arithmetic-scorer/v1",
      reason:
        "Hook clarity, semantic completion, pacing, and overall score are fixed arithmetic rules.",
      decisionFields: [
        "candidate.title",
        "candidate.transcriptText",
        "candidate.scores",
        "candidate.qualityThresholdPassed",
        "candidate.insufficiencyReason",
      ],
      limitations: [
        "A passing arithmetic threshold is candidate eligibility only; it is not cinematic, S4, or human approval.",
      ],
      inferenceReceipt: null,
    },
    {
      stageId: "joseph_seeded_planning",
      module: "joseph-director",
      moduleVersion: "current",
      authorityClass: "configured_not_invoked",
      configured: true,
      executed: false,
      provider: "local-deterministic",
      model: "joseph-seeded-governed-search",
      reason:
        "Joseph exposes richer deterministic seeded planning, but the current MAUL candidate path did not invoke it.",
      decisionFields: [],
      limitations: [
        "No Joseph parity may be claimed until doctrine-to-render traceability proves the shared seam.",
      ],
      inferenceReceipt: null,
    },
    configuredRouteEntry({
      stageId: "configured_primary_generation",
      route: modelRoutes.primaryGeneration,
      reason:
        "The primary generation route is configured metadata only; MAUL did not dispatch a request.",
      limitations: [
        "No provider receipt, request hash, response hash, or causally changed plan field exists.",
      ],
    }),
    configuredRouteEntry({
      stageId: "configured_cinematic_critic",
      route: modelRoutes.critic,
      reason:
        "The critic route is configured metadata only; it did not evaluate rendered MAUL output.",
      limitations: [
        "A configured critic string is not independent perceptual evidence.",
      ],
    }),
    configuredRouteEntry({
      stageId: "configured_temporal_route",
      route: modelRoutes.temporal,
      reason: "The generic temporal route was not dispatched by this MAUL run.",
      limitations: [
        "Continuity and pacing authority remains the deterministic MAUL timeline module.",
      ],
    }),
    configuredRouteEntry({
      stageId: "configured_embedding_route",
      route: modelRoutes.embedding,
      reason:
        "The generic embedding route was not dispatched by this MAUL candidate run.",
      limitations: [
        "No retrieval result from this route affected candidate selection.",
      ],
    }),
    configuredRouteEntry({
      stageId: "ocular_visual_planning",
      route: modelRoutes.ocular,
      reason:
        "The current ocular route is a future placeholder and cannot own visual planning.",
      unavailable: true,
      limitations: [
        "No frame-aware composition, gesture, crop, matte, motion, or lighting judgment was performed.",
      ],
    }),
  ];

  return {
    schemaVersion: "maul-planner-audit/v1",
    sourceAssetId,
    analysisArtifactId,
    timelineArtifactId,
    candidateArtifactIds,
    generatedAt,
    entries,
    summary: {
      liveEditorialAuthority: "deterministic",
      visualPlanningAuthority: "unavailable",
      modelInvocationCount: entries.filter(
        (entry) => entry.authorityClass === "invoked_model",
      ).length,
      configuredNotInvokedCount: entries.filter(
        (entry) => entry.authorityClass === "configured_not_invoked",
      ).length,
      unavailableAuthorityCount: entries.filter(
        (entry) => entry.authorityClass === "unavailable",
      ).length,
      fakeInferenceLabelsBlocked: true,
    },
  };
};

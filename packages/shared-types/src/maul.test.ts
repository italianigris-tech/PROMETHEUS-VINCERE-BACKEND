import {describe, expect, it} from "vitest";

import {
  maulAuditEventSchema,
  maulArtifactRecordSchema,
  maulEditorialTimelinePayloadSchema,
  maulProjectSchema,
  maulQualityEvidenceBundlePayloadSchema,
  maulQualityTruthProofSchema,
  maulQualityTruthResultSchema
} from "./maul.js";

const createdAt = "2026-07-28T12:00:00.000Z";

describe("MAUL shared contracts", () => {
  it("keeps canonical job identity and source ownership on the project", () => {
    const project = maulProjectSchema.parse({
      schemaVersion: "maul-project/v1",
      id: "project_alpha",
      canonicalJobId: "maul_job_alpha",
      creatorId: "creator_alpha",
      status: "intake_ready",
      intake: {
        goal: "retention",
        platform: "instagram_reels",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        brandKitId: null,
        treatmentPreference: "founder_podcast",
        requestedShortCount: 3,
        requestedThumbnailCount: 4,
        targetDurationMs: {min: 20000, max: 45000}
      },
      rootSourceAssetId: "artifact_source",
      artifactIds: ["artifact_source"],
      activeRunId: "run_alpha",
      revision: 1,
      createdAt,
      updatedAt: createdAt
    });

    expect(project.canonicalJobId).toBe("maul_job_alpha");
    expect(project.rootSourceAssetId).toBe("artifact_source");
  });

  it("makes lineage mandatory on every typed artifact", () => {
    const source = maulArtifactRecordSchema.parse({
      schemaVersion: "maul-artifact/v1",
      artifactId: "artifact_source",
      artifactType: "source_asset",
      lineage: {
        projectId: "project_alpha",
        canonicalJobId: "maul_job_alpha",
        runId: "run_alpha",
        rootSourceAssetId: "artifact_source",
        parentArtifactIds: [],
        sequence: 1,
        producedBy: {module: "maul-project-service", version: "1"},
        createdAt
      },
      payload: {
        originalFilename: "founder-talk.mp4",
        storageKey: "uploads/founder-talk.mp4",
        mediaType: "video/mp4",
        sha256: "a".repeat(64),
        durationMs: 120000,
        width: 1920,
        height: 1080,
        fps: 30,
        hasAudio: true,
        hasVideo: true
      }
    });

    expect(source.artifactType).toBe("source_asset");
    expect(source.lineage.rootSourceAssetId).toBe(source.artifactId);
  });

  it("requires an explicit, ordered source-to-output timestamp map", () => {
    const timeline = maulEditorialTimelinePayloadSchema.parse({
      sourceAssetId: "artifact_source",
      analysisArtifactId: "artifact_analysis",
      sourceDurationMs: 120000,
      outputDurationMs: 23000,
      selectedClipWindows: [
        {sourceStartMs: 10000, sourceEndMs: 35000}
      ],
      cutCandidates: [
        {
          sourceStartMs: 17000,
          sourceEndMs: 19000,
          sentenceSafe: true,
          reason: "non_protected_silence",
          confidence: 0.98
        }
      ],
      protectedRanges: [
        {
          sourceStartMs: 24000,
          sourceEndMs: 25000,
          kind: "rhetorical_pause",
          reason: "Preserves the payoff beat."
        }
      ],
      timestampMap: [
        {
          sourceStartMs: 10000,
          sourceEndMs: 17000,
          outputStartMs: 0,
          outputEndMs: 7000,
          mode: "keep"
        },
        {
          sourceStartMs: 17000,
          sourceEndMs: 19000,
          outputStartMs: 7000,
          outputEndMs: 7000,
          mode: "cut"
        },
        {
          sourceStartMs: 19000,
          sourceEndMs: 35000,
          outputStartMs: 7000,
          outputEndMs: 23000,
          mode: "keep"
        }
      ],
      speakerCropTracks: [],
      editRationale: ["Removed dead air without touching the rhetorical pause."],
      qualityWarnings: []
    });

    expect(timeline.timestampMap).toHaveLength(3);

    expect(() => maulEditorialTimelinePayloadSchema.parse({
      ...timeline,
      timestampMap: [
        timeline.timestampMap[2],
        timeline.timestampMap[0]
      ]
    })).toThrow();
  });

  it("requires rendered probes, all mandatory dimensions, and independent authority before quality can pass", () => {
    const base = {
      schemaVersion: "maul-quality-evidence-bundle/v1",
      sourceAssetId: "artifact_source",
      candidateArtifactId: "artifact_candidate",
      timelineArtifactId: "artifact_timeline",
      treatmentGenomeArtifactId: "artifact_treatment",
      planningBundleArtifactId: "artifact_planning_bundle",
      renderManifestArtifactId: "artifact_render_manifest",
      exportArtifactId: "artifact_export",
      replayKey: "a".repeat(64),
      evidenceStatus: "unverified",
      renderedProbeIds: [],
      mandatoryDimensions: [],
      hardFailures: [{id: "rendered_evidence_missing", dimension: "encoded_temporal_stability", message: "No probe."}],
      independentCritic: {
        authorityClass: "unavailable",
        provider: null,
        model: null,
        inferenceReceiptId: null
      },
      authenticatedHumanApprovalRequired: true,
      warnings: ["Evidence has not been collected."],
      fallbacks: [{condition: "Critic unavailable", action: "Keep export held", status: "blocking"}],
      createdAt
    } as const;

    expect(maulQualityEvidenceBundlePayloadSchema.parse(base).evidenceStatus).toBe("unverified");
    expect(() => maulQualityEvidenceBundlePayloadSchema.parse({
      ...base,
      evidenceStatus: "passed",
      hardFailures: []
    })).toThrow(/passed|rendered|dimension|critic/i);
  });

  it("requires evidence for every verified Quality Truth proof", () => {
    const proof = {
      schemaVersion: "maul-quality-truth-proof/v1",
      manifestReplayKey: "b".repeat(64),
      captionLayout: {
        status: "verified",
        evidenceId: "evidence_caption_layout",
        boxes: [
          {
            captionIndex: 0,
            leftPx: 120,
            topPx: 1440,
            rightPx: 960,
            bottomPx: 1560
          }
        ]
      },
      fontRuntime: {
        status: "eligible_loaded",
        family: "Prometheus Test Sans",
        assetId: "font_asset_test_sans",
        evidenceId: "evidence_font_loaded"
      },
      cropAndMask: {
        status: "verified",
        evidenceId: "evidence_crop_mask",
        maskingRequired: false,
        maskingStatus: "not_required",
        crops: [
          {
            outputStartMs: 0,
            outputEndMs: 1000,
            x: 0.2,
            y: 0,
            width: 0.6,
            height: 1
          }
        ]
      },
      cameraContinuity: {
        status: "verified_continuous",
        evidenceId: "evidence_camera_continuity",
        resetOutputMs: []
      },
      capabilities: [
        {
          capabilityId: "maul_caption_page_spring",
          status: "native_render_safe",
          evidenceId: "evidence_caption_spring"
        }
      ],
      fallbacks: [
        {
          planType: "dialogue_audio_plan",
          selected: true,
          evidenceId: "evidence_audio_fallback"
        }
      ]
    } as const;

    expect(maulQualityTruthProofSchema.parse(proof)).toEqual(proof);
    expect(() => maulQualityTruthProofSchema.parse({
      ...proof,
      fontRuntime: {
        ...proof.fontRuntime,
        evidenceId: null
      }
    })).toThrow(/evidence/i);
  });

  it("keeps Quality Truth status consistent with its failure list", () => {
    const blocked = {
      schemaVersion: "maul-quality-truth-result/v1",
      manifestReplayKey: "c".repeat(64),
      status: "blocked",
      evidenceIds: [],
      failures: [
        {
          code: "font_fallback_forbidden",
          field: "plans.typographyMotion.fontResolution",
          outputStartMs: null,
          outputEndMs: null,
          message: "System font fallback cannot enter the MAUL renderer.",
          evidenceId: null
        }
      ]
    } as const;

    expect(maulQualityTruthResultSchema.parse(blocked).status).toBe("blocked");
    expect(() => maulQualityTruthResultSchema.parse({
      ...blocked,
      status: "pass"
    })).toThrow(/zero failures/i);
  });

  it("supports an auditable Quality Truth evaluation event", () => {
    const event = maulAuditEventSchema.parse({
      schemaVersion: "maul-audit-event/v1",
      eventId: "event_quality_truth",
      projectId: "project_alpha",
      canonicalJobId: "maul_job_alpha",
      runId: "run_alpha",
      sequence: 3,
      type: "quality_truth_evaluated",
      artifactId: "artifact_render_manifest",
      detail: {status: "blocked"},
      createdAt
    });

    expect(event.type).toBe("quality_truth_evaluated");
  });
});

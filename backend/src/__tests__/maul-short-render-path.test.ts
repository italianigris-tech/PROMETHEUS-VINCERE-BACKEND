import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupTempDir, createTestApp, makeTempDir } from "./test-utils";

const sourceBytes = Buffer.from("maul-test-source-video");
const renderedBytes = Buffer.from("maul-rendered-mp4");

const timelineRequest = {
  transcript: {
    language: "en",
    text: "This claim matters. Here is the proof. Start now.",
    words: [
      { text: "This", startMs: 0, endMs: 250, confidence: 0.99 },
      { text: "claim", startMs: 270, endMs: 600, confidence: 0.99 },
      { text: "matters.", startMs: 620, endMs: 1050, confidence: 0.99 },
      { text: "Here", startMs: 1400, endMs: 1650, confidence: 0.99 },
      { text: "is", startMs: 1670, endMs: 1800, confidence: 0.99 },
      { text: "the", startMs: 1820, endMs: 1950, confidence: 0.99 },
      { text: "proof.", startMs: 1970, endMs: 2450, confidence: 0.99 },
      { text: "Start", startMs: 2850, endMs: 3200, confidence: 0.99 },
      { text: "now.", startMs: 3220, endMs: 3650, confidence: 0.99 },
    ],
  },
  selectedWindow: { sourceStartMs: 0, sourceEndMs: 3650 },
  vadEvidence: {
    kind: "detected_spans",
    provider: "manual_verified_vad",
    silenceSpans: [
      { sourceStartMs: 1050, sourceEndMs: 1400, confidence: 1 },
      { sourceStartMs: 2450, sourceEndMs: 2850, confidence: 1 },
    ],
  },
  speakerDetections: [],
  shots: [],
};

const validQualityTruthProofProvider = async (manifest: any) => ({
  schemaVersion: "maul-quality-truth-proof/v1",
  manifestReplayKey: manifest.replayKey,
  captionLayout: {
    status: "verified",
    evidenceId: "evidence_caption_layout",
    boxes: manifest.captions.map((_caption: unknown, captionIndex: number) => ({
      captionIndex,
      leftPx: 120,
      topPx: 1400,
      rightPx: 960,
      bottomPx: 1540,
    })),
  },
  fontRuntime: {
    status: "eligible_loaded",
    family: manifest.plans.typographyMotion.fontResolution.selectedFamily,
    assetId: manifest.plans.typographyMotion.fontResolution.selectedAssetId,
    evidenceId: "evidence_font_loaded",
  },
  cropAndMask: {
    status: "verified",
    evidenceId: "evidence_crop_mask",
    maskingRequired: false,
    maskingStatus: "not_required",
    crops: manifest.timeline.speakerCropTracks.map((track: any) => ({
      outputStartMs: track.outputStartMs,
      outputEndMs: track.outputEndMs,
      ...track.crop,
    })),
  },
  cameraContinuity: {
    status: "verified_continuous",
    evidenceId: "evidence_camera_continuity",
    resetOutputMs: [],
  },
  capabilities: [
    ...new Set([
      ...manifest.plans.capabilitySelection.selections
        .filter((entry: any) => entry.selected)
        .map((entry: any) => entry.capabilityId),
      ...manifest.plans.typographyMotion.motionPrograms.map(
        (entry: any) => entry.capabilityId,
      ),
    ]),
  ].map((capabilityId) => ({
    capabilityId,
    status: "native_render_safe",
    evidenceId: `evidence_${capabilityId}`,
  })),
  fallbacks: manifest.planExecution
    .filter((entry: any) => entry.executionStatus === "governed_fallback")
    .map((entry: any) => ({
      planType: entry.planType,
      selected: true,
      evidenceId: `evidence_fallback_${entry.planType}`,
    })),
});

describe("MAUL complete short render path", () => {
  let tempDir: string;
  let sourcePath: string;
  let musicPath: string;
  let sfxPath: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
    sourcePath = path.join(tempDir, "source.mp4");
    musicPath = path.join(tempDir, "licensed-music.wav");
    sfxPath = path.join(tempDir, "licensed-hit.wav");
    await Promise.all([
      writeFile(sourcePath, sourceBytes),
      writeFile(musicPath, "music"),
      writeFile(sfxPath, "sfx"),
    ]);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("blocks the thin baseline and holds a proven render until post-render approval", async () => {
    const renderEngine = vi.fn(async (input: any) => ({
      bytes: renderedBytes,
      sha256: createHash("sha256").update(renderedBytes).digest("hex"),
      durationMs: input.manifest.timeline.outputDurationMs,
      width: 1080,
      height: 1920,
      evidence: {
        compositionId: "MaulShort",
        renderer: "remotion",
        sourceMappingPreserved: true,
        audioMixed: true,
      },
    }));
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        maulRenderEngine: renderEngine,
        maulQualityTruthProofProvider: validQualityTruthProofProvider,
      } as any,
    });
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: {
        tenantId: "tenant_render",
        creatorId: "creator_render",
        goal: "conversion",
        platform: "youtube_shorts",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en",
        },
        treatmentPreference: "premium_direct_response",
        requestedShortCount: 3,
        requestedThumbnailCount: 4,
        targetDurationMs: { min: 3000, max: 5000 },
        source: {
          originalFilename: "source.mp4",
          storageKey: sourcePath,
          mediaType: "video/mp4",
          sha256: createHash("sha256").update(sourceBytes).digest("hex"),
          durationMs: 60000,
          width: 1920,
          height: 1080,
          fps: 30,
          hasAudio: true,
          hasVideo: true,
        },
      },
    });
    const project = projectResponse.json().project;
    const timelineResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/editorial-timeline`,
      payload: timelineRequest,
    });
    const timeline = timelineResponse.json().timeline;
    const treatmentsResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/treatments`,
      payload: { timelineArtifactId: timeline.artifactId },
    });
    const treatment = treatmentsResponse
      .json()
      .treatments.find(
        (artifact: any) =>
          artifact.payload.treatmentId === "premium_direct_response",
      );
    const candidatesResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/candidates`,
      payload: { timelineArtifactId: timeline.artifactId },
    });
    expect(candidatesResponse.statusCode).toBe(201);
    expect(candidatesResponse.json().candidates).toHaveLength(1);
    expect(candidatesResponse.json().insufficiency.missingCount).toBe(2);
    const candidate = candidatesResponse.json().candidates[0];
    expect(candidate.payload.transcriptText).toBe(
      timelineRequest.transcript.text,
    );
    expect(
      new Date(candidate.lineage.createdAt).getTime() -
        new Date(project.createdAt).getTime(),
    ).toBeLessThan(120_000);
    const planningResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/planning-bundles`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
      },
    });
    expect(planningResponse.statusCode, planningResponse.body).toBe(201);
    const planningBundle = planningResponse.json().planningBundle;
    expect(planningBundle).toMatchObject({
      artifactType: "planning_bundle",
      payload: {
        schemaVersion: "maul-planning-bundle/v1",
        rendererReadiness: "governed_with_explicit_fallbacks",
      },
    });
    expect(Object.keys(planningBundle.payload.planArtifactIds).sort()).toEqual([
      "adapterDecision",
      "artDirection",
      "audio",
      "beatMap",
      "camera",
      "candidateNarrative",
      "capabilitySelection",
      "contextAssembly",
      "observationSnapshot",
      "revision",
      "shotIntentMatrix",
      "textOpportunity",
      "typographyMotion",
      "visual",
    ]);
    const plans = planningResponse.json().plans;
    expect(
      Object.values(plans)
        .map((plan: any) => plan.artifactType)
        .sort(),
    ).toEqual([
      "adapter_decision",
      "art_direction_plan",
      "candidate_narrative",
      "capability_selection",
      "context_assembly_plan",
      "dialogue_audio_plan",
      "editorial_beat_map",
      "framing_camera_plan",
      "observation_snapshot",
      "revision_plan",
      "shot_intent_matrix",
      "text_opportunity_plan",
      "typography_motion_plan",
      "visual_plan",
    ]);
    expect(plans.artDirection.payload.explicitProhibitions).toEqual(
      expect.arrayContaining([
        "No reference-image pixels in the render.",
        "No unlicensed evidence, B-roll, music, or SFX.",
      ]),
    );
    expect(plans.contextAssembly.payload.omissionReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effect: "degraded_authority" }),
      ]),
    );
    expect(plans.shotIntentMatrix.payload.implementationSegmentsAreShots).toBe(
      false,
    );
    expect(plans.textOpportunity.payload.quotaUsed).toBe(false);
    expect(plans.revision.payload).toEqual(
      expect.objectContaining({
        criticMustBeIndependent: true,
        thresholdReductionAllowed: false,
      }),
    );
    for (const key of [
      "artDirection",
      "contextAssembly",
      "shotIntentMatrix",
      "textOpportunity",
      "revision",
    ]) {
      expect(plans[key].lineage.parentArtifactIds).toEqual(
        expect.arrayContaining([
          project.rootSourceAssetId,
          timeline.artifactId,
          candidate.artifactId,
          treatment.artifactId,
        ]),
      );
      expect(planningBundle.lineage.parentArtifactIds).toContain(
        plans[key].artifactId,
      );
    }

    const forgedManifest = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/artifacts`,
      payload: {
        artifactType: "render_manifest",
        parentArtifactIds: [planningBundle.artifactId],
        payload: {},
      },
    });
    expect(forgedManifest.statusCode).toBe(409);
    expect(forgedManifest.json().error).toMatch(
      /manual|manifest compiler|governed runtime/i,
    );

    const beforeReview = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/renders`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewDecisionArtifactId: "missing_review",
        musicTrack: licensedMusicTrack(),
        sfxAssets: [licensedSfx()],
      },
    });
    expect(beforeReview.statusCode).toBeGreaterThanOrEqual(400);

    const reviewResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/reviews`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewerId: "reviewer_human",
        decision: "approved",
        failureClasses: [],
        rationale: "Source-grounded, legible, and ready.",
        rubricScores: {
          editorial_clarity: 96,
          source_fidelity: 100,
          pacing_fit: 92,
          visual_hierarchy: 94,
          accessibility: 96,
        },
      },
    });
    expect(reviewResponse.statusCode).toBe(201);
    const review = reviewResponse.json().review;

    const blockedRenderEngine = vi.fn(async () => {
      throw new Error("Quality Truth must block before renderer invocation.");
    });
    const blockedContext = await createTestApp({
      storageDir: tempDir,
      deps: {maulRenderEngine: blockedRenderEngine} as any,
    });
    const blockedRender = await blockedContext.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/renders`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        musicTrack: licensedMusicTrack(),
        sfxAssets: [licensedSfx()],
      },
    });
    expect(blockedRender.statusCode).toBe(409);
    expect(blockedRender.json().error).toMatch(/quality truth/i);
    expect(blockedRenderEngine).not.toHaveBeenCalled();
    const blockedAudit = await blockedContext.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/audit`,
      headers: {
        "x-maul-tenant-id": "tenant_render",
        "x-maul-creator-id": "creator_render",
      },
    });
    expect(blockedAudit.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "quality_truth_evaluated",
          detail: expect.objectContaining({
            status: "blocked",
            failures: expect.arrayContaining([
              expect.objectContaining({code: "font_fallback_forbidden"}),
              expect.objectContaining({code: "caption_bounds_unverified"}),
            ]),
          }),
        }),
      ]),
    );
    await blockedContext.app.close();

    const unavailableRenderEngine = vi.fn(async () => {
      throw new Error("Unavailable proof must block before renderer invocation.");
    });
    const unavailableContext = await createTestApp({
      storageDir: tempDir,
      deps: {
        maulRenderEngine: unavailableRenderEngine,
        maulQualityTruthProofProvider: async () => {
          throw new Error("runtime proof bridge unavailable");
        },
      } as any,
    });
    const unavailableRender = await unavailableContext.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/renders`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        musicTrack: licensedMusicTrack(),
        sfxAssets: [licensedSfx()],
      },
    });
    expect(unavailableRender.statusCode).toBe(409);
    expect(unavailableRender.json().error).toMatch(/proof_unavailable/i);
    expect(unavailableRenderEngine).not.toHaveBeenCalled();
    const unavailableAudit = await unavailableContext.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/audit`,
      headers: {
        "x-maul-tenant-id": "tenant_render",
        "x-maul-creator-id": "creator_render",
      },
    });
    expect(unavailableAudit.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "quality_truth_evaluated",
          detail: expect.objectContaining({
            status: "blocked",
            failures: [expect.objectContaining({code: "proof_unavailable"})],
          }),
        }),
      ]),
    );
    await unavailableContext.app.close();

    const typographyPlanPath = path.join(
      tempDir,
      "maul",
      "projects",
      project.id,
      "artifacts",
      `${plans.typographyMotion.artifactId}.json`,
    );
    const typographyPlan = JSON.parse(
      await readFile(typographyPlanPath, "utf8"),
    );
    typographyPlan.payload.fontResolution = {
      requestedRole: "utility",
      selectedFamily: "Prometheus Test Sans",
      selectedAssetId: "font_asset_test_sans",
      status: "eligible_loaded",
      reason: "Integration fixture stages a loaded export-safe font.",
    };
    await writeFile(
      typographyPlanPath,
      `${JSON.stringify(typographyPlan, null, 2)}\n`,
      "utf8",
    );

    const renderResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/renders`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        musicTrack: licensedMusicTrack(),
        sfxAssets: [licensedSfx()],
      },
    });
    expect(renderResponse.statusCode).toBe(201);
    expect(renderEngine).toHaveBeenCalledOnce();
    const renderInput = renderEngine.mock.calls[0]?.[0];
    expect(Object.keys(renderInput).sort()).toEqual(["manifest", "workRoot"]);
    expect(renderInput.manifest).toEqual(
      expect.objectContaining({
        schemaVersion: "maul-unified-short-render-manifest/v1",
        rendererInputKind: "unified_short_render_manifest_only",
        planningBundleArtifactId: planningBundle.artifactId,
        output: { width: 1080, height: 1920, fps: 30, codec: "h264" },
        audio: expect.objectContaining({ planMode: "render_ready" }),
      }),
    );
    expect(renderInput.manifest.planExecution).toHaveLength(14);
    expect(renderInput.manifest.planExecution).toSatisfy(
      (entries: Array<{ executionStatus: string }>) =>
        entries.every(
          (entry) =>
            entry.executionStatus === "native" ||
            entry.executionStatus === "governed_fallback",
        ),
    );
    const exported = renderResponse.json().export;
    expect(exported.artifactType).toBe("export_artifact");
    expect(exported.payload.renderManifestArtifactId).toMatch(
      /^maul_artifact_/,
    );
    expect(exported.payload.evidence).toEqual(
      expect.objectContaining({
        technicalValidationPassed: true,
        rightsVerified: true,
        preRenderReviewPassed: true,
        remotionCompositionId: "MaulShort",
      }),
    );
    expect(exported.payload.evidence.qualityGate).toEqual(
      expect.objectContaining({
        status: "unverified",
        releaseEligible: false,
        implementationLabel: "encoded-output-verified",
        renderedEvidenceArtifactId: null,
        postRenderHumanApprovalArtifactId: null,
        hardFailures: expect.arrayContaining([
          expect.objectContaining({ id: "rendered_quality_evidence_missing" }),
          expect.objectContaining({ id: "post_render_human_approval_missing" }),
        ]),
      }),
    );
    expect(exported.payload.evidence).not.toHaveProperty(
      "aestheticSoundnessPassed",
    );
    const forgedRelease = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/artifacts`,
      payload: {
        artifactType: "export_artifact",
        parentArtifactIds: [
          project.rootSourceAssetId,
          candidate.artifactId,
          timeline.artifactId,
          treatment.artifactId,
          review.artifactId,
        ],
        payload: {
          sourceAssetId: project.rootSourceAssetId,
          candidateArtifactId: candidate.artifactId,
          timelineArtifactId: timeline.artifactId,
          treatmentGenomeArtifactId: treatment.artifactId,
          planningBundleArtifactId: planningBundle.artifactId,
          reviewDecisionArtifactId: review.artifactId,
          storageKey: "external://forged-release.mp4",
          mediaType: "video/mp4",
          sha256: "f".repeat(64),
          durationMs: 3650,
          width: 1080,
          height: 1920,
          evidence: {
            technicalValidationPassed: true,
            rightsVerified: true,
            deterministicReplayKey: "forged-release",
            preRenderReviewPassed: true,
            qualityGate: {
              status: "passed",
              releaseEligible: true,
              implementationLabel: "human-approved",
              renderedEvidenceArtifactId: review.artifactId,
              postRenderHumanApprovalArtifactId: review.artifactId,
              hardFailures: [],
            },
            warnings: [],
          },
        },
      },
    });
    expect(forgedRelease.statusCode).toBe(409);
    expect(forgedRelease.json().error).toMatch(
      /manual|quality gate|release authority/i,
    );

    const download = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/exports/${exported.artifactId}/file`,
      headers: {
        "x-maul-tenant-id": "tenant_render",
        "x-maul-creator-id": "creator_render",
      },
    });
    expect(download.statusCode).toBe(409);
    expect(download.json().error).toMatch(/quality evidence|release gate/i);

    const audit = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/audit`,
      headers: {
        "x-maul-tenant-id": "tenant_render",
        "x-maul-creator-id": "creator_render",
      },
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "project_created" }),
        expect.objectContaining({
          type: "artifact_registered",
          artifactId: exported.artifactId,
        }),
        expect.objectContaining({
          type: "quality_truth_evaluated",
          detail: expect.objectContaining({
            status: "pass",
            evidenceIds: expect.arrayContaining([
              "evidence_caption_layout",
              "evidence_font_loaded",
            ]),
          }),
        }),
      ]),
    );

    const crossTenantDownload = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/exports/${exported.artifactId}/file`,
      headers: {
        "x-maul-tenant-id": "tenant_other",
        "x-maul-creator-id": "creator_render",
      },
    });
    expect(crossTenantDownload.statusCode).toBe(403);

    const unsafe = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/renders`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        musicTrack: { ...licensedMusicTrack(), licenseVerified: false },
        sfxAssets: [licensedSfx()],
      },
    });
    expect(unsafe.statusCode).toBeGreaterThanOrEqual(400);
    expect(unsafe.json().error).toMatch(/licensed|export-safe|verified/i);
    expect(renderEngine).toHaveBeenCalledOnce();

    await context.app.close();
  }, 60_000);

  const licensedMusicTrack = () => ({
    id: "music_licensed",
    title: "Licensed Bed",
    artist: "MAUL Library",
    storagePath: musicPath,
    licenseType: "commercial_subscription",
    commercialAllowed: true,
    licenseVerified: true,
    renderSafe: true,
    durationSec: 60,
  });

  const licensedSfx = () => ({
    id: "sfx_licensed",
    eventType: "resolve_hit",
    storagePath: sfxPath,
    sourceMs: 3000,
    licenseType: "commercial_subscription",
    commercialAllowed: true,
    licenseVerified: true,
    renderSafe: true,
  });
});

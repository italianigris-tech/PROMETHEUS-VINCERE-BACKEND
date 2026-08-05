import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { materializeShortsTextChunkProposal } from "../maul/shorts-text-chunking";
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
      { text: "Start", startMs: 3650, endMs: 4000, confidence: 0.99 },
      { text: "now.", startMs: 4020, endMs: 4450, confidence: 0.99 },
    ],
  },
  selectedWindow: { sourceStartMs: 0, sourceEndMs: 4450 },
  vadEvidence: {
    kind: "detected_spans",
    provider: "manual_verified_vad",
    silenceSpans: [
      { sourceStartMs: 1050, sourceEndMs: 1400, confidence: 1 },
      { sourceStartMs: 2450, sourceEndMs: 3650, confidence: 1 },
    ],
  },
  speakerDetections: [],
  shots: [],
};

const validQualityTruthProofProvider = async (manifest: any) => {
  const common = {
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
  };
  if (manifest.schemaVersion === "maul-unified-short-render-manifest/v2") {
    const selectedCompositions = manifest.plans.textPlacement.segments.map(
      (segment: any) =>
        manifest.plans.textPlacement.compositionIntervals.find(
          (interval: any) =>
            interval.variantId === segment.selectedCompositionVariantId &&
            interval.transformHash === segment.selectedTransformHash &&
            interval.sceneId === segment.sceneId &&
            interval.discontinuityId === segment.discontinuityId &&
            interval.outputStartMs <= segment.outputStartMs &&
            interval.outputEndMs >= segment.outputEndMs,
        ),
    );
    return {
      schemaVersion: "maul-quality-truth-proof/v2",
      ...common,
      cropAndMask: {
        status: "verified",
        evidenceId: "evidence_crop_mask",
        maskingRequired: false,
        maskingStatus: "not_required",
        crops: selectedCompositions
          .filter(
            (composition: any, index: number, all: any[]) =>
              composition &&
              all.findIndex(
                (candidate) =>
                  candidate?.intervalId === composition.intervalId,
              ) === index,
          )
          .map((composition: any) => ({
            outputStartMs: composition.outputStartMs,
            outputEndMs: composition.outputEndMs,
            ...composition.crop,
          })),
      },
      placementSegments: manifest.plans.textPlacement.segments.map(
        (segment: any, index: number) => {
          const composition = selectedCompositions[index];
          const envelope = segment.maximumEnvelope;
          return {
            status: "verified",
            evidenceId: `evidence_placement_${segment.segmentId}`,
            textPlacementPlanArtifactId:
              manifest.planArtifactIds.textPlacement,
            placementSegmentId: segment.segmentId,
            compositionIntervalId: composition.intervalId,
            compositionVariantId: segment.selectedCompositionVariantId,
            compositionTransformHash: segment.selectedTransformHash,
            compatibilityProfileId: segment.compatibility.profileId,
            metricsFingerprint: segment.compatibility.metricsFingerprint,
            exactFontAssetId:
              manifest.plans.typographyMotion.fontResolution.selectedAssetId,
            compiledLegibilityPrimitive: segment.minimumLegibilityPrimitive,
            measuredBox: {
              leftPx: envelope.x * manifest.output.width + 1,
              topPx: envelope.y * manifest.output.height + 1,
              rightPx:
                (envelope.x + envelope.width) * manifest.output.width - 1,
              bottomPx:
                (envelope.y + envelope.height) * manifest.output.height - 1,
            },
          };
        },
      ),
    };
  }
  return {
    schemaVersion: "maul-quality-truth-proof/v1",
    ...common,
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
  };
};

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
    const textChunkPlanner = {
      plan: vi.fn(async (request: any) =>
        materializeShortsTextChunkProposal({
          request,
          proposal: {
            schemaVersion: "maul-shorts-text-chunk-proposal/v1",
            chunks: [
              {
                startWordIndex: 0,
                endWordIndex: 4,
                semanticRole: "hook",
                emphasisWordIndices: [1],
                emphasisLevel: "hero",
              },
              {
                startWordIndex: 5,
                endWordIndex: 8,
                semanticRole: "payoff",
                emphasisWordIndices: [6, 8],
                emphasisLevel: "hero",
              },
            ],
          },
          inference: {
            status: "invoked",
            provider: "openai_compatible",
            baseUrl: "https://codex-everywhere.com",
            model: "gpt-5.6-terra",
            requestHash: "a".repeat(64),
            responseHash: "b".repeat(64),
            fallbackReason: null,
          },
        }),
      ),
    };
    const creativeTreatmentPlanner = {
      plan: vi.fn(async () => ({
        status: 'invoked',
        treatment: {
          schemaVersion: 'maul-creative-treatment-proposal/v1',
          profileId: 'aspire_visual_hook',
          compositionDirection: 'subject_integrated',
          primaryTypeRole: 'neutral_grotesk',
          accentTypeRole: 'editorial_italic',
          palette: {
            primary: '#F7F3EA',
            accent: '#F06424',
            sourceTreatment: 'dark_warm_cool_contrast',
          },
          textDensity: 'medium',
          emphasisMode: 'selective_accent_phrase',
          motionMode: 'restrained_phrase_lockup',
          rationale: ['Keep the speaker dominant.'],
        },
        receipt: {
          provider: 'openai_compatible',
          model: 'gpt-5.6-terra',
          reasoningEffort: 'high',
          requestHash: 'd'.repeat(64),
          responseHash: 'e'.repeat(64),
          inferenceReceiptId: 'maul_creative_fixture',
          fallbackReason: null,
        },
      })),
    };
    const renderEngine = vi.fn(async (input: any) => ({
      bytes: renderedBytes,
      sha256: createHash("sha256").update(renderedBytes).digest("hex"),
      durationMs: input.manifest.timeline.outputDurationMs,
      width: input.renderMode === "preview" ? 540 : 1080,
      height: input.renderMode === "preview" ? 960 : 1920,
      evidence: {
        compositionId: "MaulShort",
        renderer: "remotion",
        sourceMappingPreserved: true,
        audioMixed: true,
      },
      frameSamples: input.renderMode === "preview"
        ? [{
            outputMs: 900,
            bytes: Buffer.from("rendered-frame-pixels"),
            sha256: createHash("sha256")
              .update("rendered-frame-pixels")
              .digest("hex"),
            contentType: "image/png",
          }]
        : [],
    }));
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        maulRenderEngine: renderEngine,
        maulQualityTruthProofProvider: validQualityTruthProofProvider,
        maulTextChunkPlanner: textChunkPlanner,
        maulCreativeTreatmentPlanner: creativeTreatmentPlanner,
        maulSceneEvidenceProvider: {
          inspect: vi.fn(async ({beats}: any) => ({
            status: "available",
            providerId: "fixture_scene_evidence",
            providerVersion: "v1",
            holds: [{
              beatId: beats[0].beatId,
              sceneId: "fixture_scene",
              discontinuityId: "fixture_discontinuity",
              outputStartMs: 0,
              outputEndMs: 3250,
              sourceFrameIds: ["fixture_frame"],
              subject: {
                trackingState: "tracked",
                box: {x: 0.08, y: 0.08, width: 0.32, height: 0.72},
              },
              existingTextRegions: [],
              opportunities: [{
                regionId: "fixture_negative_space",
                box: {x: 0.52, y: 0.18, width: 0.38, height: 0.22},
                negativeSpace: 0.92,
                readability: 0.9,
                clutter: 0.08,
                faceInterference: 0,
                temporalStability: 0.94,
              }],
            }],
          })),
        },
        maulPerceptualTruthProvider: {
          evaluate: vi.fn(async ({preview}: any) => ({
            status: "pass",
            failureLabels: [],
            evidenceIds: preview.frameSamples.map((frame: any) => frame.frameId),
            receipt: {
              authorityClass: "invoked_model",
              provider: "fixture_vision_critic",
              model: "fixture-v1",
              inferenceReceiptId: "fixture_receipt",
            },
          })),
        },
        maulTypographyProvider: {
          plan: vi.fn(async ({chunks}: any) => ({
            status: "available",
            profile: {
              profileId: "maul-measured-playfair-editorial-v1",
              family: "Playfair Display",
              approvedFontAssets: [{
                assetId: "font_google_playfair_display_700",
                family: "Playfair Display",
                weights: [400, 700, 900],
              }],
              loadedFallback: {
                assetId: "font_google_playfair_display_700",
                family: "Playfair Display",
                weight: 700,
              },
              metrics: {
                fingerprint: "c".repeat(64),
                maxGlyphWidthEm: 0.82,
                maxLineHeightEm: 1.18,
                minimumFontSizePx: 48,
                maximumFontSizePx: 88,
                minimumLineHeight: 1,
                maximumLineHeight: 1.2,
              },
            },
            fontResolution: {
              requestedRole: "editorial",
              selectedFamily: "Playfair Display",
              selectedAssetId: "font_google_playfair_display_700",
              status: "eligible_loaded",
              reason: "Fixture measurement provider proved Playfair Display.",
            },
            layouts: chunks.map((chunk: any) => ({
              chunkId: chunk.chunkId,
              fontSizePx: 72,
              lines: [{
                text: chunk.text,
                widthPx: 360,
                measurementId: `measurement_${chunk.chunkId}`,
              }],
              measurementIds: [`measurement_${chunk.chunkId}`],
            })),
            evidenceIds: chunks.map((chunk: any) => `measurement_${chunk.chunkId}`),
          })),
        },
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
    expect(textChunkPlanner.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        videoDurationMs: 3250,
        transcript: expect.objectContaining({
          words: expect.arrayContaining([
            expect.objectContaining({
              text: "Start",
              startMs: 2450,
              endMs: 2800,
            }),
            expect.objectContaining({
              text: "now.",
              startMs: 2820,
              endMs: 3250,
            }),
          ]),
        }),
      }),
    );
    expect(planningBundle).toMatchObject({
      artifactType: "planning_bundle",
      payload: {
        schemaVersion: "maul-planning-bundle/v3",
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
      "textAnimation",
      "textChunk",
      "textOpportunity",
      "textPlacement",
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
      "text_animation_plan",
      "text_chunk_plan",
      "text_opportunity_plan",
      "text_placement_plan",
      "typography_motion_plan",
      "visual_plan",
    ]);
    expect(plans.artDirection.payload.explicitProhibitions).toEqual(
      expect.arrayContaining([
        "No reference-image pixels in the render.",
        "No unlicensed evidence, B-roll, music, or SFX.",
      ]),
    );
    expect(plans.artDirection.payload.authorityReceipt).toMatchObject({
      directorId: "joseph",
      version: "maul-joseph-editorial-director/v1",
      doctrineId: expect.any(String),
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(creativeTreatmentPlanner.plan).toHaveBeenCalledOnce();
    expect(plans.artDirection.payload.creativeTreatment).toMatchObject({
      profileId: 'aspire_visual_hook',
      compositionDirection: 'subject_integrated',
      primaryTypeRole: 'neutral_grotesk',
      accentTypeRole: 'editorial_italic',
      palette: {primary: '#F7F3EA', accent: '#F06424'},
    });
    expect(plans.artDirection.payload.creativeTreatmentInference).toMatchObject({
      status: 'invoked',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
      inferenceReceiptId: 'maul_creative_fixture',
    });
    expect(plans.artDirection.payload.visualBeats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({startMs: 0, purpose: "HOOK"}),
      ]),
    );
    expect(plans.artDirection.payload.sceneEvidence).toEqual({
      status: "available",
      providerId: "fixture_scene_evidence",
      holdCount: 1,
      reason: null,
    });
    expect(plans.contextAssembly.payload.omissionReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effect: "degraded_authority" }),
      ]),
    );
    expect(plans.shotIntentMatrix.payload.implementationSegmentsAreShots).toBe(
      false,
    );
    expect(plans.textOpportunity.payload.quotaUsed).toBe(false);
    expect(plans.textChunk.payload).toMatchObject({
      strategy: "llm_assisted",
      schemaVersion: "maul-shorts-text-chunk-plan/v2",
      inference: {
        status: "invoked",
        baseUrl: "https://codex-everywhere.com",
        model: "gpt-5.6-terra",
      },
    });
    expect(plans.textChunk.payload.tokens).toHaveLength(
      timelineRequest.transcript.words.length,
    );
    expect(plans.textChunk.payload.tokens.map((token: any) => token.transcriptWordIndex)).toEqual(
      timelineRequest.transcript.words.map((_word, index) => index),
    );
    expect(plans.textPlacement.payload.status).toBe("planned");
    expect(plans.textPlacement.payload.segments.length).toBeGreaterThan(0);
    expect(plans.typographyMotion.payload).toMatchObject({
      schemaVersion: "maul-typography-motion-plan/v3",
      textChunkPlanArtifactId: plans.textChunk.artifactId,
      textPlacementPlanArtifactId: plans.textPlacement.artifactId,
      textAnimationPlanArtifactId: plans.textAnimation.artifactId,
      fontResolution: {
        selectedFamily: "Playfair Display",
        selectedAssetId: "font_google_playfair_display_700",
        status: "eligible_loaded",
      },
    });
    expect(plans.typographyMotion.payload.authority).toMatchObject({
      authorityClass: "deterministic",
    });
    expect(plans.textAnimation.payload).toMatchObject({
      schemaVersion: "maul-text-animation-plan/v1",
      treatmentGenomeArtifactId: treatment.artifactId,
      textChunkPlanArtifactId: plans.textChunk.artifactId,
      textPlacementPlanArtifactId: plans.textPlacement.artifactId,
    });
    expect(
      plans.textChunk.payload.chunks
        .map((chunk: any) => chunk.text)
        .join(" "),
    ).toBe(timelineRequest.transcript.text);
    expect(plans.typographyMotion.payload.captionGroups).toEqual([
      {
        text: "This claim matters. Here is",
        outputStartMs: 0,
        outputEndMs: 1800,
        sourceGrounded: true,
        role: "dialogue_caption",
      },
      {
        text: "the proof. Start now.",
        outputStartMs: 1820,
        outputEndMs: 3250,
        sourceGrounded: true,
        role: "dialogue_caption",
      },
    ]);
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
      "textChunk",
      "textPlacement",
      "textAnimation",
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
    for (const key of ["textChunk", "textPlacement", "textAnimation", "camera", "audio"]) {
      expect(plans[key].lineage.parentArtifactIds).toContain(
        plans.artDirection.artifactId,
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
    for (const artifactType of [
      "text_chunk_plan",
      "text_placement_plan",
      "text_animation_plan",
    ]) {
      const forgedPlan = await context.app.inject({
        method: "POST",
        url: `/api/maul/projects/${project.id}/artifacts`,
        payload: {artifactType, parentArtifactIds: [], payload: {}},
      });
      expect(forgedPlan.statusCode).toBe(409);
      expect(forgedPlan.json().error).toMatch(/manual|governed runtime/i);
    }

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

    const prematureReview = await context.app.inject({
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
    expect(prematureReview.statusCode).toBe(409);
    expect(prematureReview.json().error).toMatch(/perceptual truth/i);

    const previewResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/previews`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        musicTrack: licensedMusicTrack(),
        sfxAssets: [licensedSfx()],
      },
    });
    expect(previewResponse.statusCode, previewResponse.body).toBe(201);
    expect(previewResponse.json().preview.payload).toMatchObject({
      width: 540,
      height: 960,
      frameSamples: [expect.objectContaining({mediaType: "image/png"})],
    });
    expect(previewResponse.json().perceptualTruth.payload).toMatchObject({
      status: "pass",
      placementOutcome: "ART_DIRECTED",
      failureLabels: [],
    });

    const preview = previewResponse.json().preview;
    const previewFile = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/previews/${preview.artifactId}/file`,
    });
    expect(previewFile.statusCode).toBe(200);
    expect(previewFile.headers["content-type"]).toContain("video/mp4");
    expect(previewFile.body).toBe(renderedBytes.toString());

    const frameId = preview.payload.frameSamples[0].frameId;
    const previewFrame = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/previews/${preview.artifactId}/frames/${frameId}`,
    });
    expect(previewFrame.statusCode).toBe(200);
    expect(previewFrame.headers["content-type"]).toContain("image/png");
    expect(previewFrame.body).toBe("rendered-frame-pixels");

    const visualDirection = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/visual-direction?candidateArtifactId=${candidate.artifactId}`,
    });
    expect(visualDirection.statusCode).toBe(200);
    expect(visualDirection.json()).toMatchObject({
      outcome: "ART_DIRECTED",
      reviewState: "awaiting_human_review",
      preview: expect.objectContaining({artifactId: preview.artifactId}),
      perceptualTruth: expect.objectContaining({
        artifactId: previewResponse.json().perceptualTruth.artifactId,
      }),
    });

    const reviewResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/reviews`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        perceptualTruthArtifactId:
          previewResponse.json().perceptualTruth.artifactId,
        reviewerId: "reviewer_human",
        decision: "approved",
        failureClasses: [],
        rationale: "Rendered-frame evidence is coherent and intentional.",
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

    const textChunkPlanPath = path.join(
      tempDir,
      "maul",
      "projects",
      project.id,
      "artifacts",
      `${plans.textChunk.artifactId}.json`,
    );
    const textChunkPlanRecord = JSON.parse(
      await readFile(textChunkPlanPath, "utf8"),
    );
    const originalTextChunkPlanRecord = JSON.stringify(textChunkPlanRecord, null, 2);
    textChunkPlanRecord.payload.warnings = ["Mutated after reference hash capture."];
    await writeFile(
      textChunkPlanPath,
      `${JSON.stringify(textChunkPlanRecord, null, 2)}\n`,
      "utf8",
    );

    const staleRender = await context.app.inject({
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
    expect(staleRender.statusCode).toBe(409);
    expect(staleRender.json().error).toMatch(/hash|stale|mismatch/i);
    expect(renderEngine).toHaveBeenCalledOnce();
    await writeFile(textChunkPlanPath, `${originalTextChunkPlanRecord}\n`, "utf8");

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
    expect(renderResponse.statusCode, renderResponse.body).toBe(201);
    expect(renderEngine).toHaveBeenCalledTimes(2);
    const renderInput = renderEngine.mock.calls[1]?.[0];
    expect(Object.keys(renderInput).sort()).toEqual(["manifest", "renderMode", "workRoot"]);
    expect(renderInput.renderMode).toBe("final");
    expect(renderInput.manifest).toEqual(
      expect.objectContaining({
        schemaVersion: "maul-unified-short-render-manifest/v3",
        rendererInputKind: "unified_short_render_manifest_only",
        planningBundleArtifactId: planningBundle.artifactId,
        output: { width: 1080, height: 1920, fps: 30, codec: "h264" },
        audio: expect.objectContaining({ planMode: "render_ready" }),
      }),
    );
    expect(renderInput.manifest.planExecution).toHaveLength(17);
    expect(renderInput.manifest.planExecution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({planType: "text_chunk_plan", nativeBranch: "MaulPlannedTextLayer.stableTokens"}),
        expect.objectContaining({planType: "text_placement_plan", nativeBranch: "MaulPlannedTextLayer.exactPlacement"}),
        expect.objectContaining({planType: "text_animation_plan", nativeBranch: "MaulPlannedTextLayer.governedTransforms"}),
      ]),
    );
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
        status: "passed",
        releaseEligible: true,
        implementationLabel: "human-approved",
        renderedEvidenceArtifactId: previewResponse.json().preview.artifactId,
        perceptualTruthArtifactId:
          previewResponse.json().perceptualTruth.artifactId,
        placementOutcome: "ART_DIRECTED",
        postRenderHumanApprovalArtifactId: review.artifactId,
        hardFailures: [],
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
          durationMs: 3250,
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
    expect(download.statusCode).toBe(200);

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
          type: "perceptual_truth_evaluated",
          artifactId: previewResponse.json().perceptualTruth.artifactId,
          detail: expect.objectContaining({
            status: "pass",
            placementOutcome: "ART_DIRECTED",
          }),
        }),
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
    expect(renderEngine).toHaveBeenCalledTimes(2);

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

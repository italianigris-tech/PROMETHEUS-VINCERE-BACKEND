import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupTempDir, createTestApp, makeTempDir } from "./test-utils";

const sourceBytes = Buffer.from("maul-planner-authority-source");

const supportedSourceProfile = {
  mode: "single_speaker_talking_head",
  principalSpeakerCount: 1,
  primaryLanguage: "en",
};

const projectPayload = (sourcePath: string) => ({
  tenantId: "tenant_authority",
  creatorId: "creator_authority",
  goal: "clarity",
  platform: "youtube_shorts",
  treatmentPreference: "minimal_expert",
  requestedShortCount: 1,
  requestedThumbnailCount: 3,
  targetDurationMs: { min: 2000, max: 5000 },
  sourceProfile: supportedSourceProfile,
  source: {
    originalFilename: "authority-source.mp4",
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
});

const timelineRequest = {
  transcript: {
    language: "en",
    text: "Meaning comes first. Motion follows meaning.",
    words: [
      { text: "Meaning", startMs: 0, endMs: 300, confidence: 0.99 },
      { text: "comes", startMs: 320, endMs: 560, confidence: 0.99 },
      { text: "first.", startMs: 580, endMs: 950, confidence: 0.99 },
      { text: "Motion", startMs: 1250, endMs: 1550, confidence: 0.99 },
      { text: "follows", startMs: 1570, endMs: 1900, confidence: 0.99 },
      { text: "meaning.", startMs: 1920, endMs: 2400, confidence: 0.99 },
    ],
  },
  selectedWindow: { sourceStartMs: 0, sourceEndMs: 2400 },
  vadEvidence: {
    kind: "detected_spans",
    provider: "manual_verified_vad",
    silenceSpans: [{ sourceStartMs: 950, sourceEndMs: 1250, confidence: 1 }],
  },
  speakerDetections: [],
  shots: [],
};

describe("MAUL planner authority and S4 source-scope truth", () => {
  let tempDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
    sourcePath = path.join(tempDir, "authority-source.mp4");
    await writeFile(sourcePath, sourceBytes);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("publishes the V1 source scope and derived-only S4-to-elite contract", async () => {
    const context = await createTestApp({ storageDir: tempDir });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/maul/contracts",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: "maul-runtime-contracts/v1",
      sourceScope: {
        schemaVersion: "maul-v1-source-scope/v1",
        acceptedModes: [
          "single_speaker_talking_head",
          "single_speaker_podcast",
        ],
        supportedPrimaryLanguages: ["en"],
        principalSpeakerCount: 1,
        unsupportedOutcome: "reject_before_upload",
      },
      s4: {
        schemaVersion: "maul-s4-release-contract/v1",
        displayLabel: "S4",
        goldenCorpusTier: "elite",
        derivedOnly: true,
        goodOrNoExport: true,
        technicalSuccessIsQualitySuccess: false,
        zeroErrorsPromise: false,
        minimumWeightedScore: 85,
        requiresAuthenticatedPostRenderHumanApproval: true,
      },
      plannerAuthority: {
        maulLiveEditorialAuthority: "deterministic",
        textChunkingAuthority:
          "model_assisted_with_deterministic_validation_and_fallback",
        textChunkingDecisionScope:
          "semantic_boundaries_roles_and_emphasis_only",
        configuredRouteIsInvocation: false,
        inferenceReceiptRequiredForModelAuthority: true,
        currentVisualPlanningAuthority: "unavailable",
        textPlacementAuthority: "deterministic_placement_planner",
        rendererHandoffAuthority: "manifest_compiler",
      },
    });
    expect(response.json().s4.mandatoryDimensions).toHaveLength(11);
    expect(response.json().s4.hardFailureIds).toContain(
      "mandatory_dependency_unverified",
    );

    await context.app.close();
  });

  it("rejects excluded source modes before creating a project", async () => {
    const context = await createTestApp({ storageDir: tempDir });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: {
        ...projectPayload(sourcePath),
        sourceProfile: {
          mode: "multi_speaker_panel",
          principalSpeakerCount: 3,
          primaryLanguage: "en",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(
      /V1 Source Scope|one principal speaker|talking-head|podcast/i,
    );

    await context.app.close();
  });

  it("records deterministic authority and configured-but-not-invoked model routes per run", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        GROQ_API_KEY: "configured-for-authority-test",
        GROQ_MODEL: "llama-3.3-70b-versatile",
        OPENAI_API_KEY: "configured-for-authority-test",
        CRITIC_MODEL: "gpt-5.5",
        OCULAR_MODEL: "future-ocular-adapter",
      },
    });
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload(sourcePath),
    });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json().project;
    expect(project.intake.sourceProfile).toMatchObject({
      ...supportedSourceProfile,
      suitabilityStatus: "declared_in_scope_pending_analysis",
    });

    const timelineResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/editorial-timeline`,
      payload: timelineRequest,
    });
    expect(timelineResponse.statusCode).toBe(201);
    const timeline = timelineResponse.json().timeline;

    const candidateResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/candidates`,
      payload: { timelineArtifactId: timeline.artifactId },
    });
    expect(candidateResponse.statusCode, candidateResponse.body).toBe(201);
    expect(candidateResponse.json().plannerAudit).toMatchObject({
      artifactType: "planner_audit",
      payload: {
        schemaVersion: "maul-planner-audit/v1",
        summary: {
          liveEditorialAuthority: "deterministic",
          modelInvocationCount: 0,
          fakeInferenceLabelsBlocked: true,
        },
      },
    });

    const entries = candidateResponse.json().plannerAudit.payload.entries;
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageId: "maul_candidate_scoring",
          authorityClass: "deterministic",
          executed: true,
          inferenceReceipt: null,
        }),
        expect.objectContaining({
          stageId: "configured_primary_generation",
          authorityClass: "configured_not_invoked",
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          executed: false,
          inferenceReceipt: null,
        }),
        expect.objectContaining({
          stageId: "configured_cinematic_critic",
          authorityClass: "configured_not_invoked",
          provider: "openai",
          model: "gpt-5.5",
          executed: false,
          inferenceReceipt: null,
        }),
        expect.objectContaining({
          stageId: "ocular_visual_planning",
          authorityClass: "unavailable",
          executed: false,
          inferenceReceipt: null,
        }),
      ]),
    );

    await context.app.close();
  }, 15_000);
});

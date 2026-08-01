import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  buildMultipartBody,
  cleanupTempDir,
  createTestApp,
  makeTempDir
} from "./test-utils";

const projectPayload = {
  creatorId: "creator_reference",
  goal: "retention",
  platform: "instagram_reels",
  sourceProfile: {
    mode: "single_speaker_talking_head",
    principalSpeakerCount: 1,
    primaryLanguage: "en"
  },
  treatmentPreference: "founder_podcast",
  source: {
    originalFilename: "source.mp4",
    storageKey: "uploads/source.mp4",
    mediaType: "video/mp4",
    sha256: "a".repeat(64),
    durationMs: 120000,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: true,
    hasVideo: true
  }
};

const referenceMetadata = {
  source: {
    kind: "url",
    url: "https://example.com/reference/founder-edit"
  },
  rightsStatus: "publicly_analysable",
  attribution: "Internal provenance only",
  media: {
    mediaType: "video",
    durationMs: 42000,
    platform: "instagram",
    language: "en",
    sourceQuality: "high"
  },
  annotations: {
    hook: ["Contrarian claim in the first sentence"],
    escalation: ["A concrete mistake raises stakes"],
    proof: ["Speaker gives a source-grounded example"],
    reveal: [],
    payoff: ["The solution resolves the opening tension"],
    cta: [],
    pauseBehavior: ["Short rhetorical pause before payoff"]
  },
  observedTraits: {
    pacing: ["fast sentence-safe cuts"],
    framing: ["tight principal-speaker crop"],
    captions: ["two-line sentence case"],
    typography: ["bold sans hierarchy"],
    color: ["neutral with one warm accent"],
    motion: ["modest punch-ins"],
    bRoll: ["proof-only inserts"],
    music: ["restrained pulse"],
    sfx: ["payoff accent only"]
  },
  forbiddenElements: ["creator logo", "signature phrase"],
  nonTransferableIdentityMarkers: ["named show opener"]
};

describe("MAUL Reference Corpus", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("ingests a URL into a searchable draft trait record", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const project = projectResponse.json().project;

    const ingestResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/references`,
      payload: referenceMetadata
    });

    expect(ingestResponse.statusCode).toBe(201);
    const ingested = ingestResponse.json().reference;
    expect(ingested.artifactType).toBe("reference_corpus_item");
    expect(ingested.payload.reviewStatus).toBe("draft");
    expect(ingested.payload.rightsStatus).toBe("publicly_analysable");
    expect(ingested.payload.traitDraft.extractorVersion).toBe("maul-reference-traits/v1");
    expect(ingested.payload.traitDraft.traits.motion).toContain("modest punch-ins");
    expect(ingested.payload.approvedTraits).toBeNull();

    const searchResponse = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/references?q=punch-ins&reviewStatus=draft`
    });
    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().references).toHaveLength(1);
    expect(searchResponse.json().references[0].artifactId).toBe(ingested.artifactId);

    await context.app.close();
  });

  it("stores uploaded references and serves the exact supplied bytes", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const project = projectResponse.json().project;
    const metadata = {
      ...referenceMetadata,
      source: {kind: "file"}
    };
    const fileBytes = Buffer.from("reference-video-bytes");
    const multipart = buildMultipartBody([
      {name: "metadata_json", value: JSON.stringify(metadata)},
      {
        name: "reference_file",
        value: fileBytes,
        filename: "reference.mp4",
        contentType: "video/mp4"
      }
    ]);

    const ingestResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/references`,
      headers: {"content-type": multipart.contentType},
      payload: multipart.body
    });
    expect(ingestResponse.statusCode).toBe(201);
    const reference = ingestResponse.json().reference;
    expect(reference.payload.source.suppliedFileId).toMatch(/^maul_reference_file_/);

    const sourceResponse = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/references/${reference.artifactId}/source`
    });
    expect(sourceResponse.statusCode).toBe(200);
    expect(sourceResponse.headers["content-type"]).toBe("video/mp4");
    expect(sourceResponse.rawPayload).toEqual(fileBytes);

    await context.app.close();
  });

  it("creates an immutable reviewed version and returns only the latest record", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const project = projectResponse.json().project;
    const ingestResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/references`,
      payload: referenceMetadata
    });
    expect(ingestResponse.statusCode).toBe(201);
    const draft = ingestResponse.json().reference;
    const correctedTraits = {
      ...draft.payload.traitDraft.traits,
      pacing: ["measured fast pacing with a protected payoff pause"]
    };

    const reviewResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/references/${draft.artifactId}/review`,
      payload: {
        decision: "approved",
        reviewerId: "reviewer_alpha",
        notes: "Approved after pacing correction.",
        approvedTraits: correctedTraits
      }
    });
    expect(reviewResponse.statusCode).toBe(201);
    const reviewed = reviewResponse.json().reference;
    expect(reviewed.artifactId).not.toBe(draft.artifactId);
    expect(reviewed.payload.supersedesArtifactId).toBe(draft.artifactId);
    expect(reviewed.payload.reviewStatus).toBe("approved");
    expect(reviewed.payload.approvedTraits.pacing[0]).toContain("protected payoff pause");

    const projectAfterReview = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}`
    });
    const storedDraft = projectAfterReview.json().artifacts.find(
      (artifact: {artifactId: string}) => artifact.artifactId === draft.artifactId
    );
    expect(storedDraft.payload.reviewStatus).toBe("draft");

    const searchResponse = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/references?reviewStatus=approved`
    });
    expect(searchResponse.json().references).toHaveLength(1);
    expect(searchResponse.json().references[0].artifactId).toBe(reviewed.artifactId);

    await context.app.close();
  });

  it("blocks approval without usable rights and blocks reference media from export lineage", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const created = projectResponse.json();
    const ingestResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${created.project.id}/references`,
      payload: {
        ...referenceMetadata,
        rightsStatus: "unknown"
      }
    });
    expect(ingestResponse.statusCode).toBe(201);
    const draft = ingestResponse.json().reference;

    const reviewResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${created.project.id}/references/${draft.artifactId}/review`,
      payload: {
        decision: "approved",
        reviewerId: "reviewer_alpha",
        notes: "Trying to approve unknown rights.",
        approvedTraits: draft.payload.traitDraft.traits
      }
    });
    expect(reviewResponse.statusCode).toBe(409);
    expect(reviewResponse.json().error).toContain("rights");

    const exportResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${created.project.id}/artifacts`,
      payload: {
        artifactType: "export_artifact",
        parentArtifactIds: [draft.artifactId],
        payload: {
          sourceAssetId: created.sourceAsset.artifactId,
          candidateArtifactId: draft.artifactId,
          timelineArtifactId: draft.artifactId,
          treatmentGenomeArtifactId: draft.artifactId,
          reviewDecisionArtifactId: draft.artifactId,
          storageKey: "exports/blocked.mp4",
          mediaType: "video/mp4",
          sha256: "c".repeat(64),
          durationMs: 30000,
          width: 1080,
          height: 1920,
          evidence: {
            technicalValidationPassed: true,
            rightsVerified: true,
            deterministicReplayKey: "blocked",
            preRenderReviewPassed: true,
            qualityGate: {
              status: "unverified",
              releaseEligible: false,
              implementationLabel: "encoded-output-verified",
              renderedEvidenceArtifactId: null,
              postRenderHumanApprovalArtifactId: null,
              hardFailures: [{
                id: "reference_lineage_fixture_not_quality_reviewed",
                dimension: "perceptual_quality",
                message: "Synthetic blocked-lineage fixture has no rendered quality review."
              }]
            },
            warnings: []
          }
        }
      }
    });
    expect(exportResponse.statusCode).toBe(409);
    expect(exportResponse.json().error).toContain("Reference Corpus");

    await context.app.close();
  });
});

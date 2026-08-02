import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  maulArtifactCreateRequestSchema,
  maulArtifactRecordSchema,
  maulCandidateGenerationRequestSchema,
  maulEditorialTimelineRequestSchema,
  maulProjectCreateRequestSchema,
  maulProjectSchema,
  maulPlanningBundleRequestSchema,
  maulReferenceIngestRequestSchema,
  maulReferenceReviewRequestSchema,
  maulReviewDecisionRequestSchema,
  maulShortRenderRequestSchema,
  maulThumbnailGenerationRequestSchema,
  maulThumbnailReviewRequestSchema,
  maulTreatmentCatalogRequestSchema,
  joinShortsTextTokens,
  shortsTextChunkingRequestSchema,
  type MaulArtifactCreateRequest,
  type MaulArtifactRecord,
  type MaulAuditEvent,
  type MaulCandidateGenerationRequest,
  type MaulEditorialTimelinePayload,
  type MaulEditorialTimelineRequest,
  type MaulProject,
  type MaulProjectCreateRequest,
  type MaulPlanningBundleRequest,
  type MaulReferenceCorpusItemPayload,
  type MaulReferenceIngestRequest,
  type MaulReferenceReviewRequest,
  type MaulReviewDecisionRequest,
  type MaulShortRenderRequest,
  type MaulThumbnailGenerationRequest,
  type MaulThumbnailReviewRequest,
  type MaulTreatmentCatalogRequest,
  type ShortsTextChunkPlan,
} from "@prometheus/shared-types";

import {
  assertTrackUsableForExport,
  buildVideoAwareAudioPlan,
  type MusicTrack,
} from "../music/index.js";
import type { ModelRoutingTable } from "../model-routing/index.js";

import {
  buildMaulAnalysisPayload,
  buildMaulEditorialTimelinePayload,
  detectSilenceWithFfmpeg,
  type DetectedSilenceSpan,
} from "./editorial-timeline.js";
import { MaulProjectStore } from "./store.js";
import {
  renderMaulShortLocally,
  type MaulRenderCaption,
  type MaulShortRenderEngine,
} from "./render-engine.js";
import {
  defaultMaulThumbnailGenerator,
  type MaulThumbnailGenerator,
} from "./thumbnail-generator.js";
import {
  getMaulTreatmentCatalog,
  materializeMaulTreatment,
  type MaulTreatmentCatalogEntry,
} from "./treatment-catalog.js";
import { buildMaulPlannerAuditPayload } from "./planner-audit.js";
import {
  adaptMaulLegacyPlanningBundleV1,
  buildMaulPlanningBundlePayload,
  buildMaulConservativePlacementInputs,
  buildMaulPlanningPayloads,
  buildMaulTextChunkPlanPayload,
  buildMaulTextPlacementPlanPayload,
  compileMaulUnifiedShortRenderManifest,
  hashMaulPlanPayload,
  mapMaulSourceMsToOutput,
  mapMaulTranscriptWordsToOutput,
  type MaulPlanningInputs,
} from "./planning.js";
import {buildMaulTextPlacementPlan} from "./shorts-text-placement.js";
import {materializeMaulTextChunkPlanV2} from "./text-chunk-plan.js";
import {
  buildUnavailableMaulQualityTruthResult,
  buildUnverifiedMaulQualityTruthProof,
  evaluateMaulQualityTruth,
  type MaulQualityTruthProofProvider,
} from "./quality-truth.js";
import type {ShortsTextChunkPlanner} from "./shorts-text-chunking-llm.js";

export class MaulProjectNotFoundError extends Error {}
export class MaulLineageConflictError extends Error {}

const createId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${randomBytes(5).toString("hex")}`;

const collectArtifactReferences = (value: unknown): string[] => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const references: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (/ArtifactId$/.test(key) && typeof child === "string") {
      references.push(child);
      continue;
    }
    if (/ArtifactIds$/.test(key) && Array.isArray(child)) {
      references.push(
        ...child.filter((item): item is string => typeof item === "string"),
      );
      continue;
    }
    references.push(...collectArtifactReferences(child));
  }
  return [...new Set(references)];
};

type MaulReferenceArtifact = Extract<
  MaulArtifactRecord,
  { artifactType: "reference_corpus_item" }
>;

type MaulReferenceUpload = {
  originalFilename: string;
  contentType: string;
  bytes: Buffer;
};

type MaulSilenceDetector = (input: {
  sourcePath: string;
  sourceDurationMs: number;
  noiseThresholdDb: number;
  minimumSilenceMs: number;
}) => Promise<DetectedSilenceSpan[]>;

const referenceTraitConfidence = (
  request: MaulReferenceIngestRequest,
): number => {
  const annotationGroups = Object.values(request.annotations);
  const traitGroups = Object.values(request.observedTraits);
  const populated = [...annotationGroups, ...traitGroups].filter(
    (values) => values.length > 0,
  ).length;
  return Math.min(0.98, Number((0.5 + populated * 0.03).toFixed(2)));
};

const rightsAllowApproval = (
  rightsStatus: MaulReferenceCorpusItemPayload["rightsStatus"],
): boolean =>
  ["owned", "licensed", "publicly_analysable"].includes(rightsStatus);

const captionsForRender = (
  timeline: MaulEditorialTimelinePayload,
  words: Array<{
    text: string;
    startMs: number;
    endMs: number;
    confidence: number;
  }>,
): MaulRenderCaption[] =>
  words.flatMap((word) => {
    const startMs = mapMaulSourceMsToOutput(
      timeline.timestampMap,
      word.startMs,
    );
    const endMs = mapMaulSourceMsToOutput(timeline.timestampMap, word.endMs);
    if (startMs === null || endMs === null || endMs <= startMs) {
      return [];
    }
    return [
      {
        text: word.text,
        startMs,
        endMs,
        timestampMs: startMs,
        confidence: word.confidence,
      },
    ];
  });

const musicTrackForPlanner = (
  request: MaulShortRenderRequest,
  timestamp: string,
): MusicTrack => ({
  id: request.musicTrack.id,
  title: request.musicTrack.title,
  artist: request.musicTrack.artist,
  source: "maul_render_request",
  sourceUrl: null,
  storagePath: request.musicTrack.storagePath,
  licenseType: request.musicTrack.licenseType,
  commercialAllowed: request.musicTrack.commercialAllowed,
  attributionRequired: false,
  licenseVerified: request.musicTrack.licenseVerified,
  durationSec: request.musicTrack.durationSec,
  bpm: null,
  musicalKey: null,
  energy: 0.5,
  valence: 0.5,
  arousal: 0.45,
  tension: 0.35,
  prestige: 0.7,
  urgency: 0.35,
  clarity: 0.75,
  speechFriendliness: 0.9,
  genreTags: [],
  moodTags: ["focused"],
  instrumentTags: [],
  useCaseTags: ["underscore"],
  avoidWhen: [],
  beatGrid: null,
  sections: [],
  waveformSummary: null,
  loudnessLufs: null,
  analysisStatus: "analyzed",
  createdAt: timestamp,
  analyzedAt: timestamp,
});

const thumbnailCopyOptions = (
  words: Array<{ text: string; startMs: number; endMs: number }>,
  count: number,
) => {
  const sentences: Array<typeof words> = [];
  let current: typeof words = [];
  for (const word of words) {
    current.push(word);
    if (/[.!?]["']?$/.test(word.text)) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    sentences.push(current);
  }
  const candidates = [
    ...sentences,
    words.slice(0, Math.min(6, words.length)),
    words.slice(Math.max(0, words.length - Math.min(6, words.length))),
  ];
  const unique = new Map<string, typeof words>();
  for (const group of candidates) {
    if (group.length === 0) continue;
    const bounded = group.slice(0, 6);
    const text = bounded
      .map((word) => word.text)
      .join(" ")
      .trim();
    if (text) unique.set(text.toLowerCase(), bounded);
  }
  return [...unique.entries()].slice(0, count).map(([_key, group]) => ({
    text: group.map((word) => word.text).join(" "),
    sourceStartMs: group[0]!.startMs,
    sourceEndMs: group.at(-1)!.endMs,
    sourceGrounded: true as const,
  }));
};

export class MaulProjectService {
  private readonly projectLocks = new Map<string, Promise<void>>();

  public constructor(
    private readonly store: MaulProjectStore,
    private readonly modelRoutes: ModelRoutingTable,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly silenceDetector: MaulSilenceDetector = detectSilenceWithFfmpeg,
    private readonly renderEngine: MaulShortRenderEngine = renderMaulShortLocally,
    private readonly thumbnailGenerator: MaulThumbnailGenerator = defaultMaulThumbnailGenerator,
    private readonly qualityTruthProofProvider: MaulQualityTruthProofProvider = async (
      manifest,
    ) => buildUnverifiedMaulQualityTruthProof(manifest),
    private readonly textChunkPlanner: ShortsTextChunkPlanner,
  ) {}

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public async previewTextChunks(input: unknown): Promise<ShortsTextChunkPlan> {
    const request = shortsTextChunkingRequestSchema.parse(input);
    return this.textChunkPlanner.plan(request);
  }

  private async withProjectLock<T>(
    projectId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = this.projectLocks.get(projectId) ?? Promise.resolve();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(() => gate);
    this.projectLocks.set(projectId, current);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.projectLocks.get(projectId) === current) {
        this.projectLocks.delete(projectId);
      }
    }
  }

  private auditEvent({
    project,
    sequence,
    type,
    artifactId = null,
    detail = {},
  }: {
    project: MaulProject;
    sequence: number;
    type: MaulAuditEvent["type"];
    artifactId?: string | null;
    detail?: Record<string, unknown>;
  }): MaulAuditEvent {
    return {
      schemaVersion: "maul-audit-event/v1",
      eventId: createId("maul_event"),
      projectId: project.id,
      canonicalJobId: project.canonicalJobId,
      runId: project.activeRunId,
      sequence,
      type,
      artifactId,
      detail,
      createdAt: this.now(),
    };
  }

  public async createProject(input: unknown): Promise<{
    project: MaulProject;
    sourceAsset: MaulArtifactRecord;
  }> {
    const request: MaulProjectCreateRequest =
      maulProjectCreateRequestSchema.parse(input);
    const projectId = createId("maul_project");
    const canonicalJobId = createId("maul_job");
    const runId = createId("maul_run");
    const sourceArtifactId = createId("maul_artifact");
    const timestamp = this.now();
    const sourceAsset = maulArtifactRecordSchema.parse({
      schemaVersion: "maul-artifact/v1",
      artifactId: sourceArtifactId,
      artifactType: "source_asset",
      lineage: {
        projectId,
        canonicalJobId,
        runId,
        rootSourceAssetId: sourceArtifactId,
        parentArtifactIds: [],
        sequence: 1,
        producedBy: { module: "maul-project-service", version: "1" },
        createdAt: timestamp,
      },
      payload: request.source,
    });
    const project = maulProjectSchema.parse({
      schemaVersion: "maul-project/v1",
      id: projectId,
      canonicalJobId,
      tenantId: request.tenantId ?? request.creatorId,
      creatorId: request.creatorId,
      status: "intake_ready",
      intake: {
        goal: request.goal,
        platform: request.platform,
        sourceProfile: request.sourceProfile,
        brandKitId: request.brandKitId,
        treatmentPreference: request.treatmentPreference,
        requestedShortCount: request.requestedShortCount,
        requestedThumbnailCount: request.requestedThumbnailCount,
        targetDurationMs: request.targetDurationMs,
      },
      rootSourceAssetId: sourceArtifactId,
      artifactIds: [sourceArtifactId],
      activeRunId: runId,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.store.createProject(project, sourceAsset, [
      this.auditEvent({
        project,
        sequence: 1,
        type: "project_created",
        detail: { creatorId: project.creatorId },
      }),
      this.auditEvent({
        project,
        sequence: 2,
        type: "artifact_registered",
        artifactId: sourceArtifactId,
        detail: { artifactType: "source_asset", sequence: 1 },
      }),
    ]);
    return { project, sourceAsset };
  }

  private async loadProject(projectId: string): Promise<MaulProject> {
    try {
      return await this.store.readProject(projectId);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new MaulProjectNotFoundError(
          `MAUL project ${projectId} was not found.`,
        );
      }
      throw error;
    }
  }

  public async getProject(projectId: string): Promise<{
    project: MaulProject;
    artifacts: MaulArtifactRecord[];
  }> {
    const project = await this.loadProject(projectId);
    return {
      project,
      artifacts: await this.store.readArtifacts(project),
    };
  }

  public async getAudit(projectId: string): Promise<{
    projectId: string;
    events: MaulAuditEvent[];
  }> {
    await this.loadProject(projectId);
    return {
      projectId,
      events: await this.store.readAudit(projectId),
    };
  }

  public async ingestReference(
    projectId: string,
    input: unknown,
    upload?: MaulReferenceUpload,
  ): Promise<{ reference: MaulReferenceArtifact }> {
    const request = maulReferenceIngestRequestSchema.parse(input);
    const { project } = await this.getProject(projectId);
    let source: MaulReferenceCorpusItemPayload["source"];

    if (request.source.kind === "url") {
      if (upload) {
        throw new Error(
          "A URL reference cannot include an uploaded reference_file.",
        );
      }
      source = request.source;
    } else if (upload) {
      const fileId = createId("maul_reference_file");
      await this.store.writeReferenceFile({
        projectId,
        fileId,
        originalFilename: upload.originalFilename,
        contentType: upload.contentType,
        bytes: upload.bytes,
      });
      source = {
        kind: "file",
        suppliedFileId: fileId,
        originalFilename: upload.originalFilename,
        contentType: upload.contentType,
      };
    } else {
      if (
        !request.source.suppliedFileId ||
        !request.source.originalFilename ||
        !request.source.contentType
      ) {
        throw new Error(
          "A file reference requires reference_file upload bytes or a complete supplied file identifier.",
        );
      }
      source = {
        kind: "file",
        suppliedFileId: request.source.suppliedFileId,
        originalFilename: request.source.originalFilename,
        contentType: request.source.contentType,
      };
    }

    const result = await this.registerArtifact(projectId, {
      artifactType: "reference_corpus_item",
      parentArtifactIds: [project.rootSourceAssetId],
      producedBy: { module: "maul-reference-corpus", version: "1" },
      payload: {
        supersedesArtifactId: null,
        source,
        rightsStatus: request.rightsStatus,
        reviewStatus: "draft",
        attribution: request.attribution,
        media: request.media,
        annotations: request.annotations,
        observedTraits: request.observedTraits,
        traitDraft: {
          traits: request.observedTraits,
          confidence: referenceTraitConfidence(request),
          extractorVersion: "maul-reference-traits/v1",
        },
        approvedTraits: null,
        forbiddenElements: request.forbiddenElements,
        nonTransferableIdentityMarkers: request.nonTransferableIdentityMarkers,
        reviewerId: null,
        reviewNotes: null,
        reviewedAt: null,
      },
    });
    if (result.artifact.artifactType !== "reference_corpus_item") {
      throw new Error(
        "MAUL Reference Corpus produced the wrong artifact type.",
      );
    }
    return { reference: result.artifact };
  }

  public async searchReferences(
    projectId: string,
    filters: { q?: string; rightsStatus?: string; reviewStatus?: string },
  ): Promise<{ references: MaulReferenceArtifact[] }> {
    const { artifacts } = await this.getProject(projectId);
    const references = artifacts.filter(
      (artifact): artifact is MaulReferenceArtifact =>
        artifact.artifactType === "reference_corpus_item",
    );
    const supersededIds = new Set(
      references
        .map((reference) => reference.payload.supersedesArtifactId)
        .filter((artifactId): artifactId is string => Boolean(artifactId)),
    );
    const query = filters.q?.trim().toLowerCase() ?? "";
    return {
      references: references
        .filter((reference) => !supersededIds.has(reference.artifactId))
        .filter(
          (reference) =>
            !filters.rightsStatus ||
            reference.payload.rightsStatus === filters.rightsStatus,
        )
        .filter(
          (reference) =>
            !filters.reviewStatus ||
            reference.payload.reviewStatus === filters.reviewStatus,
        )
        .filter(
          (reference) =>
            !query ||
            JSON.stringify(reference.payload).toLowerCase().includes(query),
        )
        .sort((left, right) => right.lineage.sequence - left.lineage.sequence),
    };
  }

  public async reviewReference(
    projectId: string,
    artifactId: string,
    input: unknown,
  ): Promise<{ reference: MaulReferenceArtifact }> {
    const request: MaulReferenceReviewRequest =
      maulReferenceReviewRequestSchema.parse(input);
    const { artifacts } = await this.getProject(projectId);
    const reference = artifacts.find(
      (artifact) => artifact.artifactId === artifactId,
    );
    if (!reference || reference.artifactType !== "reference_corpus_item") {
      throw new MaulProjectNotFoundError(
        `MAUL reference ${artifactId} was not found.`,
      );
    }
    const alreadySuperseded = artifacts.some(
      (artifact) =>
        artifact.artifactType === "reference_corpus_item" &&
        artifact.payload.supersedesArtifactId === artifactId,
    );
    if (alreadySuperseded) {
      throw new MaulLineageConflictError(
        `MAUL reference ${artifactId} already has a newer reviewed version.`,
      );
    }
    if (
      request.decision === "approved" &&
      !rightsAllowApproval(reference.payload.rightsStatus)
    ) {
      throw new MaulLineageConflictError(
        `Reference rights status ${reference.payload.rightsStatus} does not permit approval.`,
      );
    }

    const reviewedAt = this.now();
    const result = await this.registerArtifact(projectId, {
      artifactType: "reference_corpus_item",
      parentArtifactIds: [reference.artifactId],
      producedBy: { module: "maul-reference-review", version: "1" },
      payload: {
        ...reference.payload,
        supersedesArtifactId: reference.artifactId,
        reviewStatus: request.decision,
        annotations: request.annotations ?? reference.payload.annotations,
        approvedTraits:
          request.decision === "approved"
            ? (request.approvedTraits ?? reference.payload.traitDraft.traits)
            : null,
        reviewerId: request.reviewerId,
        reviewNotes: request.notes,
        reviewedAt,
      },
    });
    if (result.artifact.artifactType !== "reference_corpus_item") {
      throw new Error(
        "MAUL reference review produced the wrong artifact type.",
      );
    }
    return { reference: result.artifact };
  }

  public async getReferenceSource(
    projectId: string,
    artifactId: string,
  ): Promise<{
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    bytes: Buffer;
  }> {
    const { artifacts } = await this.getProject(projectId);
    const reference = artifacts.find(
      (artifact) => artifact.artifactId === artifactId,
    );
    if (!reference || reference.artifactType !== "reference_corpus_item") {
      throw new MaulProjectNotFoundError(
        `MAUL reference ${artifactId} was not found.`,
      );
    }
    if (reference.payload.source.kind !== "file") {
      throw new MaulProjectNotFoundError(
        `MAUL reference ${artifactId} has no supplied file.`,
      );
    }
    return this.store.readReferenceFile(
      projectId,
      reference.payload.source.suppliedFileId,
    );
  }

  public async createEditorialTimeline(
    projectId: string,
    input: unknown,
  ): Promise<{
    analysis: Extract<MaulArtifactRecord, { artifactType: "analysis" }>;
    timeline: Extract<
      MaulArtifactRecord,
      { artifactType: "editorial_timeline" }
    >;
  }> {
    if (
      !input ||
      typeof input !== "object" ||
      !("vadEvidence" in input) ||
      (input as { vadEvidence?: unknown }).vadEvidence === undefined
    ) {
      throw new Error(
        "VAD evidence is required; MAUL never infers silence from transcript gaps.",
      );
    }
    const request: MaulEditorialTimelineRequest =
      maulEditorialTimelineRequestSchema.parse(input);
    const { project, artifacts } = await this.getProject(projectId);
    const sourceAsset = artifacts.find(
      (artifact) => artifact.artifactId === project.rootSourceAssetId,
    );
    if (!sourceAsset || sourceAsset.artifactType !== "source_asset") {
      throw new MaulLineageConflictError(
        "The authoritative MAUL source asset is unavailable.",
      );
    }
    if (request.selectedWindow.sourceEndMs > sourceAsset.payload.durationMs) {
      throw new Error(
        "The selected editorial window exceeds the source duration.",
      );
    }

    const provider =
      request.vadEvidence.kind === "source_media"
        ? "ffmpeg_silencedetect"
        : request.vadEvidence.provider;
    const silenceSpans =
      request.vadEvidence.kind === "source_media"
        ? await this.silenceDetector({
            sourcePath: request.vadEvidence.sourcePath,
            sourceDurationMs: sourceAsset.payload.durationMs,
            noiseThresholdDb: request.vadEvidence.noiseThresholdDb,
            minimumSilenceMs: request.vadEvidence.minimumSilenceMs,
          })
        : request.vadEvidence.silenceSpans;

    const analysisResult = await this.registerArtifact(projectId, {
      artifactType: "analysis",
      parentArtifactIds: [sourceAsset.artifactId],
      producedBy: { module: "maul-media-analysis", version: "1" },
      payload: buildMaulAnalysisPayload({
        request,
        sourceAssetId: sourceAsset.artifactId,
        sourceDurationMs: sourceAsset.payload.durationMs,
        silenceSpans,
        provider,
      }),
    });
    if (analysisResult.artifact.artifactType !== "analysis") {
      throw new Error("MAUL Media Analysis produced the wrong artifact type.");
    }

    const timelineResult = await this.registerArtifact(projectId, {
      artifactType: "editorial_timeline",
      parentArtifactIds: [
        sourceAsset.artifactId,
        analysisResult.artifact.artifactId,
      ],
      producedBy: { module: "maul-editorial-timeline", version: "1" },
      payload: buildMaulEditorialTimelinePayload({
        request,
        sourceAssetId: sourceAsset.artifactId,
        analysisArtifactId: analysisResult.artifact.artifactId,
        sourceDurationMs: sourceAsset.payload.durationMs,
        sourceWidth: sourceAsset.payload.width,
        sourceHeight: sourceAsset.payload.height,
        silenceSpans,
      }),
    });
    if (timelineResult.artifact.artifactType !== "editorial_timeline") {
      throw new Error(
        "MAUL Editorial Timeline produced the wrong artifact type.",
      );
    }
    return {
      analysis: analysisResult.artifact,
      timeline: timelineResult.artifact,
    };
  }

  public getTreatmentCatalog(): { treatments: MaulTreatmentCatalogEntry[] } {
    return { treatments: getMaulTreatmentCatalog() };
  }

  public async createTreatmentCatalog(
    projectId: string,
    input: unknown,
  ): Promise<{
    treatments: Array<
      Extract<MaulArtifactRecord, { artifactType: "treatment_genome" }>
    >;
  }> {
    const request: MaulTreatmentCatalogRequest =
      maulTreatmentCatalogRequestSchema.parse(input);
    const { artifacts } = await this.getProject(projectId);
    const timeline = artifacts.find(
      (artifact) => artifact.artifactId === request.timelineArtifactId,
    );
    if (!timeline || timeline.artifactType !== "editorial_timeline") {
      throw new MaulProjectNotFoundError(
        `MAUL Editorial Timeline ${request.timelineArtifactId} was not found.`,
      );
    }
    const references = request.referenceCorpusArtifactIds.map((artifactId) => {
      const artifact = artifacts.find(
        (candidate) => candidate.artifactId === artifactId,
      );
      if (!artifact || artifact.artifactType !== "reference_corpus_item") {
        throw new MaulProjectNotFoundError(
          `MAUL reference ${artifactId} was not found.`,
        );
      }
      if (
        artifact.payload.reviewStatus !== "approved" ||
        !artifact.payload.approvedTraits
      ) {
        throw new MaulLineageConflictError(
          `MAUL reference ${artifactId} must have approved traits before treatment use.`,
        );
      }
      return artifact;
    });

    const treatments: Array<
      Extract<MaulArtifactRecord, { artifactType: "treatment_genome" }>
    > = [];
    for (const entry of getMaulTreatmentCatalog()) {
      const result = await this.registerArtifact(projectId, {
        artifactType: "treatment_genome",
        parentArtifactIds: [
          timeline.artifactId,
          ...references.map((reference) => reference.artifactId),
        ],
        producedBy: { module: "maul-treatment-catalog", version: "1" },
        payload: materializeMaulTreatment({
          entry,
          timelineArtifactId: timeline.artifactId,
          referenceCorpusArtifactIds: references.map(
            (reference) => reference.artifactId,
          ),
        }),
      });
      if (result.artifact.artifactType !== "treatment_genome") {
        throw new Error(
          "MAUL Treatment Catalog produced the wrong artifact type.",
        );
      }
      treatments.push(result.artifact);
    }
    return { treatments };
  }

  public async createCandidates(
    projectId: string,
    input: unknown,
  ): Promise<{
    candidates: Array<
      Extract<MaulArtifactRecord, { artifactType: "candidate" }>
    >;
    rejectedCandidates: Array<
      Extract<MaulArtifactRecord, { artifactType: "candidate" }>
    >;
    plannerAudit: Extract<
      MaulArtifactRecord,
      { artifactType: "planner_audit" }
    >;
    insufficiency: {
      requestedCount: number;
      producedCount: number;
      missingCount: number;
      reason: string | null;
    };
  }> {
    const request: MaulCandidateGenerationRequest =
      maulCandidateGenerationRequestSchema.parse(input);
    const { project, artifacts } = await this.getProject(projectId);
    const timeline = artifacts.find(
      (artifact) => artifact.artifactId === request.timelineArtifactId,
    );
    if (!timeline || timeline.artifactType !== "editorial_timeline") {
      throw new MaulProjectNotFoundError(
        `MAUL Editorial Timeline ${request.timelineArtifactId} was not found.`,
      );
    }
    const analysis = artifacts.find(
      (artifact) => artifact.artifactId === timeline.payload.analysisArtifactId,
    );
    if (!analysis || analysis.artifactType !== "analysis") {
      throw new MaulLineageConflictError(
        "The timeline's Media Analysis artifact is unavailable.",
      );
    }
    const selected = timeline.payload.selectedClipWindows[0];
    if (!selected) {
      throw new MaulLineageConflictError(
        "The timeline has no selected clip window.",
      );
    }
    const words = analysis.payload.transcript.words.filter(
      (word) =>
        word.endMs > selected.sourceStartMs &&
        word.startMs < selected.sourceEndMs,
    );
    const transcriptText = words
      .map((word) => word.text)
      .join(" ")
      .trim();
    const durationFit =
      timeline.payload.outputDurationMs >=
        project.intake.targetDurationMs.min &&
      timeline.payload.outputDurationMs <= project.intake.targetDurationMs.max;
    const hookClarity = words.length >= 3 ? 0.9 : 0.45;
    const semanticCompletion = /[.!?]["']?$/.test(words.at(-1)?.text ?? "")
      ? 0.95
      : 0.6;
    const pacing = durationFit ? 0.95 : 0.55;
    const overall = Number(
      ((hookClarity + semanticCompletion + pacing) / 3).toFixed(3),
    );
    const qualityThresholdPassed = Boolean(transcriptText) && overall >= 0.72;
    const result = await this.registerArtifact(projectId, {
      artifactType: "candidate",
      parentArtifactIds: [project.rootSourceAssetId, timeline.artifactId],
      producedBy: { module: "maul-candidate-scorer", version: "1" },
      payload: {
        sourceAssetId: project.rootSourceAssetId,
        timelineArtifactId: timeline.artifactId,
        rank: 1,
        sourceStartMs: selected.sourceStartMs,
        sourceEndMs: selected.sourceEndMs,
        title:
          words
            .slice(0, 7)
            .map((word) => word.text)
            .join(" ") || "MAUL candidate",
        transcriptText,
        scores: { hookClarity, semanticCompletion, pacing, overall },
        qualityThresholdPassed,
        insufficiencyReason: qualityThresholdPassed
          ? null
          : "The available source window did not meet the coherent-short quality threshold.",
      },
    });
    if (result.artifact.artifactType !== "candidate") {
      throw new Error(
        "MAUL Candidate Scoring produced the wrong artifact type.",
      );
    }
    const plannerAuditResult = await this.registerArtifact(projectId, {
      artifactType: "planner_audit",
      parentArtifactIds: [
        project.rootSourceAssetId,
        analysis.artifactId,
        timeline.artifactId,
        result.artifact.artifactId,
      ],
      producedBy: { module: "maul-planner-accountability", version: "1" },
      payload: buildMaulPlannerAuditPayload({
        sourceAssetId: project.rootSourceAssetId,
        analysisArtifactId: analysis.artifactId,
        timelineArtifactId: timeline.artifactId,
        candidateArtifactIds: [result.artifact.artifactId],
        generatedAt: this.now(),
        modelRoutes: this.modelRoutes,
      }),
    });
    if (plannerAuditResult.artifact.artifactType !== "planner_audit") {
      throw new Error(
        "MAUL Planner Accountability produced the wrong artifact type.",
      );
    }
    const candidates = qualityThresholdPassed ? [result.artifact] : [];
    const rejectedCandidates = qualityThresholdPassed ? [] : [result.artifact];
    const missingCount = project.intake.requestedShortCount - candidates.length;
    return {
      candidates,
      rejectedCandidates,
      plannerAudit: plannerAuditResult.artifact,
      insufficiency: {
        requestedCount: project.intake.requestedShortCount,
        producedCount: candidates.length,
        missingCount,
        reason:
          missingCount > 0
            ? "This Editorial Timeline contains one coherent idea; MAUL will not duplicate it to pad the requested output count."
            : null,
      },
    };
  }

  public async createPlanningBundle(
    projectId: string,
    input: unknown,
  ): Promise<{
    planningBundle: Extract<
      MaulArtifactRecord,
      { artifactType: "planning_bundle" }
    >;
    plans: {
      observationSnapshot: Extract<
        MaulArtifactRecord,
        { artifactType: "observation_snapshot" }
      >;
      candidateNarrative: Extract<
        MaulArtifactRecord,
        { artifactType: "candidate_narrative" }
      >;
      beatMap: Extract<
        MaulArtifactRecord,
        { artifactType: "editorial_beat_map" }
      >;
      typographyMotion: Extract<
        MaulArtifactRecord,
        { artifactType: "typography_motion_plan" }
      >;
      camera: Extract<
        MaulArtifactRecord,
        { artifactType: "framing_camera_plan" }
      >;
      visual: Extract<MaulArtifactRecord, { artifactType: "visual_plan" }>;
      audio: Extract<
        MaulArtifactRecord,
        { artifactType: "dialogue_audio_plan" }
      >;
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
      textChunk: Extract<
        MaulArtifactRecord,
        { artifactType: "text_chunk_plan" }
      >;
      textPlacement: Extract<
        MaulArtifactRecord,
        { artifactType: "text_placement_plan" }
      >;
    };
  }> {
    const request: MaulPlanningBundleRequest =
      maulPlanningBundleRequestSchema.parse(input);
    const { project, artifacts } = await this.getProject(projectId);
    const candidate = artifacts.find(
      (artifact) => artifact.artifactId === request.candidateArtifactId,
    );
    const treatment = artifacts.find(
      (artifact) => artifact.artifactId === request.treatmentGenomeArtifactId,
    );
    if (!candidate || candidate.artifactType !== "candidate") {
      throw new MaulProjectNotFoundError(
        `MAUL candidate ${request.candidateArtifactId} was not found.`,
      );
    }
    if (!treatment || treatment.artifactType !== "treatment_genome") {
      throw new MaulProjectNotFoundError(
        `MAUL Treatment Genome ${request.treatmentGenomeArtifactId} was not found.`,
      );
    }
    if (!candidate.payload.qualityThresholdPassed) {
      throw new MaulLineageConflictError(
        "Rejected MAUL candidates cannot enter governed planning.",
      );
    }
    if (
      candidate.payload.timelineArtifactId !==
      treatment.payload.timelineArtifactId
    ) {
      throw new MaulLineageConflictError(
        "Candidate and Treatment Genome must share one Editorial Timeline.",
      );
    }
    const timeline = artifacts.find(
      (artifact) =>
        artifact.artifactId === candidate.payload.timelineArtifactId,
    );
    if (!timeline || timeline.artifactType !== "editorial_timeline") {
      throw new MaulLineageConflictError(
        "The governed planning timeline is unavailable.",
      );
    }
    const analysis = artifacts.find(
      (artifact) => artifact.artifactId === timeline.payload.analysisArtifactId,
    );
    const source = artifacts.find(
      (artifact) => artifact.artifactId === project.rootSourceAssetId,
    );
    if (
      !analysis ||
      analysis.artifactType !== "analysis" ||
      !source ||
      source.artifactType !== "source_asset"
    ) {
      throw new MaulLineageConflictError(
        "Planning requires the authoritative source and Media Analysis.",
      );
    }
    let candidateWords;
    try {
      candidateWords = mapMaulTranscriptWordsToOutput({
        timestampMap: timeline.payload.timestampMap,
        words: analysis.payload.transcript.words
          .map((word, transcriptWordIndex) => ({
            ...word,
            transcriptWordIndex,
          }))
          .filter(
            (word) =>
              word.endMs > candidate.payload.sourceStartMs &&
              word.startMs < candidate.payload.sourceEndMs,
          ),
      });
    } catch (error) {
      throw new MaulLineageConflictError(
        `Planning cannot chunk the authoritative transcript: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const textChunkPlanV1 = await this.textChunkPlanner.plan({
        transcript: {
          language: analysis.payload.transcript.language,
          text: joinShortsTextTokens(
            candidateWords.map((word) => word.text),
          ),
          words: candidateWords,
        },
        videoDurationMs: timeline.payload.outputDurationMs,
        pacing:
          treatment.payload.treatmentId === "premium_direct_response"
            ? "fast"
            : treatment.payload.treatmentId === "minimal_expert"
              ? "slow"
              : "measured",
        style:
          treatment.payload.treatmentId === "premium_direct_response"
            ? "direct_response"
            : treatment.payload.treatmentId === "minimal_expert"
              ? "restrained"
              : "editorial",
        editorialContext: {
          platform: project.intake.platform,
          objective: project.intake.goal,
          audience: treatment.payload.targetViewerState,
          notes: `Treatment: ${treatment.payload.catalogEntryName}`,
        },
        constraints: {
          minWordsPerChunk: 1,
          maxWordsPerChunk: Math.min(
            8,
            treatment.payload.rendererInputs.caption.maxWordsPerCard,
          ),
          preserveEveryWord: true,
        },
      });
    const planningInputs: MaulPlanningInputs = {
      project,
      source,
      analysis,
      timeline,
      candidate,
      treatment,
      textChunkPlan: textChunkPlanV1,
    };
    const sharedParents = [
      source.artifactId,
      analysis.artifactId,
      timeline.artifactId,
      candidate.artifactId,
      treatment.artifactId,
    ];
    const textChunkCore = materializeMaulTextChunkPlanV2({
      mappedWords: candidateWords,
      textChunkPlanV1,
      editorialTimeline: timeline.payload,
    });
    const textChunkPayload = buildMaulTextChunkPlanPayload({
      inputs: planningInputs,
      core: textChunkCore,
    });
    const textChunkResult = await this.registerArtifact(projectId, {
      artifactType: "text_chunk_plan",
      parentArtifactIds: sharedParents,
      producedBy: {module: "maul-text-chunk-materializer", version: "2"},
      payload: textChunkPayload,
    });
    if (textChunkResult.artifact.artifactType !== "text_chunk_plan") {
      throw new Error("MAUL planner produced the wrong text chunk artifact type.");
    }
    const textChunkPlanHash = hashMaulPlanPayload(
      textChunkResult.artifact.payload,
    );
    const placementInputs = buildMaulConservativePlacementInputs(
      timeline.payload,
    );
    const textPlacementCore = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: textChunkResult.artifact.artifactId,
      textChunkPlan: textChunkCore,
      textChunkPlanHash,
      ...placementInputs,
    });
    const textPlacementPayload = buildMaulTextPlacementPlanPayload({
      inputs: planningInputs,
      core: textPlacementCore,
    });
    const textPlacementResult = await this.registerArtifact(projectId, {
      artifactType: "text_placement_plan",
      parentArtifactIds: [
        ...sharedParents,
        textChunkResult.artifact.artifactId,
      ],
      producedBy: {module: "maul-text-placement-planner", version: "1"},
      payload: textPlacementPayload,
    });
    if (textPlacementResult.artifact.artifactType !== "text_placement_plan") {
      throw new Error(
        "MAUL planner produced the wrong text placement artifact type.",
      );
    }
    const textPlacementPlanHash = hashMaulPlanPayload(
      textPlacementResult.artifact.payload,
    );
    const payloads = buildMaulPlanningPayloads(planningInputs, {
      textChunkPlanArtifactId: textChunkResult.artifact.artifactId,
      textChunkPlanHash,
      textPlacementPlanArtifactId: textPlacementResult.artifact.artifactId,
      textPlacementPlanHash,
    });
    const dependentParents = [
      ...sharedParents,
      textChunkResult.artifact.artifactId,
      textPlacementResult.artifact.artifactId,
    ];
    const observationResult = await this.registerArtifact(projectId, {
      artifactType: "observation_snapshot",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.observationSnapshot,
    });
    const narrativeResult = await this.registerArtifact(projectId, {
      artifactType: "candidate_narrative",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.candidateNarrative,
    });
    const beatMapResult = await this.registerArtifact(projectId, {
      artifactType: "editorial_beat_map",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.beatMap,
    });
    const typographyResult = await this.registerArtifact(projectId, {
      artifactType: "typography_motion_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.typographyMotion,
    });
    const cameraResult = await this.registerArtifact(projectId, {
      artifactType: "framing_camera_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.camera,
    });
    const visualResult = await this.registerArtifact(projectId, {
      artifactType: "visual_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.visual,
    });
    const audioResult = await this.registerArtifact(projectId, {
      artifactType: "dialogue_audio_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.audio,
    });
    const capabilityResult = await this.registerArtifact(projectId, {
      artifactType: "capability_selection",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.capabilitySelection,
    });
    const adapterResult = await this.registerArtifact(projectId, {
      artifactType: "adapter_decision",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.adapterDecision,
    });
    const artDirectionResult = await this.registerArtifact(projectId, {
      artifactType: "art_direction_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.artDirection,
    });
    const contextAssemblyResult = await this.registerArtifact(projectId, {
      artifactType: "context_assembly_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.contextAssembly,
    });
    const shotIntentResult = await this.registerArtifact(projectId, {
      artifactType: "shot_intent_matrix",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.shotIntentMatrix,
    });
    const textOpportunityResult = await this.registerArtifact(projectId, {
      artifactType: "text_opportunity_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.textOpportunity,
    });
    const revisionResult = await this.registerArtifact(projectId, {
      artifactType: "revision_plan",
      parentArtifactIds: dependentParents,
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: payloads.revision,
    });
    if (
      observationResult.artifact.artifactType !== "observation_snapshot" ||
      narrativeResult.artifact.artifactType !== "candidate_narrative" ||
      beatMapResult.artifact.artifactType !== "editorial_beat_map" ||
      typographyResult.artifact.artifactType !== "typography_motion_plan" ||
      cameraResult.artifact.artifactType !== "framing_camera_plan" ||
      visualResult.artifact.artifactType !== "visual_plan" ||
      audioResult.artifact.artifactType !== "dialogue_audio_plan" ||
      capabilityResult.artifact.artifactType !== "capability_selection" ||
      adapterResult.artifact.artifactType !== "adapter_decision" ||
      artDirectionResult.artifact.artifactType !== "art_direction_plan" ||
      contextAssemblyResult.artifact.artifactType !== "context_assembly_plan" ||
      shotIntentResult.artifact.artifactType !== "shot_intent_matrix" ||
      textOpportunityResult.artifact.artifactType !== "text_opportunity_plan" ||
      revisionResult.artifact.artifactType !== "revision_plan"
    ) {
      throw new Error(
        "MAUL Stage 1 planning produced an unexpected artifact type.",
      );
    }
    const plans = {
      textChunk: textChunkResult.artifact,
      textPlacement: textPlacementResult.artifact,
      observationSnapshot: observationResult.artifact,
      candidateNarrative: narrativeResult.artifact,
      beatMap: beatMapResult.artifact,
      typographyMotion: typographyResult.artifact,
      camera: cameraResult.artifact,
      visual: visualResult.artifact,
      audio: audioResult.artifact,
      capabilitySelection: capabilityResult.artifact,
      adapterDecision: adapterResult.artifact,
      artDirection: artDirectionResult.artifact,
      contextAssembly: contextAssemblyResult.artifact,
      shotIntentMatrix: shotIntentResult.artifact,
      textOpportunity: textOpportunityResult.artifact,
      revision: revisionResult.artifact,
    };
    const planArtifactIds = {
      textChunk: plans.textChunk.artifactId,
      textPlacement: plans.textPlacement.artifactId,
      observationSnapshot: plans.observationSnapshot.artifactId,
      candidateNarrative: plans.candidateNarrative.artifactId,
      beatMap: plans.beatMap.artifactId,
      typographyMotion: plans.typographyMotion.artifactId,
      camera: plans.camera.artifactId,
      visual: plans.visual.artifactId,
      audio: plans.audio.artifactId,
      capabilitySelection: plans.capabilitySelection.artifactId,
      adapterDecision: plans.adapterDecision.artifactId,
      artDirection: plans.artDirection.artifactId,
      contextAssembly: plans.contextAssembly.artifactId,
      shotIntentMatrix: plans.shotIntentMatrix.artifactId,
      textOpportunity: plans.textOpportunity.artifactId,
      revision: plans.revision.artifactId,
    };
    const planningBundleResult = await this.registerArtifact(projectId, {
      artifactType: "planning_bundle",
      parentArtifactIds: [...sharedParents, ...Object.values(planArtifactIds)],
      producedBy: { module: "maul-stage-one-planner", version: "1" },
      payload: buildMaulPlanningBundlePayload({
        inputs: planningInputs,
        planArtifactIds,
        blockingReasons:
          plans.textPlacement.payload.status === "blocked"
            ? [
                plans.textPlacement.payload.blockingReason ??
                  "Text placement is blocked.",
              ]
            : [],
      }),
    });
    if (planningBundleResult.artifact.artifactType !== "planning_bundle") {
      throw new Error(
        "MAUL Stage 1 planner produced an unexpected bundle artifact type.",
      );
    }
    return { planningBundle: planningBundleResult.artifact, plans };
  }

  public async reviewCandidate(
    projectId: string,
    input: unknown,
  ): Promise<{
    review: Extract<MaulArtifactRecord, { artifactType: "review_decision" }>;
  }> {
    const request: MaulReviewDecisionRequest =
      maulReviewDecisionRequestSchema.parse(input);
    const { artifacts } = await this.getProject(projectId);
    const candidate = artifacts.find(
      (artifact) => artifact.artifactId === request.candidateArtifactId,
    );
    const treatment = artifacts.find(
      (artifact) => artifact.artifactId === request.treatmentGenomeArtifactId,
    );
    const planningBundle = artifacts.find(
      (artifact) => artifact.artifactId === request.planningBundleArtifactId,
    );
    if (!candidate || candidate.artifactType !== "candidate") {
      throw new MaulProjectNotFoundError(
        `MAUL candidate ${request.candidateArtifactId} was not found.`,
      );
    }
    if (!treatment || treatment.artifactType !== "treatment_genome") {
      throw new MaulProjectNotFoundError(
        `MAUL Treatment Genome ${request.treatmentGenomeArtifactId} was not found.`,
      );
    }
    if (!planningBundle || planningBundle.artifactType !== "planning_bundle") {
      throw new MaulProjectNotFoundError(
        `MAUL Planning Bundle ${request.planningBundleArtifactId} was not found.`,
      );
    }
    if (
      planningBundle.payload.rendererReadiness === "blocked" ||
      planningBundle.payload.candidateArtifactId !== candidate.artifactId ||
      planningBundle.payload.treatmentGenomeArtifactId !== treatment.artifactId
    ) {
      throw new MaulLineageConflictError(
        "Review requires a render-ready Planning Bundle for the same candidate and Treatment Genome.",
      );
    }
    if (
      candidate.payload.timelineArtifactId !==
      treatment.payload.timelineArtifactId
    ) {
      throw new MaulLineageConflictError(
        "Candidate and Treatment Genome must share one Editorial Timeline.",
      );
    }
    const failureClasses = new Map(
      treatment.payload.judgmentLayer.failureClasses.map((failure) => [
        failure.id,
        failure,
      ]),
    );
    for (const failureId of request.failureClasses) {
      if (!failureClasses.has(failureId)) {
        throw new Error(
          `Unknown ${treatment.payload.catalogEntryName} failure class ${failureId}.`,
        );
      }
    }
    const rubric = treatment.payload.judgmentLayer.rubric;
    const totalWeight = rubric.reduce(
      (sum, dimension) => sum + dimension.weight,
      0,
    );
    const weightedScore = Number(
      (
        rubric.reduce((sum, dimension) => {
          const score = request.rubricScores[dimension.id];
          if (score === undefined) {
            throw new Error(`Judgment score ${dimension.id} is required.`);
          }
          return sum + score * dimension.weight;
        }, 0) / totalWeight
      ).toFixed(2),
    );
    const belowMinimum = rubric.filter(
      (dimension) =>
        (request.rubricScores[dimension.id] ?? 0) < dimension.minimumScore,
    );
    const blockingFailures = request.failureClasses.filter(
      (failureId) => failureClasses.get(failureId)?.severity === "blocking",
    );
    if (
      request.decision === "approved" &&
      (!candidate.payload.qualityThresholdPassed ||
        weightedScore < treatment.payload.judgmentLayer.minimumWeightedScore ||
        belowMinimum.length > 0 ||
        blockingFailures.length > 0)
    ) {
      throw new MaulLineageConflictError(
        "Approval is blocked by the candidate quality gate, rubric minimums, or a blocking failure class.",
      );
    }
    const result = await this.registerArtifact(projectId, {
      artifactType: "review_decision",
      parentArtifactIds: [
        candidate.artifactId,
        treatment.artifactId,
        planningBundle.artifactId,
      ],
      producedBy: { module: "maul-judgment-layer", version: "1" },
      payload: {
        subjectArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewerId: request.reviewerId,
        decision: request.decision,
        failureClasses: request.failureClasses,
        rationale: request.rationale,
        rubricScores: request.rubricScores,
        weightedScore,
        decidedAt: this.now(),
      },
    });
    if (result.artifact.artifactType !== "review_decision") {
      throw new Error("MAUL Judgment Layer produced the wrong artifact type.");
    }
    return { review: result.artifact };
  }

  public async renderShort(
    projectId: string,
    input: unknown,
  ): Promise<{
    export: Extract<MaulArtifactRecord, { artifactType: "export_artifact" }>;
    audioPlan: ReturnType<typeof buildVideoAwareAudioPlan>;
  }> {
    const request: MaulShortRenderRequest =
      maulShortRenderRequestSchema.parse(input);
    const { project, artifacts } = await this.getProject(projectId);
    const candidate = artifacts.find(
      (artifact) => artifact.artifactId === request.candidateArtifactId,
    );
    const treatment = artifacts.find(
      (artifact) => artifact.artifactId === request.treatmentGenomeArtifactId,
    );
    const review = artifacts.find(
      (artifact) => artifact.artifactId === request.reviewDecisionArtifactId,
    );
    const planningBundle = artifacts.find(
      (artifact) => artifact.artifactId === request.planningBundleArtifactId,
    );
    if (!candidate || candidate.artifactType !== "candidate") {
      throw new MaulProjectNotFoundError(
        `MAUL candidate ${request.candidateArtifactId} was not found.`,
      );
    }
    if (!treatment || treatment.artifactType !== "treatment_genome") {
      throw new MaulProjectNotFoundError(
        `MAUL treatment ${request.treatmentGenomeArtifactId} was not found.`,
      );
    }
    if (!review || review.artifactType !== "review_decision") {
      throw new MaulProjectNotFoundError(
        `MAUL review ${request.reviewDecisionArtifactId} was not found.`,
      );
    }
    if (!planningBundle || planningBundle.artifactType !== "planning_bundle") {
      throw new MaulProjectNotFoundError(
        `MAUL Planning Bundle ${request.planningBundleArtifactId} was not found.`,
      );
    }
    if (planningBundle.payload.rendererReadiness === "blocked") {
      throw new MaulLineageConflictError(
        "A blocked MAUL Planning Bundle cannot reach render.",
      );
    }
    if (
      review.payload.decision !== "approved" ||
      review.payload.subjectArtifactId !== candidate.artifactId ||
      review.payload.treatmentGenomeArtifactId !== treatment.artifactId ||
      review.payload.planningBundleArtifactId !== planningBundle.artifactId
    ) {
      throw new MaulLineageConflictError(
        "A matching approved human review is required before rendering.",
      );
    }
    if (
      planningBundle.payload.candidateArtifactId !== candidate.artifactId ||
      planningBundle.payload.treatmentGenomeArtifactId !== treatment.artifactId
    ) {
      throw new MaulLineageConflictError(
        "Planning Bundle, approved review, candidate, and Treatment Genome must share one governed plan.",
      );
    }
    if (!candidate.payload.qualityThresholdPassed) {
      throw new MaulLineageConflictError(
        "Rejected MAUL candidates cannot be rendered.",
      );
    }
    if (
      candidate.payload.timelineArtifactId !==
      treatment.payload.timelineArtifactId
    ) {
      throw new MaulLineageConflictError(
        "Candidate and Treatment Genome do not share a timeline.",
      );
    }
    const timeline = artifacts.find(
      (artifact) =>
        artifact.artifactId === candidate.payload.timelineArtifactId,
    );
    if (!timeline || timeline.artifactType !== "editorial_timeline") {
      throw new MaulLineageConflictError(
        "The reviewed Editorial Timeline is unavailable.",
      );
    }
    const analysis = artifacts.find(
      (artifact) => artifact.artifactId === timeline.payload.analysisArtifactId,
    );
    const source = artifacts.find(
      (artifact) => artifact.artifactId === project.rootSourceAssetId,
    );
    if (
      !analysis ||
      analysis.artifactType !== "analysis" ||
      !source ||
      source.artifactType !== "source_asset"
    ) {
      throw new MaulLineageConflictError(
        "The authoritative source or Media Analysis is unavailable.",
      );
    }
    const observationSnapshot = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.observationSnapshot,
    );
    const candidateNarrative = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.candidateNarrative,
    );
    const beatMap = artifacts.find(
      (artifact) =>
        artifact.artifactId === planningBundle.payload.planArtifactIds.beatMap,
    );
    const typographyMotion = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.typographyMotion,
    );
    const camera = artifacts.find(
      (artifact) =>
        artifact.artifactId === planningBundle.payload.planArtifactIds.camera,
    );
    const visual = artifacts.find(
      (artifact) =>
        artifact.artifactId === planningBundle.payload.planArtifactIds.visual,
    );
    const dialogueAudio = artifacts.find(
      (artifact) =>
        artifact.artifactId === planningBundle.payload.planArtifactIds.audio,
    );
    const capabilitySelection = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.capabilitySelection,
    );
    const adapterDecision = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.adapterDecision,
    );
    const artDirection = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.artDirection,
    );
    const contextAssembly = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.contextAssembly,
    );
    const shotIntentMatrix = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.shotIntentMatrix,
    );
    const textOpportunity = artifacts.find(
      (artifact) =>
        artifact.artifactId ===
        planningBundle.payload.planArtifactIds.textOpportunity,
    );
    const revision = artifacts.find(
      (artifact) =>
        artifact.artifactId === planningBundle.payload.planArtifactIds.revision,
    );
    const v2PlanArtifactIds =
      planningBundle.payload.schemaVersion === "maul-planning-bundle/v2"
        ? planningBundle.payload.planArtifactIds
        : null;
    const textChunk =
      v2PlanArtifactIds
        ? artifacts.find(
            (artifact) =>
              artifact.artifactId === v2PlanArtifactIds.textChunk,
          )
        : null;
    const textPlacement =
      v2PlanArtifactIds
        ? artifacts.find(
            (artifact) =>
              artifact.artifactId === v2PlanArtifactIds.textPlacement,
          )
        : null;
    if (
      !observationSnapshot ||
      observationSnapshot.artifactType !== "observation_snapshot" ||
      !candidateNarrative ||
      candidateNarrative.artifactType !== "candidate_narrative" ||
      !beatMap ||
      beatMap.artifactType !== "editorial_beat_map" ||
      !typographyMotion ||
      typographyMotion.artifactType !== "typography_motion_plan" ||
      !camera ||
      camera.artifactType !== "framing_camera_plan" ||
      !visual ||
      visual.artifactType !== "visual_plan" ||
      !dialogueAudio ||
      dialogueAudio.artifactType !== "dialogue_audio_plan" ||
      !capabilitySelection ||
      capabilitySelection.artifactType !== "capability_selection" ||
      !adapterDecision ||
      adapterDecision.artifactType !== "adapter_decision" ||
      !artDirection ||
      artDirection.artifactType !== "art_direction_plan" ||
      !contextAssembly ||
      contextAssembly.artifactType !== "context_assembly_plan" ||
      !shotIntentMatrix ||
      shotIntentMatrix.artifactType !== "shot_intent_matrix" ||
      !textOpportunity ||
      textOpportunity.artifactType !== "text_opportunity_plan" ||
      !revision ||
      revision.artifactType !== "revision_plan" ||
      (planningBundle.payload.schemaVersion === "maul-planning-bundle/v2" &&
        (!textChunk ||
          textChunk.artifactType !== "text_chunk_plan" ||
          !textPlacement ||
          textPlacement.artifactType !== "text_placement_plan"))
    ) {
      throw new MaulLineageConflictError(
        "The Planning Bundle is incomplete or contains an artifact with the wrong governed type.",
      );
    }
    if (planningBundle.payload.schemaVersion === "maul-planning-bundle/v2") {
      if (
        !textChunk ||
        textChunk.artifactType !== "text_chunk_plan" ||
        !textPlacement ||
        textPlacement.artifactType !== "text_placement_plan" ||
        typographyMotion.payload.schemaVersion !==
          "maul-typography-motion-plan/v2"
      ) {
        throw new MaulLineageConflictError(
          "V2 Planning Bundle requires governed chunk, placement, and Typography Motion V2 artifacts.",
        );
      }
      const currentTextChunkHash = hashMaulPlanPayload(textChunk.payload);
      const currentTextPlacementHash = hashMaulPlanPayload(
        textPlacement.payload,
      );
      const referencesMatch =
        textPlacement.payload.textChunkPlanArtifactId ===
          textChunk.artifactId &&
        textPlacement.payload.textChunkPlanHash === currentTextChunkHash &&
        typographyMotion.payload.textChunkPlanArtifactId ===
          textChunk.artifactId &&
        typographyMotion.payload.textChunkPlanHash === currentTextChunkHash &&
        typographyMotion.payload.textPlacementPlanArtifactId ===
          textPlacement.artifactId &&
        typographyMotion.payload.textPlacementPlanHash ===
          currentTextPlacementHash;
      const lineageMatches =
        textPlacement.lineage.parentArtifactIds.includes(
          textChunk.artifactId,
        ) &&
        typographyMotion.lineage.parentArtifactIds.includes(
          textChunk.artifactId,
        ) &&
        typographyMotion.lineage.parentArtifactIds.includes(
          textPlacement.artifactId,
        ) &&
        planningBundle.lineage.parentArtifactIds.includes(
          textChunk.artifactId,
        ) &&
        planningBundle.lineage.parentArtifactIds.includes(
          textPlacement.artifactId,
        );
      if (!referencesMatch || !lineageMatches) {
        throw new MaulLineageConflictError(
          "V2 Planning Bundle contains a stale hash, lineage mismatch, or mismatched placement reference.",
        );
      }
    } else {
      if (
        typographyMotion.payload.schemaVersion !==
        "maul-typography-motion-plan/v1"
      ) {
        throw new MaulLineageConflictError(
          "Legacy Planning Bundle requires Typography Motion V1.",
        );
      }
      const legacyMappedWords = mapMaulTranscriptWordsToOutput({
        timestampMap: timeline.payload.timestampMap,
        words: analysis.payload.transcript.words
          .map((word, transcriptWordIndex) => ({
            ...word,
            transcriptWordIndex,
          }))
          .filter(
            (word) =>
              word.endMs > candidate.payload.sourceStartMs &&
              word.startMs < candidate.payload.sourceEndMs,
          ),
      });
      adaptMaulLegacyPlanningBundleV1({
        planningBundle: planningBundle.payload,
        typographyMotion: typographyMotion.payload,
        mappedWords: legacyMappedWords,
        editorialTimeline: timeline.payload,
      });
    }
    const planningInputs: MaulPlanningInputs = {
      project,
      source,
      analysis,
      timeline,
      candidate,
      treatment,
      textChunkPlan:
        typographyMotion.payload.schemaVersion ===
        "maul-typography-motion-plan/v1"
          ? typographyMotion.payload.textChunkPlan
          : null,
    };
    const planningArtifacts = {
      ...(textChunk?.artifactType === "text_chunk_plan" &&
      textPlacement?.artifactType === "text_placement_plan"
        ? {textChunk, textPlacement}
        : {}),
      observationSnapshot,
      candidateNarrative,
      beatMap,
      typographyMotion,
      camera,
      visual,
      audio: dialogueAudio,
      capabilitySelection,
      adapterDecision,
      artDirection,
      contextAssembly,
      shotIntentMatrix,
      textOpportunity,
      revision,
    };

    const sourcePath = path.resolve(source.payload.storageKey);
    const sourceBytes = await readFile(sourcePath);
    const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
    if (sourceSha256 !== source.payload.sha256.toLowerCase()) {
      throw new MaulLineageConflictError(
        "The render source failed authoritative SHA-256 verification.",
      );
    }
    if (
      !request.musicTrack.renderSafe ||
      !request.musicTrack.licenseVerified ||
      !request.musicTrack.commercialAllowed
    ) {
      throw new MaulLineageConflictError(
        "Music must be licensed, commercially allowed, verified, and render-safe.",
      );
    }
    for (const sfx of request.sfxAssets) {
      if (!sfx.renderSafe || !sfx.licenseVerified || !sfx.commercialAllowed) {
        throw new MaulLineageConflictError(
          `SFX ${sfx.id} must be licensed, commercially allowed, verified, and render-safe.`,
        );
      }
    }
    await Promise.all([
      readFile(request.musicTrack.storagePath),
      ...request.sfxAssets.map((sfx) => readFile(sfx.storagePath)),
    ]);

    const timestamp = this.now();
    const plannerTrack = assertTrackUsableForExport(
      musicTrackForPlanner(request, timestamp),
    );
    const captions = captionsForRender(
      timeline.payload,
      analysis.payload.transcript.words,
    );
    const audioPlan = buildVideoAwareAudioPlan({
      jobId: `${project.canonicalJobId}-${candidate.artifactId}`,
      projectId: project.id,
      userId: project.creatorId,
      sourceVideoId: source.artifactId,
      transcriptId: analysis.artifactId,
      videoDurationSec: timeline.payload.outputDurationMs / 1000,
      transcriptWords: captions.map((caption) => ({
        text: caption.text,
        start_ms: caption.startMs,
        end_ms: caption.endMs,
        confidence: caption.confidence ?? undefined,
      })),
      creativeDirection: {
        summary: treatment.payload.purpose,
        moodTags: [treatment.payload.treatmentId],
        pacing: `${treatment.payload.pacing.minCutsPerMinute}-${treatment.payload.pacing.maxCutsPerMinute} cuts per minute`,
        emphasisMoments: ["hook", "proof", "payoff"],
        constraints: treatment.payload.provenanceRules,
      },
      previewStartSec: 0,
      previewEndSec: timeline.payload.outputDurationMs / 1000,
      planMode: "render_ready",
      candidateTracks: [plannerTrack],
      now: () => timestamp,
    });
    if (
      audioPlan.musicEvents.length === 0 ||
      audioPlan.musicEvents.some(
        (event) => !event.renderSafe || event.previewOnly,
      )
    ) {
      throw new MaulLineageConflictError(
        "The video-aware audio plan did not produce a render-safe music event.",
      );
    }
    const compiledManifest = compileMaulUnifiedShortRenderManifest({
      inputs: planningInputs,
      planningBundle,
      planningArtifacts,
      captions,
      audioPlan,
      request,
      createdAt: timestamp,
    });
    const renderManifestResult = await this.registerArtifact(projectId, {
      artifactType: "render_manifest",
      parentArtifactIds: [
        source.artifactId,
        analysis.artifactId,
        timeline.artifactId,
        candidate.artifactId,
        treatment.artifactId,
        review.artifactId,
        planningBundle.artifactId,
        ...Object.values(planningBundle.payload.planArtifactIds),
      ],
      producedBy: { module: "maul-manifest-compiler", version: "1" },
      payload: compiledManifest,
    });
    if (renderManifestResult.artifact.artifactType !== "render_manifest") {
      throw new Error(
        "MAUL Manifest Compiler produced an unexpected artifact type.",
      );
    }
    let proofOutcome:
      | { available: true; proof: Awaited<ReturnType<MaulQualityTruthProofProvider>> }
      | { available: false; error: unknown };
    try {
      proofOutcome = {
        available: true,
        proof: await this.qualityTruthProofProvider(
          renderManifestResult.artifact.payload,
        ),
      };
    } catch (error) {
      proofOutcome = {available: false, error};
    }
    const qualityTruth = proofOutcome.available
      ? evaluateMaulQualityTruth(
          renderManifestResult.artifact.payload,
          proofOutcome.proof,
        )
      : buildUnavailableMaulQualityTruthResult(
          renderManifestResult.artifact.payload,
          proofOutcome.error,
        );
    const audit = await this.store.readAudit(project.id);
    await this.store.appendAuditEvent(
      this.auditEvent({
        project: renderManifestResult.project,
        sequence: audit.length + 1,
        type: "quality_truth_evaluated",
        artifactId: renderManifestResult.artifact.artifactId,
        detail: {...qualityTruth},
      }),
    );
    if (qualityTruth.status === "blocked") {
      throw new MaulLineageConflictError(
        `MAUL Quality Truth gate blocked render: ${qualityTruth.failures
          .map((failure) => `${failure.code}: ${failure.message}`)
          .join("; ")}`,
      );
    }
    const renderResult = await this.renderEngine({
      workRoot: path.join(this.store.projectDir(project.id), "render-work"),
      manifest: renderManifestResult.artifact.payload,
    });
    const calculatedSha256 = createHash("sha256")
      .update(renderResult.bytes)
      .digest("hex");
    if (
      calculatedSha256 !== renderResult.sha256 ||
      renderResult.width !== 1080 ||
      renderResult.height !== 1920 ||
      renderResult.durationMs !== timeline.payload.outputDurationMs
    ) {
      throw new MaulLineageConflictError(
        "Rendered MP4 failed output integrity or 9:16 conformance checks.",
      );
    }
    const fileId = createId("maul_export_file");
    await this.store.writeExportFile({
      projectId: project.id,
      fileId,
      filename: `${
        candidate.payload.title
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "maul-short"
      }.mp4`,
      bytes: renderResult.bytes,
      sha256: calculatedSha256,
    });
    const deterministicReplayKey = createHash("sha256")
      .update(
        JSON.stringify({
          sourceSha256,
          candidateArtifactId: candidate.artifactId,
          treatmentReplayKey: treatment.payload.replayKey,
          reviewArtifactId: review.artifactId,
          audioPlanId: audioPlan.id,
          renderManifestReplayKey:
            renderManifestResult.artifact.payload.replayKey,
        }),
      )
      .digest("hex");
    const result = await this.registerArtifact(projectId, {
      artifactType: "export_artifact",
      parentArtifactIds: [
        source.artifactId,
        candidate.artifactId,
        timeline.artifactId,
        treatment.artifactId,
        review.artifactId,
        renderManifestResult.artifact.artifactId,
      ],
      producedBy: { module: "maul-short-render", version: "1" },
      payload: {
        sourceAssetId: source.artifactId,
        candidateArtifactId: candidate.artifactId,
        timelineArtifactId: timeline.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        renderManifestArtifactId: renderManifestResult.artifact.artifactId,
        storageKey: `maul-export:${fileId}`,
        mediaType: "video/mp4",
        sha256: calculatedSha256,
        durationMs: renderResult.durationMs,
        width: renderResult.width,
        height: renderResult.height,
        evidence: {
          technicalValidationPassed: true,
          rightsVerified: true,
          deterministicReplayKey,
          preRenderReviewPassed: true,
          qualityGate: {
            status: "unverified",
            releaseEligible: false,
            implementationLabel: "encoded-output-verified",
            renderedEvidenceArtifactId: null,
            postRenderHumanApprovalArtifactId: null,
            hardFailures: [
              {
                id: "rendered_quality_evidence_missing",
                dimension: "perceptual_quality",
                message:
                  "The encoded render has not passed the independent rendered Quality Evidence Bundle.",
              },
              {
                id: "post_render_human_approval_missing",
                dimension: "human_approval",
                message:
                  "The encoded render has not received authenticated post-render human approval.",
              },
            ],
          },
          remotionCompositionId: renderResult.evidence.compositionId,
          audioPlanId: audioPlan.id,
          sourceMappingPreserved: renderResult.evidence.sourceMappingPreserved,
          fileSizeBytes: renderResult.bytes.length,
          warnings: [],
        },
      },
    });
    if (result.artifact.artifactType !== "export_artifact") {
      throw new Error("MAUL Short Render produced the wrong artifact type.");
    }
    return { export: result.artifact, audioPlan };
  }

  public async getExportFile(projectId: string, artifactId: string) {
    const { artifacts } = await this.getProject(projectId);
    const artifact = artifacts.find(
      (candidate) => candidate.artifactId === artifactId,
    );
    if (!artifact || artifact.artifactType !== "export_artifact") {
      throw new MaulProjectNotFoundError(
        `MAUL export ${artifactId} was not found.`,
      );
    }
    const match = /^maul-export:(.+)$/.exec(artifact.payload.storageKey);
    if (!artifact.payload.evidence.qualityGate.releaseEligible) {
      throw new MaulLineageConflictError(
        `MAUL export ${artifactId} is held by the release gate until rendered quality evidence and post-render human approval pass.`,
      );
    }
    if (!match?.[1]) {
      throw new MaulProjectNotFoundError(
        `MAUL export ${artifactId} has no local downloadable file.`,
      );
    }
    const file = await this.store.readExportFile(projectId, match[1]);
    if (file.sha256 !== artifact.payload.sha256) {
      throw new MaulLineageConflictError(
        `MAUL export ${artifactId} failed its SHA-256 integrity check.`,
      );
    }
    return file;
  }

  public async createThumbnails(
    projectId: string,
    input: unknown,
  ): Promise<{
    direction: Extract<
      MaulArtifactRecord,
      { artifactType: "thumbnail_direction" }
    >;
    candidates: Array<
      Extract<MaulArtifactRecord, { artifactType: "thumbnail_candidate" }>
    >;
  }> {
    const request: MaulThumbnailGenerationRequest =
      maulThumbnailGenerationRequestSchema.parse(input);
    const { project, artifacts } = await this.getProject(projectId);
    const exported = artifacts.find(
      (artifact) => artifact.artifactId === request.exportArtifactId,
    );
    if (!exported || exported.artifactType !== "export_artifact") {
      throw new MaulProjectNotFoundError(
        `MAUL export ${request.exportArtifactId} was not found.`,
      );
    }
    if (
      !exported.payload.evidence.qualityGate.releaseEligible ||
      !exported.payload.evidence.rightsVerified
    ) {
      throw new MaulLineageConflictError(
        "Thumbnail generation requires a quality-gated, rights-verified short.",
      );
    }
    const review = artifacts.find(
      (artifact) =>
        artifact.artifactId === exported.payload.reviewDecisionArtifactId,
    );
    const candidate = artifacts.find(
      (artifact) =>
        artifact.artifactId === exported.payload.candidateArtifactId,
    );
    const timeline = artifacts.find(
      (artifact) => artifact.artifactId === exported.payload.timelineArtifactId,
    );
    const source = artifacts.find(
      (artifact) => artifact.artifactId === exported.payload.sourceAssetId,
    );
    if (
      !review ||
      review.artifactType !== "review_decision" ||
      review.payload.decision !== "approved"
    ) {
      throw new MaulLineageConflictError(
        "Thumbnail generation requires the short's approved review decision.",
      );
    }
    if (
      !candidate ||
      candidate.artifactType !== "candidate" ||
      !timeline ||
      timeline.artifactType !== "editorial_timeline" ||
      !source ||
      source.artifactType !== "source_asset"
    ) {
      throw new MaulLineageConflictError(
        "Thumbnail source lineage is incomplete.",
      );
    }
    const analysis = artifacts.find(
      (artifact) => artifact.artifactId === timeline.payload.analysisArtifactId,
    );
    if (!analysis || analysis.artifactType !== "analysis") {
      throw new MaulLineageConflictError(
        "Thumbnail direction requires Media Analysis evidence.",
      );
    }
    const speakerSamples = analysis.payload.speakerTracks
      .flatMap((track) =>
        track.samples.map((sample) => ({
          ...sample,
          speakerId: track.speakerId,
        })),
      )
      .filter(
        (sample) =>
          sample.sourceMs >= candidate.payload.sourceStartMs &&
          sample.sourceMs <= candidate.payload.sourceEndMs,
      );
    const bestSpeaker = speakerSamples.sort(
      (left, right) =>
        right.confidence - left.confidence || left.sourceMs - right.sourceMs,
    )[0];
    const fallbackCrop = timeline.payload.speakerCropTracks[0]?.crop ?? {
      x: 0.3418,
      y: 0,
      width: 0.3164,
      height: 1,
    };
    const speakerFrame = bestSpeaker
      ? {
          sourceMs: bestSpeaker.sourceMs,
          speakerId: bestSpeaker.speakerId,
          confidence: bestSpeaker.confidence,
          crop: {
            x: bestSpeaker.x,
            y: bestSpeaker.y,
            width: bestSpeaker.width,
            height: bestSpeaker.height,
          },
          reason:
            "Highest-confidence principal-speaker frame inside the approved candidate.",
        }
      : {
          sourceMs: Math.round(
            (candidate.payload.sourceStartMs + candidate.payload.sourceEndMs) /
              2,
          ),
          speakerId: "principal_unknown",
          confidence: 0.5,
          crop: fallbackCrop,
          reason:
            "Centered candidate midpoint fallback because no face-track sample was available.",
        };
    const transcriptWords = analysis.payload.transcript.words.filter(
      (word) =>
        word.endMs > candidate.payload.sourceStartMs &&
        word.startMs < candidate.payload.sourceEndMs,
    );
    const copyOptions = thumbnailCopyOptions(
      transcriptWords,
      request.requestedCount,
    );
    if (copyOptions.length < 2) {
      throw new MaulLineageConflictError(
        "The source cannot support two distinct, source-grounded thumbnail copy options.",
      );
    }
    const promptTemplate = [
      "Create a premium, legible 16:9 editorial thumbnail from the supplied source frame.",
      "Preserve the real speaker's identity, expression, and photographic truth.",
      "Use the exact supplied headline text only; do not invent claims, numbers, logos, or people.",
      `Brand: ${request.brandKit.name}; primary ${request.brandKit.primaryColor}; accent ${request.brandKit.accentColor}; type ${request.brandKit.fontFamily}.`,
      "Keep the face unobstructed, use strong mobile hierarchy, and leave breathing room.",
    ].join(" ");
    const directionResult = await this.registerArtifact(projectId, {
      artifactType: "thumbnail_direction",
      parentArtifactIds: [
        exported.artifactId,
        candidate.artifactId,
        source.artifactId,
      ],
      producedBy: { module: "maul-thumbnail-direction", version: "1" },
      payload: {
        exportArtifactId: exported.artifactId,
        candidateArtifactId: candidate.artifactId,
        sourceAssetId: source.artifactId,
        speakerFrame,
        copyOptions,
        brandKit: request.brandKit,
        providerPolicy: {
          preferredProvider: "nano_banana",
          model: "gemini-3.1-flash-image",
          fallback: "deterministic_source_frame_svg",
          preserveSpeakerIdentity: true,
        },
        promptTemplate,
        negativeConstraints: [
          "No fabricated quote or number.",
          "No face replacement, beautification, or identity drift.",
          "No reference-corpus pixels, creator marks, or unlicensed logo.",
          "No text outside the exact source-grounded copy.",
        ],
        provenanceNotes: [
          `Speaker frame maps to authoritative source ${source.artifactId} at ${speakerFrame.sourceMs}ms.`,
          "Every copy option is a contiguous span of the approved transcript.",
        ],
      },
    });
    if (directionResult.artifact.artifactType !== "thumbnail_direction") {
      throw new Error(
        "MAUL Thumbnail Direction produced the wrong artifact type.",
      );
    }

    const generated = await Promise.all(
      copyOptions
        .slice(0, request.requestedCount)
        .map(async (copy, variationIndex) => ({
          copy,
          variationIndex,
          result: await this.thumbnailGenerator({
            sourcePath: path.resolve(source.payload.storageKey),
            sourceMs: speakerFrame.sourceMs,
            copy: copy.text,
            prompt: `${promptTemplate} Exact headline: "${copy.text}". Variation ${variationIndex + 1}.`,
            variationIndex,
            brandKit: request.brandKit,
          }),
        })),
    );
    const candidates: Array<
      Extract<MaulArtifactRecord, { artifactType: "thumbnail_candidate" }>
    > = [];
    for (const item of generated) {
      const sha256 = createHash("sha256")
        .update(item.result.bytes)
        .digest("hex");
      const fileId = createId("maul_thumbnail_file");
      const extension =
        item.result.mediaType === "image/png"
          ? "png"
          : item.result.mediaType === "image/jpeg"
            ? "jpg"
            : "svg";
      await this.store.writeThumbnailFile({
        projectId: project.id,
        fileId,
        filename: `maul-thumbnail-${item.variationIndex + 1}.${extension}`,
        contentType: item.result.mediaType,
        bytes: item.result.bytes,
        sha256,
      });
      const sourceFidelity = Number(
        (0.88 + speakerFrame.confidence * 0.1).toFixed(3),
      );
      const legibility = item.copy.text.length <= 36 ? 0.96 : 0.84;
      const composition = Number(
        (0.94 - item.variationIndex * 0.025).toFixed(3),
      );
      const brandFit = request.brandKit.kind === "supplied" ? 0.96 : 0.9;
      const overall = Number(
        ((sourceFidelity + legibility + composition + brandFit) / 4).toFixed(3),
      );
      const artifactResult = await this.registerArtifact(projectId, {
        artifactType: "thumbnail_candidate",
        parentArtifactIds: [
          directionResult.artifact.artifactId,
          exported.artifactId,
          source.artifactId,
        ],
        producedBy: { module: "maul-thumbnail-generator", version: "1" },
        payload: {
          directionArtifactId: directionResult.artifact.artifactId,
          exportArtifactId: exported.artifactId,
          sourceAssetId: source.artifactId,
          generationId: item.result.generationId,
          provider: item.result.provider,
          model: item.result.model,
          storageKey: `maul-thumbnail:${fileId}`,
          mediaType: item.result.mediaType,
          sha256,
          width: item.result.width ?? 1280,
          height: item.result.height ?? 720,
          copy: item.copy.text,
          sourceFrameMs: speakerFrame.sourceMs,
          score: { sourceFidelity, legibility, composition, brandFit, overall },
          reviewStatus: "pending",
        },
      });
      if (artifactResult.artifact.artifactType !== "thumbnail_candidate") {
        throw new Error(
          "MAUL Thumbnail Generation produced the wrong artifact type.",
        );
      }
      candidates.push(artifactResult.artifact);
    }
    candidates.sort(
      (left, right) => right.payload.score.overall - left.payload.score.overall,
    );
    return { direction: directionResult.artifact, candidates };
  }

  public async reviewThumbnail(
    projectId: string,
    artifactId: string,
    input: unknown,
  ): Promise<{
    review: Extract<MaulArtifactRecord, { artifactType: "review_decision" }>;
  }> {
    const request: MaulThumbnailReviewRequest =
      maulThumbnailReviewRequestSchema.parse(input);
    const { artifacts } = await this.getProject(projectId);
    const candidate = artifacts.find(
      (artifact) => artifact.artifactId === artifactId,
    );
    if (!candidate || candidate.artifactType !== "thumbnail_candidate") {
      throw new MaulProjectNotFoundError(
        `MAUL thumbnail ${artifactId} was not found.`,
      );
    }
    if (
      request.decision === "approved" &&
      candidate.payload.score.overall < 0.75
    ) {
      throw new MaulLineageConflictError(
        "Thumbnail approval is blocked below the 0.75 quality threshold.",
      );
    }
    const result = await this.registerArtifact(projectId, {
      artifactType: "review_decision",
      parentArtifactIds: [candidate.artifactId],
      producedBy: { module: "maul-thumbnail-review", version: "1" },
      payload: {
        subjectArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: null,
        reviewerId: request.reviewerId,
        decision: request.decision,
        failureClasses:
          request.decision === "approved" ? [] : ["thumbnail_not_approved"],
        rationale: request.rationale,
        rubricScores: {
          source_fidelity: candidate.payload.score.sourceFidelity * 100,
          legibility: candidate.payload.score.legibility * 100,
          composition: candidate.payload.score.composition * 100,
          brand_fit: candidate.payload.score.brandFit * 100,
        },
        weightedScore: candidate.payload.score.overall * 100,
        decidedAt: this.now(),
      },
    });
    if (result.artifact.artifactType !== "review_decision") {
      throw new Error(
        "MAUL Thumbnail Review produced the wrong artifact type.",
      );
    }
    return { review: result.artifact };
  }

  public async getThumbnailFile(projectId: string, artifactId: string) {
    const { artifacts } = await this.getProject(projectId);
    const artifact = artifacts.find(
      (candidate) => candidate.artifactId === artifactId,
    );
    if (!artifact || artifact.artifactType !== "thumbnail_candidate") {
      throw new MaulProjectNotFoundError(
        `MAUL thumbnail ${artifactId} was not found.`,
      );
    }
    const match = /^maul-thumbnail:(.+)$/.exec(artifact.payload.storageKey);
    if (!match?.[1]) {
      throw new MaulProjectNotFoundError(
        `MAUL thumbnail ${artifactId} has no local file.`,
      );
    }
    const file = await this.store.readThumbnailFile(projectId, match[1]);
    if (file.sha256 !== artifact.payload.sha256) {
      throw new MaulLineageConflictError(
        `MAUL thumbnail ${artifactId} failed its SHA-256 integrity check.`,
      );
    }
    return file;
  }

  public async deleteProjectPermanently(
    projectId: string,
    confirmProjectId: string,
    reason: string,
  ): Promise<{ deleted: true; projectId: string; recoverable: false }> {
    if (confirmProjectId !== projectId) {
      throw new Error(
        "confirmProjectId must exactly match the MAUL project being deleted.",
      );
    }
    if (!reason.trim()) {
      throw new Error("A permanent deletion reason is required.");
    }
    const project = await this.loadProject(projectId);
    await this.store.deleteProjectPermanently(project);
    return { deleted: true, projectId, recoverable: false };
  }

  public async resumeProject(
    projectId: string,
    input: unknown,
  ): Promise<{
    project: MaulProject;
  }> {
    const reason =
      typeof input === "object" && input !== null && "reason" in input
        ? String(input.reason ?? "").trim()
        : "";
    if (!reason) {
      throw new Error("A resume reason is required.");
    }

    return this.withProjectLock(projectId, async () => {
      const current = await this.loadProject(projectId);
      const audit = await this.store.readAudit(projectId);
      const next = maulProjectSchema.parse({
        ...current,
        activeRunId: createId("maul_run"),
        revision: current.revision + 1,
        updatedAt: this.now(),
      });
      await this.store.writeProject(next);
      await this.store.appendAuditEvent(
        this.auditEvent({
          project: next,
          sequence: audit.length + 1,
          type: "project_resumed",
          detail: { reason, previousRunId: current.activeRunId },
        }),
      );
      return { project: next };
    });
  }

  public async registerArtifact(
    projectId: string,
    input: unknown,
  ): Promise<{ project: MaulProject; artifact: MaulArtifactRecord }> {
    const request: MaulArtifactCreateRequest =
      maulArtifactCreateRequestSchema.parse(input);
    return this.withProjectLock(projectId, async () => {
      const project = await this.loadProject(projectId);
      const parentIds = [...new Set(request.parentArtifactIds)];
      const parentArtifacts: MaulArtifactRecord[] = [];

      for (const parentId of parentIds) {
        const owner = await this.store.readArtifactOwner(parentId);
        if (!owner) {
          throw new MaulLineageConflictError(
            `Unknown parent artifact ${parentId}.`,
          );
        }
        if (owner !== project.id) {
          throw new MaulLineageConflictError(
            `Parent artifact ${parentId} belongs to another project.`,
          );
        }
        parentArtifacts.push(
          await this.store.readArtifact(project.id, parentId),
        );
      }

      if (
        request.artifactType === "export_artifact" &&
        parentArtifacts.some(
          (artifact) => artifact.artifactType === "reference_corpus_item",
        )
      ) {
        throw new MaulLineageConflictError(
          "Reference Corpus media and records cannot become export artifact parents.",
        );
      }

      const explicitReferences = collectArtifactReferences(request.payload);
      for (const referenceId of explicitReferences) {
        const owner = await this.store.readArtifactOwner(referenceId);
        if (!owner) {
          throw new MaulLineageConflictError(
            `Referenced artifact ${referenceId} was not found.`,
          );
        }
        if (owner !== project.id) {
          throw new MaulLineageConflictError(
            `Referenced artifact ${referenceId} belongs to another project.`,
          );
        }
        if (!parentIds.includes(referenceId)) {
          throw new MaulLineageConflictError(
            `Referenced artifact ${referenceId} must be declared as a parent.`,
          );
        }
      }

      if (
        "sourceAssetId" in request.payload &&
        request.payload.sourceAssetId !== project.rootSourceAssetId
      ) {
        throw new MaulLineageConflictError(
          "Artifact sourceAssetId does not match the project's authoritative source.",
        );
      }

      const timestamp = this.now();
      const artifact = maulArtifactRecordSchema.parse({
        schemaVersion: "maul-artifact/v1",
        artifactId: createId("maul_artifact"),
        artifactType: request.artifactType,
        lineage: {
          projectId: project.id,
          canonicalJobId: project.canonicalJobId,
          runId: project.activeRunId,
          rootSourceAssetId: project.rootSourceAssetId,
          parentArtifactIds: parentIds,
          sequence: project.artifactIds.length + 1,
          producedBy: request.producedBy ?? {
            module: "maul-project-service",
            version: "1",
          },
          createdAt: timestamp,
        },
        payload: request.payload,
      });
      const nextProject = maulProjectSchema.parse({
        ...project,
        artifactIds: [...project.artifactIds, artifact.artifactId],
        updatedAt: timestamp,
      });
      const audit = await this.store.readAudit(project.id);
      await this.store.writeArtifact(artifact);
      await this.store.writeProject(nextProject);
      await this.store.appendAuditEvent(
        this.auditEvent({
          project: nextProject,
          sequence: audit.length + 1,
          type: "artifact_registered",
          artifactId: artifact.artifactId,
          detail: {
            artifactType: artifact.artifactType,
            sequence: artifact.lineage.sequence,
            parentArtifactIds: artifact.lineage.parentArtifactIds,
          },
        }),
      );
      return { project: nextProject, artifact };
    });
  }
}

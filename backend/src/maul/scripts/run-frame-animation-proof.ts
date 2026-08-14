import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {stat, mkdir, readFile, writeFile} from "node:fs/promises";
import {availableParallelism} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

import {
  joinShortsTextTokens,
  type MaulRenderLayerPolicy,
} from "@prometheus/shared-types";
import {z} from "zod";

import {transcribeWithAssemblyAI} from "../../integrations/assemblyai.js";
import {resolveRepositoryMediaTool} from "../repository-media-tools.js";
import {runMaulMediaObservation} from "../mediapipe-observation.js";
import {
  DEFAULT_MAUL_TYPOGRAPHY_SFX,
  selectMaulTypographySfx,
} from "../typography-sfx.js";

const execFileAsync = promisify(execFile);
const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../../..");
const defaultMediaPath = path.join(
  repoRoot,
  "remotion-app/public/uploads/edit_mrjqjl9t_3edf3cf8db/1783978174548-source-first-video-10s.mp4",
);
const defaultTranscriptPath = path.join(
  repoRoot,
  "backend/src/maul/fixtures/frame-animation-proof-transcript.json",
);
const defaultOutputDir = path.join(repoRoot, "artifacts/maul-frame-animation-proof");
const defaultProofMusicPath = path.join(
  repoRoot,
  "remotion-app/public/audio/music/lo-fi-chill-soft-focus--the-way-instrumental.mp3",
);

export const FRAME_ANIMATION_PROOF_LAYER_POLICY: MaulRenderLayerPolicy = {
  baseVideo: "required",
  typography: "required",
  sourceTreatment: "disabled",
  sourceLegibilityOverlay: "disabled",
  editorialCuts: "disabled",
  transitions: "disabled",
  backgroundAnimation: "disabled",
  motionGraphics: "disabled",
  audioTreatment: "enabled",
};

export const FULL_SCALE_MAUL_LAYER_POLICY: MaulRenderLayerPolicy = {
  baseVideo: "required",
  typography: "required",
  sourceTreatment: "enabled",
  sourceLegibilityOverlay: "enabled",
  editorialCuts: "enabled",
  transitions: "enabled",
  backgroundAnimation: "enabled",
  motionGraphics: "enabled",
  audioTreatment: "enabled",
};

export const resolveFrameAnimationProofRenderConcurrency = (
  requested: number,
  availableCpu = availableParallelism(),
): number => {
  if (!Number.isFinite(requested) || requested < 1) {
    throw new Error("Frame-animation proof render concurrency must be at least 1.");
  }
  return Math.min(Math.floor(requested), Math.max(1, Math.floor(availableCpu)));
};

const proofWordSchema = z.object({
  text: z.string().trim().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
}).strict().refine((word) => word.endMs > word.startMs, {
  path: ["endMs"],
  message: "Proof transcript words require positive duration.",
});

const proofTranscriptSchema = z.object({
  schemaVersion: z.literal("maul-frame-animation-proof-transcript/v1"),
  source: z.enum(["assemblyai", "offline_fixture"]),
  language: z.literal("en"),
  text: z.string().trim().min(1),
  words: z.array(proofWordSchema).min(1),
}).strict().superRefine((transcript, context) => {
  transcript.words.forEach((word, index) => {
    if (index > 0 && word.startMs < transcript.words[index - 1]!.startMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["words", index, "startMs"],
        message: "Proof transcript words must be ordered.",
      });
    }
  });
});

const proofWordArraySchema = z.array(proofWordSchema).min(1);

export type FrameAnimationProofTranscript = z.infer<typeof proofTranscriptSchema>;

type ProofTranscriber = (input: {
  filePath: string;
  apiKey: string;
  onActivity?: (detail: string) => void | Promise<void>;
}) => Promise<Array<{
  text: string;
  start_ms: number;
  end_ms: number;
  confidence?: number;
}>>;

const isReadableFile = async (filePath: string): Promise<boolean> => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

export const resolveFrameAnimationProofTranscript = async ({
  mediaPath,
  transcriptPath,
  assemblyAiApiKey = "",
  transcribe = transcribeWithAssemblyAI,
  onActivity,
}: {
  mediaPath: string;
  transcriptPath?: string;
  assemblyAiApiKey?: string;
  transcribe?: ProofTranscriber;
  onActivity?: (detail: string) => void | Promise<void>;
}): Promise<FrameAnimationProofTranscript> => {
  if (transcriptPath && await isReadableFile(transcriptPath)) {
    const persisted = JSON.parse(await readFile(transcriptPath, "utf8")) as unknown;
    if (Array.isArray(persisted)) {
      const words = proofWordArraySchema.parse(persisted);
      return proofTranscriptSchema.parse({
        schemaVersion: "maul-frame-animation-proof-transcript/v1",
        source: "offline_fixture",
        language: "en",
        text: joinShortsTextTokens(words.map((word) => word.text)),
        words,
      });
    }
    return proofTranscriptSchema.parse(persisted);
  }

  if (assemblyAiApiKey.trim()) {
    const rawWords = await transcribe({
      filePath: mediaPath,
      apiKey: assemblyAiApiKey.trim(),
      onActivity,
    });
    return proofTranscriptSchema.parse({
      schemaVersion: "maul-frame-animation-proof-transcript/v1",
      source: "assemblyai",
      language: "en",
      text: joinShortsTextTokens(rawWords.map((word) => word.text.trim())),
      words: rawWords.map((word) => ({
        text: word.text.trim(),
        startMs: Math.round(word.start_ms),
        endMs: Math.round(word.end_ms),
        confidence: word.confidence ?? 1,
      })),
    });
  }

  throw new Error(
    "Frame-animation proof requires AssemblyAI credentials or an explicit persisted timed transcript.",
  );
};

type ProofPlanShape = {
  tokens: readonly {tokenId: string; text: string}[];
  segments: readonly {segmentId: string; tokenIds: readonly string[]}[];
  programs: readonly {
    animationId: string;
    executorId?: string;
    target: {placementSegmentId: string; tokenIds: readonly string[]};
    frameMotion?: {
      executorId: string;
      tokenId: string;
      phases: {
        entry: {startFrame: number; endFrame: number};
        hold: {startFrame: number; endFrame: number};
        exit: {startFrame: number; endFrame: number};
      };
    };
  }[];
};

export const runIndependentProofAnalyses = async <TTranscript, TObservation>({
  resolveTranscript,
  observeMedia,
}: {
  resolveTranscript: () => Promise<TTranscript>;
  observeMedia: () => Promise<TObservation>;
}): Promise<{transcript: TTranscript; mediaObservation: TObservation}> => {
  const transcriptPromise = resolveTranscript();
  const observationPromise = observeMedia();
  const [transcript, mediaObservation] = await Promise.all([
    transcriptPromise,
    observationPromise,
  ]);
  return {transcript, mediaObservation};
};

export const selectFrameAnimationProofSfx = selectMaulTypographySfx;

export const assertFrameAnimationProofPlan = (
  plan: ProofPlanShape,
): {
  tokenCount: number;
  segmentCount: number;
  programCount: number;
  executorIds: string[];
} => {
  const tokensById = new Map(plan.tokens.map((token) => [token.tokenId, token]));
  const segmentsById = new Map(plan.segments.map((segment) => [segment.segmentId, segment]));
  if (tokensById.size !== plan.tokens.length || segmentsById.size !== plan.segments.length) {
    throw new Error("Frame-animation proof contains duplicate token or segment IDs.");
  }
  for (const program of plan.programs) {
    const frameMotion = program.frameMotion;
    const segment = segmentsById.get(program.target.placementSegmentId);
    if (
      !frameMotion ||
      !program.executorId ||
      frameMotion.executorId !== program.executorId ||
      program.target.tokenIds.length !== 1 ||
      program.target.tokenIds[0] !== frameMotion.tokenId ||
      !segment?.tokenIds.includes(frameMotion.tokenId)
    ) {
      throw new Error(
        `Frame-animation proof program ${program.animationId} has an unresolved executor or token target.`,
      );
    }
  }
  for (const segment of plan.segments) {
    for (const tokenId of segment.tokenIds) {
      if (!tokensById.has(tokenId)) {
        throw new Error(`Frame-animation proof segment references missing token ${tokenId}.`);
      }
      const programs = plan.programs
        .filter((program) => (
          program.target.placementSegmentId === segment.segmentId &&
          program.frameMotion?.tokenId === tokenId
        ))
        .sort((left, right) => (
          left.frameMotion!.phases.entry.startFrame -
          right.frameMotion!.phases.entry.startFrame
        ));
      if (programs.length === 0) {
        throw new Error(`Every placed token requires a compiled frame program; ${tokenId} is missing.`);
      }
      for (let index = 1; index < programs.length; index += 1) {
        const previous = programs[index - 1]!.frameMotion!;
        const current = programs[index]!.frameMotion!;
        if (current.phases.entry.startFrame < previous.phases.exit.endFrame) {
          throw new Error(`Frame programs for ${tokenId} overlap or duplicate one another.`);
        }
      }
    }
  }
  return {
    tokenCount: plan.tokens.length,
    segmentCount: plan.segments.length,
    programCount: plan.programs.length,
    executorIds: [...new Set(plan.programs.map((program) => program.executorId!))].sort(),
  };
};

const sha256 = (bytes: Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const proofMediaSchema = z.object({
  streams: z.array(z.object({
    codec_type: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    avg_frame_rate: z.string().optional(),
    r_frame_rate: z.string().optional(),
  }).passthrough()),
  format: z.object({duration: z.string()}).passthrough(),
}).passthrough();

const parseFrameRate = (value: string | undefined): number | null => {
  if (!value) return null;
  const [numeratorText, denominatorText = "1"] = value.split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  const fps = numerator / denominator;
  return Number.isFinite(fps) && fps > 0 ? fps : null;
};

const probeProofMedia = async (mediaPath: string) => {
  const receipt = await resolveRepositoryMediaTool({tool: "ffprobe", repoRoot});
  if (receipt.status !== "available") throw new Error(receipt.reason);
  const {stdout} = await execFileAsync(receipt.executablePath, [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", mediaPath,
  ], {maxBuffer: 8 * 1024 * 1024});
  const parsed = proofMediaSchema.parse(JSON.parse(stdout));
  const video = parsed.streams.find((stream) => stream.codec_type === "video");
  const durationMs = Math.round(Number(parsed.format.duration) * 1000);
  const fps = parseFrameRate(video?.avg_frame_rate) ?? parseFrameRate(video?.r_frame_rate);
  if (!video?.width || !video.height || !fps || !Number.isInteger(durationMs) || durationMs <= 0) {
    throw new Error("Frame-animation proof could not resolve deterministic media metadata.");
  }
  return {
    width: video.width,
    height: video.height,
    fps,
    durationMs,
    hasAudio: parsed.streams.some((stream) => stream.codec_type === "audio"),
  };
};

export type FrameAnimationProofResult = {
  outputDirectory: string;
  videoPath: string | null;
  manifestPath: string;
  transcriptPath: string;
  diagnosticsPath: string;
  transcriptSource: FrameAnimationProofTranscript["source"];
  tokenCount: number;
  segmentCount: number;
  programCount: number;
};

export const runFrameAnimationProof = async ({
  mediaPath = defaultMediaPath,
  transcriptPath,
  outputDirectory = defaultOutputDir,
  assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY ?? "",
  planOnly = false,
  fullScale = false,
  livePlanning = false,
  renderConcurrency = 6,
}: {
  mediaPath?: string;
  transcriptPath?: string;
  outputDirectory?: string;
  assemblyAiApiKey?: string;
  planOnly?: boolean;
  fullScale?: boolean;
  livePlanning?: boolean;
  renderConcurrency?: number;
} = {}): Promise<FrameAnimationProofResult> => {
  const resolvedMediaPath = path.resolve(mediaPath);
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  if (!await isReadableFile(resolvedMediaPath)) {
    throw new Error(`Frame-animation proof media is unavailable: ${resolvedMediaPath}`);
  }
  if (
    resolvedOutputDirectory === repoRoot ||
    resolvedOutputDirectory === path.parse(resolvedOutputDirectory).root
  ) {
    throw new Error("Frame-animation proof output cannot be a repository or filesystem root.");
  }
  const runStartedAt = Date.now();
  let stageStartedAt = runStartedAt;
  const logStageTiming = (stage: string): void => {
    const completedAt = Date.now();
    process.stdout.write(
      `[timing] ${stage} stageMs=${completedAt - stageStartedAt} totalMs=${completedAt - runStartedAt}\n`,
    );
    stageStartedAt = completedAt;
  };
  const media = await probeProofMedia(resolvedMediaPath);
  logStageTiming("media_probe");
  if (media.durationMs < 9_000 || media.durationMs > 65_000) {
    throw new Error(
      `Frame-animation launch proof requires a 10-65 second source; received ${media.durationMs}ms.`,
    );
  }
  const {loadEnv} = await import("../../config.js");
  const configuredEnv = loadEnv();
  const analysisStartedAt = Date.now();
  const [
    {transcript, mediaObservation},
    [
      {createBackendApp},
      {renderMaulShortLocally},
      {createMediaObservationSceneEvidenceProvider},
    ],
  ] = await Promise.all([
    runIndependentProofAnalyses({
      resolveTranscript: async () => {
        const startedAt = Date.now();
        const result = await resolveFrameAnimationProofTranscript({
          mediaPath: resolvedMediaPath,
          transcriptPath: transcriptPath
            ? path.resolve(transcriptPath)
            : assemblyAiApiKey.trim() ? undefined : defaultTranscriptPath,
          assemblyAiApiKey: assemblyAiApiKey.trim()
            ? assemblyAiApiKey
            : configuredEnv.ASSEMBLYAI_API_KEY,
          onActivity: (detail) => {
            process.stdout.write(`[assemblyai] ${detail}\n`);
          },
        });
        process.stdout.write(`[timing] assemblyai_transcript stageMs=${Date.now() - startedAt}\n`);
        return result;
      },
      observeMedia: async () => {
        const startedAt = Date.now();
        const result = await runMaulMediaObservation({
          sourcePath: resolvedMediaPath,
          durationMs: media.durationMs,
          outputWidth: 1_080,
          outputHeight: 1_920,
          sampleEveryFrames: 12,
          poseEverySamples: 2,
        });
        process.stdout.write(`[timing] mediapipe_observation stageMs=${Date.now() - startedAt}\n`);
        return result;
      },
    }),
    Promise.all([
      import("../../app.js"),
      import("../render-engine.js"),
      import("../media-observation-placement.js"),
    ]),
  ]);
  process.stdout.write(`[timing] independent_analysis wallMs=${Date.now() - analysisStartedAt}\n`);
  const boundedWords = transcript.words
    .filter((word) => word.startMs < media.durationMs)
    .map((word) => ({...word, endMs: Math.min(word.endMs, media.durationMs)}))
    .filter((word) => word.endMs > word.startMs);
  if (boundedWords.length === 0) {
    throw new Error("Frame-animation proof transcript has no words inside the source interval.");
  }
  const boundedTranscript = proofTranscriptSchema.parse({
    ...transcript,
    text: joinShortsTextTokens(boundedWords.map((word) => word.text)),
    words: boundedWords,
  });
  logStageTiming("independent_analysis");

  await mkdir(resolvedOutputDirectory, {recursive: true});
  const storageDirectory = path.join(resolvedOutputDirectory, "maul-store");
  const persistedTranscriptPath = path.join(resolvedOutputDirectory, "transcript.json");
  await writeJson(persistedTranscriptPath, boundedTranscript);

  const mediaBytes = await readFile(resolvedMediaPath);
  const sceneEvidenceProvider = createMediaObservationSceneEvidenceProvider({
    observation: mediaObservation,
    maximumInterpolationGapMs: 600,
  });
  const context = await createBackendApp({
    storageDir: storageDirectory,
    deps: {maulSceneEvidenceProvider: sceneEvidenceProvider},
    envOverrides: livePlanning
      ? {ASSEMBLYAI_API_KEY: "", ASSET_MILVUS_ENABLED: "false"}
      : {
          ASSEMBLYAI_API_KEY: "",
          ASSET_MILVUS_ENABLED: "false",
          MAUL_CHUNKING_LLM_API_KEY: "",
          MAUL_CREATIVE_PLANNER_API_KEY: "",
        },
  });
  try {
    const projectResult = await context.maulProjects.createProject({
      tenantId: "maul_frame_animation_proof",
      creatorId: "maul_frame_animation_proof",
      goal: "brand_consistency",
      platform: "instagram_reels",
      sourceProfile: {
        mode: "single_speaker_talking_head",
        principalSpeakerCount: 1,
        primaryLanguage: "en",
      },
      treatmentPreference: "premium_direct_response",
      requestedShortCount: 1,
      requestedThumbnailCount: 1,
      targetDurationMs: {min: media.durationMs, max: media.durationMs},
      source: {
        originalFilename: path.basename(resolvedMediaPath),
        storageKey: resolvedMediaPath,
        mediaType: "video/mp4",
        sha256: sha256(mediaBytes),
        durationMs: media.durationMs,
        width: media.width,
        height: media.height,
        fps: media.fps,
        hasAudio: media.hasAudio,
        hasVideo: true,
      },
    });
    logStageTiming("project_intake");
    const timeline = await context.maulProjects.createEditorialTimeline(
      projectResult.project.id,
      {
        transcript: {
          language: boundedTranscript.language,
          text: boundedTranscript.text,
          words: boundedTranscript.words,
        },
        selectedWindow: {sourceStartMs: 0, sourceEndMs: media.durationMs},
        vadEvidence: {
          kind: "detected_spans",
          provider: "manual_verified_vad",
          silenceSpans: [],
        },
        speakerDetections: [],
        shots: [],
      },
    );
    logStageTiming("editorial_timeline");
    const catalog = await context.maulProjects.createTreatmentCatalog(
      projectResult.project.id,
      {timelineArtifactId: timeline.timeline.artifactId},
    );
    const treatment = catalog.treatments.find(
      (candidate) => candidate.payload.treatmentId === "premium_direct_response",
    );
    if (!treatment) throw new Error("Frame-animation proof treatment was not materialized.");
    const candidateResult = await context.maulProjects.createCandidates(
      projectResult.project.id,
      {timelineArtifactId: timeline.timeline.artifactId},
    );
    logStageTiming("treatments_and_candidates");
    const candidate = candidateResult.candidates[0];
    if (!candidate) throw new Error("Frame-animation proof produced no eligible candidate.");
    const planning = await context.maulProjects.createPlanningBundle(
      projectResult.project.id,
      {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        typographyCoverage: "full",
      },
    );
    logStageTiming("codex_planning_bundle");
    const unsafeFallback = planning.plans.textPlacement.payload.segments.find(
      (segment) => segment.fallbackCode === "caption_safe_fallback" ||
        segment.selectedCompositionVariantId === "caption_safe_fallback",
    );
    if (unsafeFallback) {
      throw new Error(
        `Frame-animation proof refuses caption fallback ${unsafeFallback.segmentId} when MediaPipe evidence is required.`,
      );
    }
    const planReceipt = assertFrameAnimationProofPlan({
      tokens: planning.plans.textChunk.payload.tokens,
      segments: planning.plans.textPlacement.payload.segments,
      programs: planning.plans.textAnimation.payload.programs,
    });
    const proofSfx = selectFrameAnimationProofSfx({
      programs: planning.plans.textAnimation.payload.programs,
      assets: DEFAULT_MAUL_TYPOGRAPHY_SFX,
      semanticMoments: planning.plans.textChunk.payload.chunks.map((chunk) => ({
        sourceMs: chunk.outputStartMs,
        role: chunk.semanticRole,
        emphasisLevel: chunk.emphasis.level,
      })),
      maxCues: 3,
      minimumGapMs: 1_800,
    });
    const compiled = await context.maulProjects.compileRenderManifest(
      projectResult.project.id,
      {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planning.planningBundle.artifactId,
        layerPolicy: fullScale
          ? FULL_SCALE_MAUL_LAYER_POLICY
          : FRAME_ANIMATION_PROOF_LAYER_POLICY,
        musicTrack: {
          id: "maul_frame_animation_speech_safe_bed",
          title: "The Way (Instrumental)",
          artist: "Zack Hemsey",
          storagePath: defaultProofMusicPath,
          durationSec: 424.848979,
          licenseType: "local_user_supplied_proof_only",
          commercialAllowed: true,
          licenseVerified: true,
          renderSafe: true,
        },
        sfxAssets: proofSfx.map((sfx) => ({
          id: sfx.id,
          storagePath: sfx.storagePath,
          licenseType: "local_user_supplied_proof_only",
          commercialAllowed: true,
          licenseVerified: true,
          renderSafe: true,
          eventType: sfx.eventType,
          sourceMs: sfx.sourceMs,
        })),
      },
    );
    logStageTiming("manifest_compile");
    const videoPath = path.join(resolvedOutputDirectory, "maul-frame-animation-proof.mp4");
    const manifestPath = path.join(resolvedOutputDirectory, "render-manifest.json");
    const diagnosticsPath = path.join(resolvedOutputDirectory, "diagnostics.json");
    if (planOnly) {
      await Promise.all([
        writeJson(manifestPath, {
          artifactId: compiled.renderManifest.artifactId,
          sha256: createHash("sha256")
            .update(JSON.stringify(compiled.renderManifest.payload))
            .digest("hex"),
          manifest: compiled.renderManifest.payload,
        }),
        writeJson(diagnosticsPath, {
          schemaVersion: "maul-frame-animation-proof-diagnostics/v1",
          mode: "plan_only",
          transcriptSource: boundedTranscript.source,
          mediaObservation: mediaObservation.receipt,
          sceneEvidence: planning.plans.artDirection.payload.sceneEvidence,
          animation: planReceipt,
          treatments: planning.plans.textAnimation.payload.programs.map((program) => ({
            tokenId: program.frameMotion?.tokenId,
            treatment: program.treatment,
            executorId: program.executorId,
          })),
          placements: planning.plans.textPlacement.payload.segments.map((segment) => ({
            segmentId: segment.segmentId,
            chunkId: segment.chunkId,
            selectedCompositionVariantId: segment.selectedCompositionVariantId,
            fallbackCode: segment.fallbackCode,
            box: segment.box,
          })),
        }),
      ]);
      return {
        outputDirectory: resolvedOutputDirectory,
        videoPath: null,
        manifestPath,
        transcriptPath: persistedTranscriptPath,
        diagnosticsPath,
        transcriptSource: boundedTranscript.source,
        ...planReceipt,
      };
    }
    const sampleTimesMs = planning.plans.textPlacement.payload.segments
      .slice(0, 4)
      .map((segment) => Math.round((segment.outputStartMs + segment.outputEndMs) / 2));
    const rendered = await renderMaulShortLocally({
      workRoot: path.join(resolvedOutputDirectory, "render-work"),
      manifest: compiled.renderManifest.payload,
      renderMode: "final",
      previewFrameTimesMs: sampleTimesMs,
      observationMode: "creative",
      renderConcurrency: resolveFrameAnimationProofRenderConcurrency(
        renderConcurrency,
      ),
    });
    await Promise.all([
      writeFile(videoPath, rendered.bytes),
      writeJson(manifestPath, {
        artifactId: compiled.renderManifest.artifactId,
        sha256: createHash("sha256")
          .update(JSON.stringify(compiled.renderManifest.payload))
          .digest("hex"),
        manifest: compiled.renderManifest.payload,
      }),
      writeJson(diagnosticsPath, {
        schemaVersion: "maul-frame-animation-proof-diagnostics/v1",
        transcriptSource: boundedTranscript.source,
        media: {...media, sourcePath: resolvedMediaPath, sourceSha256: sha256(mediaBytes)},
        output: {
          path: videoPath,
          sha256: rendered.sha256,
          width: rendered.width,
          height: rendered.height,
          durationMs: rendered.durationMs,
          renderer: rendered.evidence,
        },
        chunkInference: planning.plans.textChunk.payload.inference,
        typographyProfiles: planning.plans.typographyMotion.payload.chunkTypographyBindings.map(
          (binding) => ({
            chunkId: binding.chunkId,
            profileName: binding.profile.name,
            sourceFilename: binding.profile.sourceFilename,
            sourceSha256: binding.profile.sourceSha256,
            selectedAssets: binding.layers.map((layer) => layer.selectedAsset),
          }),
        ),
        placementSegments: planning.plans.textPlacement.payload.segments.map(
          (segment) => ({
            segmentId: segment.segmentId,
            chunkId: segment.chunkId,
            variantId: segment.variantId,
            box: segment.box,
            colorResolution: segment.profileColorResolution,
          }),
        ),
        animation: {
          ...planReceipt,
          programs: planning.plans.textAnimation.payload.programs.map((program) => ({
            animationId: program.animationId,
            treatment: program.treatment,
            executorId: program.executorId,
            tokenId: program.frameMotion?.tokenId,
            sourceIntervalMs: program.frameMotion?.sourceIntervalMs,
            phases: program.frameMotion?.phases,
          })),
        },
        retainedFrames: rendered.frameSamples.map((sample) => ({
          outputMs: sample.outputMs,
          sha256: sample.sha256,
        })),
      }),
      ...rendered.frameSamples.map((sample) => writeFile(
        path.join(resolvedOutputDirectory, `frame-${sample.outputMs}.png`),
        sample.bytes,
      )),
    ]);
    return {
      outputDirectory: resolvedOutputDirectory,
      videoPath,
      manifestPath,
      transcriptPath: persistedTranscriptPath,
      diagnosticsPath,
      transcriptSource: boundedTranscript.source,
      ...planReceipt,
    };
  } finally {
    await context.app.close();
  }
};

const cliValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runFrameAnimationProof({
    mediaPath: cliValue("--media") ?? defaultMediaPath,
    transcriptPath: cliValue("--transcript"),
    outputDirectory: cliValue("--output") ?? defaultOutputDir,
    planOnly: process.argv.includes("--plan-only"),
    fullScale: process.argv.includes("--full-scale"),
    livePlanning: process.argv.includes("--live-planning"),
    renderConcurrency: Number(cliValue("--concurrency") ?? 6),
  }).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

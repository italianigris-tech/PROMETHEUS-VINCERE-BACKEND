import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import * as path from "node:path";
import {fileURLToPath} from "node:url";

import {createBackendApp} from "../backend/src/app.js";
import {freezeDeclaredComposition} from "../backend/src/maul/composition-experiment-contracts.js";
import {buildCompositionFidelityReport} from "../backend/src/maul/composition-fidelity.js";
import {buildSceneAOutputSubjectMask} from "../backend/src/maul/composition-experiment-scene-a.js";
import {
  COMPOSITION_EXPERIMENT_FIXTURES,
  assertEligibleExperimentSceneEvidence,
  buildReferenceTypographyTranscript,
  createCompositionExperimentSceneEvidenceProvider,
  deriveSceneAAlphaEvidence,
} from "../backend/src/maul/composition-experiment-fixtures.js";
import {observeRenderedComposition} from "../backend/src/maul/composition-observer.js";
import {rankMaulFontPairs} from "../backend/src/maul/font-pair-ranking.js";
import {decodeRgbaPng, encodeRgbaPng} from "../backend/src/maul/png-rgba.js";
import {renderMaulShortLocally} from "../backend/src/maul/render-engine.js";
import {
  REFERENCE_TYPOGRAPHY_PROOF_SAMPLE_TIMES_MS,
  REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID,
  assertReferenceTypographyProofPlan,
  assertReferenceTypographyProofSamplePlacements,
  buildReferenceTypographyProofChunkPlan,
  validateReferenceTypographyProofRequest,
} from "../backend/src/maul/reference-typography-proof.js";
import {resolveRepositoryMediaTool} from "../backend/src/maul/repository-media-tools.js";
import {createResolvedMaulTypographyProvider} from "../backend/src/maul/typography-layout.js";
import {
  loadHydratedMaulFontAssets,
  loadMaulFontCatalogCount,
  loadMaulFontRoleBuckets,
} from "../backend/src/maul/zilliz-font-assets.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = COMPOSITION_EXPERIMENT_FIXTURES.sceneA;
const evidenceFrameRange = {startFrame: 0, endFrame: fixture.output.fps * 4 - 1};
const evidenceRenderConfiguration = {
  frameRange: evidenceFrameRange,
  concurrency: 1,
  rationale: "Render the 1/2/3-second review window sequentially on the local two-core evidence host while retaining full-paragraph planning and geometry validation.",
} as const;
const referenceTypographyFidelitySampleMs = 3000;

const sha256 = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const sha256File = async (filePath: string): Promise<string> => sha256(await readFile(filePath));

const isVolatileProofField = (key: string): boolean =>
  key === "storagePath" ||
  key === "sourcePath" ||
  key === "replayKey" ||
  key === "inputHashes" ||
  key === "declarationSha256" ||
  key === "reportSha256" ||
  key.endsWith("Hash") ||
  /^(?:source|analysis|timeline|candidate|treatmentGenome|planningBundle|text\w*|project|job|plan|artifact|parentArtifact|reference)Ids?$/u.test(key);

const canonicalizeProofValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.replace(/maul_(?:artifact|project)_[a-z0-9_]+/giu, "maul_volatile");
  }
  if (Array.isArray(value)) return value.map(canonicalizeProofValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [
          key,
          isVolatileProofField(key) ? "volatile" : canonicalizeProofValue(entry),
        ]),
    );
  }
  return value;
};

export const fingerprintReferenceTypographyProofValue = (value: unknown): string =>
  sha256(JSON.stringify(canonicalizeProofValue(value)));

export const selectReferenceTypographyFidelitySegment = <T extends {
  outputStartMs: number;
  outputEndMs: number;
}>({
  sampleMs,
  placementSegments,
}: {
  sampleMs: number;
  placementSegments: T[];
}): T | undefined => placementSegments.find((segment) =>
  segment.outputStartMs <= sampleMs && segment.outputEndMs >= sampleMs,
);

export const resolveReferenceTypographyProofPlacementBox = <T extends {
  box: {x: number; y: number; width: number; height: number};
  maximumEnvelope?: {x: number; y: number; width: number; height: number};
}>({maximumEnvelope, box}: T): {x: number; y: number; width: number; height: number} =>
  maximumEnvelope ?? box;

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const writeReferenceTypographyProofFrameArtifacts = async ({
  outputDirectory,
  creativeFrames,
  typographySuppressedFrames,
  sourceTreatmentSuppressedFrames,
}: {
  outputDirectory: string;
  creativeFrames: Array<{outputMs: number; bytes: Buffer}>;
  typographySuppressedFrames: Array<{outputMs: number; bytes: Buffer}>;
  sourceTreatmentSuppressedFrames: Array<{outputMs: number; bytes: Buffer}>;
}): Promise<void> => {
  const creativeFrameDirectory = path.join(outputDirectory, "frames");
  const typographySuppressedFrameDirectory = path.join(
    outputDirectory,
    "typography-suppressed-frames",
  );
  const sourceTreatmentSuppressedFrameDirectory = path.join(
    outputDirectory,
    "source-treatment-suppressed-frames",
  );
  await Promise.all([
    mkdir(creativeFrameDirectory, {recursive: true}),
    mkdir(typographySuppressedFrameDirectory, {recursive: true}),
    mkdir(sourceTreatmentSuppressedFrameDirectory, {recursive: true}),
  ]);
  await Promise.all([
    ...creativeFrames.map((sample) => writeFile(
      path.join(creativeFrameDirectory, `frame-${sample.outputMs}.png`),
      sample.bytes,
    )),
    ...typographySuppressedFrames.map((sample) => writeFile(
      path.join(typographySuppressedFrameDirectory, `frame-${sample.outputMs}.png`),
      sample.bytes,
    )),
    ...sourceTreatmentSuppressedFrames.map((sample) => writeFile(
      path.join(sourceTreatmentSuppressedFrameDirectory, `frame-${sample.outputMs}.png`),
      sample.bytes,
    )),
  ]);
};

export const measureReferenceTypographySourceTreatmentVisibility = ({
  creativeFrames,
  sourceTreatmentSuppressedFrames,
  differenceThreshold = 8,
}: {
  creativeFrames: Array<{outputMs: number; bytes: Buffer}>;
  sourceTreatmentSuppressedFrames: Array<{outputMs: number; bytes: Buffer}>;
  differenceThreshold?: number;
}) => {
  const controlsByTime = new Map(
    sourceTreatmentSuppressedFrames.map((frame) => [frame.outputMs, frame]),
  );
  if (creativeFrames.length === 0 || controlsByTime.size !== creativeFrames.length) {
    throw new Error("Source-treatment visibility requires one timestamp-matched control for every creative frame.");
  }
  let changedPixelCount = 0;
  for (const creative of creativeFrames) {
    const control = controlsByTime.get(creative.outputMs);
    if (!control) {
      throw new Error(`Source-treatment visibility lacks a control at ${creative.outputMs}ms.`);
    }
    const creativePng = decodeRgbaPng(creative.bytes);
    const controlPng = decodeRgbaPng(control.bytes);
    if (creativePng.width !== controlPng.width || creativePng.height !== controlPng.height) {
      throw new Error("Source-treatment visibility controls must share creative frame geometry.");
    }
    for (let offset = 0; offset < creativePng.pixels.length; offset += 4) {
      const difference = Math.max(
        Math.abs(creativePng.pixels[offset]! - controlPng.pixels[offset]!),
        Math.abs(creativePng.pixels[offset + 1]! - controlPng.pixels[offset + 1]!),
        Math.abs(creativePng.pixels[offset + 2]! - controlPng.pixels[offset + 2]!),
        Math.abs(creativePng.pixels[offset + 3]! - controlPng.pixels[offset + 3]!),
      );
      if (difference >= differenceThreshold) changedPixelCount += 1;
    }
  }
  return {
    visible: changedPixelCount > 0,
    changedPixelCount,
    sampleCount: creativeFrames.length,
    differenceThreshold,
  };
};

const runExecutable = async (executable: string, args: string[]): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    execFile(
      executable,
      args,
      {windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024},
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`${path.basename(executable)} failed: ${stderr.trim() || error.message}`));
          return;
        }
        resolve();
      },
    );
  });

const resolveFfmpeg = async (): Promise<string> => {
  const receipt = await resolveRepositoryMediaTool({tool: "ffmpeg", repoRoot});
  if (receipt.status !== "available") throw new Error(receipt.reason);
  return receipt.executablePath;
};

const flattenFemaleMatte = (sourceBytes: Buffer): Buffer => {
  const source = decodeRgbaPng(sourceBytes);
  const {width, height} = fixture.output;
  const background = [8, 7, 11];
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y * source.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x * source.width / width));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      const alpha = source.pixels[sourceOffset + 3]! / 255;
      pixels[targetOffset] = Math.round(source.pixels[sourceOffset]! * alpha + background[0]! * (1 - alpha));
      pixels[targetOffset + 1] = Math.round(source.pixels[sourceOffset + 1]! * alpha + background[1]! * (1 - alpha));
      pixels[targetOffset + 2] = Math.round(source.pixels[sourceOffset + 2]! * alpha + background[2]! * (1 - alpha));
      pixels[targetOffset + 3] = 255;
    }
  }
  return encodeRgbaPng({width, height, pixels});
};

const materializeFemaleInputs = async ({
  outputDirectory,
  durationMs,
}: {
  outputDirectory: string;
  durationMs: number;
}) => {
  const sourcePath = path.join(repoRoot, fixture.sourceRelativePath);
  await assertEligibleExperimentSceneEvidence({filePath: sourcePath, claimedStatus: "verified"});
  const [alphaEvidence, ffmpegPath, sourceBytes] = await Promise.all([
    deriveSceneAAlphaEvidence({repoRoot}),
    resolveFfmpeg(),
    readFile(sourcePath),
  ]);
  const inputDirectory = path.join(outputDirectory, "inputs");
  const carrierPath = path.join(inputDirectory, "female-reference-carrier.mp4");
  const silentTrackPath = path.join(inputDirectory, "silent-contract-track.wav");
  const flattenedMattePath = path.join(inputDirectory, "female-flattened-matte.png");
  await mkdir(inputDirectory, {recursive: true});
  await writeFile(flattenedMattePath, flattenFemaleMatte(sourceBytes));
  await runExecutable(ffmpegPath, [
    "-y",
    "-loop", "1",
    "-framerate", String(fixture.output.fps),
    "-i", flattenedMattePath,
    "-f", "lavfi",
    "-i", "anullsrc=r=48000:cl=stereo",
    "-map", "0:v",
    "-map", "1:a",
    "-t", (durationMs / 1000).toFixed(3),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    carrierPath,
  ]);
  await runExecutable(ffmpegPath, [
    "-y",
    "-f", "lavfi",
    "-i", "anullsrc=r=48000:cl=stereo",
    "-t", (durationMs / 1000).toFixed(3),
    "-c:a", "pcm_s16le",
    silentTrackPath,
  ]);
  return {
    sourcePath,
    carrierPath,
    carrierSha256: await sha256File(carrierPath),
    silentTrackPath,
    alphaEvidence,
    subjectMask: await buildSceneAOutputSubjectMask({repoRoot}),
    mediaTool: {executablePath: ffmpegPath, source: "repository_resolver"},
  };
};

const referenceCreativeTreatmentPlanner = {
  async plan() {
    const treatment = {
      schemaVersion: "maul-creative-treatment-proposal/v1" as const,
      profileId: "aspire_visual_hook" as const,
      compositionDirection: "subject_integrated" as const,
      primaryTypeRole: "editorial_display" as const,
      accentTypeRole: "editorial_italic" as const,
      palette: {
        primary: "#F7F3EA",
        accent: "#D6D0C4",
        sourceTreatment: "dark_warm_cool_contrast" as const,
      },
      sourceTreatmentProfileId: REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID,
      textDensity: "low" as const,
      emphasisMode: "editorial_italic_hinge" as const,
      motionMode: "restrained_phrase_lockup" as const,
      rationale: [
        "Preserve source case, use ivory hierarchy with a quiet italic accent, and hold each word anchor fixed while local reveal programs play.",
      ],
    };
    return {
      status: "invoked" as const,
      treatment,
      receipt: {
        provider: "openai_compatible" as const,
        model: "reference-typography-proof/v1",
        reasoningEffort: "high" as const,
        requestHash: sha256(JSON.stringify({fixture: fixture.fixtureId, profile: REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID})),
        responseHash: sha256(JSON.stringify(treatment)),
        inferenceReceiptId: "reference_typography_creative_treatment_v1",
        fallbackReason: null,
      },
    };
  },
};

const selectRankedFontPair = async ({
  requiredText,
  chunkTexts,
}: {
  requiredText: string;
  chunkTexts: string[];
}) => {
  const roleBucketsByAssetId = loadMaulFontRoleBuckets();
  const hydratedAssets = loadHydratedMaulFontAssets({roleBucketsByAssetId});
  const ranking = rankMaulFontPairs({
    candidates: hydratedAssets.map((asset) => ({
      assetId: asset.assetId,
      score: 0.5,
      needsManualLicenseReview: false,
      roleBuckets: roleBucketsByAssetId.get(asset.assetId) ?? [],
    })),
    hydratedAssets,
    roleBucketsByAssetId,
    requiredText,
    catalogCount: loadMaulFontCatalogCount(),
  });
  const assetsById = new Map(hydratedAssets.map((asset) => [asset.assetId, asset]));
  for (const [rankIndex, rankedPair] of ranking.rankedPairs.entries()) {
    const primary = assetsById.get(rankedPair.primaryAssetId);
    const accent = assetsById.get(rankedPair.accentAssetId);
    if (!primary || !accent) continue;
    const measured = await createResolvedMaulTypographyProvider({primary, accent}).plan({
      chunks: chunkTexts.map((text, index) => ({chunkId: `proof_chunk_${index}`, text})),
      maximumLineWidthPx: 410,
      primaryTypeRole: "editorial_display",
    });
    if (measured.status === "available") {
      return {
        primary,
        accent,
        rankingReceipt: {
          evaluatedPairCount: ranking.evaluatedPairCount,
          catalogCount: ranking.catalogCount,
          hydratedCount: ranking.hydratedCount,
          status: ranking.status,
          score: {
            total: rankedPair.total,
            breakdown: rankedPair.breakdown,
          },
          selectedRank: rankIndex + 1,
          selectionReason: "Highest-ranked pair that passed the full paragraph measured-layout probe.",
        },
        rankedPairs: ranking.rankedPairs,
      };
    }
  }
  throw new Error("No ranked governed font pair passed the full paragraph measured-layout probe.");
};

const buildDeclaration = ({
  planning,
  fonts,
  durationMs,
  alphaEvidenceSha256,
  fidelitySampleMs,
}: {
  planning: Awaited<ReturnType<Awaited<ReturnType<typeof createBackendApp>>["maulProjects"]["createPlanningBundle"]>>;
  fonts: Awaited<ReturnType<typeof selectRankedFontPair>>;
  durationMs: number;
  alphaEvidenceSha256: string;
  fidelitySampleMs: number;
}) => {
  const placementPlan = planning.plans.textPlacement.payload;
  const chunkPlan = planning.plans.textChunk.payload;
  const animationPlan = planning.plans.textAnimation.payload;
  const segment = selectReferenceTypographyFidelitySegment({
    sampleMs: fidelitySampleMs,
    placementSegments: placementPlan.segments,
  });
  if (!segment?.editorialLockup) {
    throw new Error("Reference typography proof lacks an editorial lockup at the first retained frame.");
  }
  const textByTokenId = new Map(chunkPlan.tokens.map((token) => [token.tokenId, token.text]));
  const animation = animationPlan.programs.find(
    (program) => program.target.placementSegmentId === segment.segmentId,
  );
  if (!animation) throw new Error("Reference typography proof lacks a local animation program.");
  const fontByAssetId = new Map([
    [fonts.primary.assetId, fonts.primary],
    [fonts.accent.assetId, fonts.accent],
  ]);
  const tokenStyles = segment.editorialLockup.tokenStyles.map((style) => {
    const font = fontByAssetId.get(style.fontAssetId);
    if (!font) throw new Error(`Proof lockup references an unranked font ${style.fontAssetId}.`);
    return {
      role: style.role === "accent" ? "accent" as const : "hero" as const,
      tokenIds: [style.tokenId],
      font: {
        assetId: font.assetId,
        family: font.family,
        sha256: font.localFileSha256,
        status: "verified" as const,
      },
    };
  });
  const declaredBox = segment.box;
  const declaredPlacementBox = resolveReferenceTypographyProofPlacementBox(segment);
  return freezeDeclaredComposition({
    declarationId: "declared_reference_typography_female_v1",
    parentDeclarationId: null,
    fixtureId: fixture.fixtureId,
    sourceGroup: fixture.sourceGroup,
    sourceSha256: fixture.sourceSha256,
    output: {...fixture.output, durationMs},
    causalLineage: {
      fixtureEvidenceIds: [`source:${fixture.sourceSha256}`, `alpha:${alphaEvidenceSha256}`],
      referenceObservationIds: ["reference_typography_corpus/44"],
      semanticTreeId: "reference_typography_paragraph/v1",
      semanticHypothesisId: "rhetorical_chunking_with_editorial_hinge/v1",
      treatmentGenomeArtifactId: planning.plans.textPlacement.payload.treatmentGenomeArtifactId,
      planningBundleArtifactId: planning.planningBundle.artifactId,
      visualRealizationId: `${planning.planningBundle.artifactId}:${segment.variantId}:${segment.editorialLockup.mode}`,
    },
    typography: {
      roles: tokenStyles,
      lineBreaks: segment.lines.map((line) => line.tokenIds.map((tokenId) => {
        const text = textByTokenId.get(tokenId);
        if (!text) throw new Error(`Proof line references unknown token ${tokenId}.`);
        return text;
      })),
      shapedBoundsPx: {
        left: declaredBox.x * fixture.output.width,
        top: declaredBox.y * fixture.output.height,
        width: declaredBox.width * fixture.output.width,
        height: declaredBox.height * fixture.output.height,
      },
    },
    placement: {
      box: declaredPlacementBox,
      comparisonMode: "containment" as const,
      depthMode: segment.depth.resolved === "behind_subject" ? "behind_subject" : "front",
      sceneEvidenceIds: [`alpha:${alphaEvidenceSha256}`],
    },
    treatment: {
      family: "reference_typography_paragraph",
      primitives: ["editorial_lockup", animation.treatment, REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID],
      colors: ["#F7F3EA", "#D6D0C4"],
    },
    motion: {
      family: animation.treatment,
      trajectorySamples: REFERENCE_TYPOGRAPHY_PROOF_SAMPLE_TIMES_MS.map((outputMs) => ({
        outputMs,
        x: declaredBox.x,
        y: declaredBox.y,
      })),
    },
    sourceTransform: {
      mode: "immutable_rgba_matte_to_9x16_carrier",
      background: fixture.carrierBackground,
      fit: "exact_1080x1920",
      alphaEvidenceSha256,
      sourceTreatmentProfileId: REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID,
    },
    requiredObservations: ["font_geometry", "line_breaks", "text_bounds", "placement", "treatment_visibility", "motion_trajectory"],
    presentationFields: ["typography.hero.font", "placement.box", "treatment.primitives", "motion.trajectory", "sourceTreatment.profile"],
    capabilityVerification: [
      {
        capabilityId: "maul_governed_font_pair_ranking",
        status: "verified",
        supports: ["typography.hero.font"],
        evidenceIds: [fonts.primary.localFileSha256, fonts.accent.localFileSha256],
      },
      {
        capabilityId: "maul_text_placement_plan",
        status: "verified",
        supports: ["placement.box"],
        evidenceIds: [planning.plans.textPlacement.artifactId],
      },
      {
        capabilityId: "maul_text_animation",
        status: "verified",
        supports: ["motion.trajectory"],
        evidenceIds: [planning.plans.textAnimation.artifactId],
      },
      {
        capabilityId: "maul_source_treatment",
        status: "verified",
        supports: ["treatment.primitives", "sourceTreatment.profile"],
        evidenceIds: [REFERENCE_TYPOGRAPHY_SOURCE_TREATMENT_PROFILE_ID],
      },
    ],
    fallbacks: [],
    versions: {
      declaration: "maul-declared-composition/v1",
      renderer: "MaulShort/v1",
      observer: "maul-composition-observer/v1",
      policy: "maul-reference-typography-proof/v1",
    },
  });
};

export const assertReferenceTypographyProofFidelity = (fidelity: {
  fields: {
    lineBreaks: {status: string};
    placement: {status: string};
  };
}): void => {
  if (fidelity.fields.lineBreaks.status !== "match") {
    throw new Error("Reference typography proof line-break fidelity is not observed.");
  }
  if (fidelity.fields.placement.status !== "match") {
    throw new Error("Reference typography proof placement fidelity is not observed.");
  }
};

const assertProofEvidence = ({
  observed,
  fidelity,
  sourceTreatmentVisibility,
}: {
  observed: ReturnType<typeof observeRenderedComposition>;
  fidelity: ReturnType<typeof buildCompositionFidelityReport>;
  sourceTreatmentVisibility: ReturnType<typeof measureReferenceTypographySourceTreatmentVisibility>;
}): void => {
  if (fidelity.hardFailures.length > 0 || fidelity.status === "fail") {
    throw new Error(`Reference typography proof has a hard fidelity failure: ${fidelity.hardFailures.map((failure) => failure.code).join(", ")}.`);
  }
  if (observed.measurements.treatmentVisibility.status !== "observed" || !observed.measurements.treatmentVisibility.value) {
    throw new Error("Reference typography proof cannot observe the declared source/typography treatment.");
  }
  assertReferenceTypographyProofFidelity(fidelity);
  if (!sourceTreatmentVisibility.visible) {
    throw new Error("Reference typography proof cannot observe the declared source treatment against its dedicated control.");
  }
};

export const prepareReferenceTypographyProof = async ({
  outputDirectory,
  text,
}: {
  outputDirectory: string;
  text: string;
}) => {
  const request = validateReferenceTypographyProofRequest({fixture: "female", text});
  const transcript = buildReferenceTypographyTranscript();
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  if (resolvedOutputDirectory === repoRoot || resolvedOutputDirectory === path.parse(resolvedOutputDirectory).root) {
    throw new Error("Refusing to use a repository root or filesystem root as proof output.");
  }
  await rm(resolvedOutputDirectory, {recursive: true, force: true});
  await mkdir(resolvedOutputDirectory, {recursive: true});
  const paragraphPlan = buildReferenceTypographyProofChunkPlan({
    transcript: transcript.transcript,
    durationMs: transcript.durationMs,
  });
  const [inputs, fonts] = await Promise.all([
    materializeFemaleInputs({outputDirectory: resolvedOutputDirectory, durationMs: transcript.durationMs}),
    selectRankedFontPair({
      requiredText: text,
      chunkTexts: paragraphPlan.chunks.map((chunk) => chunk.text),
    }),
  ]);
  const context = await createBackendApp({
    storageDir: path.join(resolvedOutputDirectory, "maul-store"),
    envOverrides: {
      ASSEMBLYAI_API_KEY: "",
      GROQ_API_KEY: "",
      ASSET_MILVUS_ENABLED: "false",
      MAUL_CHUNKING_LLM_API_KEY: "",
    },
    deps: {
      maulSceneEvidenceProvider: createCompositionExperimentSceneEvidenceProvider({
        fixtureId: fixture.fixtureId,
        repoRoot,
      }),
      maulTypographyProvider: createResolvedMaulTypographyProvider(fonts),
      maulCreativeTreatmentPlanner: referenceCreativeTreatmentPlanner,
      maulTextChunkPlanner: {
        async plan(chunkRequest) {
          return buildReferenceTypographyProofChunkPlan({
            transcript: chunkRequest.transcript,
            durationMs: chunkRequest.videoDurationMs,
          });
        },
      },
    },
  });
  try {
    const projectResult = await context.maulProjects.createProject({
      tenantId: "maul_reference_typography_proof",
      creatorId: "maul_reference_typography_proof",
      goal: "brand_consistency",
      platform: "instagram_reels",
      sourceProfile: {mode: "single_speaker_talking_head", principalSpeakerCount: 1, primaryLanguage: "en"},
      treatmentPreference: "premium_direct_response",
      requestedShortCount: 1,
      requestedThumbnailCount: 1,
      targetDurationMs: {min: transcript.durationMs, max: transcript.durationMs},
      source: {
        originalFilename: path.basename(inputs.carrierPath),
        storageKey: inputs.carrierPath,
        mediaType: "video/mp4",
        sha256: inputs.carrierSha256,
        durationMs: transcript.durationMs,
        width: fixture.output.width,
        height: fixture.output.height,
        fps: fixture.output.fps,
        hasAudio: true,
        hasVideo: true,
      },
    });
    const timeline = await context.maulProjects.createEditorialTimeline(projectResult.project.id, {
      transcript: transcript.transcript,
      selectedWindow: {sourceStartMs: 0, sourceEndMs: transcript.durationMs},
      vadEvidence: {kind: "detected_spans", provider: "manual_verified_vad", silenceSpans: []},
      speakerDetections: [],
      shots: [],
    });
    const catalog = await context.maulProjects.createTreatmentCatalog(projectResult.project.id, {
      timelineArtifactId: timeline.timeline.artifactId,
    });
    const treatment = catalog.treatments.find(
      (candidate) => candidate.payload.treatmentId === "premium_direct_response",
    );
    if (!treatment) throw new Error("Reference typography proof did not materialize its treatment genome.");
    const candidates = await context.maulProjects.createCandidates(projectResult.project.id, {
      timelineArtifactId: timeline.timeline.artifactId,
    });
    const candidate = candidates.candidates[0];
    if (!candidate) throw new Error("Reference typography proof did not clear the candidate quality floor.");
    const planning = await context.maulProjects.createPlanningBundle(projectResult.project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
    });
    assertReferenceTypographyProofPlan({
      chunks: paragraphPlan.chunks,
      placementSegments: planning.plans.textPlacement.payload.segments,
      animationPrograms: planning.plans.textAnimation.payload.programs,
      rankedFontAssetIds: [fonts.primary.assetId, fonts.accent.assetId],
    });
    const musicTrack = {
      id: "reference_typography_silent_contract_track",
      title: "Reference typography silent contract track",
      artist: "MAUL proof fixture",
      storagePath: inputs.silentTrackPath,
      durationSec: transcript.durationMs / 1000,
      licenseType: "local_experiment_fixture",
      commercialAllowed: true,
      licenseVerified: true,
      renderSafe: true,
    };
    const compiled = await context.maulProjects.compileRenderManifest(projectResult.project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
      planningBundleArtifactId: planning.planningBundle.artifactId,
      musicTrack,
      sfxAssets: [],
    });
    const declaration = buildDeclaration({
      planning,
      fonts,
      durationMs: transcript.durationMs,
      alphaEvidenceSha256: inputs.alphaEvidence.alphaSha256,
      fidelitySampleMs: referenceTypographyFidelitySampleMs,
    });
    const manifest = compiled.renderManifest.payload;
    const creative = await renderMaulShortLocally({
      workRoot: path.join(resolvedOutputDirectory, "render-work", "creative"),
      manifest,
      renderMode: "final",
      previewFrameTimesMs: [...request.sampleTimesMs],
      observationMode: "creative",
      renderConcurrency: evidenceRenderConfiguration.concurrency,
      frameRange: evidenceRenderConfiguration.frameRange,
    });
    const typographySuppressed = await renderMaulShortLocally({
      workRoot: path.join(resolvedOutputDirectory, "render-work", "typography-suppressed"),
      manifest,
      renderMode: "final",
      previewFrameTimesMs: [...request.sampleTimesMs],
      observationMode: "typography_suppressed",
      renderConcurrency: evidenceRenderConfiguration.concurrency,
      frameRange: evidenceRenderConfiguration.frameRange,
    });
    const sourceTreatmentSuppressed = await renderMaulShortLocally({
      workRoot: path.join(resolvedOutputDirectory, "render-work", "source-treatment-suppressed"),
      manifest,
      renderMode: "final",
      previewFrameTimesMs: [...request.sampleTimesMs],
      observationMode: "source_treatment_suppressed",
      renderConcurrency: evidenceRenderConfiguration.concurrency,
      frameRange: evidenceRenderConfiguration.frameRange,
    });
    const sourceTreatmentVisibility = measureReferenceTypographySourceTreatmentVisibility({
      creativeFrames: creative.frameSamples,
      sourceTreatmentSuppressedFrames: sourceTreatmentSuppressed.frameSamples,
    });
    const typographyControlsByTime = new Map(
      typographySuppressed.frameSamples.map((frame) => [frame.outputMs, frame]),
    );
    const fidelityFrame = creative.frameSamples.find(
      (frame) => frame.outputMs === referenceTypographyFidelitySampleMs,
    )
      ?? creative.frameSamples[creative.frameSamples.length - 1];
    const fidelityControl = fidelityFrame
      ? typographyControlsByTime.get(fidelityFrame.outputMs)
      : undefined;
    if (!fidelityFrame || !fidelityControl) {
      throw new Error("Reference typography proof lacks a completed-hold fidelity sample.");
    }
    const observed = observeRenderedComposition({
      observationId: "observed_reference_typography_female_v1",
      declarationId: declaration.declarationId,
      renderedFrames: [fidelityFrame],
      typographySuppressedFrames: [fidelityControl],
      subjectMask: inputs.subjectMask,
      semanticRegions: [],
      fontCapabilityEvidence: {
        status: "verified",
        assetId: fonts.primary.assetId,
        family: fonts.primary.family,
        sha256: fonts.primary.localFileSha256,
        evidenceId: `font:${fonts.primary.localFileSha256}`,
      },
    });
    const sampledPlacementObservations = creative.frameSamples.map((frame) => {
      const control = typographyControlsByTime.get(frame.outputMs);
      if (!control) {
        throw new Error(`Reference typography proof lacks a typography control at ${frame.outputMs}ms.`);
      }
      const sampleObservation = observeRenderedComposition({
        observationId: `observed_reference_typography_female_${frame.outputMs}ms_v1`,
        declarationId: declaration.declarationId,
        renderedFrames: [frame],
        typographySuppressedFrames: [control],
        subjectMask: null,
        semanticRegions: [],
        fontCapabilityEvidence: null,
      });
      const bounds = sampleObservation.measurements.textBounds;
      if (sampleObservation.status !== "observed" || bounds.status !== "observed") {
        throw new Error(`Reference typography proof cannot measure text bounds at ${frame.outputMs}ms.`);
      }
      return {outputMs: frame.outputMs, bounds: bounds.value};
    });
    await writeReferenceTypographyProofFrameArtifacts({
      outputDirectory: resolvedOutputDirectory,
      creativeFrames: creative.frameSamples,
      typographySuppressedFrames: typographySuppressed.frameSamples,
      sourceTreatmentSuppressedFrames: sourceTreatmentSuppressed.frameSamples,
    });
    assertReferenceTypographyProofSamplePlacements({
      output: fixture.output,
      placementSegments: planning.plans.textPlacement.payload.segments,
      observedSamples: sampledPlacementObservations,
    });
    const manifestSha256 = fingerprintReferenceTypographyProofValue(manifest);
    const fidelity = buildCompositionFidelityReport({
      reportId: "fidelity_reference_typography_female_v1",
      declaration,
      observed,
      manifestSha256,
      rendererReceipt: {renderer: creative.evidence.renderer, compositionId: creative.evidence.compositionId},
    });
    const anchors = planning.plans.textPlacement.payload.segments.map((segment) => ({
      segmentId: segment.segmentId,
      outputStartMs: segment.outputStartMs,
      outputEndMs: segment.outputEndMs,
      x: segment.box.x,
      y: segment.box.y,
      width: segment.box.width,
      height: segment.box.height,
    }));
    await Promise.all([
      writeJson(path.join(resolvedOutputDirectory, "source-evidence.json"), {
        fixtureId: request.fixtureId,
        sourcePath: inputs.sourcePath,
        sourceSha256: fixture.sourceSha256,
        alphaEvidence: inputs.alphaEvidence,
        carrierPath: inputs.carrierPath,
        carrierSha256: inputs.carrierSha256,
        sourceTreatmentProfileId: request.sourceTreatmentProfileId,
        mediaTool: inputs.mediaTool,
      }),
      writeJson(path.join(resolvedOutputDirectory, "font-pair-ranking.json"), {
        primary: fonts.primary,
        accent: fonts.accent,
        rankingReceipt: fonts.rankingReceipt,
        rankedPairs: fonts.rankedPairs,
      }),
      writeJson(path.join(resolvedOutputDirectory, "declared-composition.json"), declaration),
      writeJson(path.join(resolvedOutputDirectory, "render-manifest.json"), {
        artifactId: compiled.renderManifest.artifactId,
        manifestSha256,
        manifest,
      }),
      writeFile(path.join(resolvedOutputDirectory, "creative.mp4"), creative.bytes),
      writeFile(path.join(resolvedOutputDirectory, "typography-suppressed.mp4"), typographySuppressed.bytes),
      writeFile(path.join(resolvedOutputDirectory, "source-treatment-suppressed.mp4"), sourceTreatmentSuppressed.bytes),
      writeJson(path.join(resolvedOutputDirectory, "observed-composition.json"), observed),
      writeJson(path.join(resolvedOutputDirectory, "fidelity-report.json"), fidelity),
      writeJson(path.join(resolvedOutputDirectory, "source-treatment-visibility.json"), sourceTreatmentVisibility),
    ]);
    const proof = {
      schemaVersion: "maul-reference-typography-proof/v1",
      fixtureId: request.fixtureId,
      text,
      sourceTreatmentProfileId: request.sourceTreatmentProfileId,
      evidenceWindowMs: creative.durationMs,
      evidenceRenderConfiguration,
      declaredFingerprint: fingerprintReferenceTypographyProofValue(declaration),
      observedFingerprint: observed.observationSha256,
      manifestFingerprint: manifestSha256,
      wordAnchors: anchors,
      retainedFrames: creative.frameSamples.map((sample) => ({outputMs: sample.outputMs, sha256: sample.sha256})),
      typographySuppressedFrames: typographySuppressed.frameSamples.map((sample) => ({outputMs: sample.outputMs, sha256: sample.sha256})),
      sourceTreatmentSuppressedFrames: sourceTreatmentSuppressed.frameSamples.map((sample) => ({outputMs: sample.outputMs, sha256: sample.sha256})),
      sourceTreatmentVisibility,
      sampledPlacementObservations,
      fidelityStatus: fidelity.status,
      hardFailures: fidelity.hardFailures,
    };
    await writeJson(path.join(resolvedOutputDirectory, "proof.json"), proof);
    assertProofEvidence({observed, fidelity, sourceTreatmentVisibility});
    return proof;
  } finally {
    await context.app.close();
  }
};

const argumentValue = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const readInputText = async (textFile: string): Promise<string> =>
  (await readFile(path.resolve(textFile), "utf8"))
    .replace(/^\uFEFF/u, "")
    .replace(/(?:\r?\n)$/u, "");

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const fixtureName = argumentValue(args, "--fixture");
  const textFile = argumentValue(args, "--text-file");
  const outputDirectory = argumentValue(args, "--output");
  if (!fixtureName || !textFile || !outputDirectory) {
    throw new Error("Usage: npx tsx scripts/maul-reference-typography-proof.ts --fixture female --text-file <paragraph.txt> --output <directory>");
  }
  const text = await readInputText(textFile);
  validateReferenceTypographyProofRequest({fixture: fixtureName, text});
  const proof = await prepareReferenceTypographyProof({outputDirectory, text});
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
};

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

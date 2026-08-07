import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import * as path from "node:path";
import {fileURLToPath} from "node:url";

import {createBackendApp} from "../backend/src/app.js";
import {buildCompositionExperimentCapabilityCoverage} from "../backend/src/maul/composition-capability-coverage.js";
import {
  buildSceneADeclaredComposition,
  buildSceneAExperimentDefinition,
  buildSceneAOutputSubjectMask,
  buildSceneAPlanningReceipt,
  buildSceneARepairLedger,
  selectSceneAExperimentFontPair,
} from "../backend/src/maul/composition-experiment-scene-a.js";
import {runCompositionExperiment} from "../backend/src/maul/composition-experiment-runner.js";
import {observeRenderedComposition} from "../backend/src/maul/composition-observer.js";
import type {CreativeTreatmentPlanner} from "../backend/src/maul/creative-treatment-planner.js";
import {
  COMPOSITION_EXPERIMENT_FIXTURES,
  assertEligibleExperimentSceneEvidence,
  deriveSceneAAlphaEvidence,
} from "../backend/src/maul/composition-experiment-fixtures.js";
import {renderMaulShortLocally} from "../backend/src/maul/render-engine.js";
import {decodeRgbaPng, encodeRgbaPng} from "../backend/src/maul/png-rgba.js";
import {resolveRepositoryMediaTool} from "../backend/src/maul/repository-media-tools.js";
import {materializeShortsTextChunkProposal} from "../backend/src/maul/shorts-text-chunking.js";
import {createResolvedMaulTypographyProvider} from "../backend/src/maul/typography-layout.js";
import {loadHydratedMaulFontAssets} from "../backend/src/maul/zilliz-font-assets.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputDirectory = path.join(
  repoRoot,
  "artifacts",
  "maul-composition-experiment",
  "scene-a",
);
const fixture = COMPOSITION_EXPERIMENT_FIXTURES.sceneA;
const sampleTimesMs = [1000, 2000, 3000] as const;

const runExecutable = async (executable: string, args: string[]): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    execFile(
      executable,
      args,
      {windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 64 * 1024 * 1024},
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`${path.basename(executable)} failed: ${stderr.trim() || error.message}`));
          return;
        }
        resolve();
      },
    );
  });

const sha256Bytes = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const sha256File = async (filePath: string): Promise<string> => sha256Bytes(await readFile(filePath));
const sha256Json = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const resolveFfmpeg = async (): Promise<string> => {
  const receipt = await resolveRepositoryMediaTool({tool: "ffmpeg", repoRoot});
  if (receipt.status !== "available") throw new Error(receipt.reason);
  return receipt.executablePath;
};

const flattenSceneAMatte = (sourceBytes: Buffer): Buffer => {
  const source = decodeRgbaPng(sourceBytes);
  const {width, height} = fixture.output;
  const background = [
    Number.parseInt(fixture.carrierBackground.slice(1, 3), 16),
    Number.parseInt(fixture.carrierBackground.slice(3, 5), 16),
    Number.parseInt(fixture.carrierBackground.slice(5, 7), 16),
  ];
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

const materializeSceneAInputs = async ({
  outputDirectory,
}: {
  outputDirectory: string;
}) => {
  const sourcePath = path.join(repoRoot, fixture.sourceRelativePath);
  await assertEligibleExperimentSceneEvidence({filePath: sourcePath, claimedStatus: "verified"});
  const alphaEvidence = await deriveSceneAAlphaEvidence({repoRoot});
  const ffmpegPath = await resolveFfmpeg();
  const inputDirectory = path.join(outputDirectory, "inputs");
  const carrierPath = path.join(inputDirectory, "scene-a-carrier.mp4");
  const silentTrackPath = path.join(inputDirectory, "silent-contract-track.wav");
  const flattenedMattePath = path.join(inputDirectory, "scene-a-flattened-matte.png");
  const carrierReferenceDirectory = path.join(inputDirectory, "carrier-reference-frames");
  await mkdir(carrierReferenceDirectory, {recursive: true});
  await writeFile(flattenedMattePath, flattenSceneAMatte(await readFile(sourcePath)));
  await runExecutable(ffmpegPath, [
    "-y",
    "-loop", "1",
    "-framerate", String(fixture.output.fps),
    "-i", flattenedMattePath,
    "-f", "lavfi",
    "-i", "anullsrc=r=48000:cl=stereo",
    "-map", "0:v",
    "-map", "1:a",
    "-t", "4",
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
    "-t", "4",
    "-c:a", "pcm_s16le",
    silentTrackPath,
  ]);
  const carrierReferenceFrames = await Promise.all(sampleTimesMs.map(async (outputMs) => {
    const framePath = path.join(carrierReferenceDirectory, `frame-${outputMs}.png`);
    await runExecutable(ffmpegPath, [
      "-ss", (outputMs / 1000).toFixed(3),
      "-i", carrierPath,
      "-frames:v", "1",
      "-y",
      framePath,
    ]);
    const bytes = await readFile(framePath);
    return {
      outputMs,
      bytes,
      sha256: sha256Bytes(bytes),
      contentType: "image/png" as const,
    };
  }));
  const subjectMask = await buildSceneAOutputSubjectMask({repoRoot});
  return {
    sourcePath,
    carrierPath,
    carrierSha256: await sha256File(carrierPath),
    silentTrackPath,
    carrierReferenceFrames,
    subjectMask,
    alphaEvidence,
    mediaTool: {
      executablePath: ffmpegPath,
      source: "repository_resolver",
    },
  };
};

const creativeTreatmentPlanner: CreativeTreatmentPlanner = {
  async plan() {
    const treatment = {
      schemaVersion: "maul-creative-treatment-proposal/v1" as const,
      profileId: "aspire_visual_hook" as const,
      compositionDirection: "subject_integrated" as const,
      primaryTypeRole: "editorial_display" as const,
      accentTypeRole: "editorial_italic" as const,
      palette: {
        primary: "#FFFFFF",
        accent: "#F6C453",
        sourceTreatment: "dark_warm_cool_contrast" as const,
      },
      textDensity: "low" as const,
      emphasisMode: "editorial_italic_hinge" as const,
      motionMode: "restrained_phrase_lockup" as const,
      rationale: [
        "Use one source-grounded phrase, one exact display/italic pair, and restrained integrated motion.",
      ],
    };
    return {
      status: "invoked" as const,
      treatment,
      receipt: {
        provider: "openai_compatible" as const,
        model: "reference-derived-scene-a-fixture/v1",
        reasoningEffort: "high" as const,
        requestHash: sha256Json({fixtureId: fixture.fixtureId, phrase: fixture.phrase}),
        responseHash: sha256Json(treatment),
        inferenceReceiptId: "scene_a_creative_treatment_fixture_v1",
        fallbackReason: null,
      },
    };
  },
};

export const prepareSceneACompositionExperiment = async ({
  outputDirectory = defaultOutputDirectory,
  reviewSeed = "scene_a_hidden_review_seed_v1",
}: {
  outputDirectory?: string;
  reviewSeed?: string;
} = {}) => {
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  if (resolvedOutputDirectory === repoRoot || resolvedOutputDirectory === path.parse(resolvedOutputDirectory).root) {
    throw new Error("Refusing to use a repository root or filesystem root as experiment output.");
  }
  await rm(resolvedOutputDirectory, {recursive: true, force: true});
  await mkdir(resolvedOutputDirectory, {recursive: true});
  const definition = buildSceneAExperimentDefinition();
  const inputs = await materializeSceneAInputs({outputDirectory: resolvedOutputDirectory});
  const fonts = selectSceneAExperimentFontPair(loadHydratedMaulFontAssets());
  const typographyProvider = createResolvedMaulTypographyProvider(fonts);
  const semanticConditions = [definition.baseline, definition.repair] as const;
  let planningCall = 0;
  const storageDirectory = path.join(resolvedOutputDirectory, "maul-store");
  const context = await createBackendApp({
    storageDir: storageDirectory,
    envOverrides: {
      ASSEMBLYAI_API_KEY: "",
      GROQ_API_KEY: "",
      ASSET_MILVUS_ENABLED: "false",
      MAUL_CHUNKING_LLM_API_KEY: "",
    },
    deps: {
      maulSceneEvidenceProvider: (await import("../backend/src/maul/composition-experiment-fixtures.js"))
        .createCompositionExperimentSceneEvidenceProvider({
          fixtureId: fixture.fixtureId,
          repoRoot,
        }),
      maulTypographyProvider: typographyProvider,
      maulCreativeTreatmentPlanner: creativeTreatmentPlanner,
      maulTextChunkPlanner: {
        async plan(request) {
          const condition = semanticConditions[planningCall];
          if (!condition) {
            throw new Error("Scene A experiment attempted more than two semantic planning calls.");
          }
          planningCall += 1;
          return {
            ...materializeShortsTextChunkProposal({
              request,
              proposal: condition.chunk.proposal,
              inference: {
                status: "invoked",
                provider: "openai_compatible",
                baseUrl: "https://maul-composition-experiment.local",
                model: "reference-derived-semantic-typography/v1",
                requestHash: sha256Json({fixtureId: fixture.fixtureId, hypothesisId: condition.hypothesisId}),
                responseHash: sha256Json(condition.chunk.proposal),
                fallbackReason: null,
              },
            }),
            semanticTypography: condition.chunk.planBinding,
          };
        },
      },
    },
  });

  try {
    const transcriptWords = [
      {text: "MAKE", startMs: 0, endMs: 1100, confidence: 1},
      {text: "IDEAS", startMs: 1100, endMs: 2400, confidence: 1},
      {text: "MATTER", startMs: 2400, endMs: 4000, confidence: 1},
    ];
    const projectResult = await context.maulProjects.createProject({
      tenantId: "maul_composition_experiment",
      creatorId: "maul_composition_experiment",
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
      targetDurationMs: {min: 4000, max: 4000},
      source: {
        originalFilename: path.basename(inputs.carrierPath),
        storageKey: inputs.carrierPath,
        mediaType: "video/mp4",
        sha256: inputs.carrierSha256,
        durationMs: 4000,
        width: 1080,
        height: 1920,
        fps: 30,
        hasAudio: true,
        hasVideo: true,
      },
    });
    const timeline = await context.maulProjects.createEditorialTimeline(projectResult.project.id, {
      transcript: {language: "en", text: fixture.phrase, words: transcriptWords},
      selectedWindow: {sourceStartMs: 0, sourceEndMs: 4000},
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
    if (!treatment) throw new Error("Scene A premium Treatment Genome was not materialized.");
    const candidates = await context.maulProjects.createCandidates(projectResult.project.id, {
      timelineArtifactId: timeline.timeline.artifactId,
    });
    const candidate = candidates.candidates[0];
    if (!candidate) throw new Error("Scene A did not clear the existing candidate quality floor.");
    const baselinePlanning = await context.maulProjects.createPlanningBundle(projectResult.project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
    });
    const repairPlanning = await context.maulProjects.createPlanningBundle(projectResult.project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
    });
    if (planningCall !== 2) throw new Error(`Scene A expected two planning calls; received ${planningCall}.`);
    const toReceipt = (planning: typeof baselinePlanning) => buildSceneAPlanningReceipt({
      planningBundleArtifactId: planning.planningBundle.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
      sceneEvidenceIds: [`alpha:${inputs.alphaEvidence.alphaSha256}`],
      textChunkPlan: {tokens: planning.plans.textChunk.payload.tokens},
      textPlacementPlan: {segments: planning.plans.textPlacement.payload.segments},
      textAnimationPlan: {programs: planning.plans.textAnimation.payload.programs},
    });
    const baselineReceipt = toReceipt(baselinePlanning);
    const repairReceipt = toReceipt(repairPlanning);
    const textFor = (receipt: typeof baselineReceipt, tokenId: string) =>
      receipt.materializedTokens.find((token) => token.tokenId === tokenId)?.text;
    const baselineAccent = baselineReceipt.tokenStyles.find((style) => style.role === "accent");
    const repairAccent = repairReceipt.tokenStyles.find((style) => style.role === "accent");
    if (!baselineAccent || textFor(baselineReceipt, baselineAccent.tokenId) !== "IDEAS") {
      throw new Error("Scene A baseline did not manifest IDEAS as the compound-anchor accent.");
    }
    if (!repairAccent || textFor(repairReceipt, repairAccent.tokenId) !== "MATTER") {
      throw new Error("Scene A repair did not manifest MATTER as the semantic-anchor accent.");
    }
    const baselineDeclaration = buildSceneADeclaredComposition({
      condition: "baseline",
      definition,
      selection: definition.baseline.selection,
      planning: baselineReceipt,
      fonts,
    });
    const repairDeclaration = buildSceneADeclaredComposition({
      condition: "repair",
      definition,
      selection: definition.repair.selection,
      planning: repairReceipt,
      fonts,
      parentDeclarationId: baselineDeclaration.declarationId,
    });
    const repairLedger = buildSceneARepairLedger({
      baseline: baselineDeclaration,
      repair: repairDeclaration,
      seed: definition.seed,
    });
    const musicTrack = {
      id: "scene_a_silent_contract_track",
      title: "Scene A silent contract track",
      artist: "MAUL experiment fixture",
      storagePath: inputs.silentTrackPath,
      durationSec: 4,
      licenseType: "local_experiment_fixture",
      commercialAllowed: true,
      licenseVerified: true,
      renderSafe: true,
    };
    const planningByCondition = {
      baseline: baselinePlanning,
      repair: repairPlanning,
    } as const;
    const result = await runCompositionExperiment({
      experimentId: "scene_a_causal_hierarchy_v1",
      outputDirectory: resolvedOutputDirectory,
      workRoot: path.join(resolvedOutputDirectory, "render-work"),
      reviewSeed,
      baselineDeclaration,
      repairDeclaration,
      repairLedger,
      capabilityCoverage: buildCompositionExperimentCapabilityCoverage({
        fixtureId: fixture.fixtureId,
        generatedAt: new Date().toISOString(),
      }),
      compiler: {
        version: "maul-manifest-compiler/v1",
        async compile({condition}) {
          const planning = planningByCondition[condition];
          const compiled = await context.maulProjects.compileRenderManifest(projectResult.project.id, {
            candidateArtifactId: candidate.artifactId,
            treatmentGenomeArtifactId: treatment.artifactId,
            planningBundleArtifactId: planning.planningBundle.artifactId,
            musicTrack,
            sfxAssets: [],
          });
          return {
            artifactId: compiled.renderManifest.artifactId,
            candidateArtifactId: candidate.artifactId,
            treatmentGenomeArtifactId: treatment.artifactId,
            planningBundleArtifactId: planning.planningBundle.artifactId,
            manifest: compiled.renderManifest.payload,
          };
        },
      },
      renderer: {version: "MaulShort/v1", render: renderMaulShortLocally},
      observer: {
        version: "maul-composition-observer/v1",
        async observe({condition, declaration, render, observationControl}) {
          return observeRenderedComposition({
            observationId: `scene_a_${condition}_pixels_v1`,
            declarationId: declaration.declarationId,
            renderedFrames: render.frameSamples,
            typographySuppressedFrames: observationControl.frameSamples,
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
        },
      },
    });
    await Promise.all([
      writeJson(path.join(resolvedOutputDirectory, "semantic-typography-tree.json"), definition.tree),
      writeJson(path.join(resolvedOutputDirectory, "fixture-evidence.json"), {
        fixture,
        sourcePath: inputs.sourcePath,
        carrierPath: inputs.carrierPath,
        carrierSha256: inputs.carrierSha256,
        alphaEvidence: inputs.alphaEvidence,
        outputMaskSha256: inputs.subjectMask.sha256,
        carrierReferenceFrames: inputs.carrierReferenceFrames.map(({outputMs, sha256}) => ({outputMs, sha256})),
        mediaTool: inputs.mediaTool,
      }),
      writeJson(path.join(resolvedOutputDirectory, "project-lineage.json"), {
        projectId: projectResult.project.id,
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactIds: {
          baseline: baselinePlanning.planningBundle.artifactId,
          repair: repairPlanning.planningBundle.artifactId,
        },
      }),
    ]);
    return result;
  } finally {
    await context.app.close();
  }
};

const argumentValue = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const command = args.shift();
  const requestedFixture = argumentValue(args, "--fixture");
  if (command !== "prepare" || requestedFixture !== fixture.fixtureId) {
    throw new Error(
      `Usage: npx tsx scripts/maul-composition-experiment.ts prepare --fixture ${fixture.fixtureId} [--output <directory>]`,
    );
  }
  const result = await prepareSceneACompositionExperiment({
    outputDirectory: argumentValue(args, "--output") ?? defaultOutputDirectory,
  });
  process.stdout.write(`${JSON.stringify({
    experimentId: result.experimentId,
    tracePath: result.tracePath,
    publicReviewPackage: path.join(path.dirname(result.tracePath), "review", "public-package.json"),
    status: "pending_blinded_human_review",
  }, null, 2)}\n`);
};

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]!) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

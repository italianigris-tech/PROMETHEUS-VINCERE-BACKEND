import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {copyFile, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

import {createBackendApp} from "../backend/src/app.ts";
import {materializeShortsTextChunkProposal} from "../backend/src/maul/shorts-text-chunking.ts";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputImage = path.join(repoRoot, "THE matted LADY TALKING HEAD MAUL TESTING.png");
const outputDir = path.join(repoRoot, "artifacts", "maul-static-image-placement");
const sourceVideo = path.join(outputDir, "static-matte-carrier.mp4");
const silentTrack = path.join(outputDir, "silent-contract-track.wav");
const renderedVideo = path.join(outputDir, "maul-static-image-placement.mp4");
const manifestPath = path.join(outputDir, "maul-render-manifest.json");
const summaryPath = path.join(outputDir, "maul-placement-summary.json");
const storageDir = path.join(outputDir, "maul-store");

const transcript = "Every great company starts with a simple choice to solve a real problem for people, and you do not need a massive budget, but you do need a clear plan and the courage to start small. Put your product in front of real users right away, listen to what they say, and fix what does not work because success is not about luck; it is about showing up every single day to make your product better.";
const wordDurationMs = 230;
const wordGapMs = 40;

const chunkSpec = [
  {wordCount: 3, role: "hook", emphasisOffset: 1, level: "hero"},
  {wordCount: 5, role: "claim", emphasisOffset: 4, level: "hero"},
  {wordCount: 5, role: "claim", emphasisOffset: 3, level: "key"},
  {wordCount: 5, role: "context", emphasisOffset: 0, level: "support"},
  {wordCount: 5, role: "contrast", emphasisOffset: 0, level: "hero"},
  {wordCount: 4, role: "contrast", emphasisOffset: 3, level: "key"},
  {wordCount: 4, role: "claim", emphasisOffset: 1, level: "key"},
  {wordCount: 5, role: "payoff", emphasisOffset: 1, level: "hero"},
  {wordCount: 5, role: "cta", emphasisOffset: 1, level: "key"},
  {wordCount: 3, role: "proof", emphasisOffset: 1, level: "key"},
  {wordCount: 2, role: "transition", emphasisOffset: 0, level: "support"},
  {wordCount: 5, role: "proof", emphasisOffset: 3, level: "key"},
  {wordCount: 5, role: "claim", emphasisOffset: 4, level: "key"},
  {wordCount: 5, role: "contrast", emphasisOffset: 4, level: "hero"},
  {wordCount: 5, role: "payoff", emphasisOffset: 1, level: "hero"},
  {wordCount: 5, role: "payoff", emphasisOffset: 4, level: "key"},
  {wordCount: 5, role: "cta", emphasisOffset: 3, level: "hero"},
] as const;

const run = async (command: string, args: string[]) => {
  await execFileAsync(command, args, {windowsHide: true, maxBuffer: 8 * 1024 * 1024});
};

const sha256File = async (filePath: string) =>
  createHash("sha256").update(await readFile(filePath)).digest("hex");

const words = transcript.split(/\s+/).filter(Boolean);
let nextWordIndex = 0;
const chunkProposal = chunkSpec.map((spec) => {
  const startWordIndex = nextWordIndex;
  const endWordIndex = startWordIndex + spec.wordCount - 1;
  nextWordIndex = endWordIndex + 1;
  return {
    startWordIndex,
    endWordIndex,
    semanticRole: spec.role,
    emphasisWordIndices: [startWordIndex + spec.emphasisOffset],
    emphasisLevel: spec.level,
  };
});

if (nextWordIndex !== words.length) {
  throw new Error(`Manual chunk specification covers ${nextWordIndex} words; transcript contains ${words.length}.`);
}

const transcriptWords = words.map((text, index) => {
  const startMs = index * (wordDurationMs + wordGapMs);
  return {
    text,
    startMs,
    endMs: startMs + wordDurationMs,
    confidence: 1,
  };
});
const durationMs = transcriptWords.at(-1)!.endMs;

const makeQualityProof = async (manifest: any) => {
  const safe = manifest.plans.adapterDecision.safeRegion;
  const expectedCrops = manifest.timeline.speakerCropTracks.map((track: any) => ({
    outputStartMs: track.outputStartMs,
    outputEndMs: track.outputEndMs,
    ...track.crop,
  }));
  return {
    schemaVersion: "maul-quality-truth-proof/v1" as const,
    manifestReplayKey: manifest.replayKey,
    captionLayout: {
      status: "verified" as const,
      evidenceId: "static_fixture_caption_bounds",
      boxes: manifest.captions.map((_caption: unknown, captionIndex: number) => ({
        captionIndex,
        leftPx: safe.leftPx + 1,
        topPx: safe.topPx + 1,
        rightPx: manifest.output.width - safe.rightPx - 1,
        bottomPx: safe.topPx + 2,
      })),
    },
    fontRuntime: {
      status: "eligible_loaded" as const,
      family: manifest.plans.typographyMotion.fontResolution.selectedFamily,
      assetId: manifest.plans.typographyMotion.fontResolution.selectedAssetId,
      evidenceId: "static_fixture_font_runtime",
    },
    cropAndMask: {
      status: "verified" as const,
      evidenceId: "static_fixture_crop_plan",
      maskingRequired: false,
      maskingStatus: "not_required" as const,
      crops: expectedCrops,
    },
    cameraContinuity: {
      status: "verified_continuous" as const,
      evidenceId: "static_fixture_camera_continuity",
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
      status: "native_render_safe" as const,
      evidenceId: `static_fixture_${capabilityId}`,
    })),
    fallbacks: manifest.planExecution
      .filter((entry: any) => entry.executionStatus === "governed_fallback")
      .map((entry: any) => ({
        planType: entry.planType,
        selected: true as const,
        evidenceId: `static_fixture_fallback_${entry.planType}`,
      })),
  };
};

const main = async () => {
  await rm(outputDir, {recursive: true, force: true});
  await mkdir(outputDir, {recursive: true});

  // The current MAUL source contract accepts video only. This is a neutral carrier:
  // the supplied RGBA matte is placed 1:1 in a 9:16 frame over MAUL's default
  // premium-direct-response backdrop, with a silent audio track required by intake.
  await run("ffmpeg", [
    "-y", "-loop", "1", "-i", inputImage,
    "-f", "lavfi", "-i", "color=c=#08070b:s=1080x1920:r=30",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-filter_complex", "[0:v]scale=1080:1920:flags=lanczos[matte];[1:v][matte]overlay=0:0:format=auto[v]",
    "-map", "[v]", "-map", "2:a", "-t", String(durationMs / 1000),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", sourceVideo,
  ]);
  await run("ffmpeg", [
    "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", String(durationMs / 1000),
    "-c:a", "pcm_s16le", silentTrack,
  ]);

  const context = await createBackendApp({
    storageDir,
    envOverrides: {
      ASSEMBLYAI_API_KEY: "",
      GROQ_API_KEY: "",
      ASSET_MILVUS_ENABLED: "false",
      MAUL_CHUNKING_LLM_API_KEY: "",
    },
    deps: {
      maulQualityTruthProofProvider: makeQualityProof,
      maulTextChunkPlanner: {
        plan: async (request) => materializeShortsTextChunkProposal({
          request,
          proposal: {schemaVersion: "maul-shorts-text-chunk-proposal/v1", chunks: chunkProposal},
          inference: {
            status: "invoked",
            provider: "openai_compatible",
            baseUrl: "https://static-image-placement-demo.local",
            model: "user-directed-chunk-plan",
            requestHash: "a".repeat(64),
            responseHash: "b".repeat(64),
            fallbackReason: null,
          },
        }),
      },
    },
  });

  try {
    const sourceHash = await sha256File(sourceVideo);
    const projectResult = await context.maulProjects.createProject({
      tenantId: "static_image_demo",
      creatorId: "static_image_demo",
      goal: "conversion",
      platform: "instagram_reels",
      sourceProfile: {
        mode: "single_speaker_talking_head",
        principalSpeakerCount: 1,
        primaryLanguage: "en",
      },
      treatmentPreference: "premium_direct_response",
      requestedShortCount: 1,
      requestedThumbnailCount: 1,
      targetDurationMs: {min: durationMs, max: durationMs},
      source: {
        originalFilename: path.basename(sourceVideo),
        storageKey: sourceVideo,
        mediaType: "video/mp4",
        sha256: sourceHash,
        durationMs,
        width: 1080,
        height: 1920,
        fps: 30,
        hasAudio: true,
        hasVideo: true,
      },
    });
    const project = projectResult.project;
    const timelineResult = await context.maulProjects.createEditorialTimeline(project.id, {
      transcript: {language: "en", text: transcript, words: transcriptWords},
      selectedWindow: {sourceStartMs: 0, sourceEndMs: durationMs},
      vadEvidence: {kind: "detected_spans", provider: "manual_verified_vad", silenceSpans: []},
      speakerDetections: [],
      shots: [],
    });
    const treatments = await context.maulProjects.createTreatmentCatalog(project.id, {
      timelineArtifactId: timelineResult.timeline.artifactId,
    });
    const treatment = treatments.treatments.find(
      (entry) => entry.payload.treatmentId === "premium_direct_response",
    );
    if (!treatment) throw new Error("Premium Direct Response treatment was not created.");
    const candidates = await context.maulProjects.createCandidates(project.id, {
      timelineArtifactId: timelineResult.timeline.artifactId,
    });
    const candidate = candidates.candidates[0];
    if (!candidate) throw new Error("MAUL did not generate a candidate for the static carrier.");
    const planning = await context.maulProjects.createPlanningBundle(project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
    });
    const review = await context.maulProjects.reviewCandidate(project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
      planningBundleArtifactId: planning.planningBundle.artifactId,
      reviewerId: "static_image_demo_reviewer",
      decision: "approved",
      failureClasses: [],
      rationale: "Static visual fixture approved to exercise MAUL's existing text planning and rendering path.",
      rubricScores: {
        editorial_clarity: 90,
        source_fidelity: 100,
        pacing_fit: 90,
        visual_hierarchy: 90,
        accessibility: 90,
      },
    });
    const renderResult = await context.maulProjects.renderShort(project.id, {
      candidateArtifactId: candidate.artifactId,
      treatmentGenomeArtifactId: treatment.artifactId,
      planningBundleArtifactId: planning.planningBundle.artifactId,
      reviewDecisionArtifactId: review.review.artifactId,
      musicTrack: {
        id: "silent_contract_track",
        title: "Silent contract track",
        artist: "Local test fixture",
        storagePath: silentTrack,
        durationSec: durationMs / 1000,
        licenseType: "local_test_fixture",
        commercialAllowed: true,
        licenseVerified: true,
        renderSafe: true,
      },
      sfxAssets: [],
    });
    const renderManifest = (await context.maulProjects.getProject(project.id)).artifacts.find(
      (artifact) => artifact.artifactType === "render_manifest",
    );
    if (!renderManifest || renderManifest.artifactType !== "render_manifest") {
      throw new Error("MAUL did not persist a render manifest.");
    }
    const fileId = renderResult.export.payload.storageKey.replace(/^maul-export:/, "");
    await copyFile(
      path.join(storageDir, "maul", "projects", project.id, "exports", `${fileId}.mp4`),
      renderedVideo,
    );
    await writeFile(manifestPath, `${JSON.stringify(renderManifest.payload, null, 2)}\n`, "utf8");
    await writeFile(summaryPath, `${JSON.stringify({
      input: {image: inputImage, carrier: sourceVideo, imagePlacement: "full-frame RGBA matte on the treatment's #08070b backdrop"},
      transcript,
      syntheticTiming: {wordDurationMs, wordGapMs, durationMs},
      manualChunking: planning.plans.textChunk.payload.chunks,
      maul: {
        schemaVersion: renderManifest.payload.schemaVersion,
        treatment: treatment.payload.treatmentId,
        placementStatus: planning.plans.textPlacement.payload.status,
        placementSegments: planning.plans.textPlacement.payload.segments,
        compatibilityProfiles: planning.plans.textPlacement.payload.compatibilityProfiles,
        fontResolution: planning.plans.typographyMotion.payload.fontResolution,
        animationPrograms: planning.plans.textAnimation.payload.programs,
        cameraEvents: planning.plans.camera.payload.events,
        output: renderManifest.payload.output,
        renderFile: renderedVideo,
      },
    }, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({renderedVideo, manifestPath, summaryPath, durationMs, chunks: chunkProposal.length}, null, 2));
  } finally {
    await context.app.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

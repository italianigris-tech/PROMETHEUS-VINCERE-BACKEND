import {createHash} from "node:crypto";
import {createReadStream, existsSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

import {probeVideoMetadata} from "../backend/src/integrations/ffprobe";
import {createJosephUploadPipeline} from "../backend/src/upload/joseph-upload-pipeline";

const repoRoot = path.resolve(process.cwd());
const defaultSourcePath = String.raw`C:\Users\HomePC\Downloads\TALKIN  HEAD VIDEO S\MALE Head Video Raw.mp4`;
const workspaceEvidenceSourcePath = path.join(repoRoot, "artifacts", "raw-joseph-proof-source.mp4");
const allowedProfiles = new Set(["joseph_aggressive", "joseph_cinematic", "joseph_minimal"]);

const hashFile = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
};

const sourcePath = path.resolve(
  process.argv[2] || (existsSync(workspaceEvidenceSourcePath) ? workspaceEvidenceSourcePath : defaultSourcePath),
);
const requestedProfile = process.argv[3] || "joseph_cinematic";
if (!allowedProfiles.has(requestedProfile)) {
  throw new Error(`Unsupported Joseph profile: ${requestedProfile}`);
}
const profile = requestedProfile as "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";
const sessionId = process.argv[4] || "raw_male_joseph_proof_v1";
const retryIndex = Number.parseInt(process.argv[5] || "0", 10);
const storageDir = path.join(repoRoot, "backend", "data");
const outputDir = path.join(repoRoot, "artifacts", "raw-joseph-proof");

const main = async (): Promise<void> => {
  const metadata = await probeVideoMetadata(sourcePath);
  const sourceSha256 = await hashFile(sourcePath);
  const pipeline = createJosephUploadPipeline({
    storageDir,
    requireSpeechTranscript: true,
  });

  const result = await pipeline.createRenderJob({
    sessionId,
    sourcePath,
    sourceFilename: path.basename(sourcePath),
    sourceDurationMs: Math.round(metadata.duration_seconds * 1000),
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    sourceFps: metadata.fps,
    profile,
    retryIndex,
    promptText: [
      "Create an original client-ready Joseph cinematic edit from raw talking-head footage.",
      "Select a coherent 30-45 second narrative, remove dead space, and execute real timeline cuts.",
      "Use subject-aware vertical reframing, bounded typography, motion graphics or relevant local assets,",
      "real transitions, cinematic color, at least two music tracks with a crossfade, dialogue ducking, and intentional SFX.",
      "Reject placeholder planes, clipped text, silent or fake transitions, and any candidate with unresolved quality failures.",
    ].join(" "),
  });

  await mkdir(outputDir, {recursive: true});
  const manifestPath = path.join(outputDir, "unified-render-manifest.json");
  const summaryPath = path.join(outputDir, "pipeline-summary.json");
  const summary = {
    status: "planned",
    source: {
      requiredPath: defaultSourcePath,
      resolvedPath: sourcePath,
      sha256: sourceSha256,
      metadata,
    },
    sessionId,
    profile,
    retryIndex,
    renderJobId: result.renderJobId,
    variationKey: result.variationKey,
    evidencePath: result.evidencePath,
    studioManifestPath: result.studioManifestPath,
    studioManifestUrl: result.studioManifestUrl,
    transcript: result.transcript,
    manifestPath,
  };
  await writeFile(manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({summaryPath, ...summary}, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

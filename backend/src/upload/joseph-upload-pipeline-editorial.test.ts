import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import {buildFixtureSpeechTranscript} from "./joseph-transcript";
import {createJosephUploadPipeline} from "./joseph-upload-pipeline";

const tempDirs: string[] = [];
const makeTempDir = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "joseph-editorial-pipeline-"));
  tempDirs.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe("Joseph upload editorial preprocessing", () => {
  it("plans and publishes the same 44.4-second derived source with raw provenance", async () => {
    const root = await makeTempDir();
    const rawPath = path.join(root, "raw.mp4");
    const trackA = path.join(root, "track-a.mp3");
    const trackB = path.join(root, "track-b.mp3");
    await Promise.all([
      writeFile(rawPath, "raw-source"),
      writeFile(trackA, "track-a"),
      writeFile(trackB, "track-b"),
    ]);
    const rawTranscript = {
      ...buildFixtureSpeechTranscript(61_172),
      source: "assemblyai" as const,
      trainableForIrl: true,
      warnings: [],
    };
    const editedTranscript = {
      ...buildFixtureSpeechTranscript(44_400),
      source: "assemblyai" as const,
      trainableForIrl: true,
      warnings: ["editorial_timeline_remapped_from_raw_source"],
    };
    const materializeEditorialSource = vi.fn(async ({sourcePath, outputPath}: {sourcePath: string; outputPath: string}) => {
      await mkdir(path.dirname(outputPath), {recursive: true});
      await writeFile(outputPath, "derived-source");
      return {
        sourcePath,
        sourceSha256: "a".repeat(64),
        derivedPath: outputPath,
        derivedSha256: "b".repeat(64),
        plan: {
          version: "joseph-editorial-v1" as const,
          strategy: "assemblyai_narrative_arc" as const,
          sourceDurationMs: 61_172,
          outputDurationMs: 44_400,
          removedDurationMs: 16_772,
          segments: [
            {role: "hook" as const, sourceStartMs: 800, sourceEndMs: 10_520, outputStartMs: 0, outputEndMs: 9_720},
            {role: "benefit" as const, sourceStartMs: 10_520, sourceEndMs: 13_280, outputStartMs: 9_720, outputEndMs: 12_480},
            {role: "reversal" as const, sourceStartMs: 16_960, sourceEndMs: 28_320, outputStartMs: 12_480, outputEndMs: 23_840},
            {role: "pain" as const, sourceStartMs: 28_710, sourceEndMs: 40_550, outputStartMs: 23_840, outputEndMs: 35_680},
            {role: "payoff" as const, sourceStartMs: 46_710, sourceEndMs: 55_430, outputStartMs: 35_680, outputEndMs: 44_400},
          ],
        },
        transcript: editedTranscript,
      };
    });

    const pipeline = createJosephUploadPipeline({
      storageDir: path.join(root, "data"),
      publicDir: path.join(root, "public"),
      uploadDir: path.join(root, "uploads"),
      resolveTranscript: async ({transcriptPath}) => {
        await mkdir(path.dirname(transcriptPath), {recursive: true});
        await writeFile(transcriptPath, JSON.stringify(rawTranscript));
        return {path: transcriptPath, payload: rawTranscript};
      },
      materializeEditorialSource,
      listLocalMusicCatalog: () => [trackA, trackB].map((localFilePath, index) => ({
        trackId: `track-${index}`,
        title: `Track ${index}`,
        sourceKind: "local" as const,
        localFilePath,
        durationSeconds: 60,
        renderSafe: true,
        licenseStatus: "test",
      })),
      analyzeMusicTrack: async () => ({
        bpm: 120,
        beatTimes: Array.from({length: 120}, (_, index) => index * 0.5),
        downbeats: Array.from({length: 30}, (_, index) => index * 2),
        sections: [{id: "main", startSeconds: 0, endSeconds: 60, label: "main", energy: 0.7}],
        loudnessLUFS: -15,
        energyCurve: [0.5, 0.7, 0.6],
        duration: 60,
        source: "ffmpeg_fallback" as const,
        warnings: [],
      }),
    });

    const result = await pipeline.createRenderJob({
      sessionId: "raw-editorial-proof",
      sourcePath: rawPath,
      sourceDurationMs: 61_172,
      sourceWidth: 1280,
      sourceHeight: 720,
      sourceFps: 30,
      profile: "joseph_cinematic",
    });

    expect(materializeEditorialSource).toHaveBeenCalledTimes(1);
    expect(result.manifest.source.durationMs).toBe(44_400);
    expect(result.manifest.sourceEdit).toMatchObject({
      sourceSha256: "a".repeat(64),
      derivedSha256: "b".repeat(64),
      outputDurationMs: 44_400,
      segments: expect.arrayContaining([expect.objectContaining({role: "payoff"})]),
    });
    expect(result.manifest.source.audioUrl).toContain("raw-editorial-proof");
    const studioManifest = JSON.parse(await readFile(result.studioManifestPath!, "utf8"));
    expect(studioManifest.source.videoUrl).toBe(result.manifest.source.videoUrl);
    expect(studioManifest.sourceEdit).toEqual(result.manifest.sourceEdit);
  });
});

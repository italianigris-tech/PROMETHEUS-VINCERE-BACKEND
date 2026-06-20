import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";

const targetPath = path.resolve(__dirname, "judgment-layer.ts");
const describeIfPresent = fs.existsSync(targetPath) ? describe : describe.skip;

describeIfPresent("JudgmentLayer contract", () => {
  let JudgmentLayer: any;

  beforeAll(async () => {
    ({JudgmentLayer} = await import(new URL("./judgment-layer.ts", import.meta.url).href));
  });

  const mockManifest = (jobId: string, hookCuts = 3) => ({
    jobId,
    version: "2.0",
    seed: 12345,
    durationFrames: 60,
    fps: 30,
    width: 1080,
    height: 1920,
    videoTracks: [],
    cameraMoves: [{type: "push_in", startFrame: 30, endFrame: 59}],
    textOverlays: [],
    transitions: [],
    timeline: Array.from({length: hookCuts}, (_, index) => ({type: "cut", atMs: index * 500, toMs: index * 500, style: "hard", intensity: 1})),
    audio: {beats: [], onsets: [], energyCurve: [], sfx: [], voiceVolumeDb: 0, musicVolumeDb: -18, targetLufs: -14},
    source: {videoUrl: "file:///test.mp4", transcript: [], durationMs: 2000, width: 1080, height: 1920, fps: 30},
    output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
    creativeProfile: {name: "joseph_aggressive", cutDensity: 1, textDensity: 0.8, sfxDensity: 1, cameraAggression: 0.9, colorIntensity: 0.8},
  });

  const mockVariationKey = () => ({
    sourceFingerprint: "sha256-of-test-video",
    promptFingerprint: "sha256-of-prompt",
    uploadInstanceId: "upload-1",
    retryIndex: 0,
  });

  it("selects one candidate and rejects the rest", async () => {
    const judgment = new JudgmentLayer({getBySource: () => [], insert: () => undefined});
    const result = await judgment.judgeCandidates([mockManifest("a"), mockManifest("b"), mockManifest("c")], mockVariationKey());

    expect(result.selected).toBeDefined();
    expect(result.rejected).toHaveLength(2);
  });

  it("rejects candidates below the hook quality floor", async () => {
    const judgment = new JudgmentLayer({getBySource: () => [], insert: () => undefined});
    const result = await judgment.judgeCandidates([mockManifest("bad", 0), mockManifest("good", 3)], mockVariationKey());

    expect(result.selected.jobId).toBe("good");
  });

  it("is deterministic for the same candidate set and variation key", async () => {
    const judgment = new JudgmentLayer({getBySource: () => [], insert: () => undefined});
    const candidates = [mockManifest("a"), mockManifest("b"), mockManifest("c")];

    const left = await judgment.judgeCandidates(candidates, mockVariationKey());
    const right = await judgment.judgeCandidates(candidates, mockVariationKey());

    expect(right).toEqual(left);
  });
});

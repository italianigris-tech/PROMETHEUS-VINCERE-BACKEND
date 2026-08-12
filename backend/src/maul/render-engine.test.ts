import {describe, expect, it} from "vitest";

import {
  assertMaulSfxAudibility,
  buildMaulSoundDesignManifest,
  shouldUseMaulSoundEngine,
  resolveMaulRenderConcurrency,
  resolveMaulRenderFrameRange,
  resolveMaulMartinStageAssets,
} from "./render-engine.js";

describe("MAUL local render engine", () => {
  it("rejects an imperceptible rendered typography-SFX stem", () => {
    expect(() => assertMaulSfxAudibility({dialogueMaxDb: -2, sfxMaxDb: -20})).toThrow(/inaudible/i);
    expect(() => assertMaulSfxAudibility({dialogueMaxDb: -2, sfxMaxDb: -7})).not.toThrow();
  });

  it("routes enabled 9:16 audio treatment through the sound engine", async () => {
    const manifest = {
      timeline: {outputDurationMs: 20_000},
      captions: [],
      treatment: {rendererInputs: {audio: {duckingDb: -14}}},
      layerPolicy: {audioTreatment: "enabled"},
      audio: {
        musicTrack: {
          id: "bed",
          storagePath: "C:/audio/bed.mp3",
          renderSafe: true,
        },
        sfxAssets: [{
          id: "type_1",
          eventType: "typography_entry",
          outputMs: 1_000,
          storagePath: "C:/audio/type.wav",
          renderSafe: true,
        }],
      },
    } as any;

    expect(shouldUseMaulSoundEngine(manifest)).toBe(true);
    const sound = await buildMaulSoundDesignManifest({
      manifest,
      dialogueSource: "C:/render/visual-dialogue.mp4",
      probeDuration: async (file) => file.endsWith("type.wav") ? 0.8 : 60,
    });
    expect(sound.dialogueSource).toBe("C:/render/visual-dialogue.mp4");
    expect(sound.musicCues).toHaveLength(1);
    expect(sound.sfx).toEqual([
      expect.objectContaining({id: "type_1", start: 1, end: 1.8, gainDb: 4}),
    ]);
    expect(sound.master).toMatchObject({targetI: -16, truePeak: -1.5, sampleRate: 48_000});
  });

  it("serializes a constrained proof render with an explicit Remotion concurrency flag", () => {
    expect(resolveMaulRenderConcurrency(1)).toEqual(["--concurrency=1"]);
  });

  it("preserves Remotion defaults when no render concurrency is requested", () => {
    expect(resolveMaulRenderConcurrency(undefined)).toEqual([]);
  });

  it("renders only the declared evidence window when a frame range is supplied", () => {
    expect(resolveMaulRenderFrameRange({startFrame: 0, endFrame: 119})).toEqual([
      "--frames=0-119",
    ]);
  });

  it("stages every verified Martin alpha foreground before Remotion starts", () => {
    expect(resolveMaulMartinStageAssets({
      martinDepth: {windows: [
        {windowId: "w1", foregroundAsset: {storagePath: "C:/mattes/w1.webm", sha256: "a".repeat(64)}},
        {windowId: "w2", foregroundAsset: {storagePath: "C:/mattes/w2.webm", sha256: "b".repeat(64)}},
      ]},
    } as any)).toEqual([
      {windowId: "w1", storagePath: "C:/mattes/w1.webm", sha256: "a".repeat(64)},
      {windowId: "w2", storagePath: "C:/mattes/w2.webm", sha256: "b".repeat(64)},
    ]);
  });
});

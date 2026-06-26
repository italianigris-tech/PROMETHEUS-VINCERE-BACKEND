import path from "node:path";
import {access, mkdir} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {compileFilterGraph, renderMasterTrack, validateManifest, buildSoundDesignPlan, runFfmpegCommand} from "../sound-engine";
import {cleanupTempDir, makeTempDir} from "./test-utils";

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const createToneFile = async ({
  dir,
  relativePath,
  frequency,
  durationSeconds
}: {
  dir: string;
  relativePath: string;
  frequency: number;
  durationSeconds: number;
}): Promise<string> => {
  const filePath = path.join(dir, relativePath);
  await mkdir(path.dirname(filePath), {recursive: true});
  await runFfmpegCommand([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequency}:duration=${durationSeconds}:sample_rate=48000`,
    "-c:a",
    "pcm_s16le",
    filePath
  ]);
  return filePath;
};

describe("sound engine", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("validates manifests and compiles a deterministic filtergraph", async () => {
    await createToneFile({
      dir: tempDir,
      relativePath: "dialogue/dialogue_source.wav",
      frequency: 220,
      durationSeconds: 12
    });
    await createToneFile({
      dir: tempDir,
      relativePath: "music/fast_intro.wav",
      frequency: 440,
      durationSeconds: 8
    });
    await createToneFile({
      dir: tempDir,
      relativePath: "music/second_lift.wav",
      frequency: 554,
      durationSeconds: 10
    });
    await createToneFile({
      dir: tempDir,
      relativePath: "music/final_push.wav",
      frequency: 660,
      durationSeconds: 10
    });
    await createToneFile({
      dir: tempDir,
      relativePath: "sfx/riser.wav",
      frequency: 880,
      durationSeconds: 2
    });
    await createToneFile({
      dir: tempDir,
      relativePath: "sfx/impact.wav",
      frequency: 110,
      durationSeconds: 2
    });

    const manifest = {
      duration: 24,
      dialogueSource: "dialogue/dialogue_source.wav",
      dialogue: [
        {start: 0, end: 3.6, gainDb: -3, label: "opening statement"},
        {start: 4.2, end: 8.8, gainDb: -3, label: "supporting explanation"}
      ],
      musicCues: [
        {
          id: "cue_1",
          file: "music/fast_intro.wav",
          start: 0,
          end: 6,
          gainDb: -4,
          transitionOut: {
            preset: "tail_wash_out",
            start: 5.2,
            duration: 0.8,
            settings: {
              echoMix: 0.38,
              echoDelayMs: 108
            }
          }
        },
        {
          id: "cue_2",
          file: "music/second_lift.wav",
          start: 5.8,
          end: 13,
          gainDb: -5,
          transitionIn: {
            preset: "soft_overlap_in",
            start: 5.8,
            duration: 0.8,
            settings: {
              fadeInSeconds: 0.8
            }
          },
          transitionOut: {
            preset: "impact_handoff",
            start: 12.2,
            duration: 0.8,
            settings: {
              echoMix: 0.24,
              echoDelayMs: 42
            }
          }
        },
        {
          id: "cue_3",
          file: "music/final_push.wav",
          start: 12.6,
          end: 20.5,
          gainDb: -5,
          transitionIn: {
            preset: "reverb_throw",
            start: 12.6,
            duration: 0.8,
            settings: {
              echoMix: 0.44,
              echoDelayMs: 96
            }
          },
          transitionOut: {
            preset: "filter_sink",
            start: 19.7,
            duration: 0.8,
            settings: {
              lowpassHz: 1800
            }
          }
        }
      ],
      sfx: [
        {
          id: "riser_1",
          file: "sfx/riser.wav",
          start: 12.1,
          end: 12.9,
          gainDb: -8,
          role: "sfx"
        },
        {
          id: "impact_1",
          file: "sfx/impact.wav",
          start: 13,
          end: 13.6,
          gainDb: -5,
          role: "sfx"
        }
      ],
      master: {
        targetI: -16,
        truePeak: -1.5,
        lra: 11,
        sampleRate: 48000,
        previewSampleRate: 22050
      },
      presetOverrides: {
        tail_wash_out: {
          echoMix: 0.38,
          echoDelayMs: 108
        }
      }
    };

    await expect(validateManifest(manifest, {baseDir: tempDir})).resolves.toBeTruthy();

    const plan = await buildSoundDesignPlan(manifest, {baseDir: tempDir});
    const compilation = compileFilterGraph(plan);

    expect(plan.musicCues).toHaveLength(3);
    expect(plan.sfxCues).toHaveLength(2);
    expect(compilation.filterComplexScript).toContain("acrossfade");
    expect(compilation.filterComplexScript).toContain("loudnorm");
    expect(compilation.filterComplexScript).toContain("[dialogue_bus_raw]asplit=2");
    expect(compilation.inputFiles.length).toBeGreaterThanOrEqual(6);

    const masterPath = path.join(tempDir, "renders", "master.wav");
    const previewPath = path.join(tempDir, "renders", "preview.wav");
    const waveformPath = path.join(tempDir, "renders", "waveform.png");
    const peaksPath = path.join(tempDir, "renders", "peaks.json");
    const stemsDir = path.join(tempDir, "renders", "stems");
    const debugPlanPath = path.join(tempDir, "renders", "audio-render-plan.json");

    const result = await renderMasterTrack(manifest, masterPath, {
      baseDir: tempDir,
      previewMixPath: previewPath,
      waveformPngPath: waveformPath,
      peaksJsonPath: peaksPath,
      stemsDir,
      debugPlanPath,
      aacPath: path.join(tempDir, "renders", "master.m4a")
    });

    expect(result.masterPath).toBe(masterPath);
    expect(await fileExists(masterPath)).toBe(true);
    expect(await fileExists(path.join(tempDir, "renders", "master.m4a"))).toBe(true);
    expect(await fileExists(previewPath)).toBe(true);
    expect(await fileExists(waveformPath)).toBe(true);
    expect(await fileExists(peaksPath)).toBe(true);
    expect(await fileExists(path.join(stemsDir, "music.wav"))).toBe(true);
    expect(await fileExists(path.join(stemsDir, "dialogue.wav"))).toBe(true);
    expect(await fileExists(path.join(stemsDir, "sfx.wav"))).toBe(true);
    expect(await fileExists(debugPlanPath)).toBe(true);
    expect(result.compilation.appliedPresets.length).toBeGreaterThan(0);
  }, 120000);

  it("rejects missing source files", async () => {
    await expect(
      validateManifest(
        {
          duration: 30,
          musicCues: [
            {
              id: "missing",
              file: "music/missing.wav",
              start: 0,
              end: 10,
              gainDb: 0
            }
          ],
          sfx: [],
          dialogue: [],
          master: {
            targetI: -16,
            truePeak: -1.5,
            lra: 11,
            sampleRate: 48000,
            previewSampleRate: 22050
          }
        },
        {baseDir: tempDir}
      )
    ).rejects.toThrow("missing files");
  });
});

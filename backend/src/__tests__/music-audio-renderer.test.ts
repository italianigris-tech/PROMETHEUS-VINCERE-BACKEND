import path from "node:path";
import {access, mkdir} from "node:fs/promises";
import {constants as fsConstants} from "node:fs";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {renderAudioPlan, videoAwareAudioPlanSchema} from "../music";
import {runFfmpegCommand} from "../sound-engine/ffmpeg";
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

describe("music audio renderer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  const buildBasePlan = (trackStoragePath: string, overrides: Record<string, unknown> = {}) =>
    videoAwareAudioPlanSchema.parse({
      id: "plan_audio_1",
      jobId: "job_audio_1",
      projectId: "project_1",
      userId: "user_1",
      sourceVideoId: "video_1",
      transcriptId: "transcript_1",
      videoDurationSec: 8,
      previewStartSec: 0,
      previewEndSec: 8,
      creativeDirection: {summary: "preview mix"},
      timelineSegments: [],
      musicEvents: [
        {
          id: "music_1",
          trackId: "track_local",
          videoStartSec: 0,
          videoEndSec: 6,
          trackStartSec: 0,
          trackEndSec: 6,
          sectionRole: "intro",
          purpose: "hook_bed",
          storagePath: trackStoragePath,
          sourceObjectKey: null,
          previewOnly: true,
          renderSafe: false,
          warning: "Preview only / license not verified.",
          volumeDb: -24,
          fadeInSec: 0.25,
          fadeOutSec: 0.5,
          duckingEnabled: true,
          beatAligned: false,
          transitionInId: null,
          transitionOutId: null
        }
      ],
      transitionEvents: [],
      sfxEvents: [],
      duckingRegions: [],
      captionSyncEvents: [],
      renderSettings: {
        targetIntegratedLufs: -16,
        targetTruePeakDbtp: -1.5,
        targetLra: 11,
        sampleRate: 48000,
        previewSampleRate: 22050,
        preserveDialogueIntelligibility: true,
        notes: []
      },
      outputAudioPath: null,
      outputVideoPath: null,
      planMode: "dry_run",
      status: "planned",
      errorMessage: null,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
      ...overrides
    });

  it("throws instead of pretending a remote music source is renderable without a cache resolver", async () => {
    const plan = buildBasePlan("r2://prometheus-music/example.mp3");
    await expect(renderAudioPlan({
      plan,
      outputAudioPath: path.join(tempDir, "blocked.wav"),
      baseDir: tempDir
    })).rejects.toThrow(/remote audio cache resolver/i);
  });

  it("downloads remote music through the cache resolver before FFmpeg rendering", async () => {
    const cachedTrack = await createToneFile({
      dir: tempDir,
      relativePath: "remote-cache/cached-track.wav",
      frequency: 330,
      durationSeconds: 8
    });
    const plan = buildBasePlan("r2://prometheus-music/music-originals/example.wav");
    const outputAudioPath = path.join(tempDir, "renders", "remote-rendered.wav");
    const calls: Array<{source: string; cueId: string}> = [];
    const result = await renderAudioPlan({
      plan,
      outputAudioPath,
      baseDir: tempDir,
      remoteAudioResolver: async (input) => {
        calls.push({source: input.source, cueId: input.cueId});
        return {
          localPath: cachedTrack,
          evidence: [`cached ${input.source}`]
        };
      }
    });

    expect(calls).toEqual([{source: "r2://prometheus-music/music-originals/example.wav", cueId: "music_1"}]);
    expect(result.status).toBe("rendered");
    expect(await fileExists(outputAudioPath)).toBe(true);
    expect(result.evidence.some((entry) => entry.includes("cached r2://prometheus-music"))).toBe(true);
  }, 120000);

  it("returns skipped when explicitly disabled", async () => {
    const localTrack = await createToneFile({
      dir: tempDir,
      relativePath: "music/local-track.wav",
      frequency: 330,
      durationSeconds: 8
    });
    const plan = buildBasePlan(localTrack);
    const result = await renderAudioPlan({
      plan,
      outputAudioPath: path.join(tempDir, "disabled.wav"),
      baseDir: tempDir,
      disabled: true
    });

    expect(result.status).toBe("skipped");
    expect(result.evidence[0]).toContain("explicitly disabled");
  });

  it("renders a real preview mix when local-safe inputs exist", async () => {
    const localTrack = await createToneFile({
      dir: tempDir,
      relativePath: "music/local-track.wav",
      frequency: 440,
      durationSeconds: 8
    });
    const plan = buildBasePlan(localTrack);
    const outputAudioPath = path.join(tempDir, "renders", "video-aware-audio-preview-mix.wav");
    const result = await renderAudioPlan({
      plan,
      outputAudioPath,
      baseDir: tempDir
    });

    expect(result.status).toBe("rendered");
    expect(result.outputAudioPath).toBe(outputAudioPath);
    expect(await fileExists(outputAudioPath)).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("preview-only"))).toBe(true);
  }, 120000);

  it("blocks render-ready handoff when unverified tracks remain", async () => {
    const localTrack = await createToneFile({
      dir: tempDir,
      relativePath: "music/local-track.wav",
      frequency: 550,
      durationSeconds: 8
    });
    const plan = buildBasePlan(localTrack, {
      planMode: "render_ready",
      musicEvents: [
        {
          ...buildBasePlan(localTrack).musicEvents[0],
          renderSafe: false,
          previewOnly: true
        }
      ]
    });
    const result = await renderAudioPlan({
      plan,
      outputAudioPath: path.join(tempDir, "render-ready.wav"),
      baseDir: tempDir
    });

    expect(result.status).toBe("blocked");
    expect(result.errors.some((error) => error.includes("Render-ready handoff is blocked"))).toBe(true);
  });

  it("reports ducking and SFX evidence when the preview mix renders them", async () => {
    const localTrack = await createToneFile({
      dir: tempDir,
      relativePath: "music/local-track.wav",
      frequency: 440,
      durationSeconds: 8
    });
    const dialogueTrack = await createToneFile({
      dir: tempDir,
      relativePath: "dialogue/dialogue.wav",
      frequency: 220,
      durationSeconds: 8
    });
    const sfxTrack = await createToneFile({
      dir: tempDir,
      relativePath: "sfx/whoosh.wav",
      frequency: 880,
      durationSeconds: 1
    });
    const plan = buildBasePlan(localTrack, {
      sfxEvents: [
        {
          id: "sfx_1",
          type: "tension_riser",
          assetId: "whoosh",
          videoStartSec: 1.9,
          videoEndSec: 2.25,
          durationSec: 0.35,
          intensity: 0.64,
          mixRole: "video_context",
          reason: "Visual whip lead-in",
          triggerText: "breakthrough",
          volumeDb: -8
        }
      ],
      duckingRegions: [
        {
          id: "duck_1",
          videoStartSec: 1,
          videoEndSec: 3.4,
          reason: "Dialogue protection",
          targetMusicDb: -21,
          speechPriority: 0.92
        }
      ]
    });
    const result = await renderAudioPlan({
      plan,
      outputAudioPath: path.join(tempDir, "renders", "ducked-preview.wav"),
      baseDir: tempDir,
      dialogueSource: dialogueTrack,
      sfxAssetPaths: {
        whoosh: sfxTrack
      }
    });

    expect(result.status).toBe("rendered");
    expect(result.evidence.some((entry) => entry.includes("Ducking applied"))).toBe(true);
    expect(result.evidence.some((entry) => entry.includes("SFX mixed into render"))).toBe(true);
  }, 120000);
});

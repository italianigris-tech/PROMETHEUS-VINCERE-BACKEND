import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTempFile, createTestApp, makeTempDir} from "./test-utils";

const buildTranscript = (lines: string[]): Array<{text: string; start_ms: number; end_ms: number; confidence: number}> => {
  let cursorMs = 0;
  return lines.flatMap((line, lineIndex) => {
    const words = line.split(/\s+/).filter(Boolean);
    const lineWords = words.map((word, wordIndex) => {
      const start = cursorMs + wordIndex * 390;
      return {
        text: word,
        start_ms: start,
        end_ms: start + 310,
        confidence: 0.96
      };
    });
    cursorMs += words.length * 390 + (lineIndex % 2 === 0 ? 620 : 180);
    return lineWords;
  });
};

const parseSseEventTypes = (body: string): string[] =>
  body
    .split(/\n/)
    .filter((line) => line.startsWith("event: "))
    .map((line) => line.slice("event: ".length));

describe("short-form intelligence contract", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("returns ranked candidates with semantic, acoustic, visual, pacing, music, and style explanations", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const transcript = buildTranscript([
      "Most creators make one mistake that kills retention.",
      "They start with background instead of tension, and viewers scroll before the payoff arrives.",
      "Here's the thing: when you open with conflict first, people stay long enough to hear the lesson.",
      "I was wrong about that for years, and fixing it doubled the comments on my videos.",
      "The reason is simple.",
      "Curiosity buys you a few more seconds, and those seconds give your payoff room to land.",
      "Nobody talks about this, but the hook is not the headline.",
      "The hook is unresolved tension that makes the next sentence feel necessary."
    ]);

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/generate-viral-clips",
      payload: {
        projectId: "proj_short_form_ai",
        videoId: "vid_longform_01",
        targetPlatform: "shorts",
        clipCountMin: 2,
        clipCountMax: 4,
        prompt: "Generate cinematic short-form clips using correlated signal stacking.",
        creatorNiche: "creator",
        metadataOverrides: {
          stylePreference: "cinematic",
          selectedSongs: ["internal-track-rise"]
        },
        providedTranscript: transcript
      }
    });
    expect(createResponse.statusCode).toBe(202);
    const {jobId} = createResponse.json();

    await context.queue.onIdle();

    const resultResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/result`
    });
    expect(resultResponse.statusCode).toBe(200);
    const result = resultResponse.json();
    const topClip = result.selected_clips[0];

    expect(result.source_summary.ranking_model).toBe("correlated_signal_stacking_v1");
    expect(result.source_summary.fallback_mode).toBe("transcript_semantic_segmentation");
    expect(topClip.semantic_summary.length).toBeGreaterThan(10);
    expect(topClip.semantic_segment.intent).toMatch(/hook|insight|payoff|story/);
    expect(topClip.semantic_segment.boundary_reasons).toEqual(
      expect.arrayContaining(["semantic_window", "speech_boundary"])
    );
    expect(topClip.semantic_segment.boundary_reasons).not.toContain("fixed_duration");
    expect(topClip.score_breakdown).toMatchObject({
      model: "correlated_signal_stacking_v1",
      semantic: {
        score: expect.any(Number)
      },
      acoustic: {
        rms_energy_proxy: expect.any(Number),
        speech_velocity_wps: expect.any(Number),
        silence_ratio: expect.any(Number),
        score: expect.any(Number)
      },
      visual: {
        motion_variance_proxy: expect.any(Number),
        score: expect.any(Number)
      },
      pacing: {
        score: expect.any(Number)
      },
      layers: {
        deterministic_scoring: "active",
        learned_weighting: "not_trained",
        llm_reasoning: "optional_refinement"
      }
    });
    expect(topClip.recommended_music_pairing).toMatchObject({
      source: expect.stringMatching(/selected_song|internal_catalog/),
      intensity: expect.any(String),
      bpm_range: [expect.any(Number), expect.any(Number)],
      emotional_peak_ms: expect.any(Number)
    });
    expect(topClip.rendering_style_metadata).toMatchObject({
      style: "cinematic",
      typography_density: expect.any(String),
      motion_curve: expect.any(String),
      color_grade: expect.any(String)
    });

    const eventReplay = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/events?replay=once`
    });
    expect(parseSseEventTypes(eventReplay.body)).toEqual(
      expect.arrayContaining(["SEGMENTING", "SCORING", "RANKING", "CLIP_READY", "MUSIC_ALIGNED"])
    );

    await context.app.close();
  });

  it("falls back to acoustic segmentation when transcript generation is unavailable", async () => {
    const sourcePath = await createTempFile({
      dir: tempDir,
      fileName: "longform-source.mp4",
      contents: Buffer.from("fake-video")
    });
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          fps: 30,
          duration_seconds: 96,
          duration_in_frames: 2880,
          codec_video: "h264",
          container_format: "mp4",
          bitrate_video: 1_200_000
        })
      }
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Find viral shorts even if the transcript cannot be produced.",
        source_media_ref: sourcePath,
        target_platform: "shorts",
        max_clip_count: 3,
        metadata_overrides: {
          stylePreference: "viral"
        }
      }
    });
    expect(createResponse.statusCode).toBe(202);
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const resultResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/result`
    });
    expect(resultResponse.statusCode).toBe(200);
    const result = resultResponse.json();

    expect(result.source_summary.transcript_available).toBe(false);
    expect(result.source_summary.fallback_mode).toBe("acoustic_segmentation");
    expect(result.selected_clips.length).toBeGreaterThan(0);
    expect(result.selected_clips[0]).toMatchObject({
      score_breakdown: {
        acoustic: {
          analysis_mode: "acoustic_fallback_proxy"
        }
      },
      rendering_style_metadata: {
        style: "viral"
      }
    });

    await context.app.close();
  });
});

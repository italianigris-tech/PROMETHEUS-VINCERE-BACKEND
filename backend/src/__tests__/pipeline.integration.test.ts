import {afterEach, beforeEach, describe, expect, it} from "vitest";
import path from "node:path";
import {mkdir} from "node:fs/promises";

import {runFfmpegCommand} from "../sound-engine";
import {cleanupTempDir, createTempFile, createTestApp, makeTempDir} from "./test-utils";

describe("pipeline integration", () => {
  let tempDir: string;

  const buildTranscript = (text: string): Array<{text: string; start_ms: number; end_ms: number; confidence: number}> => {
    return text.split(/\s+/).map((word, index) => ({
      text: word,
      start_ms: index * 500,
      end_ms: (index * 500) + 420,
      confidence: 0.96
    }));
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

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("completes a prompt-only request with cinematic premium defaults", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Plan an educational talking head edit."
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const metadata = await context.service.getMetadataProfile(jobId);
    const job = await context.service.getJob(jobId);
    const motionPlanExists = await context.repository.artifactExists(jobId, "motion_plan");

    expect(metadata.typography.caption_style_profile).toBe("longform_eve_typography_v1");
    expect(metadata.motion_graphics.motion_graphics_style_family).toBe("restrained-premium-accent");
    expect(motionPlanExists).toBe(true);
    expect(job.stage_history.map((entry) => entry.stage)).toEqual([
      "received",
      "analyzing",
      "metadata_ready",
      "plan_ready",
      "execution_ready",
      "ranking",
      "completed"
    ]);

    await context.app.close();
  });

  it("bridges retrieved typography fonts into metadata and edit plans as browser-safe assets", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        resolveFontsByVibe: async () => ({
          query: "luxury typography pairing | premium founder lesson",
          fallbackReasons: [],
          primary: {
            assetId: "font_aesthetic",
            family: "Aesthetic",
            filePath: "C:\\tmp\\retrieved\\aesthetic\\Aesthetic-Regular.woff2",
            browserUrl: "/fonts/retrieved/aesthetic/Aesthetic-Regular.woff2",
            sources: [
              {
                fileName: "Aesthetic-Regular.woff2",
                filePath: "C:\\tmp\\retrieved\\aesthetic\\Aesthetic-Regular.woff2",
                browserUrl: "/fonts/retrieved/aesthetic/Aesthetic-Regular.woff2",
                format: "woff2"
              }
            ],
            score: 0.97,
            confidence: 0.94,
            recommendedUsage: "headline"
          },
          secondary: {
            assetId: "font_ageya",
            family: "Ageya",
            filePath: "C:\\tmp\\retrieved\\ageya\\Ageya-Regular.woff2",
            browserUrl: "/fonts/retrieved/ageya/Ageya-Regular.woff2",
            sources: [
              {
                fileName: "Ageya-Regular.woff2",
                filePath: "C:\\tmp\\retrieved\\ageya\\Ageya-Regular.woff2",
                browserUrl: "/fonts/retrieved/ageya/Ageya-Regular.woff2",
                format: "woff2"
              }
            ],
            score: 0.91,
            confidence: 0.9,
            recommendedUsage: "support"
          }
        })
      }
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Build a premium founder lesson with restrained luxury typography."
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const metadata = await context.service.getMetadataProfile(jobId);
    const editPlan = await context.service.getEditPlan(jobId);

    expect(metadata.typography.font_family_primary).toBe("Aesthetic");
    expect(metadata.typography.primary_font_browser_url).toBe("/fonts/retrieved/aesthetic/Aesthetic-Regular.woff2");
    expect(String(metadata.typography.primary_font_browser_url)).not.toMatch(/^file:|^[A-Z]:\\/i);
    expect(String(metadata.typography.font_face_css)).toContain("@font-face");
    expect(editPlan.typography_plan.font_family_primary).toBe("Aesthetic");
    expect(editPlan.typography_plan.primary_font).toMatchObject({
      family: "Aesthetic",
      browserUrl: "/fonts/retrieved/aesthetic/Aesthetic-Regular.woff2",
      source: "custom_ingested"
    });
    expect(editPlan.typography_plan.font_pairing).toMatchObject({
      graphUsed: true,
      source: "zilliz"
    });

    await context.app.close();
  });

  it("uses a source-media reference with a probe stub and produces source metadata", async () => {
    const sourcePath = await createTempFile({
      dir: tempDir,
      fileName: "source.mp4",
      contents: "fake-video-binary"
    });

    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1080,
          height: 1920,
          fps: 30,
          duration_seconds: 18,
          duration_in_frames: 540,
          codec_video: "h264",
          container_format: "mov,mp4"
        })
      }
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Make this fast for shorts.",
        source_media_ref: sourcePath
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const metadata = await context.service.getMetadataProfile(jobId);

    expect(metadata.source_media.source_width).toBe(1080);
    expect(metadata.source_media.source_aspect_ratio).toBe("9:16");
    expect(metadata.derived_technical.format_family).toBe("vertical");

    await context.app.close();
  });

  it("turns a named entity like Abraham Lincoln into a source candidate with a typography fallback", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "When Abraham Lincoln is mentioned, show something relevant if possible."
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const plan = await context.service.getEditPlan(jobId);
    const candidate = plan.enrichment_plan.source_candidates.find((entry) => entry.entity_text === "Abraham Lincoln");

    expect(candidate?.entity_type).toBe("person");
    expect(candidate?.fallback_strategy).toBe("animated_name_card");
    expect(candidate?.recommended_action).toBe("source_candidate");

    await context.app.close();
  });

  it("does not force external sourcing for abstract concepts", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Emphasize freedom and confidence in the edit."
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const metadata = await context.service.getMetadataProfile(jobId);
    const conceptCandidate = metadata.enrichment_candidates.find((entry) => entry.entity_text.toLowerCase() === "freedom");

    expect(conceptCandidate?.recommended_action).toBe("typography_only");
    expect(conceptCandidate?.threshold_passed).toBe(false);

    await context.app.close();
  });

  it("records a transcript-confidence fallback when provided transcript confidence is low", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Keep this clean.",
        provided_transcript: [
          {text: "Abraham", start_ms: 0, end_ms: 300, confidence: 0.45},
          {text: "Lincoln", start_ms: 301, end_ms: 620, confidence: 0.5}
        ]
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const fallbackLog = await context.repository.readArtifact<Array<{code: string}>>(jobId, "fallback_log");
    expect(fallbackLog.some((entry) => entry.code === "low_transcript_confidence")).toBe(true);

    await context.app.close();
  }, 15000);

  it("completes successfully when Groq is disabled", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        GROQ_API_KEY: ""
      }
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Keep this premium."
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const job = await context.service.getJob(jobId);
    expect(job.status).toBe("completed");
    expect(job.template_versions.central_edit_planner).toBe("central_edit_planner_v1");

    await context.app.close();
  });

  it("builds ranked short-form clip recommendations from transcript windows", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const transcript = buildTranscript(
      [
        "Most creators make one mistake that kills retention.",
        "They start with background instead of tension, and viewers scroll before the payoff arrives.",
        "Here's the thing: when you open with the conflict first, people stay long enough to hear the lesson.",
        "I was wrong about that for years, and fixing it doubled the comments on my videos.",
        "The reason is simple.",
        "Curiosity buys you a few more seconds, and those seconds give your payoff room to land.",
        "Nobody talks about this, but the hook is not the headline.",
        "The hook is the unresolved tension that makes the next sentence feel necessary."
      ].join(" ")
    );

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Find the strongest creator-focused shorts clips from this transcript.",
        creator_niche: "creator",
        target_platform: "shorts",
        max_clip_count: 4,
        provided_transcript: transcript
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const clipSelection = await context.service.getClipSelection(jobId);

    expect(clipSelection.source_summary.target_platform).toBe("shorts");
    expect(clipSelection.source_summary.creator_niche).toBe("creator");
    expect(clipSelection.candidate_segments.length).toBeGreaterThan(0);
    expect(clipSelection.selected_clips.length).toBeGreaterThanOrEqual(2);
    expect(clipSelection.selected_clips.length).toBeLessThanOrEqual(4);
    expect(clipSelection.selected_clips[0].virality_score).toBeGreaterThan(6);
    expect(clipSelection.selected_clips[0].suggested_title.length).toBeGreaterThan(0);
    expect(clipSelection.selected_clips[0].reason_selected.length).toBeGreaterThan(0);
    expect(clipSelection.selected_clips[0].portrait_focus?.mode).toBe("speaker_head");

    await context.app.close();
  });

  it("renders the cinematic audio engine when a sound design manifest is supplied", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const dialogueSource = await createToneFile({
      dir: tempDir,
      relativePath: "dialogue/dialogue_source.wav",
      frequency: 220,
      durationSeconds: 12
    });
    const intro = await createToneFile({
      dir: tempDir,
      relativePath: "music/fast_intro.wav",
      frequency: 440,
      durationSeconds: 8
    });
    const lift = await createToneFile({
      dir: tempDir,
      relativePath: "music/second_lift.wav",
      frequency: 554,
      durationSeconds: 10
    });
    const finale = await createToneFile({
      dir: tempDir,
      relativePath: "music/final_push.wav",
      frequency: 660,
      durationSeconds: 10
    });
    const riser = await createToneFile({
      dir: tempDir,
      relativePath: "sfx/riser.wav",
      frequency: 880,
      durationSeconds: 2
    });
    const impact = await createToneFile({
      dir: tempDir,
      relativePath: "sfx/impact.wav",
      frequency: 110,
      durationSeconds: 2
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Render a premium soundtrack master.",
        sound_design_manifest: {
          duration: 24,
          dialogueSource,
          dialogue: [
            {start: 0, end: 3.6, gainDb: -3},
            {start: 4.2, end: 8.8, gainDb: -3}
          ],
          musicCues: [
            {
              id: "cue_1",
              file: intro,
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
              file: lift,
              start: 5.8,
              end: 13,
              gainDb: -5,
              transitionIn: {
                preset: "soft_overlap_in",
                start: 5.8,
                duration: 0.8
              },
              transitionOut: {
                preset: "impact_handoff",
                start: 12.2,
                duration: 0.8
              }
            },
            {
              id: "cue_3",
              file: finale,
              start: 12.6,
              end: 20.5,
              gainDb: -5,
              transitionIn: {
                preset: "reverb_throw",
                start: 12.6,
                duration: 0.8
              },
              transitionOut: {
                preset: "filter_sink",
                start: 19.7,
                duration: 0.8
              }
            }
          ],
          sfx: [
            {
              id: "riser_1",
              file: riser,
              start: 12.1,
              end: 12.9,
              gainDb: -8,
              role: "sfx"
            },
            {
              id: "impact_1",
              file: impact,
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
          }
        }
      }
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();

    await context.queue.onIdle();

    const job = await context.service.getJob(createBody.job_id);
    expect(job.stage_history.map((entry) => entry.stage)).toContain("audio_render");
    expect(job.artifact_paths.audio_render_plan).toBeTruthy();
    expect(await context.repository.pathExists(job.artifact_paths.audio_master)).toBe(true);
    expect(await context.repository.pathExists(job.artifact_paths.audio_preview_mix)).toBe(true);
    expect(await context.repository.pathExists(job.artifact_paths.audio_waveform_png)).toBe(true);
    expect(await context.repository.pathExists(job.artifact_paths.audio_peaks_json)).toBe(true);
    expect(await context.repository.pathExists(job.artifact_paths.audio_stems_dir)).toBe(true);

    await context.app.close();
  }, 120000);

  it("falls back cleanly when Groq returns invalid JSON", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        GROQ_API_KEY: "test-key"
      },
      deps: {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: "{not-valid-json"
                  }
                }
              ]
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json"
              }
            }
          )
      }
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Make this cinematic and premium."
      }
    });
    const {job_id: jobId} = createResponse.json();

    await context.queue.onIdle();

    const job = await context.service.getJob(jobId);
    expect(job.status).toBe("completed");
    expect(job.warning_list.some((warning) => warning.includes("Groq fallback during"))).toBe(true);

    await context.app.close();
  });
});

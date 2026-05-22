import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
  buildSoundManifestRehearsal,
  buildVideoAwareAudioPlan,
  normalizeR2MusicCatalog,
  readVideoAwareMusicPreflightArtifact,
  runMusicRehearsal,
  validateMusicPreflight,
  writeVideoAwareAudioPlanArtifact,
  MusicPreflightAudioPlanMissingError,
  MusicPreflightSoundManifestMissingError
} from "../music";
import {FileJobRepository} from "../repository";
import {cleanupMusicTempDir, makeMusicTempDir} from "./music-test-utils";

describe("music preflight validator", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeMusicTempDir();
  });

  afterEach(async () => {
    await cleanupMusicTempDir(tempDir);
  });

  const createJobRecord = async ({
    repository,
    jobId
  }: {
    repository: FileJobRepository;
    jobId: string;
  }) => {
    await repository.createJobRecord({
      job_id: jobId,
      status: "received",
      current_stage: "received",
      created_at: "2026-05-13T00:00:00.000Z",
      updated_at: "2026-05-13T00:00:00.000Z",
      completed_at: null,
      stage_history: [{stage: "received", at: "2026-05-13T00:00:00.000Z"}],
      progress: {
        current_step: 0,
        total_steps: 7,
        percent: 0
      },
      request_summary: {
        prompt_excerpt: "Music preflight",
        source_media_ref: null,
        has_source_video: true,
        asset_count: 0
      },
      source_summary: {
        source_filename: "video.mp4",
        source_storage_uri: "video.mp4",
        source_duration_ms: 24000,
        source_aspect_ratio: "9:16"
      },
      warning_list: [],
      error_message: null,
      template_versions: {
        metadata_synthesizer: "a",
        enrichment_planner: "b",
        central_edit_planner: "c",
        execution_planner: "d"
      },
      artifact_paths: {
        job: repository.artifactPath(jobId, "job"),
        input_manifest: repository.artifactPath(jobId, "input_manifest"),
        metadata_profile: repository.artifactPath(jobId, "metadata_profile"),
        clip_selection: null,
        edit_plan: null,
        motion_plan: null,
        execution_plan: null,
        fallback_log: null,
        video_aware_audio_plan: null,
        video_aware_sound_manifest: null,
        video_aware_music_preflight: null,
        video_aware_music_overrides: null,
        video_aware_audio_preview_mix: null,
        audio_render_plan: null,
        audio_master: null,
        audio_master_aac: null,
        audio_preview_mix: null,
        audio_waveform_png: null,
        audio_peaks_json: null,
        audio_stems_dir: null
      }
    });
  };

  const seedJobContext = async ({
    repository,
    jobId
  }: {
    repository: FileJobRepository;
    jobId: string;
  }) => {
    await repository.writeArtifact(jobId, "input_manifest", {
      job_id: jobId,
      created_at: "2026-05-13T00:00:00.000Z",
      prompt_excerpt: "Build a music preflight",
      project_id: "project_music",
      video_id: "video_music",
      source_media_ref: "video.mp4",
      source_video: null,
      assets: [],
      descriptor_assets: [],
      requested_clip_count_min: null,
      requested_clip_count_max: null,
      metadata_override_keys: [],
      has_provided_transcript: true,
      has_sound_design_manifest: false
    });

    await repository.writeMetadataProfile(jobId, {
      job: {job_id: jobId},
      source_media: {
        source_duration_ms: 24000
      },
      derived_technical: {},
      user_intent: {},
      output: {},
      timing_pacing: {},
      transcript_language: {},
      entity_enrichment: {},
      uploaded_assets: {},
      typography: {},
      motion_graphics: {},
      layout_collision: {},
      audio: {},
      color_finish: {},
      transitions: {},
      execution_orchestration: {},
      fallback: {},
      search_sourcing: {},
      field_source_map: {},
      ambiguity_notes: [],
      recommended_defaults: [],
      warnings: [],
      transcript_words: [
        {text: "mistake", start_ms: 280, end_ms: 640, confidence: 0.98},
        {text: "time", start_ms: 960, end_ms: 1200, confidence: 0.98},
        {text: "proof", start_ms: 4800, end_ms: 5120, confidence: 0.98},
        {text: "breakthrough", start_ms: 8800, end_ms: 9280, confidence: 0.98},
        {text: "click", start_ms: 17200, end_ms: 17520, confidence: 0.98}
      ],
      enrichment_candidates: []
    });
  };

  const unsafeTrack = {
    id: "track_unsafe",
    title: "Unsafe Track",
    artist: "Artist",
    source: "import",
    sourceUrl: null,
    storagePath: "music/unsafe-track.wav",
    licenseType: "unknown",
    commercialAllowed: false,
    attributionRequired: false,
    licenseVerified: false,
    durationSec: 90,
    bpm: 120,
    musicalKey: null,
    energy: 0.5,
    valence: 0.5,
    arousal: 0.5,
    tension: 0.5,
    prestige: 0.5,
    urgency: 0.5,
    clarity: 0.5,
    speechFriendliness: 0.5,
    genreTags: [],
    moodTags: [],
    instrumentTags: [],
    useCaseTags: [],
    avoidWhen: [],
    beatGrid: null,
    sections: [],
    waveformSummary: null,
    loudnessLufs: null,
    analysisStatus: "indexed" as const,
    createdAt: "2026-05-13T00:00:00.000Z",
    analyzedAt: null
  };
  const previewOnlyCatalogEntry = normalizeR2MusicCatalog({
    sourceCatalog: [
      {
        id: "cinematic-trailer-epic/epic-cinematic",
        title: "Epic Cinematic",
        category: "Cinematic Trailer - Epic",
        categorySlug: "cinematic-trailer-epic",
        originalObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
        thumbnailObjectKey: "music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp",
        duration: 92.4,
        fileSizeBytes: 1234567,
        genreTags: ["Trailer"],
        moodTags: ["Big Reveal"],
        useCaseTags: ["Hook Bed"],
        avoidWhen: ["Long Form"],
        commercialAllowed: false,
        licenseVerified: false
      }
    ],
    bucket: "prometheus-music",
    now: () => "2026-05-13T00:00:00.000Z"
  }).entries;

  it("warns for a dry_run placeholder rehearsal, writes preflight, and leaves audio_render_plan untouched", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_preflight_warn";
    await createJobRecord({repository, jobId});
    await seedJobContext({repository, jobId});
    const audioRenderPlanSpy = vi.spyOn(repository, "writeAudioRenderPlan");

    await runMusicRehearsal({
      repository,
      jobId,
      overwrite: true,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const report = await validateMusicPreflight({
      repository,
      jobId,
      now: () => "2026-05-13T00:00:00.000Z"
    });
    const persisted = await readVideoAwareMusicPreflightArtifact({repository, jobId});
    const jobRecord = await repository.getJobRecord(jobId);

    expect(report.status).toBe("warn");
    expect(report.canRender).toBe(false);
    expect(report.planMode).toBe("dry_run");
    expect(report.summary.musicEventCount).toBeGreaterThan(0);
    expect(report.summary.sfxEventCount).toBeGreaterThan(0);
    expect(report.summary.placeholderMusicCount).toBeGreaterThan(0);
    expect(report.summary.transitionEventCount).toBeGreaterThanOrEqual(0);
    expect(report.summary.licenseIssueCount).toBeGreaterThanOrEqual(0);
    expect(persisted.jobId).toBe(jobId);
    expect(jobRecord.artifact_paths.video_aware_music_preflight).toContain("video-aware-music-preflight.json");
    expect(jobRecord.artifact_paths.audio_render_plan).toBeNull();
    expect(await repository.artifactExists(jobId, "audio_render_plan")).toBe(false);
    expect(audioRenderPlanSpy).not.toHaveBeenCalled();
  });

  it("blocks a render_ready plan that still contains placeholder music", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_preflight_render_ready_placeholder";
    await createJobRecord({repository, jobId});

    const plan = {
      ...buildVideoAwareAudioPlan({
        jobId,
        videoDurationSec: 20
      }),
      planMode: "render_ready" as const
    };
    await writeVideoAwareAudioPlanArtifact({
      repository,
      jobId,
      plan
    });
    await buildSoundManifestRehearsal({
      repository,
      jobId,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const report = await validateMusicPreflight({
      repository,
      jobId,
      requireRenderReady: true,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(report.status).toBe("block");
    expect(report.canRender).toBe(false);
    expect(report.issues.some((issue) => issue.code === "music.placeholder")).toBe(true);
  });

  it("blocks an unverified real track when render-ready output is required", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_preflight_unverified";
    await createJobRecord({repository, jobId});

    const plan = {
      ...buildVideoAwareAudioPlan({
        jobId,
        videoDurationSec: 20
      }),
      planMode: "render_ready" as const,
      musicEvents: [
        {
          id: "music_unsafe",
          trackId: "track_unsafe",
          videoStartSec: 0,
          videoEndSec: 20,
          trackStartSec: 0,
          trackEndSec: 20,
          sectionRole: null,
          purpose: "bed",
          storagePath: unsafeTrack.storagePath,
          sourceObjectKey: null,
          previewOnly: true,
          renderSafe: false,
          warning: "Preview only / license not verified.",
          volumeDb: -24,
          fadeInSec: 0.3,
          fadeOutSec: 1.5,
          duckingEnabled: true,
          beatAligned: false,
          transitionInId: null,
          transitionOutId: null
        }
      ]
    };
    await writeVideoAwareAudioPlanArtifact({
      repository,
      jobId,
      plan
    });
    await buildSoundManifestRehearsal({
      repository,
      jobId,
      tracksById: {
        track_unsafe: unsafeTrack
      }
    });

    const report = await validateMusicPreflight({
      repository,
      jobId,
      requireRenderReady: true
    });

    expect(report.status).toBe("block");
    expect(report.summary.unverifiedTrackCount).toBe(1);
    expect(report.issues.some((issue) => issue.code === "license.track_not_export_safe")).toBe(true);
  });

  it("warns, not blocks, for a dry_run preview-only R2 catalog track", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_preflight_preview_only_r2";
    await createJobRecord({repository, jobId});

    const plan = buildVideoAwareAudioPlan({
      jobId,
      videoDurationSec: 20,
      useCatalogCandidates: true,
      catalogEntries: previewOnlyCatalogEntry
    });
    await writeVideoAwareAudioPlanArtifact({
      repository,
      jobId,
      plan
    });
    await buildSoundManifestRehearsal({
      repository,
      jobId
    });

    const report = await validateMusicPreflight({
      repository,
      jobId
    });

    expect(report.status).toBe("warn");
    expect(report.canRender).toBe(false);
    expect(report.summary.placeholderMusicCount).toBe(0);
    expect(report.summary.unverifiedTrackCount).toBe(1);
    expect(report.issues.some((issue) => issue.code === "license.track_not_export_safe")).toBe(true);
  });

  it("blocks out-of-bounds event timing even when the rehearsal manifest clamps it", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_preflight_timing";
    await createJobRecord({repository, jobId});

    const basePlan = buildVideoAwareAudioPlan({
      jobId,
      videoDurationSec: 20
    });
    const plan = {
      ...basePlan,
      musicEvents: [
        {
          ...basePlan.musicEvents[0],
          videoStartSec: 18.5,
          videoEndSec: 24
        }
      ]
    };
    await writeVideoAwareAudioPlanArtifact({
      repository,
      jobId,
      plan
    });
    await buildSoundManifestRehearsal({
      repository,
      jobId
    });

    const report = await validateMusicPreflight({
      repository,
      jobId
    });

    expect(report.status).toBe("block");
    expect(report.summary.timingIssueCount).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.code === "timing.music_event.out_of_bounds")).toBe(true);
  });

  it("throws clear errors when required source artifacts are missing", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const missingPlanJobId = "job_preflight_missing_plan";
    const missingManifestJobId = "job_preflight_missing_manifest";
    await createJobRecord({repository, jobId: missingPlanJobId});
    await createJobRecord({repository, jobId: missingManifestJobId});

    const plan = buildVideoAwareAudioPlan({
      jobId: missingManifestJobId,
      videoDurationSec: 20
    });
    await writeVideoAwareAudioPlanArtifact({
      repository,
      jobId: missingManifestJobId,
      plan
    });

    await expect(validateMusicPreflight({repository, jobId: missingPlanJobId})).rejects.toBeInstanceOf(
      MusicPreflightAudioPlanMissingError
    );
    await expect(validateMusicPreflight({repository, jobId: missingManifestJobId})).rejects.toBeInstanceOf(
      MusicPreflightSoundManifestMissingError
    );
  });
});

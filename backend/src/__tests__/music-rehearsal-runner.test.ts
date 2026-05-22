import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
  normalizeR2MusicCatalog,
  MusicRehearsalArtifactsExistError,
  MusicRehearsalJobIdRequiredError,
  MusicRehearsalJobMissingError,
  readVideoAwareAudioPlanArtifact,
  readVideoAwareSoundManifestArtifact,
  runMusicRehearsal
} from "../music";
import {FileJobRepository} from "../repository";
import {cleanupMusicTempDir, makeMusicTempDir} from "./music-test-utils";

describe("music rehearsal runner", () => {
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
        prompt_excerpt: "Music rehearsal runner",
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
      prompt_excerpt: "Build an urgent proof-driven music rehearsal",
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

  it("creates both rehearsal artifacts, returns summary counts, and leaves audio_render_plan untouched", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_music_rehearsal_runner";
    await createJobRecord({repository, jobId});
    await seedJobContext({repository, jobId});
    const audioRenderPlanSpy = vi.spyOn(repository, "writeAudioRenderPlan");

    const result = await runMusicRehearsal({
      repository,
      jobId,
      overwrite: true,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const audioPlan = await readVideoAwareAudioPlanArtifact({repository, jobId});
    const soundManifest = await readVideoAwareSoundManifestArtifact({repository, jobId});
    const jobRecord = await repository.getJobRecord(jobId);

    expect(result.jobId).toBe(jobId);
    expect(result.audioPlanArtifactPath).toContain("video-aware-audio-plan.json");
    expect(result.soundManifestArtifactPath).toContain("video-aware-sound-manifest.json");
    expect(result.timelineSegmentCount).toBe(audioPlan.timelineSegments.length);
    expect(result.musicEventCount).toBe(audioPlan.musicEvents.length);
    expect(result.sfxEventCount).toBe(audioPlan.sfxEvents.length);
    expect(result.transitionEventCount).toBe(audioPlan.transitionEvents.length);
    expect(result.duckingRegionCount).toBe(audioPlan.duckingRegions.length);
    expect(result.manifestDuration).toBe(soundManifest.manifest.duration);
    expect(result.planMode).toBe("dry_run");
    expect(soundManifest.planMode).toBe("dry_run");
    expect(jobRecord.artifact_paths.video_aware_audio_plan).toBe(result.audioPlanArtifactPath);
    expect(jobRecord.artifact_paths.video_aware_sound_manifest).toBe(result.soundManifestArtifactPath);
    expect(jobRecord.artifact_paths.audio_render_plan).toBeNull();
    expect(await repository.artifactExists(jobId, "audio_render_plan")).toBe(false);
    expect(audioRenderPlanSpy).not.toHaveBeenCalled();
  });

  it("fails clearly when the job context is missing", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();

    await expect(runMusicRehearsal({repository, jobId: "missing-job"})).rejects.toBeInstanceOf(
      MusicRehearsalJobMissingError
    );
    await expect(runMusicRehearsal({repository, jobId: "   "})).rejects.toBeInstanceOf(
      MusicRehearsalJobIdRequiredError
    );
  });

  it("requires overwrite before replacing existing rehearsal artifacts", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_music_rehearsal_existing";
    await createJobRecord({repository, jobId});
    await seedJobContext({repository, jobId});

    await runMusicRehearsal({
      repository,
      jobId,
      overwrite: true,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    await expect(runMusicRehearsal({repository, jobId})).rejects.toBeInstanceOf(
      MusicRehearsalArtifactsExistError
    );
  });

  it("uses real catalog candidates during rehearsal when explicitly enabled", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_music_rehearsal_catalog";
    await createJobRecord({repository, jobId});
    await seedJobContext({repository, jobId});
    const catalogEntries = normalizeR2MusicCatalog({
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

    await runMusicRehearsal({
      repository,
      jobId,
      overwrite: true,
      useCatalogCandidates: true,
      catalogEntries,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const audioPlan = await readVideoAwareAudioPlanArtifact({repository, jobId});
    expect(audioPlan.musicEvents[0]?.trackId).toBe("cinematic-trailer-epic/epic-cinematic");
    expect(audioPlan.musicEvents[0]?.sourceObjectKey).toBe("music-originals/cinematic-trailer-epic/epic-cinematic.mp3");
    expect(audioPlan.musicEvents[0]?.previewOnly).toBe(true);
  });
});

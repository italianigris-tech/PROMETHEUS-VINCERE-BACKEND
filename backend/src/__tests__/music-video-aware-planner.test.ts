import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  buildVideoAwareAudioPlan,
  buildAudioPlanDryRun,
  generateSfxEvents,
  normalizeR2MusicCatalog,
  type MusicTrack,
  type R2MusicCatalogEntry,
  synthesizeVideoTimeline,
  videoAwareAudioPlanSchema
} from "../music";
import {clearCachedEnv} from "../config";
import {assertTrackUsableForExport} from "../music/indexer/license-guard";
import {FileJobRepository} from "../repository";
import {cleanupMusicTempDir, makeMusicTempDir} from "./music-test-utils";

describe("video-aware music dry run", () => {
  let tempDir: string;

  const createCandidateTrack = ({
    id,
    durationSec,
    energy,
    speechFriendliness
  }: {
    id: string;
    durationSec: number;
    energy: number;
    speechFriendliness: number;
  }): MusicTrack => ({
    id,
    title: id,
    artist: "Prometheus",
    source: "unit_test_catalog",
    sourceUrl: null,
    storagePath: `C:/tracks/${id}.wav`,
    licenseType: "royalty_free",
    commercialAllowed: true,
    attributionRequired: false,
    licenseVerified: true,
    durationSec,
    bpm: 120,
    musicalKey: "Am",
    energy,
    valence: 0.55,
    arousal: 0.52,
    tension: 0.48,
    prestige: 0.7,
    urgency: 0.45,
    clarity: 0.72,
    speechFriendliness,
    genreTags: ["cinematic"],
    moodTags: ["focused"],
    instrumentTags: ["hybrid"],
    useCaseTags: ["hook-bed", "proof-support"],
    avoidWhen: [],
    beatGrid: {
      bpm: 120,
      beatTimesSec: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      downbeatTimesSec: [0, 2],
      confidence: 0.8,
      source: "unit_test"
    },
    sections: [
      {
        id: `${id}-intro`,
        trackId: id,
        startSec: 0,
        endSec: Math.min(durationSec, 4),
        role: "intro",
        energy: Math.max(0.25, energy - 0.1),
        density: 0.45,
        tension: 0.38,
        bestFor: ["setup", "hook"],
        avoidWhen: [],
        transitionInSuitability: 0.6,
        transitionOutSuitability: 0.72
      }
    ],
    waveformSummary: {
      windowSec: 1,
      peakAmplitudes: [0.4, 0.48, 0.44],
      rmsAmplitudes: [0.22, 0.28, 0.24],
      source: "unit_test"
    },
    loudnessLufs: -16,
    analysisStatus: "analyzed",
    createdAt: "2026-05-13T00:00:00.000Z",
    analyzedAt: "2026-05-13T00:00:00.000Z"
  });

  const transcriptWords = [
    {text: "This", start_ms: 0, end_ms: 280, confidence: 0.98},
    {text: "mistake", start_ms: 300, end_ms: 620, confidence: 0.98},
    {text: "costs", start_ms: 650, end_ms: 930, confidence: 0.98},
    {text: "time", start_ms: 960, end_ms: 1200, confidence: 0.98},
    {text: "and", start_ms: 1230, end_ms: 1380, confidence: 0.98},
    {text: "money", start_ms: 1410, end_ms: 1680, confidence: 0.98},
    {text: "Here", start_ms: 4200, end_ms: 4450, confidence: 0.98},
    {text: "is", start_ms: 4470, end_ms: 4590, confidence: 0.98},
    {text: "the", start_ms: 4620, end_ms: 4740, confidence: 0.98},
    {text: "proof", start_ms: 4770, end_ms: 5100, confidence: 0.98},
    {text: "with", start_ms: 5120, end_ms: 5280, confidence: 0.98},
    {text: "numbers", start_ms: 5300, end_ms: 5650, confidence: 0.98},
    {text: "We", start_ms: 8200, end_ms: 8400, confidence: 0.98},
    {text: "discovered", start_ms: 8420, end_ms: 8760, confidence: 0.98},
    {text: "a", start_ms: 8780, end_ms: 8860, confidence: 0.98},
    {text: "breakthrough", start_ms: 8880, end_ms: 9320, confidence: 0.98},
    {text: "Click", start_ms: 17100, end_ms: 17420, confidence: 0.98},
    {text: "start", start_ms: 17450, end_ms: 17720, confidence: 0.98},
    {text: "now", start_ms: 17750, end_ms: 17980, confidence: 0.98}
  ];
  const catalogEntries: R2MusicCatalogEntry[] = normalizeR2MusicCatalog({
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
        genreTags: ["trailer"],
        moodTags: ["big-reveal"],
        useCaseTags: ["hook-bed"],
        avoidWhen: ["long-form"],
        commercialAllowed: false,
        licenseVerified: false
      }
    ],
    bucket: "prometheus-music",
    now: () => "2026-05-13T00:00:00.000Z"
  }).entries;

  beforeEach(async () => {
    tempDir = await makeMusicTempDir();
  });

  afterEach(async () => {
    delete process.env.MUSIC_R2_CATALOG_PATH;
    clearCachedEnv();
    await cleanupMusicTempDir(tempDir);
  });

  it("synthesizes bounded video-time segments inside the preview window", () => {
    const timeline = synthesizeVideoTimeline({
      videoDurationSec: 24,
      transcriptWords,
      previewStartSec: 0,
      previewEndSec: 20,
      source: "test"
    });

    expect(timeline.length).toBeGreaterThanOrEqual(3);
    expect(timeline[0]?.role).toBe("hook");
    expect(timeline.every((segment) => segment.startSec >= 0 && segment.endSec <= 20)).toBe(true);
    expect(timeline.every((segment) => segment.endSec > segment.startSec)).toBe(true);
  });

  it("places transcript-driven sfx events using word timestamps", () => {
    const timeline = synthesizeVideoTimeline({
      videoDurationSec: 24,
      transcriptWords,
      previewStartSec: 0,
      previewEndSec: 20
    });
    const sfxEvents = generateSfxEvents({
      timelineSegments: timeline,
      transcriptWords,
      previewStartSec: 0,
      previewEndSec: 20,
      maxEvents: 5
    });

    expect(sfxEvents.length).toBeGreaterThan(0);
    expect(sfxEvents.some((event) => event.type === "clock_tick" && event.videoStartSec === 0.96)).toBe(true);
    expect(sfxEvents.every((event) => event.videoStartSec >= 0 && event.videoEndSec <= 20.58)).toBe(true);
  });

  it("builds a schema-valid dry-run audio plan with video-timecoded events", () => {
    const plan = buildVideoAwareAudioPlan({
      jobId: "job_music_1",
      projectId: "project_1",
      sourceVideoId: "video_1",
      videoDurationSec: 24,
      transcriptWords,
      creativeDirection: {
        summary: "Direct response creator ad",
        moodTags: ["urgent", "clear"]
      }
    });

    const parsed = videoAwareAudioPlanSchema.parse(plan);
    expect(parsed.previewStartSec).toBe(0);
    expect(parsed.previewEndSec).toBe(20);
    expect(parsed.musicEvents[0]?.videoStartSec).toBe(0);
    expect(parsed.musicEvents[0]?.videoEndSec).toBe(20);
    expect(parsed.sfxEvents.length).toBeLessThanOrEqual(5);
    expect(parsed.timelineSegments[0]?.role).toBe("hook");
  });

  it("uses real R2 catalog candidates for dry_run when requested", () => {
    const plan = buildVideoAwareAudioPlan({
      jobId: "job_music_catalog",
      videoDurationSec: 24,
      transcriptWords,
      useCatalogCandidates: true,
      catalogEntries
    });

    expect(plan.musicEvents[0]?.trackId).toBe("cinematic-trailer-epic/epic-cinematic");
    expect(plan.musicEvents[0]?.storagePath).toBe("r2://prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3");
    expect(plan.musicEvents[0]?.sourceObjectKey).toBe("music-originals/cinematic-trailer-epic/epic-cinematic.mp3");
    expect(plan.musicEvents[0]?.previewOnly).toBe(true);
    expect(plan.musicEvents[0]?.renderSafe).toBe(false);
  });

  it("keeps placeholder fallback when catalog candidates are not enabled", () => {
    const plan = buildVideoAwareAudioPlan({
      jobId: "job_music_placeholder",
      videoDurationSec: 24,
      transcriptWords,
      catalogEntries
    });

    expect(plan.musicEvents[0]?.trackId).toBe("placeholder-music-bed");
  });

  it("chains multiple render-safe tracks to cover a preview window longer than one song", () => {
    const plan = buildVideoAwareAudioPlan({
      jobId: "job_music_multitrack",
      videoDurationSec: 24,
      transcriptWords,
      candidateTracks: [
        createCandidateTrack({
          id: "track-alpha",
          durationSec: 6.2,
          energy: 0.82,
          speechFriendliness: 0.68
        }),
        createCandidateTrack({
          id: "track-beta",
          durationSec: 7.1,
          energy: 0.74,
          speechFriendliness: 0.73
        }),
        createCandidateTrack({
          id: "track-gamma",
          durationSec: 9.8,
          energy: 0.7,
          speechFriendliness: 0.77
        })
      ]
    });

    expect(plan.musicEvents.length).toBeGreaterThan(1);
    expect(plan.musicEvents[0]?.videoStartSec).toBe(0);
    expect(plan.musicEvents.at(-1)?.videoEndSec).toBe(20);
    expect(plan.transitionEvents.length).toBe(plan.musicEvents.length - 1);
    expect(plan.musicEvents.some((event, index) => {
      const previous = index > 0 ? plan.musicEvents[index - 1] : null;
      return Boolean(previous && event.videoStartSec < previous.videoEndSec);
    })).toBe(true);
    expect(plan.renderSettings.notes.some((note) => note.includes("Chained"))).toBe(true);
  });

  it("persists the dry-run plan into the dedicated video-aware audio plan artifact slot", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();

    const jobId = "job_music_2";
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
        prompt_excerpt: "Build an urgent proof-driven music plan",
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
        clip_selection: repository.artifactPath(jobId, "clip_selection"),
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

    await repository.writeArtifact(jobId, "input_manifest", {
      job_id: jobId,
      created_at: "2026-05-13T00:00:00.000Z",
      prompt_excerpt: "Build an urgent proof-driven music plan",
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
      transcript_words: transcriptWords,
      enrichment_candidates: []
    });

    const result = await buildAudioPlanDryRun({
      repository,
      jobId,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(result.artifactKey).toBe("video_aware_audio_plan");
    expect(result.artifactPath).toContain("video-aware-audio-plan.json");
    expect(result.plan.jobId).toBe(jobId);
    expect(result.plan.timelineSegments.length).toBeGreaterThan(0);

    const persisted = videoAwareAudioPlanSchema.parse(await repository.readArtifact(jobId, "video_aware_audio_plan"));
    const jobRecord = await repository.getJobRecord(jobId);
    expect(persisted.jobId).toBe(jobId);
    expect(persisted.sfxEvents.length).toBeGreaterThan(0);
    expect(jobRecord.artifact_paths.video_aware_audio_plan).toBe(result.artifactPath);
  });

  it("falls back to placeholder music when the normalized catalog is missing and strict is false", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_music_catalog_missing_fallback";
    process.env.MUSIC_R2_CATALOG_PATH = path.join(tempDir, "missing-r2-catalog.json");

    await repository.createJobRecord({
      job_id: jobId,
      status: "received",
      current_stage: "received",
      created_at: "2026-05-13T00:00:00.000Z",
      updated_at: "2026-05-13T00:00:00.000Z",
      completed_at: null,
      stage_history: [{stage: "received", at: "2026-05-13T00:00:00.000Z"}],
      progress: {current_step: 0, total_steps: 7, percent: 0},
      request_summary: {
        prompt_excerpt: "Catalog fallback",
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
    await repository.writeArtifact(jobId, "input_manifest", {
      job_id: jobId,
      created_at: "2026-05-13T00:00:00.000Z",
      prompt_excerpt: "Catalog fallback",
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
      source_media: {source_duration_ms: 24000},
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
      transcript_words: transcriptWords,
      enrichment_candidates: []
    });

    const result = await buildAudioPlanDryRun({
      repository,
      jobId,
      useCatalogCandidates: true,
      strict: false,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(result.plan.musicEvents[0]?.trackId).toBe("placeholder-music-bed");
    expect(result.warnings[0]).toContain("Normalized R2 music catalog is unavailable");
  });

  it("fails clearly when catalog candidates are required in strict mode and the normalized catalog is missing", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_music_catalog_missing_strict";
    process.env.MUSIC_R2_CATALOG_PATH = path.join(tempDir, "missing-r2-catalog-strict.json");

    await repository.createJobRecord({
      job_id: jobId,
      status: "received",
      current_stage: "received",
      created_at: "2026-05-13T00:00:00.000Z",
      updated_at: "2026-05-13T00:00:00.000Z",
      completed_at: null,
      stage_history: [{stage: "received", at: "2026-05-13T00:00:00.000Z"}],
      progress: {current_step: 0, total_steps: 7, percent: 0},
      request_summary: {
        prompt_excerpt: "Catalog strict",
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
    await repository.writeArtifact(jobId, "input_manifest", {
      job_id: jobId,
      created_at: "2026-05-13T00:00:00.000Z",
      prompt_excerpt: "Catalog strict",
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
      source_media: {source_duration_ms: 24000},
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
      transcript_words: transcriptWords,
      enrichment_candidates: []
    });

    await expect(buildAudioPlanDryRun({
      repository,
      jobId,
      useCatalogCandidates: true,
      strict: true,
      now: () => "2026-05-13T00:00:00.000Z"
    })).rejects.toThrow(/Normalized R2 music catalog is unavailable/i);
  });

  it("blocks unlicensed tracks for export safety", () => {
    expect(() =>
      assertTrackUsableForExport({
        id: "track_1",
        title: "Unsafe Track",
        artist: "Unknown",
        source: "test",
        sourceUrl: null,
        storagePath: null,
        licenseType: "unknown",
        commercialAllowed: false,
        attributionRequired: false,
        licenseVerified: false,
        durationSec: 120,
        bpm: null,
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
        analysisStatus: "indexed",
        createdAt: "2026-05-13T00:00:00.000Z",
        analyzedAt: null
      })
    ).toThrow(/not export-safe/i);
  });
});

import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  readMusicOverridesArtifact,
  readVideoAwareAudioPlanArtifact,
  readVideoAwareMusicPreflightArtifact,
  writeR2MusicCatalogArtifact
} from "../music";
import type {FileJobRepository} from "../repository";
import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

describe("music DJ routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  const buildCatalogFixture = () => ({
    artifactType: "r2_music_catalog" as const,
    version: "phase7_test_v1",
    sourceCatalogPath: "fixture/music-catalog.json",
    bucket: "prometheus-music",
    generatedAt: "2026-05-14T00:00:00.000Z",
    totalTracks: 2,
    entries: [
      {
        id: "cinematic-trailer-epic/epic-cinematic",
        title: "Epic Cinematic",
        artist: "Signal Atlas",
        category: "cinematic-trailer-epic",
        genreTags: ["high-energy", "trailer"],
        moodTags: ["big-reveal"],
        useCaseTags: ["hook-bed"],
        avoidWhen: ["long-form"],
        audioObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
        thumbnailObjectKey: "music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp",
        audioPublicUrl: null,
        thumbnailPublicUrl: null,
        storageProvider: "r2" as const,
        bucket: "prometheus-music",
        durationSec: 92.4,
        licenseType: "editorial_preview_only",
        commercialAllowed: false,
        attributionRequired: true,
        licenseVerified: false,
        previewAllowed: true,
        renderAllowed: false,
        analysisStatus: "pending" as const,
        uploadedAt: "2026-05-14T00:00:00.000Z",
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z"
      },
      {
        id: "classical-orchestral-prestige/silver-horizon",
        title: "Silver Horizon",
        artist: "North Arcade",
        category: "classical-orchestral-prestige",
        genreTags: ["classical"],
        moodTags: ["prestige"],
        useCaseTags: ["proof-bed"],
        avoidWhen: ["high-chaos"],
        audioObjectKey: "music-originals/classical-orchestral-prestige/silver-horizon.mp3",
        thumbnailObjectKey: "music-thumbnails/classical-orchestral-prestige/silver-horizon.webp",
        audioPublicUrl: null,
        thumbnailPublicUrl: null,
        storageProvider: "r2" as const,
        bucket: "prometheus-music",
        durationSec: 88,
        licenseType: "editorial_preview_only",
        commercialAllowed: false,
        attributionRequired: true,
        licenseVerified: false,
        previewAllowed: true,
        renderAllowed: false,
        analysisStatus: "analyzed" as const,
        uploadedAt: null,
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z"
      }
    ]
  });

  const writeFixtureCatalog = async (): Promise<string> => {
    const catalogPath = path.join(tempDir, "r2-music-catalog.normalized.json");
    await writeR2MusicCatalogArtifact({
      catalog: buildCatalogFixture(),
      outputPath: catalogPath
    });
    return catalogPath;
  };

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
      created_at: "2026-05-14T00:00:00.000Z",
      updated_at: "2026-05-14T00:00:00.000Z",
      completed_at: null,
      stage_history: [{stage: "received", at: "2026-05-14T00:00:00.000Z"}],
      progress: {
        current_step: 0,
        total_steps: 7,
        percent: 0
      },
      request_summary: {
        prompt_excerpt: "Music DJ route test",
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
      created_at: "2026-05-14T00:00:00.000Z",
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

  const createSeededApp = async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath,
        R2_ACCESS_KEY_ID: "SHOULD_NOT_LEAK_ACCESS",
        R2_SECRET_ACCESS_KEY: "SHOULD_NOT_LEAK_SECRET"
      }
    });
    const jobId = "job_music_dj_routes";
    await createJobRecord({repository: context.repository, jobId});
    await seedJobContext({repository: context.repository, jobId});
    return {context, jobId};
  };

  it("returns an empty safe music state when no dry-run artifacts exist", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const jobId = "job_music_state_empty";
    await createJobRecord({repository: context.repository, jobId});

    const response = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/music/state`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jobId,
      hasAudioPlan: false,
      hasSoundManifest: false,
      hasPreflight: false,
      selectedTracks: [],
      musicEvents: [],
      sfxEvents: [],
      warnings: [],
      renderAllowed: false,
      canRenderMusic: false,
      reason: "No dry-run music rehearsal artifacts exist yet."
    });

    await context.app.close();
  });

  it("rehearsal endpoint creates dry-run artifacts without touching audio_render_plan", async () => {
    const {context, jobId} = await createSeededApp();

    const response = await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/rehearsal`,
      payload: {
        overwrite: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jobId,
      dryRunOnly: true,
      audioRenderPlanTouched: false,
      planMode: "dry_run"
    });
    expect(await context.repository.artifactExists(jobId, "video_aware_audio_plan")).toBe(true);
    expect(await context.repository.artifactExists(jobId, "video_aware_sound_manifest")).toBe(true);
    expect(await context.repository.artifactExists(jobId, "audio_render_plan")).toBe(false);

    await context.app.close();
  });

  it("audio plan read endpoint returns the persisted VideoAwareAudioPlan", async () => {
    const {context, jobId} = await createSeededApp();
    await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/rehearsal`,
      payload: {
        overwrite: true
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/video-aware-audio-plan`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jobId,
      planMode: "dry_run"
    });
    expect(response.json().musicEvents.length).toBeGreaterThan(0);

    await context.app.close();
  });

  it("preflight endpoint writes and returns the music preflight report", async () => {
    const {context, jobId} = await createSeededApp();
    await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/rehearsal`,
      payload: {
        overwrite: true
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/preflight`,
      payload: {
        requireRenderReady: false
      }
    });

    const persisted = await readVideoAwareMusicPreflightArtifact({
      repository: context.repository,
      jobId
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jobId,
      planMode: "dry_run"
    });
    expect(persisted.jobId).toBe(jobId);
    expect(await context.repository.artifactExists(jobId, "audio_render_plan")).toBe(false);

    await context.app.close();
  });

  it("override endpoint appends an override artifact and replaces the dry-run music event track", async () => {
    const {context, jobId} = await createSeededApp();

    const response = await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/overrides`,
      payload: {
        targetType: "preview",
        action: "use_catalog_track",
        trackId: "classical-orchestral-prestige/silver-horizon",
        reason: "Use the prestige proof bed"
      }
    });

    const overrides = await readMusicOverridesArtifact({
      repository: context.repository,
      jobId
    });
    const plan = await readVideoAwareAudioPlanArtifact({
      repository: context.repository,
      jobId
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      preflightStatus: "warn",
      renderAllowed: false,
      canRenderMusic: false
    });
    expect(response.json().updatedAudioPlanSummary.selectedTracks[0]).toMatchObject({
      trackId: "classical-orchestral-prestige/silver-horizon"
    });
    expect(overrides.overrides).toHaveLength(1);
    expect(overrides.overrides[0]?.trackId).toBe("classical-orchestral-prestige/silver-horizon");
    expect(plan.musicEvents[0]?.trackId).toBe("classical-orchestral-prestige/silver-horizon");
    expect(plan.musicEvents[0]?.previewOnly).toBe(true);
    expect(plan.musicEvents[0]?.renderSafe).toBe(false);
    expect(await context.repository.artifactExists(jobId, "audio_render_plan")).toBe(false);

    await context.app.close();
  });

  it("rejects override requests that omit a required trackId", async () => {
    const {context, jobId} = await createSeededApp();

    const response = await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/overrides`,
      payload: {
        targetType: "preview",
        action: "use_catalog_track"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Override action use_catalog_track requires a trackId."
    });

    await context.app.close();
  });

  it("rejects override requests that reference a nonexistent catalog track", async () => {
    const {context, jobId} = await createSeededApp();

    const response = await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/overrides`,
      payload: {
        targetType: "preview",
        action: "replace_track",
        trackId: "missing/catalog-track"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "Catalog track missing/catalog-track was not found."
    });

    await context.app.close();
  });

  it("never exposes R2 credentials in dry-run route responses", async () => {
    const {context, jobId} = await createSeededApp();

    const rehearsalResponse = await context.app.inject({
      method: "POST",
      url: `/api/jobs/${jobId}/music/rehearsal`,
      payload: {
        overwrite: true
      }
    });
    const stateResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/music/state`
    });

    const combinedPayload = `${rehearsalResponse.body}\n${stateResponse.body}`;
    expect(combinedPayload).not.toContain("SHOULD_NOT_LEAK_ACCESS");
    expect(combinedPayload).not.toContain("SHOULD_NOT_LEAK_SECRET");

    await context.app.close();
  });
});

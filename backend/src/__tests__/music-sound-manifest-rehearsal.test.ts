import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  buildSoundManifestRehearsal,
  buildVideoAwareAudioPlan,
  readVideoAwareSoundManifestArtifact,
  videoAwareAudioPlanSchema
} from "../music";
import {FileJobRepository} from "../repository";
import {cleanupMusicTempDir, makeMusicTempDir} from "./music-test-utils";
import {validateManifest} from "../sound-engine";
import {
  VideoAwareAudioPlanArtifactMissingError
} from "../music/jobs/build-sound-manifest-rehearsal";

describe("music sound manifest rehearsal", () => {
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
        prompt_excerpt: "Manual rehearsal",
        source_media_ref: null,
        has_source_video: true,
        asset_count: 0
      },
      source_summary: {
        source_filename: "video.mp4",
        source_storage_uri: "video.mp4",
        source_duration_ms: 20000,
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
        metadata_profile: null,
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

  it("reads a VideoAwareAudioPlan and writes a separate rehearsal artifact", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_rehearsal_1";
    await createJobRecord({repository, jobId});

    const plan = buildVideoAwareAudioPlan({
      jobId,
      videoDurationSec: 20,
      transcriptWords: [
        {text: "Click", start_ms: 15000, end_ms: 15200, confidence: 0.98},
        {text: "now", start_ms: 15210, end_ms: 15400, confidence: 0.98}
      ]
    });
    await repository.writeVideoAwareAudioPlan(jobId, plan);
    await repository.updateJobRecord(jobId, (current) => ({
      ...current,
      artifact_paths: {
        ...current.artifact_paths,
        video_aware_audio_plan: repository.artifactPath(jobId, "video_aware_audio_plan")
      }
    }));

    const beforePlan = structuredClone(plan);
    const result = await buildSoundManifestRehearsal({
      repository,
      jobId,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(result.artifactPath).toContain("video-aware-sound-manifest.json");
    expect(result.musicCueCount).toBeGreaterThan(0);
    expect(result.dialogueOrDuckingHintCount).toBeGreaterThanOrEqual(0);
    expect(plan).toEqual(beforePlan);

    const artifact = await readVideoAwareSoundManifestArtifact({repository, jobId});
    const jobRecord = await repository.getJobRecord(jobId);

    expect(artifact.artifactType).toBe("video_aware_sound_manifest_rehearsal");
    expect(artifact.sourcePlanId).toBe(plan.id);
    expect(artifact.manifest.duration).toBe(20);
    expect(artifact.renderHints.planMode).toBe("dry_run");
    expect(jobRecord.artifact_paths.video_aware_sound_manifest).toBe(result.artifactPath);
    expect(jobRecord.artifact_paths.audio_render_plan).toBeNull();
    await expect(validateManifest(artifact.manifest, {checkFiles: false})).resolves.toBeTruthy();
  });

  it("keeps placeholder music placeholder and non-render-ready", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_rehearsal_2";
    await createJobRecord({repository, jobId});

    const plan = videoAwareAudioPlanSchema.parse({
      ...buildVideoAwareAudioPlan({
        jobId,
        videoDurationSec: 20
      }),
      musicEvents: [
        {
          id: "placeholder-bed",
          trackId: "placeholder-music-bed",
          videoStartSec: 0,
          videoEndSec: 20,
          trackStartSec: 0,
          trackEndSec: 20,
          sectionRole: null,
          purpose: "hook_bed",
          volumeDb: -24,
          fadeInSec: 0.3,
          fadeOutSec: 1.5,
          duckingEnabled: true,
          beatAligned: false,
          transitionInId: null,
          transitionOutId: null
        }
      ]
    });
    await repository.writeVideoAwareAudioPlan(jobId, plan);

    const result = await buildSoundManifestRehearsal({
      repository,
      jobId
    });

    const artifact = await readVideoAwareSoundManifestArtifact({repository, jobId});
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    expect(artifact.manifest.musicCues[0]?.file).toContain("__music_track_placeholder__");
    expect(artifact.renderHints.placeholderCueIds).toContain("placeholder-bed");
  });

  it("throws a clear error when the source plan artifact is missing", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_rehearsal_missing";
    await createJobRecord({repository, jobId});

    await expect(buildSoundManifestRehearsal({repository, jobId})).rejects.toBeInstanceOf(
      VideoAwareAudioPlanArtifactMissingError
    );
  });

  it("does not reuse the audio_render_plan artifact key", async () => {
    const repository = new FileJobRepository(tempDir);
    await repository.initialize();
    const jobId = "job_rehearsal_3";
    await createJobRecord({repository, jobId});

    const plan = buildVideoAwareAudioPlan({
      jobId,
      videoDurationSec: 20
    });
    await repository.writeVideoAwareAudioPlan(jobId, plan);

    const result = await buildSoundManifestRehearsal({repository, jobId});

    expect(result.artifactPath).toBe(repository.artifactPath(jobId, "video_aware_sound_manifest"));
    expect(repository.artifactPath(jobId, "audio_render_plan")).not.toBe(result.artifactPath);
    expect(await repository.artifactExists(jobId, "audio_render_plan")).toBe(false);
    expect(await repository.artifactExists(jobId, "video_aware_sound_manifest")).toBe(true);
  });
});

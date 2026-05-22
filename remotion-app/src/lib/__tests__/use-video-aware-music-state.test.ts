import {describe, expect, it, vi} from "vitest";

import {loadVideoAwareMusicSnapshot} from "../music/use-video-aware-music-state";

describe("use-video-aware-music-state helpers", () => {
  it("loads a snapshot from the DJ state response", async () => {
    const api = {
      getMusicDjState: vi.fn(async () => ({
        jobId: "job_alpha",
        hasAudioPlan: true,
        hasSoundManifest: true,
        hasPreflight: true,
        audioPlan: {
          id: "plan_alpha",
          jobId: "job_alpha",
          planMode: "dry_run" as const,
          status: "planned",
          videoDurationSec: 18,
          musicEvents: [],
          sfxEvents: []
        },
        preflight: {
          artifactType: "video_aware_music_preflight" as const,
          jobId: "job_alpha",
          sourceAudioPlanId: "plan_alpha",
          sourceSoundManifestArtifactPath: "jobs/job_alpha/audio/video-aware-sound-manifest.json",
          status: "warn" as const,
          canRender: false,
          planMode: "dry_run" as const,
          checkedAt: "2026-05-15T00:00:00.000Z",
          summary: {
            musicEventCount: 1,
            sfxEventCount: 1,
            transitionEventCount: 0,
            placeholderMusicCount: 0,
            unverifiedTrackCount: 1,
            missingFileCount: 0,
            timingIssueCount: 0,
            licenseIssueCount: 1
          },
          issues: [],
          warnings: [],
          nextActions: []
        },
        selectedTracks: [],
        musicEvents: [],
        sfxEvents: [],
        warnings: [],
        renderAllowed: false,
        canRenderMusic: false,
        reason: "Dry-run preview only / licenses not verified."
      })),
      runMusicRehearsal: vi.fn(),
      runMusicPreflight: vi.fn(),
      submitMusicOverride: vi.fn()
    };

    const snapshot = await loadVideoAwareMusicSnapshot("job_alpha", api);

    expect(api.getMusicDjState).toHaveBeenCalledWith("job_alpha");
    expect(snapshot.djState.jobId).toBe("job_alpha");
    expect(snapshot.audioPlan?.id).toBe("plan_alpha");
    expect(snapshot.preflight?.status).toBe("warn");
  });
});

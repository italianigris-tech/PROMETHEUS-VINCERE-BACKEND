import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {
  MusicDjControlPanelView
} from "../../components/music/MusicDjControlPanel";
import type {VideoAwareMusicViewState} from "../../lib/music/use-video-aware-music-state";

const buildController = (overrides: Partial<VideoAwareMusicViewState> = {}): VideoAwareMusicViewState => ({
  jobId: "job_alpha",
  loading: false,
  error: null,
  djState: {
    jobId: "job_alpha",
    hasAudioPlan: true,
    hasSoundManifest: true,
    hasPreflight: true,
    audioPlan: {
      id: "plan_alpha",
      jobId: "job_alpha",
      planMode: "dry_run",
      status: "planned",
      videoDurationSec: 18,
      musicEvents: [],
      sfxEvents: []
    },
    soundManifestSummary: {
      sourcePlanId: "plan_alpha",
      planMode: "dry_run",
      durationSec: 18,
      musicCueCount: 1,
      sfxCueCount: 1,
      dialogueOrDuckingHintCount: 1,
      placeholderCueIds: [],
      unresolvedTrackIds: [],
      unverifiedTrackIds: ["catalog/track-a"],
      warnings: []
    },
    preflight: {
      artifactType: "video_aware_music_preflight",
      jobId: "job_alpha",
      sourceAudioPlanId: "plan_alpha",
      sourceSoundManifestArtifactPath: "jobs/job_alpha/audio/video-aware-sound-manifest.json",
      status: "warn",
      canRender: false,
      planMode: "dry_run",
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
      issues: [
        {
          id: "issue_1",
          severity: "warning",
          code: "license.track_not_export_safe",
          message: "Track catalog/track-a is not export-safe.",
          suggestion: "Verify the license."
        }
      ],
      warnings: [],
      nextActions: ["Verify the license."]
    },
    selectedTracks: [
      {
        id: "music_1",
        trackId: "catalog/track-a",
        title: "Signal Path",
        category: "cinematic",
        videoStartSec: 0,
        videoEndSec: 8,
        previewOnly: true,
        renderSafe: false,
        sourceObjectKey: "music-originals/cinematic/signal-path.mp3"
      }
    ],
    musicEvents: [
      {
        id: "music_1",
        trackId: "catalog/track-a",
        title: "Signal Path",
        category: "cinematic",
        purpose: "hook bed",
        videoStartSec: 0,
        videoEndSec: 8,
        previewOnly: true,
        renderSafe: false
      }
    ],
    sfxEvents: [
      {
        id: "sfx_1",
        assetId: "click_1",
        type: "click",
        videoStartSec: 3,
        videoEndSec: 3.3,
        intensity: 0.72,
        reason: "CTA punctuation"
      }
    ],
    warnings: [],
    renderAllowed: false,
    canRenderMusic: false,
    reason: "Dry-run preview only / licenses not verified."
  },
  audioPlan: null,
  preflight: {
    artifactType: "video_aware_music_preflight",
    jobId: "job_alpha",
    sourceAudioPlanId: "plan_alpha",
    sourceSoundManifestArtifactPath: "jobs/job_alpha/audio/video-aware-sound-manifest.json",
    status: "warn",
    canRender: false,
    planMode: "dry_run",
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
  selectedTrack: null,
  runningRehearsal: false,
  runningPreflight: false,
  submittingOverride: false,
  lastActionMessage: null,
  refreshState: vi.fn(async () => {}),
  runRehearsal: vi.fn(async () => {}),
  runPreflight: vi.fn(async () => {}),
  overridePreviewTrack: vi.fn(async () => {}),
  overrideMusicEvent: vi.fn(async () => {}),
  setSelectedTrack: vi.fn(),
  ...overrides
});

describe("MusicDjControlPanel", () => {
  it("renders the empty no-job state", () => {
    const markup = renderToStaticMarkup(
      <MusicDjControlPanelView
        controller={buildController({
          jobId: null,
          djState: {
            jobId: "preview",
            hasAudioPlan: false,
            hasSoundManifest: false,
            hasPreflight: false,
            selectedTracks: [],
            musicEvents: [],
            sfxEvents: [],
            warnings: [],
            renderAllowed: false,
            canRenderMusic: false,
            reason: "DJ plan controls need a backend jobId."
          },
          preflight: null
        })}
      />
    );

    expect(markup).toContain("DJ plan controls need a backend jobId.");
    expect(markup).toContain("status: no job");
  });

  it("renders the selected DJ track and export warning", () => {
    const markup = renderToStaticMarkup(
      <MusicDjControlPanelView controller={buildController()} />
    );

    expect(markup).toContain("Signal Path");
    expect(markup).toContain("trackId: catalog/track-a");
    expect(markup).toContain("Preview only - license not verified for export.");
  });

  it("keeps override buttons disabled until a catalog track is selected", () => {
    const markup = renderToStaticMarkup(
      <MusicDjControlPanelView controller={buildController({selectedTrack: null})} />
    );

    expect(markup).toContain("Replace with selected catalog track");
    expect(markup).toContain("disabled=\"\"");
  });

  it("renders the active override track when a catalog track is selected", () => {
    const markup = renderToStaticMarkup(
      <MusicDjControlPanelView
        controller={buildController({
          selectedTrack: {
            id: "catalog/track-b",
            title: "Proof Engine",
            category: "prestige",
            artist: "Signal Atlas",
            genreTags: [],
            moodTags: [],
            useCaseTags: [],
            avoidWhen: [],
            previewAllowed: true,
            renderAllowed: false,
            analysisStatus: "pending",
            licenseSummary: {
              licenseType: "preview_only",
              commercialAllowed: false,
              attributionRequired: true,
              licenseVerified: false
            }
          }
        })}
      />
    );

    expect(markup).toContain("Active Override Track");
    expect(markup).toContain("Proof Engine");
    expect(markup).toContain("Use for preview");
  });

  it("does not leak credential-shaped fields into the UI", () => {
    const controller = buildController({
      djState: {
        ...buildController().djState!,
        R2_SECRET_ACCESS_KEY: "do-not-render-me"
      } as VideoAwareMusicViewState["djState"]
    });

    const markup = renderToStaticMarkup(
      <MusicDjControlPanelView controller={controller} />
    );

    expect(markup).not.toContain("do-not-render-me");
    expect(markup).not.toContain("R2_SECRET_ACCESS_KEY");
  });
});

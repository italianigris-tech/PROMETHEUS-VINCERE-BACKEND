import {describe, expect, it} from "vitest";

import {validateManifest} from "../sound-engine";
import {
  adaptAudioPlanToSoundDesignManifest,
  adaptAudioPlanToSoundDesignManifestWithHints,
  videoAwareAudioPlanSchema
} from "../music";

describe("music manifest adapter", () => {
  const basePlan = videoAwareAudioPlanSchema.parse({
    id: "plan_1",
    jobId: "job_1",
    projectId: "project_1",
    userId: "user_1",
    sourceVideoId: "video_1",
    transcriptId: "transcript_1",
    videoDurationSec: 20,
    previewStartSec: 0,
    previewEndSec: 20,
    creativeDirection: {
      summary: "dry run"
    },
    timelineSegments: [
      {
        id: "seg_1",
        startSec: 0,
        endSec: 8,
        role: "hook",
        text: "Here is the hook",
        energy: 0.7,
        valence: 0.5,
        arousal: 0.7,
        tension: 0.6,
        prestige: 0.5,
        urgency: 0.5,
        clarity: 0.8,
        speechDensity: 0.5,
        hookStrength: 0.9,
        proofStrength: 0.1,
        ctaStrength: 0,
        source: "test"
      }
    ],
    musicEvents: [
      {
        id: "music_1",
        trackId: "track_safe",
        videoStartSec: 0,
        videoEndSec: 12,
        trackStartSec: 1,
        trackEndSec: 13,
        sectionRole: "intro",
        purpose: "hook_bed",
        volumeDb: -24,
        fadeInSec: 0.3,
        fadeOutSec: 1.5,
        duckingEnabled: true,
        beatAligned: false,
        transitionInId: null,
        transitionOutId: "transition_1"
      }
    ],
    transitionEvents: [
      {
        id: "transition_1",
        type: "riser_into_impact",
        videoStartSec: 11.4,
        videoEndSec: 12,
        fromTrackId: "track_safe",
        toTrackId: "track_safe",
        intensity: 0.7,
        beatAligned: false,
        downbeatTargetSec: null,
        settings: {
          riserShape: "gentle"
        }
      },
      {
        id: "transition_2",
        type: "hard_cut",
        videoStartSec: 15,
        videoEndSec: 15.2,
        fromTrackId: null,
        toTrackId: null,
        intensity: 0.2,
        beatAligned: false,
        downbeatTargetSec: null,
        settings: {}
      }
    ],
    sfxEvents: [
      {
        id: "sfx_1",
        type: "tension_riser",
        assetId: "riser",
        videoStartSec: 8.2,
        videoEndSec: 8.9,
        intensity: 0.4,
        reason: "reveal",
        triggerText: "secret",
        mixRole: "video_context",
        volumeDb: -16,
        durationSec: 0.7
      },
      {
        id: "sfx_2",
        type: "cinematic_impact",
        assetId: "impact",
        videoStartSec: 9,
        videoEndSec: 9.5,
        intensity: 0.45,
        reason: "payoff",
        triggerText: "breakthrough",
        mixRole: "video_context",
        volumeDb: -15,
        durationSec: 0.5
      }
    ],
    duckingRegions: [
      {
        id: "duck_1",
        videoStartSec: 0.5,
        videoEndSec: 6.5,
        reason: "dialogue protection",
        targetMusicDb: -21,
        speechPriority: 0.6
      }
    ],
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
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z"
  });

  const safeTrack = {
    id: "track_safe",
    title: "Safe Track",
    artist: "Artist",
    source: "local",
    sourceUrl: null,
    storagePath: "music/safe-track.wav",
    licenseType: "royalty_free",
    commercialAllowed: true,
    attributionRequired: false,
    licenseVerified: true,
    durationSec: 90,
    bpm: 120,
    musicalKey: null,
    energy: 0.5,
    valence: 0.5,
    arousal: 0.5,
    tension: 0.4,
    prestige: 0.5,
    urgency: 0.4,
    clarity: 0.7,
    speechFriendliness: 0.8,
    genreTags: [],
    moodTags: [],
    instrumentTags: [],
    useCaseTags: [],
    avoidWhen: [],
    beatGrid: null,
    sections: [],
    waveformSummary: null,
    loudnessLufs: null,
    analysisStatus: "analyzed" as const,
    createdAt: "2026-05-13T00:00:00.000Z",
    analyzedAt: "2026-05-13T00:00:00.000Z"
  };

  it("maps a single music event to a valid sound design manifest without losing duration", async () => {
    const manifest = adaptAudioPlanToSoundDesignManifest({
      plan: basePlan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(manifest.duration).toBe(20);
    expect(manifest.musicCues).toHaveLength(1);
    expect(manifest.musicCues[0]?.start).toBe(0);
    expect(manifest.musicCues[0]?.end).toBe(12);
    expect(manifest.musicCues[0]?.sourceStart).toBe(1);
    expect(manifest.musicCues[0]?.sourceEnd).toBe(13);
    await expect(validateManifest(manifest, {checkFiles: false})).resolves.toBeTruthy();
  });

  it("maps sfx start times directly in video time and preserves event order", () => {
    const manifest = adaptAudioPlanToSoundDesignManifest({
      plan: basePlan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(manifest.sfx[0]?.start).toBe(8.2);
    expect(manifest.sfx[1]?.start).toBe(9);
    expect(manifest.sfx[0]?.start).toBeLessThan(manifest.sfx[1]?.start ?? 0);
  });

  it("normalizes transition timing to sound-engine cue boundary rules", async () => {
    const manifest = adaptAudioPlanToSoundDesignManifest({
      plan: basePlan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(manifest.musicCues[0]?.transitionOut?.start).toBe(11.4);
    expect(manifest.musicCues[0]?.transitionOut?.duration).toBe(0.6);
    await expect(validateManifest(manifest, {checkFiles: false})).resolves.toBeTruthy();
  });

  it("preserves ducking regions as dialogue/render hints", () => {
    const adapted = adaptAudioPlanToSoundDesignManifestWithHints({
      plan: basePlan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(adapted.manifest.dialogue).toHaveLength(1);
    expect(adapted.manifest.dialogue[0]?.start).toBe(0.5);
    expect(adapted.renderHints.duckingRegions[0]?.id).toBe("duck_1");
  });

  it("clamps out-of-range events instead of crashing", async () => {
    const plan = videoAwareAudioPlanSchema.parse({
      ...basePlan,
      musicEvents: [
        {
          ...basePlan.musicEvents[0],
          videoStartSec: 19.8,
          videoEndSec: 25
        }
      ],
      sfxEvents: [
        {
          ...basePlan.sfxEvents[0],
          videoStartSec: 19.9,
          videoEndSec: 25
        }
      ],
      duckingRegions: [
        {
          ...basePlan.duckingRegions[0],
          videoStartSec: 18,
          videoEndSec: 25
        }
      ]
    });

    const manifest = adaptAudioPlanToSoundDesignManifest({
      plan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(manifest.musicCues[0]?.end).toBe(20);
    expect(manifest.sfx[0]?.end).toBe(20);
    expect(manifest.dialogue[0]?.end).toBe(20);
    await expect(validateManifest(manifest, {checkFiles: false})).resolves.toBeTruthy();
  });

  it("keeps dry-run placeholder beds clearly non-export-safe", () => {
    const plan = videoAwareAudioPlanSchema.parse({
      ...basePlan,
      musicEvents: [
        {
          ...basePlan.musicEvents[0],
          id: "music_placeholder",
          trackId: "placeholder-music-bed"
        }
      ]
    });

    const adapted = adaptAudioPlanToSoundDesignManifestWithHints({
      plan,
      tracksById: {}
    });

    expect(adapted.manifest.musicCues[0]?.file).toContain("__music_track_placeholder__");
    expect(adapted.manifest.musicCues[0]?.tags).toContain("source:placeholder");
    expect(adapted.renderHints.placeholderCueIds).toContain("music_placeholder");
  });

  it("keeps preview-only R2 tracks resolved in the manifest while flagging them as unverified", () => {
    const plan = videoAwareAudioPlanSchema.parse({
      ...basePlan,
      musicEvents: [
        {
          ...basePlan.musicEvents[0],
          id: "music_r2_preview_only",
          trackId: "cinematic-trailer-epic/epic-cinematic",
          storagePath: "r2://prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
          sourceObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
          previewOnly: true,
          renderSafe: false,
          warning: "Preview only / license not verified."
        }
      ]
    });

    const adapted = adaptAudioPlanToSoundDesignManifestWithHints({
      plan,
      tracksById: {}
    });

    expect(adapted.manifest.musicCues[0]?.file).toBe("r2://prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3");
    expect(adapted.manifest.musicCues[0]?.tags).toContain("source:track");
    expect(adapted.renderHints.placeholderCueIds).toEqual([]);
    expect(adapted.renderHints.unverifiedTrackIds).toContain("cinematic-trailer-epic/epic-cinematic");
  });

  it("does not mutate the original audio plan", () => {
    const before = structuredClone(basePlan);

    adaptAudioPlanToSoundDesignManifestWithHints({
      plan: basePlan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(basePlan).toEqual(before);
  });

  it("surfaces orphan transitions as adapter hints", () => {
    const adapted = adaptAudioPlanToSoundDesignManifestWithHints({
      plan: basePlan,
      tracksById: {
        track_safe: safeTrack
      }
    });

    expect(adapted.renderHints.orphanTransitionEvents).toHaveLength(1);
    expect(adapted.renderHints.orphanTransitionEvents[0]?.id).toBe("transition_2");
  });
});

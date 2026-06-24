import {describe, expect, it} from "vitest";

import {buildBeatGrid} from "./beat-grid-builder";
import {detectSections} from "./section-detector";
import {analyzeTrack} from "./track-analyzer";
import {planTransition} from "../planner/transition-planner";
import {generateSfxEvents} from "../video-aware-planner/sfx-event-generator";
import {adaptAudioPlanToSoundDesignManifestWithHints} from "../renderer/manifest-adapter";
import type {MusicTrack} from "../schemas/music-track.schema";
import type {VideoAwareAudioPlan} from "../schemas/audio-plan.schema";

const baseTrack = {
  id: "track-1",
  title: "Deterministic Bed",
  artist: "Prometheus",
  source: "local",
  sourceUrl: null,
  storagePath: "C:/music/track-1.mp3",
  licenseType: "owned",
  commercialAllowed: true,
  attributionRequired: false,
  licenseVerified: true,
  durationSec: 16,
  bpm: null,
  musicalKey: null,
  energy: 0.7,
  valence: 0.5,
  arousal: 0.6,
  tension: 0.5,
  prestige: 0.5,
  urgency: 0.5,
  clarity: 0.8,
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
  analysisStatus: "indexed",
  createdAt: "2026-01-01T00:00:00.000Z",
  analyzedAt: null,
} satisfies MusicTrack;

describe("deterministic music fallback analysis", () => {
  it("builds a monotonic 128 BPM fallback beat grid over the full duration", () => {
    const beatGrid = buildBeatGrid({durationSec: 16});

    expect(beatGrid.bpm).toBe(128);
    expect(beatGrid.source).toBe("ffmpeg_fallback");
    expect(beatGrid.beatTimesSec.length).toBeGreaterThan(16);
    expect(beatGrid.beatTimesSec.every((time, index, beats) => index === 0 || time > (beats[index - 1] ?? -1))).toBe(true);
    expect(beatGrid.beatTimesSec.at(-1)).toBeGreaterThan(15);
  });

  it("detects non-overlapping beat-grid sections that cover the track", () => {
    const beatGrid = buildBeatGrid({durationSec: 64, bpm: 128});
    const sections = detectSections({trackId: "track-1", durationSec: 64, beatGrid});

    expect(sections[0]?.startSec).toBe(0);
    expect(sections.at(-1)?.endSec).toBe(64);
    expect(sections.every((section, index) => index === 0 || section.startSec >= (sections[index - 1]?.endSec ?? 0))).toBe(true);
  });

  it("returns consistent analyzed track output for the same input", () => {
    const first = analyzeTrack({track: baseTrack});
    const second = analyzeTrack({track: baseTrack});

    expect(first).toEqual(second);
    expect(first.beatGrid?.source).toBe("ffmpeg_fallback");
    expect(first.waveformSummary?.source).toBe("ffmpeg_fallback");
    expect(first.sections.length).toBeGreaterThan(0);
  });

  it("plans deterministic transitions for the same input", () => {
    const input = {
      id: "transition-1",
      videoStartSec: 7.5,
      videoEndSec: 8,
      fromTrackId: "track-a",
      toTrackId: "track-b",
      intensity: 0.8,
      downbeatTargetSec: 8,
    };

    expect(planTransition(input)).toEqual(planTransition(input));
    expect(planTransition(input).type).toBe("riser_into_impact");
    expect(planTransition(input).settings.source).toBe("deterministic_transition_planner");
  });

  it("generates SFX events that adapt into a render manifest without placeholder asset IDs", () => {
    const events = generateSfxEvents({
      timelineSegments: [{
        id: "segment-1",
        role: "transition",
        startSec: 0,
        endSec: 2,
        text: "deadline",
        energy: 0.6,
        valence: 0.5,
        arousal: 0.65,
        tension: 0.8,
        prestige: 0.45,
        urgency: 0.7,
        clarity: 0.8,
        speechDensity: 0.5,
        hookStrength: 0.4,
        proofStrength: 0.35,
        ctaStrength: 0.2,
        source: "deterministic-test",
      }],
      maxEvents: 1,
    });

    expect(events[0]?.assetId).toBe(events[0]?.type);
    expect(events[0]?.assetId).not.toContain("placeholder");

    const plan = {
      id: "plan-1",
      jobId: "job-1",
      projectId: null,
      userId: null,
      sourceVideoId: null,
      transcriptId: null,
      videoDurationSec: 2,
      previewStartSec: null,
      previewEndSec: null,
      creativeDirection: {
        summary: "",
        moodTags: [],
        pacing: "",
        emphasisMoments: [],
        constraints: [],
      },
      timelineSegments: [],
      musicEvents: [],
      transitionEvents: [],
      sfxEvents: events,
      duckingRegions: [],
      captionSyncEvents: [],
      renderSettings: {
        targetIntegratedLufs: -16,
        targetTruePeakDbtp: -1.5,
        targetLra: 11,
        sampleRate: 48000,
        previewSampleRate: 22050,
        preserveDialogueIntelligibility: true,
        notes: [],
      },
      outputAudioPath: null,
      outputVideoPath: null,
      planMode: "render_ready",
      status: "planned",
      errorMessage: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies VideoAwareAudioPlan;

    const adapted = adaptAudioPlanToSoundDesignManifestWithHints({
      plan,
      sfxAssetPaths: Object.fromEntries(events.map((event) => [event.assetId, `C:/sfx/${event.assetId}.wav`])),
    });

    expect(adapted.manifest.sfx).toHaveLength(1);
    expect(adapted.renderHints.placeholderCueIds).toEqual([]);
  });
});

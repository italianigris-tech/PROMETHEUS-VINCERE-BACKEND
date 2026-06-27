import {describe, expect, it} from "vitest";
import type {CameraMove, CutEvent, SFXEvent, TextOverlay} from "@prometheus/shared-types";
import {
  buildJosephAudioVisualChoreographyPlan,
  evaluateJosephChoreographyQuality,
  JOSEPH_CHOREOGRAPHY_DOCTRINES,
  scoreJosephChoreographySegments,
  type JosephAudioVisualChoreographyPlanInput,
} from "./joseph-audio-visual-choreography";

const fps = 30;

const frame = (ms: number): number => Math.round((ms / 1000) * fps);

const baseInput = (): JosephAudioVisualChoreographyPlanInput => ({
  profile: "joseph_aggressive",
  durationMs: 12_000,
  fps,
  phrases: [
    {
      words: [{text: "Listen", startMs: 300, endMs: 580, confidence: 0.98}],
      startMs: 300,
      endMs: 1200,
      energy: 0.78,
      thesisWords: [{text: "Listen", startMs: 300, endMs: 580, confidence: 0.98}],
      highEnergyWords: [],
    },
    {
      words: [{text: "system", startMs: 2600, endMs: 3100, confidence: 0.97}],
      startMs: 2400,
      endMs: 3800,
      energy: 0.46,
      thesisWords: [{text: "system", startMs: 2600, endMs: 3100, confidence: 0.97}],
      highEnergyWords: [],
    },
    {
      words: [{text: "secret", startMs: 4700, endMs: 5100, confidence: 0.99}],
      startMs: 4400,
      endMs: 5700,
      energy: 0.72,
      thesisWords: [{text: "secret", startMs: 4700, endMs: 5100, confidence: 0.99}],
      highEnergyWords: [{text: "secret", startMs: 4700, endMs: 5100, confidence: 0.99}],
    },
    {
      words: [{text: "scale", startMs: 6600, endMs: 7200, confidence: 0.98}],
      startMs: 6400,
      endMs: 8200,
      energy: 0.86,
      thesisWords: [{text: "scale", startMs: 6600, endMs: 7200, confidence: 0.98}],
      highEnergyWords: [{text: "scale", startMs: 6600, endMs: 7200, confidence: 0.98}],
    },
    {
      words: [{text: "breathe", startMs: 8700, endMs: 9300, confidence: 0.94}],
      startMs: 8600,
      endMs: 9500,
      energy: 0.34,
      thesisWords: [],
      highEnergyWords: [],
    },
    {
      words: [{text: "now", startMs: 10_100, endMs: 10_500, confidence: 0.99}],
      startMs: 10_000,
      endMs: 11_200,
      energy: 0.92,
      thesisWords: [{text: "now", startMs: 10_100, endMs: 10_500, confidence: 0.99}],
      highEnergyWords: [{text: "now", startMs: 10_100, endMs: 10_500, confidence: 0.99}],
    },
  ],
  cuts: [500, 1800, 4700, 6600, 10_100].map((atMs, index): CutEvent => ({
    type: "cut",
    atMs,
    toMs: atMs,
    style: index % 2 === 0 ? "hard" : "zoom_blur",
    intensity: index === 4 ? 1 : 0.76,
  })),
  textOverlays: [
    {text: "LISTEN", startFrame: frame(300), endFrame: frame(820), animation: "pop", color: "#FFFFFF"},
    {text: "SECRET", startFrame: frame(4700), endFrame: frame(5300), animation: "elastic_scale", color: "#FF0040"},
    {text: "NOW", startFrame: frame(10_100), endFrame: frame(10_700), animation: "glitch", color: "#FF0040"},
  ] satisfies TextOverlay[],
  cameraMoves: [
    {type: "push_in", startFrame: frame(4700), endFrame: frame(5700)},
    {type: "shake", startFrame: frame(10_100), endFrame: frame(10_500)},
  ] satisfies CameraMove[],
  sfx: [
    {id: "impact-0", cue: "impact_deep", triggerMs: 4700, durationMs: 300, volumeDb: -10, duckMusicDb: -8},
    {id: "drop-0", cue: "sub_drop", triggerMs: 10_100, durationMs: 500, volumeDb: -8, duckMusicDb: -9},
  ] satisfies SFXEvent[],
  transitions: [],
  beats: [500, 1000, 1800, 2600, 3400, 4200, 5000, 5800, 6600, 7400, 8200, 9000, 9800, 10_600, 11_400],
  onsets: [300, 4700, 6600, 10_100],
  energyCurve: [0.72, 0.46, 0.58, 0.72, 0.86, 0.34, 0.92],
  backgroundPlan: {
    version: "joseph-background-v1",
    catalogVersion: "2026.06",
    selectedPrimitiveIds: ["shader.depth-vignette", "accent.editorial-rails"],
    primitives: [],
    layeringRules: {
      sourceFootageMode: "pip_protected",
      textProtection: "contrast_scrim",
      pipProtection: "reserved_safe_zone",
      overlayInteraction: "accent_below_text",
      maxActivePrimitives: 4,
    },
    parameterAudit: {governed: true, clampedParameterCount: 0, warnings: []},
  },
});

describe("Joseph audio-visual choreography", () => {
  it("exposes the named Joseph timing vocabulary", () => {
    expect(JOSEPH_CHOREOGRAPHY_DOCTRINES.map((doctrine) => doctrine.id)).toEqual([
      "punch",
      "hold",
      "bloom",
      "ratchet",
      "glide",
      "suspend",
      "detonate",
    ]);
    expect(JOSEPH_CHOREOGRAPHY_DOCTRINES.every((doctrine) => doctrine.cutBehavior && doctrine.sfxBehavior)).toBe(true);
  });

  it("scores hook, setup, revelation, escalation, release, and CTA segments", () => {
    const segments = scoreJosephChoreographySegments(baseInput());

    expect(segments.map((segment) => segment.role)).toEqual([
      "hook",
      "setup",
      "revelation",
      "escalation",
      "release",
      "cta",
    ]);
    expect(segments.every((segment) => segment.score >= 0 && segment.score <= 1)).toBe(true);
    expect(segments.find((segment) => segment.role === "cta")?.doctrineId).toBe("detonate");
    expect(segments.find((segment) => segment.role === "escalation")?.momentum).toBeGreaterThan(
      segments.find((segment) => segment.role === "setup")?.momentum ?? 0,
    );
  });

  it("governs cut, text, camera, SFX, and background timing together", () => {
    const plan = buildJosephAudioVisualChoreographyPlan(baseInput());

    expect(plan.version).toBe("joseph-choreography-v1");
    expect(plan.timingPlan.cutWindows.length).toBeGreaterThan(0);
    expect(plan.timingPlan.textWindows.length).toBeGreaterThan(0);
    expect(plan.timingPlan.cameraWindows.length).toBeGreaterThan(0);
    expect(plan.timingPlan.sfxWindows.length).toBeGreaterThan(0);
    expect(plan.timingPlan.backgroundWindows.length).toBe(plan.segments.length);

    const allWindows = [
      ...plan.timingPlan.cutWindows,
      ...plan.timingPlan.textWindows,
      ...plan.timingPlan.cameraWindows,
      ...plan.timingPlan.sfxWindows,
      ...plan.timingPlan.backgroundWindows,
    ];
    expect(allWindows.every((window) => window.segmentId.length > 0 && window.doctrineId.length > 0)).toBe(true);
    expect(plan.timingPlan.sfxWindows.some((window) => window.sync === "beat" || window.sync === "onset")).toBe(true);
  });

  it("evaluates pacing failures without relying on beat snapping alone", () => {
    const input = baseInput();
    const segments = scoreJosephChoreographySegments(input).map((segment) => ({
      ...segment,
      score: 0.5,
      intensity: 0.5,
    }));
    const audit = evaluateJosephChoreographyQuality({
      durationMs: input.durationMs,
      beats: input.beats,
      onsets: input.onsets,
      segments,
      timingPlan: {
        cutWindows: [500, 700, 900, 1100, 1300, 1500, 1700].map((triggerMs, index) => ({
          lane: "cut",
          eventId: `cut-${index}`,
          segmentId: "segment-hook-0",
          segmentRole: "hook",
          doctrineId: "punch",
          startMs: triggerMs - 40,
          endMs: triggerMs + 40,
          triggerMs,
          intensity: 0.82,
          sync: "beat",
        })),
        textWindows: [{
          lane: "text",
          eventId: "text-off-music",
          segmentId: "segment-cta-5",
          segmentRole: "cta",
          doctrineId: "detonate",
          startMs: 10_333,
          endMs: 10_733,
          triggerMs: 10_333,
          intensity: 0.9,
          sync: "phrase",
        }],
        cameraWindows: [],
        sfxWindows: [],
        backgroundWindows: [],
      },
    });

    expect(audit.failures).toEqual(
      expect.arrayContaining(["flat_pacing", "overcutting", "climax_overspend", "dead_zone", "non_musical_emphasis"]),
    );
    expect(audit.score).toBeLessThan(0.5);
  });
});
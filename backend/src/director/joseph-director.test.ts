import {describe, expect, it} from "vitest";
import {generateJosephManifest} from "./joseph-director";
import type {CutEvent} from "@prometheus/shared-types";

const msToFrame = (ms: number) => Math.round((ms / 1000) * 30);

const MOCK_INPUT = {
  videoUrl: "file:///video.mp4",
  musicTrackUrl: "file:///music.mp3",
  transcript: [
    {text: "Listen", startMs: 420, endMs: 680, confidence: 0.98},
    {text: "if", startMs: 700, endMs: 800, confidence: 0.95},
    {text: "you", startMs: 820, endMs: 900, confidence: 0.96},
    {text: "want", startMs: 920, endMs: 1100, confidence: 0.97},
    {text: "to", startMs: 1120, endMs: 1200, confidence: 0.94},
    {text: "win", startMs: 1220, endMs: 1500, confidence: 0.99},
    {text: "bigger", startMs: 1820, endMs: 2120, confidence: 0.97},
    {text: "today!", startMs: 2140, endMs: 2400, confidence: 0.96},
    {text: "Move", startMs: 2600, endMs: 2840, confidence: 0.98},
    {text: "now", startMs: 2860, endMs: 3000, confidence: 0.99},
    {text: "or", startMs: 3020, endMs: 3080, confidence: 0.92},
    {text: "lose", startMs: 3100, endMs: 3400, confidence: 0.99},
  ],
  beats: [500, 900, 1300, 1800, 2200, 2700, 3200, 3600, 4200, 5000, 6200, 7200],
  onsets: [420, 1220, 2140, 3100, 5000],
  energyCurve: [0.25, 0.32, 0.78, 0.41, 0.86, 0.44, 0.72, 0.91, 0.38, 0.88],
  durationMs: 9000,
  seed: 12345,
  profile: "joseph_aggressive" as const,
};

describe("generateJosephManifest", () => {
  it("hook has minimum 3 cuts", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);
    const hookCuts = manifest.timeline.filter((event) => event.type === "cut" && event.atMs <= 3000);
    expect(hookCuts.length).toBeGreaterThanOrEqual(3);
    expect(hookCuts.length).toBeLessThanOrEqual(6);
  });

  it("CTA has at least 1 push_in camera move", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);
    const ctaStart = MOCK_INPUT.durationMs * 0.78;
    const ctaMoves = manifest.cameraMoves.filter((move) => move.startFrame >= msToFrame(ctaStart) && move.type === "push_in");
    expect(ctaMoves.length).toBeGreaterThanOrEqual(1);
  });

  it("aggressive has more cuts than minimal", () => {
    const aggressive = generateJosephManifest({...MOCK_INPUT, profile: "joseph_aggressive", seed: 999});
    const minimal = generateJosephManifest({...MOCK_INPUT, profile: "joseph_minimal", seed: 999});
    const aggCuts = aggressive.timeline.filter((event) => event.type === "cut").length;
    const minCuts = minimal.timeline.filter((event) => event.type === "cut").length;
    expect(aggCuts).toBeGreaterThan(minCuts);
  });

  it("high-energy thesis words are red", () => {
    const manifest = generateJosephManifest({...MOCK_INPUT, seed: 20001});
    const redWords = manifest.textOverlays.filter((overlay) => overlay.color === "#FF0040");
    expect(redWords.length).toBeGreaterThan(0);
  });

  it("records inspectable micro-animation primitive selections", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);

    expect(manifest.microAnimationAudit?.taxonomyVersion).toBe("joseph-micro-animation-v1");
    expect(manifest.microAnimationAudit?.primitiveIds.length).toBeGreaterThan(0);
    expect(manifest.microAnimationAudit?.score).toBeGreaterThan(0.7);
    expect(manifest.textOverlays.some((overlay) => overlay.microAnimation)).toBe(true);
    expect(
      manifest.textOverlays.every((overlay) =>
        overlay.microAnimation
          ? overlay.animation === overlay.microAnimation.renderFallback
          : true,
      ),
    ).toBe(true);
  });

  it("records a reusable Joseph PiP rig with docking and coexistence rules", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);

    expect(manifest.josephPiP?.layout).toMatch(/^speaker_|^corner_/);
    expect(manifest.josephPiP?.frame.safeMarginPercent).toBeGreaterThan(0);
    expect(manifest.josephPiP?.dockingPosition).toMatch(/upper|lower/);
    expect(manifest.josephPiP?.activeMotion.length).toBeGreaterThanOrEqual(3);
    expect(manifest.josephPiP?.typographyZones.length).toBeGreaterThan(0);
    expect(manifest.josephPiP?.backgroundLayers.length).toBeGreaterThan(0);
  });

  it("records a curated Joseph background primitive plan", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);

    expect(manifest.josephBackground?.version).toBe("joseph-background-v1");
    expect(manifest.josephBackground?.parameterAudit.governed).toBe(true);
    expect(manifest.josephBackground?.primitives.length).toBeGreaterThanOrEqual(3);
    expect(manifest.josephBackground?.layeringRules.pipProtection).toBe("reserved_safe_zone");
  });  it("records a governed Joseph audio-visual choreography plan", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);

    expect(manifest.josephChoreography?.version).toBe("joseph-choreography-v1");
    expect(manifest.josephChoreography?.vocabulary.map((doctrine) => doctrine.id)).toEqual(
      expect.arrayContaining(["punch", "hold", "bloom", "ratchet", "glide", "suspend", "detonate"]),
    );
    expect(manifest.josephChoreography?.segments.map((segment) => segment.role)).toEqual(
      expect.arrayContaining(["hook", "setup", "revelation", "escalation", "release", "cta"]),
    );
    expect(manifest.josephChoreography?.timingPlan.cutWindows.length).toBeGreaterThan(0);
    expect(manifest.josephChoreography?.timingPlan.textWindows.length).toBeGreaterThan(0);
    expect(manifest.josephChoreography?.timingPlan.cameraWindows.length).toBeGreaterThan(0);
    expect(manifest.josephChoreography?.timingPlan.sfxWindows.length).toBeGreaterThan(0);
    expect(manifest.josephChoreography?.timingPlan.backgroundWindows.length).toBeGreaterThan(0);
    expect(manifest.josephChoreography?.qualityAudit.score).toBeGreaterThan(0.5);
  });

  it("cuts land near beats", () => {
    const manifest = generateJosephManifest(MOCK_INPUT);
    const cuts = manifest.timeline.filter((event) => event.type === "cut") as CutEvent[];
    const beats = MOCK_INPUT.beats;

    for (const cut of cuts) {
      const nearestBeat = beats.reduce((left, right) =>
        Math.abs(right - cut.atMs) < Math.abs(left - cut.atMs) ? right : left
      );
      expect(Math.abs(nearestBeat - cut.atMs)).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic", () => {
    const left = generateJosephManifest(MOCK_INPUT);
    const right = generateJosephManifest(MOCK_INPUT);

    expect(left.videoTracks).toEqual(right.videoTracks);
    expect(left.cameraMoves).toEqual(right.cameraMoves);
    expect(left.textOverlays).toEqual(right.textOverlays);
    expect(left.transitions).toEqual(right.transitions);
    expect(left.timeline).toEqual(right.timeline);
    expect(left.audio.sfx).toEqual(right.audio.sfx);
  });
});

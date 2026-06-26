import {UnifiedRenderManifestSchema} from "@prometheus/shared-types";
import {describe, expect, it} from "vitest";
import {generateJosephManifest} from "./joseph-director";
import {compileJosephManifest} from "./joseph-manifest-compiler";

const INPUT = {
  videoUrl: "file:///video.mp4",
  musicTrackUrl: "file:///music.mp3",
  transcript: [
    {text: "Listen", startMs: 420, endMs: 680, confidence: 0.98},
    {text: "if", startMs: 700, endMs: 800, confidence: 0.95},
    {text: "you", startMs: 820, endMs: 900, confidence: 0.96},
    {text: "want", startMs: 920, endMs: 1100, confidence: 0.97},
    {text: "to", startMs: 1120, endMs: 1200, confidence: 0.94},
    {text: "win", startMs: 1220, endMs: 1500, confidence: 0.99},
  ],
  beats: [500, 900, 1300, 1800, 2200, 2700, 3200, 3600],
  onsets: [420, 1220],
  energyCurve: [0.25, 0.32, 0.78, 0.41, 0.86, 0.44, 0.72, 0.91],
  durationMs: 4000,
  seed: 12345,
  profile: "joseph_aggressive" as const,
};

describe("Joseph Manifest Compiler", () => {
  it("passes through a schema-valid Joseph manifest without dropping render fields", () => {
    const manifest = generateJosephManifest(INPUT);
    const original = JSON.parse(JSON.stringify(manifest));

    const result = compileJosephManifest({
      manifest,
      auditReferences: {
        candidateScoreSummary: true,
        plannerAuditRef: "candidate-score-summary",
      },
    });

    expect(result.manifest).toEqual(manifest);
    expect(manifest).toEqual(original);
    expect(UnifiedRenderManifestSchema.parse(result.manifest)).toMatchObject({
      version: "2.0",
    });
    expect(result.manifest.textOverlays).toEqual(original.textOverlays);
    expect(result.manifest.microAnimationAudit).toEqual(original.microAnimationAudit);
    expect(result.manifest.josephPiP).toEqual(original.josephPiP);
    expect(result.manifest.josephBackground).toEqual(original.josephBackground);
    expect(result.manifest.josephTypography).toEqual(original.josephTypography);
    expect(result.manifest.cameraMoves).toEqual(original.cameraMoves);

    expect(result.audit).toMatchObject({
      version: "joseph-manifest-compiler-v1",
      mode: "pass_through",
      deterministic: true,
      schemaVersion: "2.0",
      auditReferences: {
        candidateScoreSummary: true,
        plannerAuditRef: "candidate-score-summary",
      },
    });
    expect(result.audit.preservedFieldPaths).toEqual(
      expect.arrayContaining([
        "textOverlays",
        "textOverlays.microAnimation",
        "microAnimationAudit",
        "josephPiP",
        "josephBackground",
        "josephTypography",
        "cameraMoves",
        "timeline",
      ]),
    );
    expect(result.audit.presentFieldPaths).toEqual(
      expect.arrayContaining([
        "textOverlays",
        "textOverlays.microAnimation",
        "microAnimationAudit",
        "josephPiP",
        "josephBackground",
        "josephTypography",
        "cameraMoves",
        "timeline",
      ]),
    );
  });

  it("produces deterministic compiler output for the same manifest input", () => {
    const manifest = generateJosephManifest(INPUT);
    const left = compileJosephManifest({manifest});
    const right = compileJosephManifest({manifest});

    expect(right).toEqual(left);
  });
});

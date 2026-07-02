import {describe, expect, it} from "vitest";
import {generateJosephManifest} from "./joseph-director";
import {
  buildJosephTypographyIntelligencePlan,
  evaluateJosephTypographyQuality,
  JOSEPH_TYPOGRAPHY_STYLEBOOKS,
} from "./joseph-typography-intelligence";

const WORDS = [
  {text: "The", startMs: 0, endMs: 120, confidence: 0.98},
  {text: "secret", startMs: 140, endMs: 420, confidence: 0.96},
  {text: "is", startMs: 440, endMs: 520, confidence: 0.99},
  {text: "premium", startMs: 540, endMs: 860, confidence: 0.97},
  {text: "focus!", startMs: 880, endMs: 1200, confidence: 0.99},
];

describe("Joseph typography intelligence", () => {
  it("scores filler, support, and hero words with explicit lexical reasons", () => {
    const plan = buildJosephTypographyIntelligencePlan({
      words: WORDS,
      energyCurve: [0.22, 0.48, 0.92, 0.86],
      durationMs: 1400,
      profile: "joseph_aggressive",
      doctrineId: "kinetic-pulse",
    });

    expect(plan.version).toBe("joseph-typography-v1");
    expect(plan.lexicalWeights.find((word) => word.normalized === "the")?.role).toBe("filler");
    expect(plan.lexicalWeights.find((word) => word.normalized === "secret")?.role).toBe("support");
    expect(plan.lexicalWeights.find((word) => word.normalized === "focus")?.role).toBe("hero");
    expect(plan.lexicalWeights.find((word) => word.normalized === "focus")?.reasons).toEqual(
      expect.arrayContaining(["high_energy", "punctuation_emphasis"]),
    );
  });

  it("applies stylebook composition rules for hierarchy, case, line rhythm, and filler suppression", () => {
    const plan = buildJosephTypographyIntelligencePlan({
      words: WORDS,
      energyCurve: [0.22, 0.48, 0.92, 0.86],
      durationMs: 1400,
      profile: "joseph_cinematic",
      doctrineId: "restrained-cinematic",
    });

    expect(JOSEPH_TYPOGRAPHY_STYLEBOOKS.map((stylebook) => stylebook.id)).toEqual(
      expect.arrayContaining([
        "aggressive_authority",
        "premium_cinematic",
        "sleek_product",
        "restrained_editorial",
      ]),
    );
    expect(plan.stylebookId).toBe("premium_cinematic");
    expect(plan.compositionRules.fillerTreatment).toBe("suppress");
    expect(plan.compositionRules.maxWordsPerLine).toBeGreaterThan(1);
    expect(plan.lines.some((line) => line.role === "hero" && line.caseTreatment === "uppercase")).toBe(true);
    expect(plan.lines.every((line) => !/\bTHE\b/i.test(line.text))).toBe(true);
  });

  it("flags cheap emphasis, broken line rhythm, clutter, and insufficient contrast", () => {
    const quality = evaluateJosephTypographyQuality({
      version: "joseph-typography-v1",
      stylebookId: "aggressive_authority",
      lexicalWeights: [
        {text: "the", normalized: "the", startFrame: 0, endFrame: 8, role: "filler", score: 0.05, reasons: ["common_filler_word"]},
        {text: "and", normalized: "and", startFrame: 9, endFrame: 16, role: "filler", score: 0.05, reasons: ["common_filler_word"]},
        {text: "win", normalized: "win", startFrame: 17, endFrame: 26, role: "hero", score: 0.91, reasons: ["high_energy"]},
      ],
      compositionRules: {
        caseStrategy: "all_caps",
        lineBreakStrategy: "phrase_stack",
        contrastMode: "single_color",
        hierarchyScale: 1.04,
        fillerTreatment: "show_dimmed",
        maxWordsPerLine: 7,
      },
      lines: [
        {
          text: "THE AND WIN EVERYTHING NOW TODAY",
          role: "hero",
          caseTreatment: "uppercase",
          startFrame: 0,
          endFrame: 60,
          maxCharacters: 16,
          contrastColor: "#FFFFFF",
          hierarchyLevel: 1,
        },
      ],
      roleStyles: [],
      qualityAudit: {score: 1, failures: [], warnings: []},
    });

    expect(quality.failures).toEqual(
      expect.arrayContaining([
        "typography_clutter",
        "typography_cheap_emphasis",
        "typography_broken_line_rhythm",
        "typography_insufficient_contrast",
      ]),
    );
    expect(quality.score).toBeLessThan(0.7);
  });

  it("records typography intelligence on generated Joseph manifests", () => {
    const manifest = generateJosephManifest({
      videoUrl: "file:///video.mp4",
      musicTrackUrl: "file:///music.mp3",
      transcript: WORDS,
      beats: [240, 560, 900, 1180],
      onsets: [140, 540, 880],
      energyCurve: [0.22, 0.48, 0.92, 0.86],
      durationMs: 2200,
      seed: 12345,
      profile: "joseph_aggressive",
    });

    expect(manifest.josephTypography?.version).toBe("joseph-typography-v1");
    expect(manifest.josephTypography?.lexicalWeights.some((word) => word.role === "hero")).toBe(true);
    expect(manifest.josephTypography?.compositionRules.fillerTreatment).toBe("suppress");
    expect(manifest.josephTypography?.qualityAudit.failures).toEqual([]);
  });

  it("carries role, tracking, weight, hierarchy, and pairing decisions on generated manifests", () => {
    const manifest = generateJosephManifest({
      videoUrl: "file:///video.mp4",
      musicTrackUrl: "file:///music.mp3",
      transcript: WORDS,
      beats: [240, 560, 900, 1180],
      onsets: [140, 540, 880],
      energyCurve: [0.22, 0.48, 0.92, 0.86],
      durationMs: 2200,
      seed: 12345,
      profile: "joseph_aggressive",
    });

    const plan = manifest.josephTypography;
    const heroStyle = plan?.roleStyles.find((style) => style.role === "hero");
    const supportStyle = plan?.roleStyles.find((style) => style.role === "support");

    expect(plan?.fontPairing?.primary).toMatchObject({
      fontId: "hero-echelon-regular",
      family: "Echelon",
      role: "hero",
      source: "custom_ingested",
      fontAssetUrl: "/fonts/hero/echelon-rg-e550ec4e2f9a.otf",
    });
    expect(plan?.fontPairing?.secondary).toMatchObject({
      fontId: "hero-goudy-bookletter",
      family: "Goudy Bookletter 1911",
      role: "support",
      source: "custom_ingested",
      fontAssetUrl: "/fonts/hero/goudybookletter1911-29a7765f69d5.otf",
    });
    expect(heroStyle).toMatchObject({
      fontRole: "hero",
      hierarchyLevel: 1,
    });
    expect(supportStyle).toMatchObject({
      fontRole: "support",
      hierarchyLevel: 2,
    });
    expect(heroStyle?.trackingEm).toBeLessThan(0);
    expect(supportStyle?.trackingEm).toBeGreaterThan(0);
    expect(heroStyle?.weight).toBeGreaterThan(supportStyle?.weight ?? 0);
    expect(plan?.lines.every((line) => line.hierarchyLevel >= 1 && line.maxCharacters > 0)).toBe(true);
  });
});

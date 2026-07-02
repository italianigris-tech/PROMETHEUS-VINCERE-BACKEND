import {describe, expect, it} from "vitest";
import {UnifiedRenderManifestSchema} from "./unified-render-manifest.js";

describe("Joseph typography intelligence manifest contract", () => {
  const baseManifest = {
    version: "2.0",
    jobId: "123e4567-e89b-12d3-a456-426614174000",
    seed: 12345,
    createdAt: "2026-01-01T00:00:00.000Z",
    durationFrames: 300,
    fps: 30,
    width: 1080,
    height: 1920,
    source: {
      videoUrl: "/uploads/job-1/video.mp4",
      transcript: [],
      durationMs: 10000,
      width: 1080,
      height: 1920,
      fps: 30,
    },
    audio: {
      beats: [],
      onsets: [],
      sfx: [],
      voiceVolumeDb: 0,
      musicVolumeDb: -18,
      targetLufs: -14,
    },
    timeline: [],
    creativeProfile: {
      name: "joseph_aggressive",
      cutDensity: 0.8,
      textDensity: 0.8,
      sfxDensity: 0.8,
      cameraAggression: 0.8,
      colorIntensity: 0.7,
    },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      codec: "h264",
      crf: 18,
    },
  };

  it("accepts lexical weights, composition rules, lines, and quality audit", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      josephTypography: {
        version: "joseph-typography-v1",
        stylebookId: "aggressive_authority",
        lexicalWeights: [
          {
            text: "the",
            normalized: "the",
            startFrame: 10,
            endFrame: 16,
            role: "filler",
            score: 0.05,
            reasons: ["common_filler_word"],
          },
          {
            text: "WIN",
            normalized: "win",
            startFrame: 18,
            endFrame: 28,
            role: "hero",
            score: 0.92,
            reasons: ["high_energy", "semantic_density"],
          },
        ],
        compositionRules: {
          caseStrategy: "hero_upper_support_title",
          lineBreakStrategy: "phrase_stack",
          contrastMode: "hero_crimson_support_white",
          hierarchyScale: 1.32,
          fillerTreatment: "suppress",
          maxWordsPerLine: 3,
        },
        lines: [
          {
            text: "WIN",
            role: "hero",
            caseTreatment: "uppercase",
            startFrame: 18,
            endFrame: 28,
            maxCharacters: 12,
            contrastColor: "#FF0040",
            hierarchyLevel: 1,
          },
        ],
        fontPairing: {
          primary: {
            fontId: "hero-satoshi-bold",
            family: "Satoshi",
            fontAssetUrl: "/fonts/retrieved/Satoshi-Bold.otf",
            source: "custom_ingested",
            role: "hero",
          },
          secondary: {
            fontId: "support-canela-regular",
            family: "Canela",
            fontAssetUrl: "/fonts/retrieved/Canela-Regular.ttf",
            source: "custom_ingested",
            role: "support",
          },
          graphUsed: true,
          pairingScore: 0.91,
          reason: "Resolved role-based hero/support pairing through the font graph.",
        },
        roleStyles: [
          {
            role: "hero",
            fontRole: "hero",
            trackingEm: -0.045,
            weight: 820,
            hierarchyLevel: 1,
            hierarchyScale: 1.36,
            lineHeight: 0.94,
          },
          {
            role: "support",
            fontRole: "support",
            trackingEm: 0.08,
            weight: 520,
            hierarchyLevel: 2,
            hierarchyScale: 1,
            lineHeight: 1.08,
          },
        ],        qualityAudit: {
          score: 0.94,
          failures: [],
          warnings: ["filler_suppressed"],
        },
      },
    });

    expect(manifest.josephTypography?.version).toBe("joseph-typography-v1");
    expect(manifest.josephTypography?.lexicalWeights.map((word) => word.role)).toEqual(
      expect.arrayContaining(["filler", "hero"]),
    );
    expect(manifest.josephTypography?.compositionRules.fillerTreatment).toBe("suppress");
    expect(manifest.josephTypography?.fontPairing.primary.role).toBe("hero");
    expect(manifest.josephTypography?.fontPairing.primary.fontAssetUrl).toBe("/fonts/retrieved/Satoshi-Bold.otf");
    expect(manifest.josephTypography?.fontPairing.secondary?.role).toBe("support");
    expect(manifest.josephTypography?.fontPairing.secondary?.fontAssetUrl).toBe("/fonts/retrieved/Canela-Regular.ttf");
    expect(manifest.josephTypography?.roleStyles.find((style) => style.role === "hero")?.trackingEm).toBeLessThan(0);
    expect(manifest.josephTypography?.roleStyles.find((style) => style.role === "support")?.trackingEm).toBeGreaterThan(0);    expect(manifest.josephTypography?.qualityAudit.score).toBeGreaterThan(0.9);
  });
});

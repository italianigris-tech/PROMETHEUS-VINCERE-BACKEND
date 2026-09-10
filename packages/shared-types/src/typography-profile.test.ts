import { describe, expect, it } from "vitest";
import {
  TypographyProfileV2Schema,
  TypographyAnchorSchema,
  TypographyFillStyleSchema,
  TypographyMaterialitySchema,
  TypographyAnnotationSchema,
  type TypographyProfileV2,
} from "./typography-profile.js";
import {
  JosephTypographySchema,
  UnifiedRenderManifestSchema,
} from "./unified-render-manifest.js";

describe("TypographyProfileV2Schema and JosephTypography integration", () => {
  const minimalValidProfile: TypographyProfileV2 = {
    version: "typography-profile-v2",
    profileId: "cranial_gold_monumental",
    name: "Cranial Gold Monumental",
    category: "cinematic",
    aspectCompatible: ["9:16"],
    layers: [
      {
        role: "hero",
        fontFamily: "Teko",
        fontWeight: 700,
        fontStyle: "normal",
        casing: "uppercase",
        letterSpacingEm: 0.05,
        lineHeightMultiplier: 1.0,
        relativeScale: 1.0,
        zIndex: 10,
        behindSubject: false,
      },
    ],
    annotations: [],
  };

  const richFullProfile: TypographyProfileV2 = {
    version: "typography-profile-v2",
    profileId: "champagne_gold_editorial_v2",
    name: "Champagne Gold Editorial V2",
    category: "luxury",
    aspectCompatible: ["9:16", "16:9"],
    layers: [
      {
        role: "hero",
        fontFamily: "Cinzel",
        fontAssetUrl: "/fonts/hero/cinzel-bold.otf",
        fallbackFamily: "serif",
        fontWeight: 800,
        fontStyle: "normal",
        casing: "uppercase",
        relativeScale: 1.0,
        letterSpacingEm: 0.08,
        lineHeightMultiplier: 1.1,
        anchor: {
          horizontal: "center",
          vertical: "center",
          offsetXPercent: 0,
          offsetYPercent: -5,
          placementZone: "center",
          relativeTo: "canvas",
        },
        stagger: {
          dxPercent: 2,
          dyPercent: 4,
          rotationDeg: -1.5,
          scaleMultiplier: 1.02,
        },
        fill: {
          type: "linear_gradient",
          angleDeg: 135,
          stops: [
            { color: "#F7E7CE", offset: 0 },
            { color: "#E5C158", offset: 0.5 },
            { color: "#B8860B", offset: 1.0 },
          ],
        },
        stroke: {
          enabled: true,
          color: "#2C220E",
          widthPx: 1.5,
          align: "outside",
        },
        materiality: {
          dropShadow: {
            color: "rgba(0,0,0,0.85)",
            blurPx: 14,
            offsetX: 0,
            offsetY: 6,
            opacity: 0.9,
          },
          bevel: {
            enabled: true,
            highlightColor: "rgba(255, 245, 200, 0.8)",
            shadowColor: "rgba(40, 30, 10, 0.9)",
            angleDeg: 135,
            depthPx: 2.5,
            softnessPx: 1.0,
          },
          glow: {
            enabled: true,
            color: "#FFDF73",
            blurPx: 20,
            spreadPx: 2,
            intensity: 0.75,
            inner: false,
          },
          opacity: 1,
          blendMode: "normal",
        },
        zIndex: 15,
        behindSubject: false,
      },
      {
        role: "subordinate",
        fontFamily: "Outfit",
        fontAssetUrl: "/fonts/support/outfit-medium.woff2",
        fallbackFamily: "sans-serif",
        fontWeight: 500,
        fontStyle: "normal",
        casing: "title",
        relativeScale: 0.38,
        letterSpacingEm: 0.15,
        lineHeightMultiplier: 1.3,
        anchor: {
          horizontal: "left",
          vertical: "top",
          offsetXPercent: 2,
          offsetYPercent: -8,
          placementZone: "top_left",
          relativeTo: "first_letter",
        },
        fill: {
          type: "solid",
          color: "#EAEAEA",
        },
        stroke: {
          enabled: false,
          color: "#000000",
          widthPx: 0,
          align: "outside",
        },
        materiality: {
          dropShadow: {
            color: "rgba(0,0,0,0.6)",
            blurPx: 6,
            offsetX: 0,
            offsetY: 2,
            opacity: 0.7,
          },
          opacity: 0.95,
          blendMode: "normal",
        },
        zIndex: 12,
        behindSubject: false,
      },
    ],
    annotations: [
      {
        type: "highlight_box",
        target: "keyword",
        targetKeyword: "INNOVATION",
        color: "#D4AF37",
        fillColor: "rgba(212, 175, 55, 0.25)",
        strokeWidthPx: 2,
        animation: "draw",
        timing: {
          delayFrames: 10,
          durationFrames: 25,
        },
      },
    ],
    frameTreatment: {
      letterbox: {
        enabled: true,
        aspect: "2.39:1",
        color: "#050505",
      },
      grain: {
        opacity: 0.05,
      },
      vignette: {
        intensity: 0.2,
        color: "#000000",
      },
    },
    metadata: {
      designer: "Studio Prometheus",
      curatedFor: "Champagne Gold Hook Sequence",
    },
  };

  it("parses minimal valid typography profile v2 successfully", () => {
    const result = TypographyProfileV2Schema.safeParse(minimalValidProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profileId).toBe("cranial_gold_monumental");
      expect(result.data.version).toBe("typography-profile-v2");
      expect(result.data.category).toBe("cinematic");
      expect(result.data.layers).toHaveLength(1);
    }
  });

  it("parses rich full typography profile v2 with all visual treatments", () => {
    const result = TypographyProfileV2Schema.safeParse(richFullProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layers).toHaveLength(2);
      expect(result.data.layers[0].fill?.type).toBe("linear_gradient");
      expect(result.data.layers[0].fill?.stops).toHaveLength(3);
      expect(result.data.layers[0].materiality?.bevel?.enabled).toBe(true);
      expect(result.data.layers[1].anchor?.relativeTo).toBe("first_letter");
      expect(result.data.annotations).toHaveLength(1);
      expect(result.data.annotations[0].type).toBe("highlight_box");
      expect(result.data.frameTreatment?.letterbox?.enabled).toBe(true);
    }
  });

  it("rejects invalid gradient stop offsets > 1", () => {
    const invalidProfile = {
      ...minimalValidProfile,
      layers: [
        {
          ...minimalValidProfile.layers[0],
          fill: {
            type: "linear_gradient",
            stops: [{ color: "#FFF", offset: 1.5 }],
          },
        },
      ],
    };
    const result = TypographyProfileV2Schema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  it("rejects negative stroke widths", () => {
    const invalidProfile = {
      ...minimalValidProfile,
      layers: [
        {
          ...minimalValidProfile.layers[0],
          stroke: {
            enabled: true,
            color: "#000",
            widthPx: -2,
            align: "outside" as const,
          },
        },
      ],
    };
    const result = TypographyProfileV2Schema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  it("maintains backward compatibility for JosephTypographySchema without profile", () => {
    const legacyTypography = {
      fontFamily: "Outfit",
      fontAssetUrl: "/fonts/outfit.woff2",
      fallbackFamily: "sans-serif",
      fontId: "font_outfit_123",
    };
    const result = JosephTypographySchema.safeParse(legacyTypography);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile).toBeUndefined();
    }
  });

  it("accepts profile inside JosephTypographySchema", () => {
    const extendedTypography = {
      fontFamily: "Outfit",
      fontAssetUrl: "/fonts/outfit.woff2",
      fallbackFamily: "sans-serif",
      fontId: "font_outfit_123",
      profile: richFullProfile,
    };
    const result = JosephTypographySchema.safeParse(extendedTypography);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile?.profileId).toBe("champagne_gold_editorial_v2");
    }
  });

  it("parses UnifiedRenderManifest containing JosephTypography with profile", () => {
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
      typography: {
        fontFamily: "Outfit",
        fontAssetUrl: "/fonts/outfit.woff2",
        fallbackFamily: "sans-serif",
        fontId: "font_outfit_123",
        profile: richFullProfile,
      },
    };

    const parsed = UnifiedRenderManifestSchema.parse(baseManifest);
    expect(parsed.typography?.profile?.name).toBe("Champagne Gold Editorial V2");
    expect(parsed.typography?.profile?.layers[0].materiality?.glow?.enabled).toBe(true);
  });
});

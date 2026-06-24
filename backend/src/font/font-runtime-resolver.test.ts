import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {selectHeroFonts} from "./font-runtime-resolver";

describe("selectHeroFonts", () => {
  const createHeroManifest = () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prometheus-hero-fonts-"));
    const aggressivePath = path.join(dir, "bold.otf");
    const cinematicPath = path.join(dir, "editorial.otf");
    const minimalPath = path.join(dir, "neutral.otf");
    const fallbackPath = path.join(dir, "fallback.otf");
    writeFileSync(aggressivePath, "font-bytes");
    writeFileSync(cinematicPath, "font-bytes");
    writeFileSync(minimalPath, "font-bytes");
    writeFileSync(fallbackPath, "font-bytes");
    const manifestPath = path.join(dir, "hero-fonts.json");
    writeFileSync(manifestPath, JSON.stringify({
      fonts: [
        {
          fontId: "hero-bold",
          family: "Hero Bold",
          cssFamily: "PrometheusHeroBold",
          publicUrl: "/fonts/hero/bold.otf",
          localFilePath: aggressivePath,
          profileAffinity: ["aggressive"],
          roleTags: ["hero", "bold", "kinetic"],
          readabilityScore: 0.65,
          expressivenessScore: 0.95,
          licenseStatus: "render_safe",
          reviewOnly: false,
        },
        {
          fontId: "hero-editorial",
          family: "Hero Editorial",
          cssFamily: "PrometheusHeroEditorial",
          publicUrl: "/fonts/hero/editorial.otf",
          localFilePath: cinematicPath,
          profileAffinity: ["cinematic"],
          roleTags: ["hero", "editorial", "premium"],
          readabilityScore: 0.82,
          expressivenessScore: 0.72,
          licenseStatus: "render_safe",
          reviewOnly: false,
        },
        {
          fontId: "hero-neutral",
          family: "Hero Neutral",
          cssFamily: "PrometheusHeroNeutral",
          publicUrl: "/fonts/hero/neutral.otf",
          localFilePath: minimalPath,
          profileAffinity: ["minimal"],
          roleTags: ["support", "neutral", "clean"],
          readabilityScore: 0.96,
          expressivenessScore: 0.35,
          licenseStatus: "render_safe",
          reviewOnly: false,
        },
        {
          fontId: "hero-fallback",
          family: "Hero Fallback",
          cssFamily: "PrometheusHeroFallback",
          publicUrl: "/fonts/hero/fallback.otf",
          localFilePath: fallbackPath,
          profileAffinity: ["minimal", "cinematic", "aggressive"],
          roleTags: ["fallback", "readable"],
          readabilityScore: 1,
          expressivenessScore: 0.2,
          licenseStatus: "render_safe",
          reviewOnly: false,
        },
      ],
    }));

    return manifestPath;
  };

  it("selects deterministic profile-aware hero/support/fallback fonts", () => {
    const heroManifestPath = createHeroManifest();

    const first = selectHeroFonts({profile: "joseph_aggressive", heroManifestPath}, 12345);
    const second = selectHeroFonts({profile: "joseph_aggressive", heroManifestPath}, 12345);
    const cinematic = selectHeroFonts({profile: "joseph_cinematic", heroManifestPath}, 12345);

    expect(first).toEqual(second);
    expect(first.hero.fontId).toBe("hero-bold");
    expect(cinematic.hero.fontId).toBe("hero-editorial");
    expect(first.hero.fontAssetUrl).toBe("/fonts/hero/bold.otf");
    expect(first.fallback.fallbackFamily).toContain("sans-serif");
  });

  it("falls back and records a warning when a selected hero file is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prometheus-hero-fonts-missing-"));
    const fallbackPath = path.join(dir, "fallback.otf");
    writeFileSync(fallbackPath, "font-bytes");
    const manifestPath = path.join(dir, "hero-fonts.json");
    writeFileSync(manifestPath, JSON.stringify({
      fonts: [
        {
          fontId: "missing-bold",
          family: "Missing Bold",
          cssFamily: "MissingBold",
          publicUrl: "/fonts/hero/missing.otf",
          localFilePath: path.join(dir, "missing.otf"),
          profileAffinity: ["aggressive"],
          roleTags: ["hero", "bold"],
          readabilityScore: 0.7,
          expressivenessScore: 0.95,
          licenseStatus: "render_safe",
          reviewOnly: false,
        },
        {
          fontId: "hero-fallback",
          family: "Hero Fallback",
          cssFamily: "PrometheusHeroFallback",
          publicUrl: "/fonts/hero/fallback.otf",
          localFilePath: fallbackPath,
          profileAffinity: ["minimal", "cinematic", "aggressive"],
          roleTags: ["fallback", "readable"],
          readabilityScore: 1,
          expressivenessScore: 0.2,
          licenseStatus: "render_safe",
          reviewOnly: false,
        },
      ],
    }));

    const selection = selectHeroFonts({profile: "aggressive", heroManifestPath: manifestPath}, 1);

    expect(selection.hero.fontId).toBe("hero-fallback");
    expect(selection.warnings.some((warning) => warning.includes("missing"))).toBe(true);
  });

  it("resolves the checked-in hero MVP manifest by default", () => {
    const selection = selectHeroFonts({profile: "joseph_minimal"}, 2026);

    expect(selection.hero.fontAssetUrl).toMatch(/^\/fonts\/hero\/.+\.otf$/);
    expect(selection.fallback.fontFamily).toContain("PrometheusHero");
    expect(selection.warnings).toEqual([]);
  });
  it("can prefer hydrated renderable library fonts over the hero MVP set", () => {
    const heroManifestPath = createHeroManifest();
    const dir = mkdtempSync(path.join(tmpdir(), "prometheus-library-fonts-"));
    const libraryFontPath = path.join(dir, "library-display.woff2");
    writeFileSync(libraryFontPath, "font-bytes");
    const libraryManifestPath = path.join(dir, "font-manifest-urls.json");
    writeFileSync(libraryManifestPath, JSON.stringify([
      {
        fontId: "font-library-display",
        familyName: "Library Display",
        publicUrl: "/fonts/library/library-display/library-display.woff2",
        localPublicPath: libraryFontPath,
        format: "woff2",
        renderable: true,
        needsManualLicenseReview: false,
        license: {
          licenseTexts: ["SIL Open Font License"],
        },
      },
    ]));

    const selection = selectHeroFonts({
      profile: "joseph_cinematic",
      heroManifestPath,
      libraryManifestPath,
      preferHydratedLibrary: true,
    }, 12345);

    expect(selection.hero.fontId).toBe("font-library-display");
    expect(selection.hero.fontAssetUrl).toBe("/fonts/library/library-display/library-display.woff2");
    expect(selection.hero.fontFamily).toBe("PrometheusLibraryLibraryDisplay");
    expect(selection.hero.localFilePath).toBe(libraryFontPath);
  });
});
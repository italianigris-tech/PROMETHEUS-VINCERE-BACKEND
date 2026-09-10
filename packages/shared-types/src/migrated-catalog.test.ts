import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { TypographyProfileV2Schema } from "./typography-profile.js";

describe("Migrated TypographyProfileV2 Catalog Validation", () => {
  it("validates all 97 migrated profiles against TypographyProfileV2Schema", () => {
    const catalogPath = path.resolve(__dirname, "../../../mini_run_pipeline/typography_profiles_v2_catalog.json");
    expect(fs.existsSync(catalogPath)).toBe(true);

    const raw = fs.readFileSync(catalogPath, "utf-8");
    const catalog = JSON.parse(raw);

    expect(catalog.version).toBe("typography-profile-v2-catalog-1.0");
    expect(catalog.totalProfiles).toBeGreaterThanOrEqual(80);
    expect(catalog.profiles.length).toBe(catalog.totalProfiles);

    let goudyCorrectedCount = 0;
    let partialHeadClipCount = 0;
    let cranialPlacementCount = 0;

    for (const profile of catalog.profiles) {
      const parseResult = TypographyProfileV2Schema.safeParse(profile);
      if (!parseResult.success) {
        console.error("Profile validation failed:", profile.profileId, parseResult.error.format());
      }
      expect(parseResult.success).toBe(true);

      if (profile.subjectZone?.cranialPlacementBand === "cranial_halo" || profile.subjectZone?.cranialPlacementBand === "supra_cranial") {
        cranialPlacementCount++;
      }

      for (const layer of profile.layers) {
        if (layer.occlusion?.mode === "partial_head_clip") {
          partialHeadClipCount++;
        }
        for (const cand of layer.candidates || []) {
          if (cand.goudyCorrectionApplied) {
            goudyCorrectedCount++;
          }
        }
      }
    }

    expect(cranialPlacementCount).toBeGreaterThan(0);
    expect(partialHeadClipCount).toBeGreaterThan(0);
    expect(goudyCorrectedCount).toBeGreaterThan(0);
  });
});

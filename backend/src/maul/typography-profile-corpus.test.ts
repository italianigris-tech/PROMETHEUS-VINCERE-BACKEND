import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {
  countTypographyCharacters,
  loadTypographyProfileCorpus,
  rankTypographyProfiles,
} from "./typography-profile-corpus.js";

describe("MAUL typography profile corpus", () => {
  it("loads all 44 observed profiles with internally consistent counts", () => {
    const profiles = loadTypographyProfileCorpus();

    expect(profiles).toHaveLength(44);
    for (const profile of profiles) {
      expect(profile.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(profile.metadata.perWordCharacterCounts).toHaveLength(
        profile.metadata.totalWordCount,
      );
      expect(
        profile.metadata.perWordCharacterCounts.reduce(
          (total, word) => total + word.characterCount,
          0,
        ),
      ).toBe(profile.metadata.totalCharacterCount);
      expect(
        profile.layers.reduce((total, layer) => total + layer.wordCount, 0),
      ).toBe(profile.metadata.totalWordCount);
      expect(
        profile.layers.reduce(
          (total, layer) => total + layer.characterCount,
          0,
        ),
      ).toBe(profile.metadata.totalCharacterCount);
    }
  });

  it("counts Unicode code points while excluding whitespace", () => {
    expect(countTypographyCharacters("brain power! ")).toBe(11);
    expect(countTypographyCharacters("go \ud83e\udde0 now")).toBe(6);
  });

  it("ranks exact count matches deterministically before aspect preference", () => {
    const profiles = loadTypographyProfileCorpus();
    const exact = profiles.find(
      (profile) =>
        profile.metadata.totalWordCount === 3 &&
        profile.metadata.totalCharacterCount === 16,
    );
    expect(exact).toBeDefined();
    const portraitClone = {
      ...exact!,
      profileName: `${exact!.profileName}_PortraitClone`,
      sourceFilename: "portrait-clone.json",
      sourceSha256: "f".repeat(64),
      metadata: {...exact!.metadata, targetAspectRatio: "9:16" as const},
    };

    const ranked = rankTypographyProfiles({
      profiles: [...profiles, portraitClone],
      chunk: {
        wordCount: 3,
        characterCount: 16,
        semanticRole: "hook",
        emphasisLevel: "hero",
      },
      targetAspectRatio: "9:16",
    });

    expect(ranked[0]).toMatchObject({
      profile: {sourceFilename: "portrait-clone.json"},
      wordDistance: 0,
      characterDistance: 0,
    });
    expect(
      rankTypographyProfiles({
        profiles: [...profiles, portraitClone],
        chunk: {
          wordCount: 3,
          characterCount: 16,
          semanticRole: "hook",
          emphasisLevel: "hero",
        },
        targetAspectRatio: "9:16",
      }).map((candidate) => candidate.profile.sourceSha256),
    ).toEqual(ranked.map((candidate) => candidate.profile.sourceSha256));
  });

  it("prefers exact word-count profiles and breaks perfect ties by recent reuse", () => {
    const profiles = loadTypographyProfileCorpus();
    const base = profiles.find(
      (profile) =>
        profile.metadata.totalWordCount === 5 &&
        profile.metadata.totalCharacterCount === 20,
    );
    expect(base).toBeDefined();
    const clone = {
      ...base!,
      profileName: `${base!.profileName}_Clone`,
      sourceFilename: "zz-reuse-clone.json",
      sourceSha256: "e".repeat(64),
    };
    const ranked = rankTypographyProfiles({
      profiles: [...profiles, clone],
      chunk: {
        wordCount: 5,
        characterCount: 20,
        semanticRole: "claim",
        emphasisLevel: "hero",
      },
      targetAspectRatio: "9:16",
      recentlyUsedProfileNames: [base!.profileName],
    });
    expect(ranked[0]!.wordDistance).toBe(0);
    expect(ranked[0]?.profile.sourceFilename).toBe("zz-reuse-clone.json");
    expect(
      ranked.find((candidate) => candidate.profile.profileName === base!.profileName)
        ?.recentProfileReusePenalty,
    ).toBe(1);
  });

  it("keeps a profile capped after an alternate breaks its consecutive run", () => {
    const profiles = loadTypographyProfileCorpus();
    const base = profiles.find(
      (profile) =>
        profile.metadata.totalWordCount === 4 &&
        profile.metadata.totalCharacterCount === 24,
    );
    expect(base).toBeDefined();
    const alternate = {
      ...base!,
      profileName: `${base!.profileName}_Alternate`,
      sourceFilename: "zz-rotation-alternate.json",
      sourceSha256: "e".repeat(64),
    };

    const ranked = rankTypographyProfiles({
      profiles: [base!, alternate],
      chunk: {
        wordCount: 4,
        characterCount: 24,
        semanticRole: "claim",
        emphasisLevel: "key",
      },
      targetAspectRatio: "9:16",
      recentlyUsedProfileNames: [
        base!.profileName,
        base!.profileName,
        alternate.profileName,
      ],
    });

    expect(ranked[0]?.profile.profileName).toBe(alternate.profileName);
    expect(ranked.find((candidate) => candidate.profile.profileName === base!.profileName)
      ?.recentProfileReusePenalty).toBeGreaterThanOrEqual(10_000);
  });

  it("prefers an unused primary font family between equivalent profiles", () => {
    const source = loadTypographyProfileCorpus().find(
      (profile) => profile.metadata.totalWordCount === 4,
    );
    expect(source).toBeDefined();
    const withFamily = (
      profileName: string,
      sourceFilename: string,
      sourceSha256: string,
      family: string,
    ) => ({
      ...structuredClone(source!),
      profileName,
      sourceFilename,
      sourceSha256,
      layers: source!.layers.map((layer) => ({
        ...structuredClone(layer),
        matchedFontCandidates: [family],
      })),
    });
    const usedFamily = withFamily(
      "Used_Playfair_Profile",
      "aa-used-family.json",
      "a".repeat(64),
      "Playfair Display",
    );
    const freshFamily = withFamily(
      "Fresh_Montserrat_Profile",
      "zz-fresh-family.json",
      "f".repeat(64),
      "Montserrat",
    );

    const ranked = rankTypographyProfiles({
      profiles: [usedFamily, freshFamily],
      chunk: {
        wordCount: source!.metadata.totalWordCount,
        characterCount: source!.metadata.totalCharacterCount,
        semanticRole: "claim",
        emphasisLevel: "key",
      },
      targetAspectRatio: "9:16",
      recentlyUsedPrimaryFontFamilies: ["playfairdisplay"],
    });

    expect(ranked[0]?.profile.profileName).toBe("Fresh_Montserrat_Profile");
  });

  it("never trades exact word compatibility for profile diversity", () => {
    const exact = loadTypographyProfileCorpus().find(
      (profile) =>
        profile.metadata.totalWordCount === 4 &&
        profile.metadata.totalCharacterCount === 24,
    );
    expect(exact).toBeDefined();
    const incompatible = {
      ...structuredClone(exact!),
      profileName: "Unused_Incompatible_Profile",
      sourceFilename: "zz-unused-incompatible.json",
      sourceSha256: "f".repeat(64),
      metadata: {
        ...structuredClone(exact!.metadata),
        totalWordCount: 3,
      },
    };

    const ranked = rankTypographyProfiles({
      profiles: [exact!, incompatible],
      chunk: {
        wordCount: 4,
        characterCount: 24,
        semanticRole: "claim",
        emphasisLevel: "key",
      },
      targetAspectRatio: "9:16",
      recentlyUsedProfileNames: [exact!.profileName, exact!.profileName],
    });

    expect(ranked[0]?.profile.profileName).toBe(exact!.profileName);
  });

  it("adapts the nearest JSON grammar when a fast-paced chunk exceeds corpus word counts", () => {
    const ranked = rankTypographyProfiles({
      profiles: loadTypographyProfileCorpus(),
      chunk: {
        wordCount: 8,
        characterCount: 39,
        semanticRole: "claim",
        emphasisLevel: "hero",
      },
      targetAspectRatio: "9:16",
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]!.wordDistance).toBe(1);
    expect(
      Math.abs(ranked[0]!.profile.metadata.totalWordCount - 8),
    ).toBe(1);
  });

  it("uses extracted expressiveness to break close character-count matches", () => {
    const profiles = loadTypographyProfileCorpus();
    const fiveWordRanked = rankTypographyProfiles({
      profiles,
      chunk: {
        wordCount: 5,
        characterCount: 23,
        semanticRole: "claim",
        emphasisLevel: "hero",
      },
      targetAspectRatio: "9:16",
    });
    const fourWordRanked = rankTypographyProfiles({
      profiles,
      chunk: {
        wordCount: 4,
        characterCount: 18,
        semanticRole: "proof",
        emphasisLevel: "key",
      },
      targetAspectRatio: "9:16",
    });

    expect(fiveWordRanked[0]?.profile.profileName).toBe(
      "Old_Money_Script_Serif_Overlapping",
    );
    expect(fourWordRanked[0]?.profile.profileName).toBe(
      "Want_This_Premium_Fonts_3D_Blue",
    );
    expect(fiveWordRanked[0]?.characterDistance).toBeLessThanOrEqual(2);
    expect(fourWordRanked[0]?.characterDistance).toBeLessThanOrEqual(2);
  });

  it("rejects a profile whose declared character counts disagree", () => {
    const corpusDir = mkdtempSync(path.join(tmpdir(), "maul-typography-corpus-"));
    try {
      writeFileSync(
        path.join(corpusDir, "invalid.json"),
        JSON.stringify({
          profile_name: "Invalid_Count_Profile",
          version: "1.0.0",
          metadata: {
            target_aspect_ratio: "9:16",
            overall_mood: "Editorial",
            casing_strategy: "mixed",
            total_word_count: 1,
            total_character_count: 99,
            per_word_character_counts: [{word: "Proof", character_count: 5}],
          },
          layout_rules: {
            horizontal_alignment: "center",
            vertical_position: "center",
            bottom_margin_percent: 15,
            max_width_percent: 85,
            scrim_overlay: {
              enabled: false,
              type: "none",
              opacity: 0,
              color: "#000000",
            },
          },
          typography_layers: [
            {
              layer_name: "hero",
              role: "header",
              font_classification: "Display Serif",
              matched_font_candidates: ["Playfair Display"],
              font_style: {
                weight: 700,
                style: "normal",
                casing: "normal",
                color: "#111111",
                size_px_base: 48,
                relative_scale: 1,
                letter_spacing_em: 0,
                line_height: 1.1,
                vertical_margin_top_px: 0,
              },
              effects: {
                drop_shadow: {
                  x_offset: 0,
                  y_offset: 1,
                  blur_radius: 2,
                  color: "rgba(0,0,0,0.1)",
                },
              },
              sample_text: "Proof",
              word_count: 1,
              character_count: 5,
              per_word_character_counts: [{word: "Proof", character_count: 5}],
            },
          ],
        }),
      );

      expect(() => loadTypographyProfileCorpus({corpusDir})).toThrow(
        /invalid\.json.*total_character_count/i,
      );
    } finally {
      rmSync(corpusDir, {recursive: true, force: true});
    }
  });
});

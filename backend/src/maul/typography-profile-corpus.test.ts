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

  it("only ranks exact word-count profiles and breaks perfect ties by recent reuse", () => {
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
    expect(ranked.every((candidate) => candidate.wordDistance === 0)).toBe(true);
    expect(ranked[0]?.profile.sourceFilename).toBe("zz-reuse-clone.json");
    expect(
      ranked.find((candidate) => candidate.profile.profileName === base!.profileName)
        ?.recentProfileReusePenalty,
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

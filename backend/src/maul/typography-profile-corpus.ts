import {createHash} from "node:crypto";
import {existsSync, readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {z} from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultCorpusDir = path.resolve(
  currentDir,
  "../../../Yuan Prometheus Screenshots/font JSON",
);

const wordCharacterCountSchema = z
  .object({
    word: z.string().min(1),
    character_count: z.number().int().nonnegative(),
  })
  .strict();

const fontStyleSchema = z
  .object({
    weight: z.number().int().min(1).max(1000),
    style: z.enum(["normal", "italic", "oblique"]),
    casing: z.enum(["normal", "lowercase", "uppercase", "title_case"]),
    color: z.string().trim().min(1),
    size_px_base: z.number().positive(),
    relative_scale: z.number().positive(),
    letter_spacing_em: z.number().finite(),
    line_height: z.number().positive(),
    vertical_margin_top_px: z.number().finite(),
  })
  .strict();

const dropShadowSchema = z
  .object({
    x_offset: z.number().finite(),
    y_offset: z.number().finite(),
    blur_radius: z.number().nonnegative(),
    color: z.string().trim().min(1),
  })
  .strict();

const rawTypographyLayerSchema = z
  .object({
    layer_name: z.string().trim().min(1),
    role: z.enum([
      "accent_tagline",
      "context_prefix",
      "header",
      "primary_focus_word",
      "secondary_clause",
    ]),
    font_classification: z.string().trim().min(1),
    matched_font_candidates: z.array(z.string().trim().min(1)).min(1),
    font_style: fontStyleSchema,
    effects: z.object({drop_shadow: dropShadowSchema}).strict(),
    sample_text: z.string().trim().min(1),
    word_count: z.number().int().positive(),
    character_count: z.number().int().positive(),
    per_word_character_counts: z.array(wordCharacterCountSchema).min(1),
  })
  .strict();

const rawTypographyProfileSchema = z
  .object({
    profile_name: z.string().trim().min(1),
    version: z.string().trim().min(1),
    metadata: z
      .object({
        target_aspect_ratio: z.enum(["16:9", "9:16"]),
        overall_mood: z.string().trim().min(1),
        casing_strategy: z.enum(["mixed", "lowercase_all", "uppercase_all"]),
        total_word_count: z.number().int().positive(),
        total_character_count: z.number().int().positive(),
        per_word_character_counts: z.array(wordCharacterCountSchema).min(1),
      })
      .strict(),
    layout_rules: z
      .object({
        horizontal_alignment: z.enum(["left", "center", "right"]),
        vertical_position: z.enum(["top", "center", "bottom"]),
        bottom_margin_percent: z.number().min(0).max(100),
        max_width_percent: z.number().positive().max(100),
        scrim_overlay: z
          .object({
            enabled: z.boolean(),
            type: z.enum(["none", "radial_vignette", "linear_gradient"]),
            opacity: z.number().min(0).max(1),
            color: z.string().trim().min(1),
          })
          .strict(),
      })
      .strict(),
    typography_layers: z.array(rawTypographyLayerSchema).min(1),
  })
  .strict();

export type TypographyProfileLayer = {
  layerName: string;
  role: z.infer<typeof rawTypographyLayerSchema>["role"];
  fontClassification: string;
  matchedFontCandidates: readonly string[];
  fontStyle: {
    weight: number;
    style: "normal" | "italic" | "oblique";
    casing: "normal" | "lowercase" | "uppercase" | "title_case";
    color: string;
    sizePxBase: number;
    relativeScale: number;
    letterSpacingEm: number;
    lineHeight: number;
    verticalMarginTopPx: number;
  };
  effects: {
    dropShadow: {
      xOffset: number;
      yOffset: number;
      blurRadius: number;
      color: string;
    };
  };
  sampleText: string;
  wordCount: number;
  characterCount: number;
  perWordCharacterCounts: readonly {word: string; characterCount: number}[];
};

export type TypographyProfileObservation = {
  profileName: string;
  version: string;
  sourceFilename: string;
  sourceSha256: string;
  metadata: {
    targetAspectRatio: "16:9" | "9:16";
    overallMood: string;
    casingStrategy: "mixed" | "lowercase_all" | "uppercase_all";
    totalWordCount: number;
    totalCharacterCount: number;
    perWordCharacterCounts: readonly {word: string; characterCount: number}[];
  };
  layoutRules: {
    horizontalAlignment: "left" | "center" | "right";
    verticalPosition: "top" | "center" | "bottom";
    bottomMarginPercent: number;
    maxWidthPercent: number;
    scrimOverlay: {
      enabled: boolean;
      type: "none" | "radial_vignette" | "linear_gradient";
      opacity: number;
      color: string;
    };
  };
  layers: readonly TypographyProfileLayer[];
};

export type RankedTypographyProfile = {
  profile: TypographyProfileObservation;
  wordDistance: number;
  characterDistance: number;
  aspectPenalty: number;
  semanticScore: number;
  expressivenessScore: number;
  recentProfileReusePenalty: number;
};

let cachedDefaultCorpus: readonly TypographyProfileObservation[] | null = null;

export const countTypographyCharacters = (text: string): number =>
  [...text].filter((character) => !/\s/u.test(character)).length;

const countObservedSampleCharacters = (text: string): number =>
  countTypographyCharacters(
    text.trim().replace(/^["'“”‘’«»]|["'“”‘’«»]$/gu, ""),
  );

const validateDeclaredCounts = (
  filename: string,
  raw: z.infer<typeof rawTypographyProfileSchema>,
): void => {
  const metadataWords = raw.metadata.per_word_character_counts;
  if (metadataWords.length !== raw.metadata.total_word_count) {
    throw new Error(
      `${filename}: metadata total_word_count does not match per_word_character_counts.`,
    );
  }
  const metadataCharacterCount = metadataWords.reduce(
    (total, word) => total + word.character_count,
    0,
  );
  if (metadataCharacterCount !== raw.metadata.total_character_count) {
    throw new Error(
      `${filename}: metadata total_character_count does not match per_word_character_counts.`,
    );
  }
  for (const word of metadataWords) {
    if (countTypographyCharacters(word.word) !== word.character_count) {
      throw new Error(
        `${filename}: metadata character count is incorrect for ${word.word}.`,
      );
    }
  }

  let layerWordCount = 0;
  let layerCharacterCount = 0;
  for (const layer of raw.typography_layers) {
    layerWordCount += layer.word_count;
    layerCharacterCount += layer.character_count;
    if (layer.per_word_character_counts.length !== layer.word_count) {
      throw new Error(
        `${filename}: layer ${layer.layer_name} word_count does not match per_word_character_counts.`,
      );
    }
    const declaredLayerCharacters = layer.per_word_character_counts.reduce(
      (total, word) => total + word.character_count,
      0,
    );
    for (const word of layer.per_word_character_counts) {
      if (countTypographyCharacters(word.word) !== word.character_count) {
        throw new Error(
          `${filename}: layer ${layer.layer_name} character count is incorrect for ${word.word}.`,
        );
      }
    }
    if (
      declaredLayerCharacters !== layer.character_count ||
      countObservedSampleCharacters(layer.sample_text) !== layer.character_count
    ) {
      throw new Error(
        `${filename}: layer ${layer.layer_name} character_count is inconsistent.`,
      );
    }
  }
  if (
    layerWordCount !== raw.metadata.total_word_count ||
    layerCharacterCount !== raw.metadata.total_character_count
  ) {
    throw new Error(
      `${filename}: typography layer counts do not match profile metadata totals.`,
    );
  }
};

const normalizeProfile = ({
  filename,
  bytes,
}: {
  filename: string;
  bytes: Buffer;
}): TypographyProfileObservation => {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(
      `${filename}: invalid typography profile JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const result = rawTypographyProfileSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `${filename}: invalid typography profile: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  const raw = result.data;
  validateDeclaredCounts(filename, raw);
  return {
    profileName: raw.profile_name,
    version: raw.version,
    sourceFilename: filename,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    metadata: {
      targetAspectRatio: raw.metadata.target_aspect_ratio,
      overallMood: raw.metadata.overall_mood,
      casingStrategy: raw.metadata.casing_strategy,
      totalWordCount: raw.metadata.total_word_count,
      totalCharacterCount: raw.metadata.total_character_count,
      perWordCharacterCounts: raw.metadata.per_word_character_counts.map(
        (word) => ({word: word.word, characterCount: word.character_count}),
      ),
    },
    layoutRules: {
      horizontalAlignment: raw.layout_rules.horizontal_alignment,
      verticalPosition: raw.layout_rules.vertical_position,
      bottomMarginPercent: raw.layout_rules.bottom_margin_percent,
      maxWidthPercent: raw.layout_rules.max_width_percent,
      scrimOverlay: {
        enabled: raw.layout_rules.scrim_overlay.enabled,
        type: raw.layout_rules.scrim_overlay.type,
        opacity: raw.layout_rules.scrim_overlay.opacity,
        color: raw.layout_rules.scrim_overlay.color,
      },
    },
    layers: raw.typography_layers.map((layer) => ({
      layerName: layer.layer_name,
      role: layer.role,
      fontClassification: layer.font_classification,
      matchedFontCandidates: [...layer.matched_font_candidates],
      fontStyle: {
        weight: layer.font_style.weight,
        style: layer.font_style.style,
        casing: layer.font_style.casing,
        color: layer.font_style.color,
        sizePxBase: layer.font_style.size_px_base,
        relativeScale: layer.font_style.relative_scale,
        letterSpacingEm: layer.font_style.letter_spacing_em,
        lineHeight: layer.font_style.line_height,
        verticalMarginTopPx: layer.font_style.vertical_margin_top_px,
      },
      effects: {
        dropShadow: {
          xOffset: layer.effects.drop_shadow.x_offset,
          yOffset: layer.effects.drop_shadow.y_offset,
          blurRadius: layer.effects.drop_shadow.blur_radius,
          color: layer.effects.drop_shadow.color,
        },
      },
      sampleText: layer.sample_text,
      wordCount: layer.word_count,
      characterCount: layer.character_count,
      perWordCharacterCounts: layer.per_word_character_counts.map((word) => ({
        word: word.word,
        characterCount: word.character_count,
      })),
    })),
  };
};

export const loadTypographyProfileCorpus = ({
  corpusDir = defaultCorpusDir,
}: {
  corpusDir?: string;
} = {}): readonly TypographyProfileObservation[] => {
  if (corpusDir === defaultCorpusDir && cachedDefaultCorpus) {
    return cachedDefaultCorpus;
  }
  if (!existsSync(corpusDir)) {
    throw new Error(`MAUL typography profile corpus is unavailable: ${corpusDir}`);
  }
  const profiles = readdirSync(corpusDir)
    .filter((filename) => filename.endsWith(".json"))
    .sort()
    .map((filename) =>
      normalizeProfile({
        filename,
        bytes: readFileSync(path.join(corpusDir, filename)),
      }),
    );
  if (profiles.length === 0) {
    throw new Error(`MAUL typography profile corpus is empty: ${corpusDir}`);
  }
  const profileNames = profiles.map((profile) => profile.profileName);
  if (new Set(profileNames).size !== profileNames.length) {
    throw new Error("MAUL typography profile names must be unique.");
  }
  const sourceHashes = profiles.map((profile) => profile.sourceSha256);
  if (new Set(sourceHashes).size !== sourceHashes.length) {
    throw new Error("MAUL typography profile source identities must be unique.");
  }
  if (corpusDir === defaultCorpusDir) {
    cachedDefaultCorpus = profiles;
  }
  return profiles;
};

const semanticScore = (
  profile: TypographyProfileObservation,
  semanticRole: string,
  emphasisLevel: "support" | "key" | "hero",
): number => {
  const roles = new Set(profile.layers.map((layer) => layer.role));
  const dominantSemanticRole = new Set(["hook", "claim", "contrast", "payoff", "cta"])
    .has(semanticRole);
  return (
    (dominantSemanticRole && roles.has("primary_focus_word") ? 2 : 0) +
    (!dominantSemanticRole &&
    (roles.has("context_prefix") || roles.has("secondary_clause"))
      ? 1
      : 0) +
    (emphasisLevel === "hero" && roles.has("header") ? 1 : 0) +
    (emphasisLevel === "support" && !roles.has("primary_focus_word") ? 1 : 0)
  );
};

const normalizedColor = (color: string): string =>
  color.trim().toLocaleLowerCase();

const normalizedFontFamily = (family: string): string =>
  family.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "");

const profileExpressivenessScore = (
  profile: TypographyProfileObservation,
): number => {
  const colors = new Set(
    profile.layers.map((layer) => normalizedColor(layer.fontStyle.color)),
  );
  const styles = new Set(
    profile.layers.map((layer) => layer.fontStyle.style),
  );
  const roles = new Set(profile.layers.map((layer) => layer.role));
  const families = new Set(
    profile.layers.flatMap((layer) =>
      layer.matchedFontCandidates.map(normalizedFontFamily),
    ),
  );
  const scales = profile.layers.map((layer) => layer.fontStyle.relativeScale);
  const scaleSpread = Math.max(...scales) - Math.min(...scales);
  const negativeMargins = profile.layers.filter(
    (layer) => layer.fontStyle.verticalMarginTopPx < 0,
  ).length;

  return (
    Math.max(0, colors.size - 1) * 3 +
    Math.max(0, styles.size - 1) * 2 +
    Math.max(0, roles.size - 1) +
    Math.max(0, families.size - 1) * 0.25 +
    Math.min(2, profile.layers.length - 1) * 1.5 +
    Math.min(2, scaleSpread * 4) +
    Math.min(2, negativeMargins)
  );
};

const CHARACTER_DISTANCE_TOLERANCE = 2;

export const rankTypographyProfiles = ({
  profiles,
  chunk,
  targetAspectRatio,
  recentlyUsedProfileNames = [],
}: {
  profiles: readonly TypographyProfileObservation[];
  chunk: {
    wordCount: number;
    characterCount: number;
    semanticRole: string;
    emphasisLevel: "support" | "key" | "hero";
  };
  targetAspectRatio: "9:16";
  recentlyUsedProfileNames?: readonly string[];
}): RankedTypographyProfile[] => {
  const candidates = profiles.map((profile) => ({
      profile,
      wordDistance: Math.abs(
        chunk.wordCount - profile.metadata.totalWordCount,
      ),
      characterDistance: Math.abs(
        chunk.characterCount - profile.metadata.totalCharacterCount,
      ),
      aspectPenalty:
        profile.metadata.targetAspectRatio === targetAspectRatio ? 0 : 1,
      semanticScore: semanticScore(
        profile,
        chunk.semanticRole,
        chunk.emphasisLevel,
      ),
      expressivenessScore: profileExpressivenessScore(profile),
      recentProfileReusePenalty: (() => {
        let consecutiveUses = 0;
        for (let index = recentlyUsedProfileNames.length - 1; index >= 0; index -= 1) {
          if (recentlyUsedProfileNames[index] !== profile.profileName) break;
          consecutiveUses += 1;
        }
        return consecutiveUses >= 2 ? 10_000 : consecutiveUses;
      })(),
    }));
  if (candidates.length === 0) return [];
  const minimumCharacterDistance = Math.min(
    ...candidates.map((candidate) => candidate.characterDistance),
  );
  const maximumCloseCharacterDistance =
    minimumCharacterDistance + CHARACTER_DISTANCE_TOLERANCE;
  return candidates.sort(
    (left, right) =>
      left.recentProfileReusePenalty - right.recentProfileReusePenalty ||
      left.wordDistance - right.wordDistance ||
      left.aspectPenalty - right.aspectPenalty ||
      Number(left.characterDistance > maximumCloseCharacterDistance) -
        Number(right.characterDistance > maximumCloseCharacterDistance) ||
      right.semanticScore - left.semanticScore ||
      right.expressivenessScore - left.expressivenessScore ||
      left.characterDistance - right.characterDistance ||
      left.profile.sourceFilename.localeCompare(right.profile.sourceFilename) ||
      left.profile.sourceSha256.localeCompare(right.profile.sourceSha256),
  );
};

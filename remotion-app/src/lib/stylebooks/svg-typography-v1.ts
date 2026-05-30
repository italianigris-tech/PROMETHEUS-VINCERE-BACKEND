import type {CaptionLayoutVariant, CaptionStyleProfileId, ChunkIntent} from "../types";

export const SVG_TYPOGRAPHY_PROFILE_ID: CaptionStyleProfileId = "svg_typography_v1";
export const SVG_TYPOGRAPHY_DISPLAY_NAME = "SVG Typography v1";
export const LONGFORM_SVG_TYPOGRAPHY_PROFILE_ID: CaptionStyleProfileId = "longform_svg_typography_v1";
export const LONGFORM_SVG_TYPOGRAPHY_DISPLAY_NAME = "Long-form SVG Typography v1";
export const LONGFORM_EVE_TYPOGRAPHY_PROFILE_ID: CaptionStyleProfileId = "longform_eve_typography_v1";
export const LONGFORM_EVE_TYPOGRAPHY_DISPLAY_NAME = "EVE Typography Engine v1";
export const SVG_TYPOGRAPHY_LAYOUT_VARIANT: CaptionLayoutVariant = "inline";
export const SVG_TYPOGRAPHY_STYLE_PREFIX = "svg_typography_v1:";
export const SVG_TYPOGRAPHY_MOTION_PREFIX = "svg_typography_v1:";

export type SvgTypographySlotSchema =
  | "primary"
  | "script+primary"
  | "script+primary+secondary"
  | "script_1+script_2+script_3+primary";

export type SvgTypographySlotDefinition = {
  key: string;
  required: boolean;
};

export type SvgTypographyVariant = {
  id: string;
  sourcePresetId: string;
  sourceVariant: string;
  legacyOptIn?: boolean;
  label?: string;
  category?: string;
  triggerType?: "timeline" | "word-level" | "syllable-level" | Array<"timeline" | "word-level" | "syllable-level">;
  compatibleWith?: string[];
  layeringRules?: Array<{
    id: string;
    channel: "base" | "accent" | "overlay" | "mask" | "host";
    zIndex: number;
    order?: number;
    blendMode?: string;
    note?: string;
  }>;
  graphTags?: string[];
  aliases?: string[];
  slotSchema: SvgTypographySlotSchema;
  slotDefinitions: SvgTypographySlotDefinition[];
  sourceSlotDefinitions: SvgTypographySlotDefinition[];
  animationType: string[];
  effects: string[];
  timingProfile: {
    entry_seconds: number;
    total_seconds: number;
  };
  easingProfile: string[];
  fontProfile: Record<string, {family: string; role: string}>;
  transformRules: Record<string, string[]>;
  recommendedCharRange: Record<string, {min: number; max: number}>;
  compatibility: {
    intents: ChunkIntent[];
    tags: string[];
  };
};

export type SvgVariantSelectionState = {
  totalSelected: number;
  blurHeavyCount: number;
  familyUsage: Record<string, number>;
  variantUsage: Record<string, number>;
  recentVariantIds: string[];
  recentFamilyIds: string[];
};

export type SvgVariantWordBucket = "one-word" | "two-word" | "three-word" | "four-word";
export type SvgMotionProfile = "clean" | "sweep-heavy" | "impact" | "blur-heavy" | "typing" | "stagger" | "stacked";
export type SvgExitProfile = "fade-soft" | "fade-late" | "integrated-sweep" | "integrated-stroke" | "typing-cursor";
export type SvgVariantSelectionPreferences = {
  allowLegacyVariants?: boolean;
  preferredMotionProfiles?: SvgMotionProfile[];
  disfavoredMotionProfiles?: SvgMotionProfile[];
  forbiddenMotionProfiles?: SvgMotionProfile[];
  preferredExitProfiles?: SvgExitProfile[];
  disfavoredExitProfiles?: SvgExitProfile[];
  forbiddenExitProfiles?: SvgExitProfile[];
};

const svgVariant = (variant: SvgTypographyVariant): SvgTypographyVariant => variant;
const SVG_VARIANT_RECENT_WINDOW = 4;
const SVG_TYPING_MAX_USES = 1;
const SVG_BLUR_HEAVY_MAX_RATIO = 0.24;
const SVG_WIPE_REVEAL_MAX_RATIO = 0.16;
const SVG_WIPE_REVEAL_MAX_USES = 2;
const SVG_FAMILY_RATIO_LIMITS: Partial<Record<string, number>> = {
  "blur-heavy": SVG_BLUR_HEAVY_MAX_RATIO,
  "wipe-reveal": SVG_WIPE_REVEAL_MAX_RATIO
};

export const svgTypographyVariantsV1: SvgTypographyVariant[] = [
  svgVariant({
    id: "cinematic_text_preset",
    sourcePresetId: "cinematic-text-preset",
    sourceVariant: "single-word-chromatic",
    slotSchema: "primary",
    slotDefinitions: [{key: "primary", required: true}],
    sourceSlotDefinitions: [{key: "primary", required: true}],
    animationType: ["fade-in", "sweep-line", "chromatic-burst"],
    effects: ["glow", "sweep-line", "ghost-channels"],
    timingProfile: {entry_seconds: 1.2, total_seconds: 2.2},
    easingProfile: ["power3.out", "power4.inOut", "back.out(3)"],
    fontProfile: {
      primary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"]},
    recommendedCharRange: {primary: {min: 2, max: 18}},
    compatibility: {
      intents: ["default", "punch-emphasis"],
      tags: ["cinematic", "hud", "bold"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_1",
    sourcePresetId: "cinematic-text-preset-1",
    sourceVariant: "single-word-char-stagger",
    slotSchema: "primary",
    slotDefinitions: [{key: "primary", required: true}],
    sourceSlotDefinitions: [{key: "primary", required: true}],
    animationType: ["char-stagger", "blur-dissolve"],
    effects: ["per-char-blur", "final-glow"],
    timingProfile: {entry_seconds: 1.1, total_seconds: 2.2},
    easingProfile: ["power3.out"],
    fontProfile: {
      primary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"]},
    recommendedCharRange: {primary: {min: 2, max: 24}},
    compatibility: {
      intents: ["default"],
      tags: ["cinematic", "clean", "stagger"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_2",
    sourcePresetId: "cinematic-text-preset-2",
    sourceVariant: "script-plus-bold",
    slotSchema: "script+primary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true}
    ],
    animationType: ["script-slide", "bold-char-stagger"],
    effects: ["script-blur", "per-char-blur", "final-glow"],
    timingProfile: {entry_seconds: 1.1, total_seconds: 2.4},
    easingProfile: ["power3.out"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 3, max: 18},
      primary: {min: 4, max: 24}
    },
    compatibility: {
      intents: ["default", "name-callout", "punch-emphasis"],
      tags: ["cinematic", "script", "bold"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_3",
    sourcePresetId: "cinematic-text-preset-3",
    sourceVariant: "slit-reveal-script-plus-bold",
    legacyOptIn: true,
    slotSchema: "script+primary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true}
    ],
    animationType: ["beam-sweep", "stroke-write-on"],
    effects: ["beam-sweep", "line-extend", "glow"],
    timingProfile: {entry_seconds: 0.9, total_seconds: 2.7},
    easingProfile: ["power3.out", "power2.inOut", "power4.inOut"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 3, max: 18},
      primary: {min: 4, max: 22}
    },
    compatibility: {
      intents: ["default", "punch-emphasis"],
      tags: ["cinematic", "slit", "beam"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_4",
    sourcePresetId: "cinematic-text-preset-4",
    sourceVariant: "script-left-right-wipe",
    legacyOptIn: true,
    slotSchema: "script+primary+secondary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    animationType: ["script-drift", "dual-wipe", "rule-draw"],
    effects: ["side-wipe", "light-sweep", "glow"],
    timingProfile: {entry_seconds: 0.9, total_seconds: 1.5},
    easingProfile: ["power3.out", "power4.inOut"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Bebas Neue', sans-serif", role: "display"},
      secondary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"], secondary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 2, max: 12},
      primary: {min: 2, max: 14},
      secondary: {min: 3, max: 16}
    },
    compatibility: {
      intents: ["default", "name-callout"],
      tags: ["cinematic", "wipe", "duality"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_5",
    sourcePresetId: "cinematic-text-preset-5",
    sourceVariant: "script-impact-split",
    legacyOptIn: true,
    slotSchema: "script+primary+secondary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    animationType: ["split-impact", "dual-word-entry", "impact-camera-shake"],
    effects: ["rebound", "impact-flash", "light-sweep", "chromatic-aberration", "impact-camera-shake", "blur-sweep"],
    timingProfile: {entry_seconds: 0.85, total_seconds: 1.6},
    easingProfile: ["expo.inOut", "expo.out", "back.out(2.5)", "cubic.luxurySnap"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Bebas Neue', sans-serif", role: "display"},
      secondary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"], secondary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 2, max: 12},
      primary: {min: 2, max: 14},
      secondary: {min: 3, max: 16}
    },
    compatibility: {
      intents: ["default", "punch-emphasis"],
      tags: ["impact", "split", "cinematic"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_6",
    sourcePresetId: "cinematic-text-preset-6",
    sourceVariant: "char-drop-pair",
    slotSchema: "script+primary+secondary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    animationType: ["char-drop", "script-float"],
    effects: ["per-char-split", "soft-glow"],
    timingProfile: {entry_seconds: 1, total_seconds: 2.1},
    easingProfile: ["power4.out", "power3.out"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Bebas Neue', sans-serif", role: "display"},
      secondary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"], secondary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 2, max: 12},
      primary: {min: 2, max: 16},
      secondary: {min: 3, max: 18}
    },
    compatibility: {
      intents: ["default", "name-callout"],
      tags: ["drop-in", "split-words", "cinematic"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_7",
    sourcePresetId: "cinematic-text-preset-7",
    sourceVariant: "script-big-small-blur",
    slotSchema: "script+primary+secondary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    animationType: ["script-drift", "big-char-drop", "small-rise", "primary-luxury-hit"],
    effects: ["per-char-blur", "dual-accent-blur", "final-glow", "layered-glow", "delicate-script-glow", "blur-sweep"],
    timingProfile: {entry_seconds: 1, total_seconds: 2.4},
    easingProfile: ["expo.out", "back.out(2.2)", "cubic.blurSweep"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Playfair Display', serif", role: "display"},
      secondary: {family: "'Bebas Neue', sans-serif", role: "support"}
    },
    transformRules: {primary: ["toUpperCase"], secondary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 3, max: 12},
      primary: {min: 3, max: 24},
      secondary: {min: 3, max: 14}
    },
    compatibility: {
      intents: ["default", "name-callout"],
      tags: ["cinematic", "triple-hierarchy", "blur"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_8",
    sourcePresetId: "cinematic-text-preset-8",
    sourceVariant: "script-big-small-elastic",
    slotSchema: "script+primary+secondary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    animationType: ["script-pop", "big-char-elastic", "small-pop"],
    effects: ["spring-scale", "group-bounce", "final-glow"],
    timingProfile: {entry_seconds: 0.65, total_seconds: 2},
    easingProfile: ["back.out(1.8)", "back.out(2.5)", "power2.out"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Playfair Display', serif", role: "display"},
      secondary: {family: "'Bebas Neue', sans-serif", role: "support"}
    },
    transformRules: {primary: ["toUpperCase"], secondary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 3, max: 12},
      primary: {min: 3, max: 24},
      secondary: {min: 3, max: 14}
    },
    compatibility: {
      intents: ["default", "punch-emphasis"],
      tags: ["elastic", "cinematic", "hierarchy"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_9",
    sourcePresetId: "cinematic-text-preset-9",
    sourceVariant: "script-plus-fog-word",
    slotSchema: "script+primary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true}
    ],
    animationType: ["script-breathe", "char-fog-reveal"],
    effects: ["per-char-blur", "collective-breathe", "glow"],
    timingProfile: {entry_seconds: 1.1, total_seconds: 2.6},
    easingProfile: ["power3.out", "power2.out", "power1.inOut"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Playfair Display', serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"]},
    recommendedCharRange: {
      script: {min: 2, max: 10},
      primary: {min: 4, max: 26}
    },
    compatibility: {
      intents: ["default", "name-callout"],
      tags: ["fog", "cinematic", "slow-breathe"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_10",
    sourcePresetId: "cinematic-text-preset-10",
    sourceVariant: "triple-script-plus-bold",
    slotSchema: "script_1+script_2+script_3+primary",
    slotDefinitions: [
      {key: "script_1", required: true},
      {key: "script_2", required: true},
      {key: "script_3", required: true},
      {key: "primary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "script_1", required: true},
      {key: "script_2", required: true},
      {key: "script_3", required: true},
      {key: "primary", required: true}
    ],
    animationType: ["triple-script-stagger", "bold-char-reveal"],
    effects: ["multi-blur", "dual-glow", "micro-breathe"],
    timingProfile: {entry_seconds: 1.1, total_seconds: 2.8},
    easingProfile: ["power3.out", "power2.out"],
    fontProfile: {
      script: {family: "'Great Vibes', cursive", role: "accent"},
      primary: {family: "'Bebas Neue', sans-serif", role: "display"}
    },
    transformRules: {primary: ["toUpperCase"]},
    recommendedCharRange: {
      script_1: {min: 1, max: 10},
      script_2: {min: 1, max: 10},
      script_3: {min: 2, max: 12},
      primary: {min: 3, max: 24}
    },
    compatibility: {
      intents: ["default", "punch-emphasis"],
      tags: ["multi-slot", "cinematic", "stacked"]
    }
  }),
  svgVariant({
    id: "cinematic_text_preset_11",
    sourcePresetId: "cinematic-text-preset-11",
    sourceVariant: "typing-name-cursor",
    slotSchema: "script+primary+secondary",
    slotDefinitions: [
      {key: "script", required: true},
      {key: "primary", required: true},
      {key: "secondary", required: true}
    ],
    sourceSlotDefinitions: [
      {key: "primary", required: true},
      {key: "secondary", required: true},
      {key: "tertiary", required: true}
    ],
    animationType: ["cursor-sweep", "typed-reveal"],
    effects: ["blink-cursor", "left-right-rebuild"],
    timingProfile: {entry_seconds: 0.9, total_seconds: 3.2},
    easingProfile: ["power2.inOut", "power3.inOut"],
    fontProfile: {
      primary: {family: "'DM Sans', sans-serif", role: "strong"},
      secondary: {family: "'DM Serif Display', serif", role: "accent"},
      tertiary: {family: "'DM Sans', sans-serif", role: "strong"}
    },
    transformRules: {},
    recommendedCharRange: {
      primary: {min: 2, max: 12},
      secondary: {min: 2, max: 10},
      tertiary: {min: 3, max: 24}
    },
    compatibility: {
      intents: ["default", "name-callout"],
      tags: ["typing", "editorial", "cursor"]
    }
  })
];

if (svgTypographyVariantsV1.length !== 12) {
  throw new Error(`SVG typography stylebook is expected to contain 12 variants, found ${svgTypographyVariantsV1.length}.`);
}

const SVG_VARIANTS_BY_ID = new Map(svgTypographyVariantsV1.map((variant) => [variant.id, variant]));

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const isSvgSlotSchema = (value: string): value is SvgTypographySlotSchema => {
  return (
    value === "primary" ||
    value === "script+primary" ||
    value === "script+primary+secondary" ||
    value === "script_1+script_2+script_3+primary"
  );
};

export const SVG_SLOT_SCHEMA_FALLBACK_ORDER: SvgTypographySlotSchema[] = [
  "script_1+script_2+script_3+primary",
  "script+primary+secondary",
  "script+primary",
  "primary"
];

export const getSvgTypographyVariant = (variantId: string): SvgTypographyVariant | null => {
  return SVG_VARIANTS_BY_ID.get(variantId) ?? null;
};

export const createSvgVariantSelectionState = (): SvgVariantSelectionState => ({
  totalSelected: 0,
  blurHeavyCount: 0,
  familyUsage: {},
  variantUsage: {},
  recentVariantIds: [],
  recentFamilyIds: []
});

export const toSvgTypographyStyleKey = (variantId: string): string => {
  return `${SVG_TYPOGRAPHY_STYLE_PREFIX}${variantId}`;
};

export const toSvgTypographyMotionKey = (variantId: string): string => {
  return `${SVG_TYPOGRAPHY_MOTION_PREFIX}${variantId}`;
};

export const isSvgTypographyStyleKey = (styleKey: string): boolean => {
  return styleKey.startsWith(SVG_TYPOGRAPHY_STYLE_PREFIX);
};

export const getSvgTypographyVariantIdFromStyleKey = (styleKey: string): string | null => {
  if (!isSvgTypographyStyleKey(styleKey)) {
    return null;
  }
  const variantId = styleKey.slice(SVG_TYPOGRAPHY_STYLE_PREFIX.length).trim();
  return variantId.length > 0 ? variantId : null;
};

export const getSvgTypographyVariantFromStyleKey = (styleKey: string): SvgTypographyVariant | null => {
  const variantId = getSvgTypographyVariantIdFromStyleKey(styleKey);
  if (!variantId) {
    return null;
  }
  return getSvgTypographyVariant(variantId);
};

export const getSvgSlotSchemaForWordCount = (wordCount: number): SvgTypographySlotSchema => {
  if (wordCount <= 1) {
    return "primary";
  }
  if (wordCount === 2) {
    return "script+primary";
  }
  if (wordCount === 3) {
    return "script+primary+secondary";
  }
  return "script_1+script_2+script_3+primary";
};

export const getSvgSlotKeysForSchema = (slotSchema: SvgTypographySlotSchema): string[] => {
  if (slotSchema === "primary") {
    return ["primary"];
  }
  if (slotSchema === "script+primary") {
    return ["script", "primary"];
  }
  if (slotSchema === "script+primary+secondary") {
    return ["script", "primary", "secondary"];
  }
  return ["script_1", "script_2", "script_3", "primary"];
};

export const mapWordsToSvgSlots = (
  words: string[],
  slotSchema: SvgTypographySlotSchema
): Record<string, string> => {
  const cleanWords = words.map((word) => word.trim()).filter(Boolean);

  if (slotSchema === "primary") {
    return {primary: cleanWords.join(" ")};
  }

  if (slotSchema === "script+primary") {
    if (cleanWords.length <= 1) {
      const value = cleanWords[0] ?? "";
      return {script: value, primary: value};
    }
    return {
      script: cleanWords[0],
      primary: cleanWords.slice(1).join(" ")
    };
  }

  if (slotSchema === "script+primary+secondary") {
    if (cleanWords.length <= 1) {
      const value = cleanWords[0] ?? "";
      return {script: value, primary: value, secondary: value};
    }
    if (cleanWords.length === 2) {
      return {
        script: cleanWords[0],
        primary: cleanWords[1],
        secondary: cleanWords[1]
      };
    }
    return {
      script: cleanWords[0],
      primary: cleanWords[1],
      secondary: cleanWords.slice(2).join(" ")
    };
  }

  const script1 = cleanWords[0] ?? "";
  const script2 = cleanWords[1] ?? script1;
  const script3 = cleanWords[2] ?? script2;
  const primary = cleanWords.slice(3).join(" ") || cleanWords[3] || cleanWords[cleanWords.length - 1] || script3;
  return {
    script_1: script1,
    script_2: script2,
    script_3: script3,
    primary
  };
};

export const getSvgVariantsForSlotSchema = (slotSchema: SvgTypographySlotSchema): SvgTypographyVariant[] => {
  return svgTypographyVariantsV1.filter((variant) => variant.slotSchema === slotSchema);
};

export const isBlurHeavySvgTypographyVariant = (variant: SvgTypographyVariant): boolean => {
  return (
    variant.effects.some((effect) => effect.includes("blur")) ||
    variant.animationType.some((animation) => animation.includes("blur") || animation.includes("fog")) ||
    variant.compatibility.tags.some((tag) => tag.includes("blur") || tag.includes("fog"))
  );
};

export const getSvgTypographyVariantFamily = (variant: SvgTypographyVariant): string => {
  const explicitFamily = ({
    cinematic_text_preset: "cinematic-default",
    cinematic_text_preset_1: "stagger-drop",
    cinematic_text_preset_2: "cinematic-default",
    cinematic_text_preset_3: "wipe-reveal",
    cinematic_text_preset_4: "wipe-reveal",
    cinematic_text_preset_5: "impact-pop",
    cinematic_text_preset_6: "stagger-drop",
    cinematic_text_preset_7: "blur-heavy",
    cinematic_text_preset_8: "impact-pop",
    cinematic_text_preset_9: "blur-heavy",
    cinematic_text_preset_10: "stacked-script",
    cinematic_text_preset_11: "typing"
  } as const)[variant.id];
  if (explicitFamily) {
    return explicitFamily;
  }
  if (variant.compatibility.tags.includes("typing") || variant.effects.includes("blink-cursor")) {
    return "typing";
  }
  if (isBlurHeavySvgTypographyVariant(variant)) {
    return "blur-heavy";
  }
  if (variant.animationType.some((animation) => animation.includes("wipe") || animation.includes("slit"))) {
    return "wipe-reveal";
  }
  if (variant.animationType.some((animation) => animation.includes("impact") || animation.includes("elastic"))) {
    return "impact-pop";
  }
  if (variant.animationType.some((animation) => animation.includes("drop") || animation.includes("stagger"))) {
    return "stagger-drop";
  }
  if (variant.compatibility.tags.includes("stacked")) {
    return "stacked-script";
  }
  return "cinematic-default";
};

const isSweepDominantSvgTypographyVariant = (variant: SvgTypographyVariant): boolean => {
  const sweepPattern = /(sweep|wipe|slit|clip-reveal|beam)/i;
  return (
    variant.animationType.some((animation) => sweepPattern.test(animation)) ||
    variant.effects.some((effect) => sweepPattern.test(effect))
  );
};

export const getSvgVariantWordBucket = (variant: SvgTypographyVariant): SvgVariantWordBucket => {
  const slotCount = getSvgSlotKeysForSchema(variant.slotSchema).length;
  if (slotCount <= 1) {
    return "one-word";
  }
  if (slotCount === 2) {
    return "two-word";
  }
  if (slotCount === 3) {
    return "three-word";
  }
  return "four-word";
};

export const getSvgVariantMotionProfile = (variant: SvgTypographyVariant): SvgMotionProfile => {
  const explicitMotionProfile = ({
    cinematic_text_preset: "clean",
    cinematic_text_preset_1: "stagger",
    cinematic_text_preset_2: "clean",
    cinematic_text_preset_3: "sweep-heavy",
    cinematic_text_preset_4: "sweep-heavy",
    cinematic_text_preset_5: "impact",
    cinematic_text_preset_6: "stagger",
    cinematic_text_preset_7: "blur-heavy",
    cinematic_text_preset_8: "impact",
    cinematic_text_preset_9: "blur-heavy",
    cinematic_text_preset_10: "stacked",
    cinematic_text_preset_11: "typing"
  } as const)[variant.id];

  return explicitMotionProfile ?? "clean";
};

export const getSvgVariantExitProfile = (variant: SvgTypographyVariant): SvgExitProfile => {
  const explicitExitProfile = ({
    cinematic_text_preset: "fade-late",
    cinematic_text_preset_1: "fade-soft",
    cinematic_text_preset_2: "fade-soft",
    cinematic_text_preset_3: "integrated-stroke",
    cinematic_text_preset_4: "integrated-sweep",
    cinematic_text_preset_5: "integrated-sweep",
    cinematic_text_preset_6: "fade-soft",
    cinematic_text_preset_7: "fade-soft",
    cinematic_text_preset_8: "fade-soft",
    cinematic_text_preset_9: "fade-soft",
    cinematic_text_preset_10: "fade-late",
    cinematic_text_preset_11: "typing-cursor"
  } as const)[variant.id];

  return explicitExitProfile ?? "fade-soft";
};

export const getSvgVariantCatalogByWordBucket = (): Record<SvgVariantWordBucket, SvgTypographyVariant[]> => {
  return svgTypographyVariantsV1.reduce<Record<SvgVariantWordBucket, SvgTypographyVariant[]>>((catalog, variant) => {
    const bucket = getSvgVariantWordBucket(variant);
    catalog[bucket].push(variant);
    return catalog;
  }, {
    "one-word": [],
    "two-word": [],
    "three-word": [],
    "four-word": []
  });
};

export const isSvgVariantLegacyOptIn = (variant: SvgTypographyVariant): boolean => {
  return variant.legacyOptIn === true;
};

const getVariantRangeKeyForSlot = (variant: SvgTypographyVariant, slotKey: string): string => {
  if (variant.recommendedCharRange[slotKey]) {
    return slotKey;
  }
  const normalizedSlotKeys = getSvgSlotKeysForSchema(variant.slotSchema);
  const slotIndex = normalizedSlotKeys.indexOf(slotKey);
  if (slotIndex < 0) {
    return slotKey;
  }
  const sourceKey = variant.sourceSlotDefinitions[slotIndex]?.key;
  return sourceKey ?? slotKey;
};

const getVariantCharRangePenalty = (
  variant: SvgTypographyVariant,
  slotValues: Record<string, string>
): number => {
  const slotKeys = getSvgSlotKeysForSchema(variant.slotSchema);
  let penalty = 0;

  slotKeys.forEach((slotKey) => {
    const rangeKey = getVariantRangeKeyForSlot(variant, slotKey);
    const range = variant.recommendedCharRange[rangeKey] ?? variant.recommendedCharRange[slotKey];
    if (!range) {
      return;
    }
    const value = (slotValues[slotKey] ?? "").replace(/\s+/g, "");
    const count = value.length;
    if (count < range.min) {
      penalty += range.min - count;
      return;
    }
    if (count > range.max) {
      penalty += count - range.max;
    }
  });

  return penalty;
};

const getCharCompatibleVariants = (
  variants: SvgTypographyVariant[],
  slotValues: Record<string, string>
): SvgTypographyVariant[] => {
  if (variants.length === 0) {
    return variants;
  }

  const scored = variants.map((variant) => ({
    variant,
    penalty: getVariantCharRangePenalty(variant, slotValues)
  }));

  const strictCompatible = scored.filter((entry) => entry.penalty === 0).map((entry) => entry.variant);
  if (strictCompatible.length > 0) {
    return strictCompatible;
  }

  const minPenalty = Math.min(...scored.map((entry) => entry.penalty));
  return scored.filter((entry) => entry.penalty === minPenalty).map((entry) => entry.variant);
};

const getSvgVariantPenalty = (
  variant: SvgTypographyVariant,
  selectionState: SvgVariantSelectionState | undefined
): number => {
  if (!selectionState) {
    return 0;
  }

  const family = getSvgTypographyVariantFamily(variant);
  const isBlurHeavy = isBlurHeavySvgTypographyVariant(variant);
  const variantUses = selectionState.variantUsage[variant.id] ?? 0;
  const familyUses = selectionState.familyUsage[family] ?? 0;
  const projectedTotal = selectionState.totalSelected + 1;
  const projectedBlurRatio = isBlurHeavy
    ? (selectionState.blurHeavyCount + 1) / projectedTotal
    : selectionState.blurHeavyCount / projectedTotal;
  const projectedFamilyRatio = (familyUses + 1) / projectedTotal;
  const familyRatioLimit = SVG_FAMILY_RATIO_LIMITS[family];
  const recentBlurHeavy = selectionState.recentVariantIds.slice(0, 2).some((variantId) => {
    const recentVariant = getSvgTypographyVariant(variantId);
    return recentVariant ? isBlurHeavySvgTypographyVariant(recentVariant) : false;
  });
  const recentSweepCount = selectionState.recentVariantIds
    .slice(0, 2)
    .reduce((count, variantId) => {
      const recentVariant = getSvgTypographyVariant(variantId);
      return count + (recentVariant && isSweepDominantSvgTypographyVariant(recentVariant) ? 1 : 0);
    }, 0);
  const isSweepDominant = isSweepDominantSvgTypographyVariant(variant);

  let penalty = variantUses * 14 + familyUses * 6;

  if (selectionState.recentVariantIds[0] === variant.id) {
    penalty += 140;
  } else if (selectionState.recentVariantIds.slice(0, 2).includes(variant.id)) {
    penalty += 70;
  }

  if (selectionState.recentFamilyIds[0] === family) {
    penalty += family === "blur-heavy" ? 90 : 36;
  }
  if (selectionState.recentFamilyIds[0] === family && selectionState.recentFamilyIds[1] === family) {
    penalty += family === "blur-heavy" ? 180 : 72;
  }

  if (family === "typing" && familyUses >= SVG_TYPING_MAX_USES) {
    penalty += 280;
  }

  if (family === "wipe-reveal" && familyUses >= SVG_WIPE_REVEAL_MAX_USES) {
    penalty += 420;
  }

  if (family === "wipe-reveal" && selectionState.recentFamilyIds[0] === "wipe-reveal") {
    penalty += 110;
  }

  if (isSweepDominant && recentSweepCount > 0) {
    penalty += recentSweepCount * 90;
  }

  if (familyRatioLimit !== undefined && projectedFamilyRatio > familyRatioLimit) {
    penalty += 120 + Math.round((projectedFamilyRatio - familyRatioLimit) * 900);
  }

  if (isBlurHeavy) {
    if (recentBlurHeavy) {
      penalty += 220;
    }
    if (projectedBlurRatio > SVG_BLUR_HEAVY_MAX_RATIO) {
      penalty += 100 + Math.round((projectedBlurRatio - SVG_BLUR_HEAVY_MAX_RATIO) * 700);
    }
  }

  return penalty;
};

const getSvgVariantPreferencePenalty = (
  variant: SvgTypographyVariant,
  preferences: SvgVariantSelectionPreferences | undefined
): number => {
  if (!preferences) {
    return 0;
  }

  const motionProfile = getSvgVariantMotionProfile(variant);
  const exitProfile = getSvgVariantExitProfile(variant);
  let penalty = 0;

  if (preferences.preferredMotionProfiles && preferences.preferredMotionProfiles.length > 0) {
    const index = preferences.preferredMotionProfiles.indexOf(motionProfile);
    penalty += index >= 0 ? index * 10 : 42;
  }
  if (preferences.disfavoredMotionProfiles?.includes(motionProfile)) {
    penalty += 160;
  }
  if (preferences.preferredExitProfiles && preferences.preferredExitProfiles.length > 0) {
    const index = preferences.preferredExitProfiles.indexOf(exitProfile);
    penalty += index >= 0 ? index * 6 : 18;
  }
  if (preferences.disfavoredExitProfiles?.includes(exitProfile)) {
    penalty += 72;
  }

  return penalty;
};

const filterSvgVariantEntriesByPreferences = (
  entries: SvgVariantCandidateEntry[],
  preferences: SvgVariantSelectionPreferences | undefined
): SvgVariantCandidateEntry[] => {
  if (!preferences) {
    return entries;
  }

  let pool = [...entries];

  if (preferences.allowLegacyVariants !== true) {
    const nonLegacy = pool.filter((entry) => !isSvgVariantLegacyOptIn(entry.variant));
    if (nonLegacy.length > 0) {
      pool = nonLegacy;
    }
  }

  if (preferences.forbiddenMotionProfiles && preferences.forbiddenMotionProfiles.length > 0) {
    const nonForbiddenMotion = pool.filter((entry) => {
      return !preferences.forbiddenMotionProfiles?.includes(getSvgVariantMotionProfile(entry.variant));
    });
    if (nonForbiddenMotion.length > 0) {
      pool = nonForbiddenMotion;
    }
  }

  if (preferences.forbiddenExitProfiles && preferences.forbiddenExitProfiles.length > 0) {
    const nonForbiddenExit = pool.filter((entry) => {
      return !preferences.forbiddenExitProfiles?.includes(getSvgVariantExitProfile(entry.variant));
    });
    if (nonForbiddenExit.length > 0) {
      pool = nonForbiddenExit;
    }
  }

  return pool;
};

const commitSvgVariantSelection = (
  selectionState: SvgVariantSelectionState | undefined,
  variant: SvgTypographyVariant
): void => {
  if (!selectionState) {
    return;
  }

  const family = getSvgTypographyVariantFamily(variant);
  selectionState.totalSelected += 1;
  selectionState.variantUsage[variant.id] = (selectionState.variantUsage[variant.id] ?? 0) + 1;
  selectionState.familyUsage[family] = (selectionState.familyUsage[family] ?? 0) + 1;
  if (isBlurHeavySvgTypographyVariant(variant)) {
    selectionState.blurHeavyCount += 1;
  }

  selectionState.recentVariantIds = [variant.id, ...selectionState.recentVariantIds].slice(0, SVG_VARIANT_RECENT_WINDOW);
  selectionState.recentFamilyIds = [family, ...selectionState.recentFamilyIds].slice(0, SVG_VARIANT_RECENT_WINDOW);
};

type SvgVariantCandidateEntry = {
  variant: SvgTypographyVariant;
  schemaDistance: number;
  charPenalty: number;
};

const getSvgVariantEntriesForSchema = ({
  words,
  schema,
  intent,
  schemaDistance
}: {
  words: string[];
  schema: SvgTypographySlotSchema;
  intent: ChunkIntent;
  schemaDistance: number;
}): SvgVariantCandidateEntry[] => {
  const bySchema = getSvgVariantsForSlotSchema(schema);
  if (bySchema.length === 0) {
    return [];
  }

  const byIntent = bySchema.filter((variant) => variant.compatibility.intents.includes(intent));
  const intentPool = byIntent.length > 0 ? byIntent : bySchema;
  const slotValues = mapWordsToSvgSlots(words, schema);
  return intentPool.map((variant) => ({
    variant,
    schemaDistance,
    charPenalty: getVariantCharRangePenalty(variant, slotValues)
  }));
};

const getSvgVariantCandidateEntriesInternal = ({
  words,
  slotSchema,
  intent
}: {
  words: string[];
  slotSchema: string;
  intent: ChunkIntent;
}): SvgVariantCandidateEntry[] => {
  const availableWordCount = Math.max(1, words.filter(Boolean).length);
  const fallbackSchemas = (isSvgSlotSchema(slotSchema)
    ? [slotSchema, ...SVG_SLOT_SCHEMA_FALLBACK_ORDER.filter((schema) => schema !== slotSchema)]
    : SVG_SLOT_SCHEMA_FALLBACK_ORDER
  ).filter((schema) => getSvgSlotKeysForSchema(schema).length <= availableWordCount);
  const entries: SvgVariantCandidateEntry[] = [];
  const seen = new Set<string>();

  fallbackSchemas.forEach((schema, schemaDistance) => {
    getSvgVariantEntriesForSchema({
      words,
      schema,
      intent,
      schemaDistance
    }).forEach((entry) => {
      const {variant} = entry;
      if (seen.has(variant.id)) {
        return;
      }
      seen.add(variant.id);
      entries.push(entry);
    });
  });

  return entries.length > 0
    ? entries
    : [{variant: svgTypographyVariantsV1[0], schemaDistance: fallbackSchemas.length, charPenalty: 0}];
};

const filterSvgVariantEntries = (
  entries: SvgVariantCandidateEntry[],
  selectionState: SvgVariantSelectionState | undefined
): SvgVariantCandidateEntry[] => {
  if (!selectionState) {
    return entries;
  }

  let pool = [...entries];
  const lastVariantId = selectionState.recentVariantIds[0];
  const lastFamily = selectionState.recentFamilyIds[0];
  const prevFamily = selectionState.recentFamilyIds[1];
  const recentBlurHeavy = selectionState.recentVariantIds.slice(0, 2).some((variantId) => {
    const recentVariant = getSvgTypographyVariant(variantId);
    return recentVariant ? isBlurHeavySvgTypographyVariant(recentVariant) : false;
  });

  const hardCappedNonWipe = pool.filter((entry) => getSvgTypographyVariantFamily(entry.variant) !== "wipe-reveal");
  if ((selectionState.familyUsage["wipe-reveal"] ?? 0) >= SVG_WIPE_REVEAL_MAX_USES && hardCappedNonWipe.length > 0) {
    pool = hardCappedNonWipe;
  }

  const nonTyping = pool.filter((entry) => getSvgTypographyVariantFamily(entry.variant) !== "typing");
  if ((selectionState.familyUsage.typing ?? 0) >= SVG_TYPING_MAX_USES && nonTyping.length > 0) {
    pool = nonTyping;
  }

  const notImmediateRepeat = pool.filter((entry) => entry.variant.id !== lastVariantId);
  if (lastVariantId && notImmediateRepeat.length > 0) {
    pool = notImmediateRepeat;
  }

  const nonBlur = pool.filter((entry) => !isBlurHeavySvgTypographyVariant(entry.variant));
  const blurBudgetExceeded = pool.some((entry) => {
    if (!isBlurHeavySvgTypographyVariant(entry.variant)) {
      return false;
    }
    return (selectionState.blurHeavyCount + 1) / (selectionState.totalSelected + 1) > SVG_BLUR_HEAVY_MAX_RATIO;
  });
  if ((recentBlurHeavy || blurBudgetExceeded) && nonBlur.length > 0) {
    pool = nonBlur;
  }

  const nonWipe = pool.filter((entry) => getSvgTypographyVariantFamily(entry.variant) !== "wipe-reveal");
  const wipeBudgetExceeded = pool.some((entry) => {
    if (getSvgTypographyVariantFamily(entry.variant) !== "wipe-reveal") {
      return false;
    }
    if ((selectionState.familyUsage["wipe-reveal"] ?? 0) >= SVG_WIPE_REVEAL_MAX_USES) {
      return true;
    }
    return ((selectionState.familyUsage["wipe-reveal"] ?? 0) + 1) / (selectionState.totalSelected + 1) > SVG_WIPE_REVEAL_MAX_RATIO;
  });
  if ((lastFamily === "wipe-reveal" || wipeBudgetExceeded) && nonWipe.length > 0) {
    pool = nonWipe;
  }

  const nonSweepDominant = pool.filter((entry) => !isSweepDominantSvgTypographyVariant(entry.variant));
  const recentSweep = selectionState.recentVariantIds
    .slice(0, 2)
    .some((variantId) => {
      const recentVariant = getSvgTypographyVariant(variantId);
      return recentVariant ? isSweepDominantSvgTypographyVariant(recentVariant) : false;
    });
  if (recentSweep && nonSweepDominant.length > 0) {
    pool = nonSweepDominant;
  }

  const differentFamily = pool.filter((entry) => getSvgTypographyVariantFamily(entry.variant) !== lastFamily);
  if (lastFamily && prevFamily === lastFamily && differentFamily.length > 0) {
    pool = differentFamily;
  }

  return pool;
};

const getSvgVariantCandidatesInternal = ({
  words,
  slotSchema,
  intent
}: {
  words: string[];
  slotSchema: string;
  intent: ChunkIntent;
}): SvgTypographyVariant[] => {
  const availableWordCount = Math.max(1, words.filter(Boolean).length);
  if (isSvgSlotSchema(slotSchema) && getSvgSlotKeysForSchema(slotSchema).length === availableWordCount) {
    const exactEntries = getSvgVariantEntriesForSchema({
      words,
      schema: slotSchema,
      intent,
      schemaDistance: 0
    });

    if (exactEntries.length > 0) {
      return exactEntries.map((entry) => entry.variant);
    }
  }

  const fallbackSchemas = (isSvgSlotSchema(slotSchema)
    ? [slotSchema, ...SVG_SLOT_SCHEMA_FALLBACK_ORDER.filter((schema) => schema !== slotSchema)]
    : SVG_SLOT_SCHEMA_FALLBACK_ORDER
  ).filter((schema) => getSvgSlotKeysForSchema(schema).length <= availableWordCount);

  for (const schema of fallbackSchemas) {
    const entries = getSvgVariantEntriesForSchema({
      words,
      schema,
      intent,
      schemaDistance: 0
    });
    if (entries.length > 0) {
      return entries.map((entry) => entry.variant);
    }
  }

  return [svgTypographyVariantsV1[0]];
};

export const getSvgVariantCandidates = ({
  words = [],
  slotSchema,
  intent
}: {
  words?: string[];
  slotSchema: string;
  intent: ChunkIntent;
}): SvgTypographyVariant[] => {
  return getSvgVariantCandidatesInternal({words, slotSchema, intent});
};

export const selectSvgTypographyVariant = ({
  words,
  chunkIndex,
  intent,
  selectionState,
  preferences
}: {
  words: string[];
  chunkIndex: number;
  intent: ChunkIntent;
  selectionState?: SvgVariantSelectionState;
  preferences?: SvgVariantSelectionPreferences;
}): SvgTypographyVariant => {
  const normalizedWords = words.map((word) => word.trim().toLowerCase()).filter(Boolean);
  const slotSchema = getSvgSlotSchemaForWordCount(normalizedWords.length);
  const candidates = filterSvgVariantEntries(
    filterSvgVariantEntriesByPreferences(
      getSvgVariantCandidateEntriesInternal({words: normalizedWords, slotSchema, intent}),
      preferences
    ),
    selectionState
  );
  const exactSchemaCandidates =
    normalizedWords.length >= 3 && isSvgSlotSchema(slotSchema)
      ? candidates.filter((entry) => entry.schemaDistance === 0)
      : [];
  const rankingPool = exactSchemaCandidates.length > 0 ? exactSchemaCandidates : candidates;
  const isThreeWordHierarchy = normalizedWords.length === 3 && slotSchema === "script+primary+secondary";
  const seed = `${normalizedWords.join("|")}|${chunkIndex}|${intent}|${slotSchema}`;
  const ranked = [...rankingPool].sort((a, b) => {
    const aHierarchyPenalty = isThreeWordHierarchy && getSvgTypographyVariantFamily(a.variant) === "impact-pop" ? 300 : 0;
    const bHierarchyPenalty = isThreeWordHierarchy && getSvgTypographyVariantFamily(b.variant) === "impact-pop" ? 300 : 0;
    const aPenalty =
      getSvgVariantPenalty(a.variant, selectionState) +
      getSvgVariantPreferencePenalty(a.variant, preferences) +
      a.schemaDistance * 42 +
      a.charPenalty * 18 +
      aHierarchyPenalty;
    const bPenalty =
      getSvgVariantPenalty(b.variant, selectionState) +
      getSvgVariantPreferencePenalty(b.variant, preferences) +
      b.schemaDistance * 42 +
      b.charPenalty * 18 +
      bHierarchyPenalty;
    const penaltyDiff = aPenalty - bPenalty;
    if (penaltyDiff !== 0) {
      return penaltyDiff;
    }
    return (
      (hashString(`${seed}|${a.variant.id}`) % 1000) -
      (hashString(`${seed}|${b.variant.id}`) % 1000)
    );
  });

  const chosen = ranked[0]?.variant ?? svgTypographyVariantsV1[0];
  commitSvgVariantSelection(selectionState, chosen);
  return chosen;
};

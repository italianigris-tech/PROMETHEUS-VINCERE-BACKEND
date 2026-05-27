export type TypographyAnimationUnit = "letter" | "word" | "line" | "phrase" | "block";
export type TypographyMood =
  | "cinematic"
  | "luxury"
  | "aggressive"
  | "documentary"
  | "dramatic"
  | "editorial"
  | "tech"
  | "emotional"
  | "trailer";
export type TypographyPreferredCase = "uppercase" | "title" | "sentence";
export type TypographyShadowStyle = "soft-bloom" | "hard-contrast" | "none";
export type TypographyGlowStyle = "subtle" | "premium-white" | "accent-color" | "none";
export type TypographyBackgroundFit = "dark-video" | "bright-video" | "blur-card" | "gradient-strip";
export type TypographyPacingFit = "slow" | "medium" | "fast" | "beat-synced";
export type TypographyEmphasisFit = "headline" | "subtitle" | "keyword" | "cta";
export type TypographyContentEnergy = "low" | "medium" | "high";
export type TypographySpeechPacing = "slow" | "medium" | "fast";
export type TypographyTextRole =
  | "subtitle"
  | "hook"
  | "quote"
  | "headline"
  | "transition-card"
  | "emotional-quote"
  | "tech-overlay"
  | "keyword"
  | "cta";

export type TypographyAnimationState = {
  opacity?: [number, number];
  y?: [number, number];
  x?: [number, number];
  scale?: [number, number];
  rotateZ?: [number, number];
  rotateX?: [number, number];
  blur?: [number, number];
  tracking?: [number, number];
  skewX?: [number, number];
  clipPath?: string[];
  filter?: string[];
};

export type TypographyStyleContext = {
  preferredFontWeight: number;
  preferredCase: TypographyPreferredCase;
  shadowStyle: TypographyShadowStyle;
  glowStyle: TypographyGlowStyle;
  backgroundFit: TypographyBackgroundFit;
  pacingFit: TypographyPacingFit;
  emphasisFit: TypographyEmphasisFit;
};

export type TypographyAnimationPattern = {
  id: string;
  unit: TypographyAnimationUnit;
  mood: TypographyMood;
  entry: TypographyAnimationState;
  settle?: {
    duration: number;
    easing: string;
  };
  exit?: {
    opacity?: [number, number];
    y?: [number, number];
    x?: [number, number];
    scale?: [number, number];
    blur?: [number, number];
  };
  stagger?: number;
  duration: number;
  easing: string;
  useCase: string;
  styling: TypographyStyleContext;
  tags?: string[];
  risky?: boolean;
};

export type TypographyTrainingExample = {
  id: string;
  textType: "subtitle" | "hook" | "quote";
  contentEnergy: TypographyContentEnergy;
  speechPacing: TypographySpeechPacing;
  animation: string;
  styling: TypographyStyleContext;
};

export type TypographyComboStep = {
  phase: "entry" | "emphasis" | "exit" | "pre-reveal" | "main-reveal" | "accent-pass" | "lock";
  treatmentId: string;
};

export type TypographyCombo = {
  id: string;
  label: string;
  useCase: string;
  steps: TypographyComboStep[];
};

export type TypographyExitTreatment = {
  id: string;
  description: string;
  duration: number;
  easing: string;
  exit: NonNullable<TypographyAnimationPattern["exit"]>;
};

export type TypographySelectionInput = {
  text: string;
  role?: TypographyTextRole;
  contentEnergy?: TypographyContentEnergy;
  speechPacing?: TypographySpeechPacing;
  wordCount?: number;
  emphasisWordCount?: number;
  semanticIntent?: string | null;
  surfaceTone?: "light" | "dark" | "neutral" | null;
  presentationMode?: "reel" | "long-form" | null;
  preferUnit?: TypographyAnimationUnit;
  allowRiskyPatterns?: boolean;
  recentPatternIds?: string[];
};

export type TypographySelection = {
  role: TypographyTextRole;
  contentEnergy: TypographyContentEnergy;
  speechPacing: TypographySpeechPacing;
  preferredUnit: TypographyAnimationUnit;
  targetMoods: TypographyMood[];
  pattern: TypographyAnimationPattern;
  styling: TypographyStyleContext;
  combo?: TypographyCombo;
  emphasisPattern?: TypographyAnimationPattern;
  exitTreatment?: TypographyExitTreatment;
  reasoning: string[];
  readabilitySafeguards: string[];
};

type TypographyConceptSeed = {
  id: string;
  name: string;
  behavior: string;
};

const createStyle = (style: TypographyStyleContext): TypographyStyleContext => style;
const createPattern = (pattern: TypographyAnimationPattern): TypographyAnimationPattern => pattern;

export const timingGuide = {
  letterStaggerFast: 0.01,
  letterStaggerPremium: 0.014,
  letterStaggerElegant: 0.02,
  wordStaggerFast: 0.025,
  wordStaggerPremium: 0.04,
  wordStaggerDramatic: 0.08,
  revealDurationFast: 0.35,
  revealDurationStandard: 0.6,
  revealDurationCinematic: 0.9,
  revealDurationPrestige: 1.2
} as const;

export const easingPresets = {
  premiumOut: "cubic-bezier(0.22,1,0.36,1)",
  snapLuxury: "cubic-bezier(0.23,1,0.32,1)",
  dramaticOut: "cubic-bezier(0.19,1,0.22,1)",
  softBreath: "cubic-bezier(0.16,1,0.3,1)",
  overshootElegant: "cubic-bezier(0.34,1.56,0.64,1)"
} as const;

const softFadeDownExit: TypographyExitTreatment = {
  id: "soft-fade-down",
  description: "A gentle downward dissolve that clears the caption region without a harsh snap.",
  duration: 0.28,
  easing: "ease-out",
  exit: {
    opacity: [1, 0],
    y: [0, -8],
    blur: [0, 6]
  }
};

const cleanFadeExit: TypographyExitTreatment = {
  id: "clean-fade",
  description: "A restrained lift-out for clean editorial holds that avoids a dead fade.",
  duration: 0.22,
  easing: "ease-out",
  exit: {
    opacity: [1, 0],
    y: [0, -5],
    blur: [0, 2]
  }
};

const lateDissolveExit: TypographyExitTreatment = {
  id: "late-dissolve",
  description: "A slightly delayed blur dissolve suited to prestige phrases and quote endings.",
  duration: 0.36,
  easing: easingPresets.dramaticOut,
  exit: {
    opacity: [1, 0],
    y: [0, -10],
    blur: [0, 12],
    scale: [1, 0.99]
  }
};

export const typographyAnimationPatterns: TypographyAnimationPattern[] = [
  createPattern({
    id: "word-rise-blur-resolve",
    unit: "word",
    mood: "cinematic",
    entry: {
      opacity: [0, 1],
      y: [42, 0],
      blur: [18, 0],
      tracking: [0.08, 0]
    },
    settle: {
      duration: 0.45,
      easing: easingPresets.premiumOut
    },
    stagger: 0.06,
    duration: 0.9,
    easing: easingPresets.premiumOut,
    useCase: "Confident word-by-word reveal for premium edits.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "subtitle"
    }),
    tags: ["subtitle", "premium", "readable"]
  }),
  createPattern({
    id: "letter-float-overshoot",
    unit: "letter",
    mood: "luxury",
    entry: {
      opacity: [0, 1],
      y: [28, -4],
      scale: [0.92, 1.03],
      blur: [10, 0]
    },
    settle: {
      duration: 0.35,
      easing: easingPresets.overshootElegant
    },
    stagger: 0.018,
    duration: 0.75,
    easing: easingPresets.overshootElegant,
    useCase: "Elegant character-by-character premium reveal.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "title",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["luxury", "hero-word", "brand"]
  }),
  createPattern({
    id: "tracking-collapse",
    unit: "word",
    mood: "dramatic",
    entry: {
      opacity: [0, 1],
      tracking: [0.35, 0],
      blur: [14, 0],
      scale: [1.08, 1]
    },
    settle: {
      duration: 0.4,
      easing: "ease-out"
    },
    stagger: 0.04,
    duration: 0.7,
    easing: "cubic-bezier(0.19,1,0.22,1)",
    useCase: "Words begin wide and cinematic, then lock into place.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["trailer", "tension", "statement"]
  }),
  createPattern({
    id: "vertical-slit-reveal",
    unit: "word",
    mood: "editorial",
    entry: {
      opacity: [0.6, 1],
      clipPath: [
        "inset(0 48% 0 48%)",
        "inset(0 0% 0 0%)"
      ],
      scale: [1.04, 1],
      blur: [8, 0]
    },
    settle: {
      duration: 0.38,
      easing: "cubic-bezier(0.2,0.9,0.2,1)"
    },
    stagger: 0.05,
    duration: 0.65,
    easing: "cubic-bezier(0.2,0.9,0.2,1)",
    useCase: "Center slit opens outward into a clean reveal.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "none",
      backgroundFit: "gradient-strip",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["editorial", "callout", "title-card"]
  }),
  createPattern({
    id: "horizontal-mask-sweep",
    unit: "word",
    mood: "tech",
    entry: {
      opacity: [0.7, 1],
      clipPath: [
        "inset(0 100% 0 0)",
        "inset(0 0% 0 0)"
      ],
      x: [-12, 0]
    },
    settle: {
      duration: 0.25,
      easing: "ease-out"
    },
    stagger: 0.045,
    duration: 0.55,
    easing: easingPresets.snapLuxury,
    useCase: "Left-to-right cinematic text wipe.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "none",
      glowStyle: "accent-color",
      backgroundFit: "gradient-strip",
      pacingFit: "fast",
      emphasisFit: "subtitle"
    }),
    tags: ["tech", "founder", "clean-kinetic"]
  }),
  createPattern({
    id: "depth-pop-letter",
    unit: "letter",
    mood: "tech",
    entry: {
      opacity: [0, 1],
      rotateX: [90, 0],
      y: [14, 0],
      blur: [6, 0],
      scale: [0.85, 1]
    },
    settle: {
      duration: 0.32,
      easing: easingPresets.premiumOut
    },
    stagger: 0.014,
    duration: 0.6,
    easing: easingPresets.premiumOut,
    useCase: "Characters rotate forward from depth.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "accent-color",
      backgroundFit: "dark-video",
      pacingFit: "fast",
      emphasisFit: "headline"
    }),
    tags: ["ai", "product", "futuristic"]
  }),
  createPattern({
    id: "glitch-stabilize",
    unit: "word",
    mood: "aggressive",
    entry: {
      opacity: [0, 1],
      x: [8, 0],
      blur: [4, 0],
      filter: [
        "drop-shadow(2px 0 rgba(255,255,255,0.18))",
        "drop-shadow(0 0 rgba(255,255,255,0))"
      ]
    },
    settle: {
      duration: 0.2,
      easing: "linear"
    },
    stagger: 0.03,
    duration: 0.45,
    easing: "steps(3, end)",
    useCase: "Momentary digital instability before locking clean.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "accent-color",
      backgroundFit: "dark-video",
      pacingFit: "beat-synced",
      emphasisFit: "keyword"
    }),
    tags: ["cyber", "system", "tension"],
    risky: true
  }),
  createPattern({
    id: "whisper-fade-up",
    unit: "word",
    mood: "emotional",
    entry: {
      opacity: [0, 1],
      y: [16, 0],
      blur: [20, 0]
    },
    settle: {
      duration: 0.6,
      easing: "ease-out"
    },
    stagger: 0.08,
    duration: 1.1,
    easing: easingPresets.softBreath,
    useCase: "Slow, soft cinematic emergence.",
    styling: createStyle({
      preferredFontWeight: 600,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "blur-card",
      pacingFit: "slow",
      emphasisFit: "subtitle"
    }),
    tags: ["introspective", "voiceover", "soft"]
  }),
  createPattern({
    id: "impact-punch",
    unit: "word",
    mood: "aggressive",
    entry: {
      opacity: [0, 1],
      scale: [0.7, 1.08],
      blur: [12, 0],
      y: [24, -3]
    },
    settle: {
      duration: 0.22,
      easing: easingPresets.overshootElegant
    },
    stagger: 0.02,
    duration: 0.5,
    easing: easingPresets.overshootElegant,
    useCase: "A strong per-word snap into focus.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "subtle",
      backgroundFit: "dark-video",
      pacingFit: "beat-synced",
      emphasisFit: "keyword"
    }),
    tags: ["hook", "money-word", "punchline"]
  }),
  createPattern({
    id: "drift-from-depth",
    unit: "phrase",
    mood: "trailer",
    entry: {
      opacity: [0, 1],
      scale: [1.18, 1],
      blur: [22, 0],
      y: [20, 0]
    },
    settle: {
      duration: 0.8,
      easing: easingPresets.dramaticOut
    },
    duration: 1.2,
    easing: easingPresets.dramaticOut,
    useCase: "Whole phrase emerges like a lens pull into focus.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "title",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "dark-video",
      pacingFit: "slow",
      emphasisFit: "headline"
    }),
    tags: ["trailer", "hero", "prestige"]
  }),
  createPattern({
    id: "letter-shimmer-pass",
    unit: "letter",
    mood: "luxury",
    entry: {
      opacity: [0, 1],
      y: [10, 0],
      blur: [8, 0]
    },
    settle: {
      duration: 0.25,
      easing: "ease-out"
    },
    stagger: 0.02,
    duration: 0.5,
    easing: "ease-out",
    useCase: "Character reveal followed by a gloss or shimmer sweep.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "title",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["luxury", "brand", "premium-title"]
  }),
  createPattern({
    id: "baseline-wave",
    unit: "letter",
    mood: "editorial",
    entry: {
      opacity: [0, 1],
      y: [22, 0],
      rotateZ: [3, 0],
      blur: [8, 0]
    },
    settle: {
      duration: 0.3,
      easing: "ease-out"
    },
    stagger: 0.012,
    duration: 0.52,
    easing: easingPresets.snapLuxury,
    useCase: "Letters rise in a flowing wave along the baseline.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "title",
      shadowStyle: "soft-bloom",
      glowStyle: "subtle",
      backgroundFit: "gradient-strip",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["editorial", "wave", "elegant"]
  }),
  createPattern({
    id: "split-convergence",
    unit: "phrase",
    mood: "dramatic",
    entry: {
      clipPath: [
        "inset(0 50% 0 0)",
        "inset(0 0% 0 0)"
      ],
      blur: [10, 0]
    },
    settle: {
      duration: 0.35,
      easing: "ease-out"
    },
    duration: 0.7,
    easing: "cubic-bezier(0.2,1,0.3,1)",
    useCase: "Two halves of a phrase converge and unify.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["comparison", "duality", "conflict"]
  }),
  createPattern({
    id: "scramble-to-clarity",
    unit: "letter",
    mood: "tech",
    entry: {
      opacity: [0.4, 1],
      blur: [6, 0],
      y: [8, 0]
    },
    settle: {
      duration: 0.25,
      easing: "linear"
    },
    stagger: 0.015,
    duration: 0.45,
    easing: "linear",
    useCase: "Characters begin unstable and resolve into final text.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "accent-color",
      backgroundFit: "dark-video",
      pacingFit: "fast",
      emphasisFit: "headline"
    }),
    tags: ["ai", "data", "system"]
  }),
  createPattern({
    id: "heavy-subtitle-rise",
    unit: "word",
    mood: "aggressive",
    entry: {
      opacity: [0, 1],
      y: [36, 0],
      scale: [0.95, 1],
      blur: [7, 0]
    },
    settle: {
      duration: 0.18,
      easing: "ease-out"
    },
    stagger: 0.03,
    duration: 0.45,
    easing: "cubic-bezier(0.2,0.9,0.2,1)",
    useCase: "Fast, clear, assertive kinetic subtitle motion.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "fast",
      emphasisFit: "subtitle"
    }),
    tags: ["business", "dominant", "assertive"]
  }),
  createPattern({
    id: "documentary-soft-lock",
    unit: "line",
    mood: "documentary",
    entry: {
      opacity: [0, 1],
      blur: [14, 0],
      y: [14, 0]
    },
    settle: {
      duration: 0.5,
      easing: "ease-out"
    },
    duration: 0.8,
    easing: "ease-out",
    useCase: "A mature understated reveal for serious content.",
    styling: createStyle({
      preferredFontWeight: 600,
      preferredCase: "sentence",
      shadowStyle: "none",
      glowStyle: "none",
      backgroundFit: "bright-video",
      pacingFit: "slow",
      emphasisFit: "subtitle"
    }),
    tags: ["interview", "thoughtful", "sober"]
  }),
  createPattern({
    id: "kinetic-cascade",
    unit: "word",
    mood: "cinematic",
    entry: {
      opacity: [0, 1],
      y: [30, 0],
      x: [-8, 0],
      rotateZ: [-2, 0],
      blur: [10, 0]
    },
    settle: {
      duration: 0.22,
      easing: "ease-out"
    },
    stagger: 0.028,
    duration: 0.48,
    easing: easingPresets.snapLuxury,
    useCase: "Words spill in with high-end kinetic energy.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "hard-contrast",
      glowStyle: "subtle",
      backgroundFit: "dark-video",
      pacingFit: "fast",
      emphasisFit: "subtitle"
    }),
    tags: ["reel", "motivational", "tempo"]
  }),
  createPattern({
    id: "flash-exposure",
    unit: "phrase",
    mood: "trailer",
    entry: {
      opacity: [0, 1],
      scale: [1.04, 1],
      blur: [30, 0]
    },
    settle: {
      duration: 0.25,
      easing: "ease-out"
    },
    duration: 0.4,
    easing: "ease-out",
    useCase: "Brief bloom or exposure burst into clarity.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "premium-white",
      backgroundFit: "dark-video",
      pacingFit: "beat-synced",
      emphasisFit: "headline"
    }),
    tags: ["reveal", "beat-hit", "headline"]
  }),
  createPattern({
    id: "bottom-crop-drift",
    unit: "line",
    mood: "editorial",
    entry: {
      clipPath: [
        "inset(100% 0 0 0)",
        "inset(0% 0 0 0)"
      ],
      y: [18, 0],
      opacity: [0.7, 1]
    },
    settle: {
      duration: 0.36,
      easing: "cubic-bezier(0.2,1,0.3,1)"
    },
    duration: 0.65,
    easing: "cubic-bezier(0.2,1,0.3,1)",
    useCase: "Text rises from a clean lower matte.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "title",
      shadowStyle: "none",
      glowStyle: "none",
      backgroundFit: "gradient-strip",
      pacingFit: "medium",
      emphasisFit: "subtitle"
    }),
    tags: ["fashion", "modern", "overlay"]
  }),
  createPattern({
    id: "single-word-elastic-emphasis",
    unit: "word",
    mood: "aggressive",
    entry: {
      opacity: [0, 1],
      scale: [0.78, 1.12],
      y: [16, -2],
      blur: [8, 0]
    },
    settle: {
      duration: 0.2,
      easing: easingPresets.overshootElegant
    },
    duration: 0.4,
    easing: easingPresets.overshootElegant,
    useCase: "Apply only to one strategic word inside a sentence.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "subtle",
      backgroundFit: "dark-video",
      pacingFit: "beat-synced",
      emphasisFit: "keyword"
    }),
    tags: ["emphasis", "money-word", "targeted"]
  }),
  createPattern({
    id: "stepped-dramatic-build",
    unit: "word",
    mood: "dramatic",
    entry: {
      opacity: [0, 1],
      y: [24, 0],
      blur: [12, 0]
    },
    settle: {
      duration: 0.28,
      easing: "ease-out"
    },
    stagger: 0.11,
    duration: 0.65,
    easing: "ease-out",
    useCase: "Deliberate pacing where each word lands with intent.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "none",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "slow",
      emphasisFit: "subtitle"
    }),
    tags: ["monologue", "rhetoric", "dramatic"]
  }),
  createPattern({
    id: "ghost-trail-letter",
    unit: "letter",
    mood: "emotional",
    entry: {
      opacity: [0, 1],
      x: [-10, 0],
      blur: [16, 0]
    },
    settle: {
      duration: 0.45,
      easing: "ease-out"
    },
    stagger: 0.022,
    duration: 0.7,
    easing: "ease-out",
    useCase: "Characters leave a spectral trail before settling.",
    styling: createStyle({
      preferredFontWeight: 600,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "blur-card",
      pacingFit: "slow",
      emphasisFit: "headline"
    }),
    tags: ["memory", "mystery", "reflective"]
  }),
  createPattern({
    id: "compression-release",
    unit: "phrase",
    mood: "luxury",
    entry: {
      opacity: [0, 1],
      scale: [0.92, 1],
      tracking: [-0.08, 0],
      blur: [10, 0]
    },
    settle: {
      duration: 0.42,
      easing: easingPresets.premiumOut
    },
    duration: 0.8,
    easing: easingPresets.premiumOut,
    useCase: "Text begins compressed and expands to natural spacing.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "title",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["opening-title", "chapter", "product-name"]
  }),
  createPattern({
    id: "skew-unbend",
    unit: "word",
    mood: "aggressive",
    entry: {
      opacity: [0, 1],
      skewX: [-18, 0],
      x: [-20, 0],
      blur: [6, 0]
    },
    settle: {
      duration: 0.22,
      easing: "ease-out"
    },
    stagger: 0.03,
    duration: 0.48,
    easing: easingPresets.snapLuxury,
    useCase: "Words snap out of a skewed slashed posture.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "accent-color",
      backgroundFit: "dark-video",
      pacingFit: "fast",
      emphasisFit: "cta"
    }),
    tags: ["startup", "promo", "energetic"]
  }),
  createPattern({
    id: "rise-glow-settle",
    unit: "word",
    mood: "luxury",
    entry: {
      opacity: [0, 1],
      y: [18, 0],
      blur: [8, 0]
    },
    settle: {
      duration: 0.35,
      easing: "ease-out"
    },
    stagger: 0.04,
    duration: 0.62,
    easing: "ease-out",
    useCase: "Subtle reveal, then hold with soft bloom.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "subtitle"
    }),
    tags: ["luxury-subtitle", "polished", "creator"]
  }),
  createPattern({
    id: "cinematic-typewriter",
    unit: "letter",
    mood: "tech",
    entry: {
      opacity: [0, 1]
    },
    settle: {
      duration: 0.01,
      easing: "linear"
    },
    stagger: 0.025,
    duration: 0.03,
    easing: "linear",
    useCase: "Use with cursor fade and soft bloom, never default subtitles.",
    styling: createStyle({
      preferredFontWeight: 600,
      preferredCase: "sentence",
      shadowStyle: "none",
      glowStyle: "subtle",
      backgroundFit: "gradient-strip",
      pacingFit: "fast",
      emphasisFit: "keyword"
    }),
    tags: ["terminal", "system", "command"],
    risky: true
  }),
  createPattern({
    id: "phrase-inhale",
    unit: "phrase",
    mood: "emotional",
    entry: {
      opacity: [0, 1],
      scale: [1.06, 1],
      blur: [18, 0]
    },
    settle: {
      duration: 0.75,
      easing: easingPresets.softBreath
    },
    duration: 1.15,
    easing: easingPresets.softBreath,
    useCase: "Text feels like it is breathing into presence.",
    styling: createStyle({
      preferredFontWeight: 600,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "blur-card",
      pacingFit: "slow",
      emphasisFit: "headline"
    }),
    tags: ["meditative", "deep", "emotional-quote"]
  }),
  createPattern({
    id: "pulse-emphasis",
    unit: "word",
    mood: "cinematic",
    entry: {
      opacity: [0, 1],
      scale: [0.88, 1]
    },
    settle: {
      duration: 0.18,
      easing: "ease-out"
    },
    exit: {},
    duration: 0.35,
    easing: "ease-out",
    useCase: "After reveal, word does a micro pulse timed to beat.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "subtle",
      backgroundFit: "dark-video",
      pacingFit: "beat-synced",
      emphasisFit: "keyword"
    }),
    tags: ["beat-sync", "emphasis", "micro-motion"]
  }),
  createPattern({
    id: "long-shadow-sweep",
    unit: "line",
    mood: "editorial",
    entry: {
      opacity: [0, 1],
      x: [-14, 0],
      blur: [8, 0]
    },
    settle: {
      duration: 0.28,
      easing: "ease-out"
    },
    duration: 0.55,
    easing: "ease-out",
    useCase: "Text arrives as shadow or light sweep resolves over it.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "none",
      backgroundFit: "gradient-strip",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["graphic-title", "stylized", "upscale"]
  }),
  createPattern({
    id: "word-ladder-build",
    unit: "word",
    mood: "cinematic",
    entry: {
      opacity: [0, 1],
      y: [20, 0],
      scale: [0.96, 1]
    },
    settle: {
      duration: 0.22,
      easing: "ease-out"
    },
    stagger: 0.07,
    duration: 0.5,
    easing: "ease-out",
    useCase: "Each word steps upward in authority and timing.",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "sentence",
      shadowStyle: "hard-contrast",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "cta"
    }),
    tags: ["sales", "persuasion", "stacking"]
  }),
  createPattern({
    id: "letter-rain-settle",
    unit: "letter",
    mood: "tech",
    entry: {
      opacity: [0, 1],
      y: [-20, 0],
      blur: [12, 0],
      rotateZ: [-5, 0]
    },
    settle: {
      duration: 0.35,
      easing: easingPresets.premiumOut
    },
    stagger: 0.016,
    duration: 0.62,
    easing: easingPresets.premiumOut,
    useCase: "Characters fall into alignment from above.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "accent-color",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "headline"
    }),
    tags: ["ai", "data", "creative-tech"]
  }),
  createPattern({
    id: "delayed-bloom",
    unit: "phrase",
    mood: "luxury",
    entry: {
      opacity: [0, 1],
      blur: [24, 0],
      scale: [0.98, 1]
    },
    settle: {
      duration: 0.65,
      easing: easingPresets.dramaticOut
    },
    duration: 1,
    easing: easingPresets.dramaticOut,
    useCase: "Phrase emerges slowly then blooms into crystal clarity.",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "blur-card",
      pacingFit: "slow",
      emphasisFit: "headline"
    }),
    tags: ["quote-ending", "prestige", "section-end"]
  })
];

export const typographyTrainingExamples: TypographyTrainingExample[] = [
  {
    id: "premium_subtitle_01",
    textType: "subtitle",
    contentEnergy: "medium",
    speechPacing: "medium",
    animation: "word-rise-blur-resolve",
    styling: createStyle({
      preferredFontWeight: 700,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "none",
      backgroundFit: "dark-video",
      pacingFit: "medium",
      emphasisFit: "subtitle"
    })
  },
  {
    id: "hook_emphasis_01",
    textType: "hook",
    contentEnergy: "high",
    speechPacing: "fast",
    animation: "impact-punch",
    styling: createStyle({
      preferredFontWeight: 800,
      preferredCase: "uppercase",
      shadowStyle: "hard-contrast",
      glowStyle: "subtle",
      backgroundFit: "dark-video",
      pacingFit: "beat-synced",
      emphasisFit: "headline"
    })
  },
  {
    id: "emotional_quote_01",
    textType: "quote",
    contentEnergy: "low",
    speechPacing: "slow",
    animation: "phrase-inhale",
    styling: createStyle({
      preferredFontWeight: 600,
      preferredCase: "sentence",
      shadowStyle: "soft-bloom",
      glowStyle: "premium-white",
      backgroundFit: "blur-card",
      pacingFit: "slow",
      emphasisFit: "headline"
    })
  }
];

export const typographyCombos: TypographyCombo[] = [
  {
    id: "subtitle-system",
    label: "Subtitle System",
    useCase: "Main subtitle flow with a single money word accent and a clean exit.",
    steps: [
      {phase: "entry", treatmentId: "word-rise-blur-resolve"},
      {phase: "emphasis", treatmentId: "single-word-elastic-emphasis"},
      {phase: "exit", treatmentId: softFadeDownExit.id}
    ]
  },
  {
    id: "trailer-headline",
    label: "Trailer Headline",
    useCase: "Prestige headline pacing with a beat-hit preflash and a final money word punch.",
    steps: [
      {phase: "pre-reveal", treatmentId: "flash-exposure"},
      {phase: "main-reveal", treatmentId: "drift-from-depth"},
      {phase: "emphasis", treatmentId: "impact-punch"}
    ]
  },
  {
    id: "editorial-luxury",
    label: "Editorial Luxury",
    useCase: "Prestige editorial system with restrained compression and a gloss accent pass.",
    steps: [
      {phase: "entry", treatmentId: "compression-release"},
      {phase: "accent-pass", treatmentId: "letter-shimmer-pass"}
    ]
  },
  {
    id: "tech-data",
    label: "Tech / Data",
    useCase: "System overlay flow that begins unstable and resolves cleanly.",
    steps: [
      {phase: "pre-reveal", treatmentId: "scramble-to-clarity"},
      {phase: "lock", treatmentId: "horizontal-mask-sweep"}
    ]
  }
];

export const typographyAvoidOveruse = [
  "glitch",
  "typewriter",
  "extreme bounce",
  "exaggerated rotation",
  "constant scaling on every word",
  "too much blur on all captions",
  "random color changes per word",
  "over-tracking every phrase",
  "too many masked reveals in the same sequence"
] as const;

export const typographyConceptSeeds: TypographyConceptSeed[] = [
  {id: "velvet-lift", name: "Velvet Lift", behavior: "Words lift slowly from slight blur and soft shadow, then stop dead clean."},
  {id: "steel-lock", name: "Steel Lock", behavior: "Letters snap from wide tracking into tight alignment like mechanical precision."},
  {id: "halo-resolve", name: "Halo Resolve", behavior: "Phrase appears through bloom, then the bloom dies away leaving crisp text."},
  {id: "echo-slide", name: "Echo Slide", behavior: "Word enters with faint duplicate trails behind it, then trails disappear."},
  {id: "parallax-title-drift", name: "Parallax Title Drift", behavior: "Different words move at slightly different speeds before converging."},
  {id: "orbital-settle", name: "Orbital Settle", behavior: "Individual letters rotate very slightly from off-axis, then level out."},
  {id: "ink-pressure-reveal", name: "Ink Pressure Reveal", behavior: "Masked reveal that feels like pressure spreading across the text."},
  {id: "magnetic-pull-together", name: "Magnetic Pull Together", behavior: "Letters begin slightly misaligned and are pulled into perfect center."},
  {id: "glass-refraction-pass", name: "Glass Refraction Pass", behavior: "Text is revealed under a moving refractive light strip."},
  {id: "breath-pulse-hold", name: "Breath Pulse Hold", behavior: "Entire phrase enters softly, then subtly expands and settles like a breath."}
];

export const typographyTrainingPromptBlock = [
  "Select typography motion based on semantic weight, emotional tone, speech pacing, and screen role.",
  "Never treat all captions the same.",
  "Differentiate between main subtitle text, emphasized money words, headline phrases, transition cards, emotional quote lines, and tech or system overlays.",
  "Choose animation unit deliberately: word-level for readability and speech rhythm, letter-level for short prestige phrases or hero words, phrase-level for dramatic unified reveals.",
  "Favor cinematic restraint over novelty.",
  "Use blur, tracking, masks, scale, and depth with moderation.",
  "Avoid cartoonish motion.",
  "Avoid cheap social-template motion unless explicitly requested.",
  "Each text event should have entry behavior, settle behavior, optional emphasis pulse, optional exit behavior, styling context, pacing logic, and readability safeguards.",
  "Prioritize clarity first, beauty second, novelty third."
].join(" ");

const riskyPatternIds = new Set(
  typographyAnimationPatterns
    .filter((pattern) => pattern.risky)
    .map((pattern) => pattern.id)
);

const patternsById = new Map(typographyAnimationPatterns.map((pattern) => [pattern.id, pattern]));
const combosById = new Map(typographyCombos.map((combo) => [combo.id, combo]));
const FADE_HEAVY_PATTERN_IDS = new Set(["whisper-fade-up", "documentary-soft-lock"]);
const DYNAMIC_CINEMATIC_PATTERN_IDS = new Set([
  "word-rise-blur-resolve",
  "tracking-collapse",
  "vertical-slit-reveal",
  "horizontal-mask-sweep",
  "impact-punch",
  "drift-from-depth",
  "flash-exposure",
  "kinetic-cascade",
  "compression-release",
  "delayed-bloom",
  "phrase-inhale",
  "skew-unbend",
  "word-ladder-build",
  "bottom-crop-drift"
]);

const ROLE_CANDIDATES: Record<TypographyTextRole, string[]> = {
  subtitle: [
    "word-rise-blur-resolve",
    "heavy-subtitle-rise",
    "kinetic-cascade",
    "rise-glow-settle",
    "stepped-dramatic-build",
    "bottom-crop-drift",
    "word-ladder-build",
    "documentary-soft-lock"
  ],
  hook: [
    "impact-punch",
    "tracking-collapse",
    "flash-exposure",
    "drift-from-depth",
    "skew-unbend",
    "compression-release"
  ],
  quote: [
    "phrase-inhale",
    "delayed-bloom",
    "ghost-trail-letter",
    "documentary-soft-lock",
    "whisper-fade-up"
  ],
  headline: [
    "compression-release",
    "letter-float-overshoot",
    "letter-shimmer-pass",
    "delayed-bloom",
    "drift-from-depth",
    "vertical-slit-reveal",
    "long-shadow-sweep"
  ],
  "transition-card": [
    "flash-exposure",
    "drift-from-depth",
    "split-convergence",
    "compression-release",
    "vertical-slit-reveal"
  ],
  "emotional-quote": [
    "phrase-inhale",
    "delayed-bloom",
    "ghost-trail-letter",
    "documentary-soft-lock",
    "whisper-fade-up"
  ],
  "tech-overlay": [
    "horizontal-mask-sweep",
    "scramble-to-clarity",
    "depth-pop-letter",
    "letter-rain-settle",
    "cinematic-typewriter",
    "glitch-stabilize"
  ],
  keyword: [
    "impact-punch",
    "single-word-elastic-emphasis",
    "pulse-emphasis",
    "tracking-collapse",
    "heavy-subtitle-rise"
  ],
  cta: [
    "word-ladder-build",
    "impact-punch",
    "skew-unbend",
    "tracking-collapse",
    "flash-exposure"
  ]
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you"
]);

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const normalizeText = (value: string): string => {
  return value.trim().replace(/\s+/g, " ");
};

const tokenize = (text: string): string[] => {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
};

const hasTechLanguage = (text: string): boolean => {
  return /\b(ai|api|data|system|workflow|terminal|command|prompt|code|model|agent|automation|dashboard|render)\b/i.test(text);
};

const countMeaningfulWords = (text: string): number => {
  return tokenize(text).filter((word) => !STOP_WORDS.has(word)).length;
};

export const getTypographyPattern = (patternId: string): TypographyAnimationPattern | null => {
  return patternsById.get(patternId) ?? null;
};

export const classifyTypographySpeechPacing = ({
  durationMs,
  wordCount
}: {
  durationMs: number;
  wordCount: number;
}): TypographySpeechPacing => {
  if (wordCount <= 0) {
    return "medium";
  }
  const msPerWord = durationMs / wordCount;
  if (msPerWord <= 280) {
    return "fast";
  }
  if (msPerWord <= 540) {
    return "medium";
  }
  return "slow";
};

export const classifyTypographyContentEnergy = (value: number): TypographyContentEnergy => {
  if (value >= 0.72) {
    return "high";
  }
  if (value <= 0.36) {
    return "low";
  }
  return "medium";
};

const inferRoleFromText = (text: string, fallbackRole: TypographyTextRole = "subtitle"): TypographyTextRole => {
  if (hasTechLanguage(text)) {
    return "tech-overlay";
  }
  if (/\?$/.test(text.trim())) {
    return "hook";
  }
  return fallbackRole;
};

const inferPreferredUnit = ({
  role,
  speechPacing,
  wordCount,
  contentEnergy
}: {
  role: TypographyTextRole;
  speechPacing: TypographySpeechPacing;
  wordCount: number;
  contentEnergy: TypographyContentEnergy;
}): TypographyAnimationUnit => {
  if (role === "subtitle") {
    return wordCount >= 7 ? "line" : "word";
  }
  if (role === "quote" || role === "emotional-quote") {
    return speechPacing === "slow" ? "phrase" : wordCount <= 4 ? "word" : "line";
  }
  if (role === "tech-overlay") {
    return wordCount <= 4 ? "letter" : "word";
  }
  if (role === "keyword") {
    return "word";
  }
  if (role === "hook" || role === "headline" || role === "transition-card" || role === "cta") {
    if (wordCount <= 3) {
      return "letter";
    }
    if (contentEnergy === "high") {
      return "phrase";
    }
    return "word";
  }
  return "word";
};

const inferTargetMoods = ({
  role,
  contentEnergy,
  speechPacing,
  text
}: {
  role: TypographyTextRole;
  contentEnergy: TypographyContentEnergy;
  speechPacing: TypographySpeechPacing;
  text: string;
}): TypographyMood[] => {
  if (role === "tech-overlay") {
    return ["tech", "cinematic", "aggressive"];
  }
  if (role === "emotional-quote") {
    return ["emotional", "luxury", "documentary"];
  }
  if (role === "quote") {
    return speechPacing === "slow"
      ? ["documentary", "emotional", "luxury"]
      : ["documentary", "cinematic", "emotional"];
  }
  if (role === "headline" || role === "transition-card") {
    return contentEnergy === "high"
      ? ["trailer", "luxury", "editorial"]
      : ["luxury", "editorial", "cinematic"];
  }
  if (role === "hook" || role === "keyword" || role === "cta") {
    return contentEnergy === "high"
      ? ["aggressive", "trailer", "dramatic"]
      : ["dramatic", "cinematic", "aggressive"];
  }
  if (/story|truth|remember|believe|feel/i.test(text)) {
    return ["emotional", "cinematic", "documentary"];
  }
  return contentEnergy === "high"
    ? ["cinematic", "aggressive", "dramatic"]
    : ["cinematic", "luxury", "documentary"];
};

const getRoleDesiredEmphasisFit = (role: TypographyTextRole): TypographyEmphasisFit => {
  if (role === "subtitle" || role === "quote" || role === "emotional-quote") {
    return "subtitle";
  }
  if (role === "keyword") {
    return "keyword";
  }
  if (role === "cta") {
    return "cta";
  }
  return "headline";
};

const getExitTreatmentForRole = (role: TypographyTextRole): TypographyExitTreatment => {
  if (role === "quote" || role === "emotional-quote" || role === "headline") {
    return lateDissolveExit;
  }
  if (role === "tech-overlay") {
    return cleanFadeExit;
  }
  return softFadeDownExit;
};

const pickComboForRole = ({
  role,
  pattern,
  contentEnergy,
  emphasisWordCount
}: {
  role: TypographyTextRole;
  pattern: TypographyAnimationPattern;
  contentEnergy: TypographyContentEnergy;
  emphasisWordCount: number;
}): TypographyCombo | undefined => {
  if (role === "subtitle" && emphasisWordCount > 0) {
    return combosById.get("subtitle-system");
  }
  if ((role === "hook" || role === "headline" || role === "transition-card") && contentEnergy === "high") {
    return combosById.get("trailer-headline");
  }
  if (role === "headline" && pattern.mood === "luxury") {
    return combosById.get("editorial-luxury");
  }
  if (role === "tech-overlay") {
    return combosById.get("tech-data");
  }
  return undefined;
};

const pickEmphasisPattern = ({
  role,
  contentEnergy,
  emphasisWordCount
}: {
  role: TypographyTextRole;
  contentEnergy: TypographyContentEnergy;
  emphasisWordCount: number;
}): TypographyAnimationPattern | undefined => {
  if (emphasisWordCount <= 0) {
    return undefined;
  }
  if (role === "subtitle") {
    return getTypographyPattern("single-word-elastic-emphasis") ?? undefined;
  }
  if (role === "hook" || role === "keyword" || role === "cta") {
    return getTypographyPattern("impact-punch") ?? undefined;
  }
  if (role === "headline") {
    return getTypographyPattern(contentEnergy === "high" ? "impact-punch" : "pulse-emphasis") ?? undefined;
  }
  return getTypographyPattern("pulse-emphasis") ?? undefined;
};

const getPatternScore = ({
  pattern,
  role,
  targetMoods,
  preferredUnit,
  contentEnergy,
  speechPacing,
  wordCount,
  desiredEmphasisFit,
  allowRiskyPatterns,
  recentPatternIds,
  presentationMode
}: {
  pattern: TypographyAnimationPattern;
  role: TypographyTextRole;
  targetMoods: TypographyMood[];
  preferredUnit: TypographyAnimationUnit;
  contentEnergy: TypographyContentEnergy;
  speechPacing: TypographySpeechPacing;
  wordCount: number;
  desiredEmphasisFit: TypographyEmphasisFit;
  allowRiskyPatterns: boolean;
  recentPatternIds: string[];
  presentationMode?: "reel" | "long-form" | null;
}): number => {
  let score = 0;

  if (pattern.unit === preferredUnit) {
    score -= 22;
  } else if (preferredUnit === "word" && pattern.unit === "line") {
    score += 18;
  } else if (preferredUnit === "phrase" && pattern.unit === "line") {
    score += 12;
  } else {
    score += 44;
  }

  const moodIndex = targetMoods.indexOf(pattern.mood);
  score += moodIndex >= 0 ? moodIndex * 7 : 36;

  if (pattern.styling.pacingFit === speechPacing) {
    score -= 10;
  } else if (pattern.styling.pacingFit === "beat-synced" && speechPacing === "fast") {
    score -= 4;
  } else {
    score += 18;
  }

  if (pattern.styling.emphasisFit === desiredEmphasisFit) {
    score -= 8;
  } else if (desiredEmphasisFit === "headline" && pattern.styling.emphasisFit === "keyword") {
    score += 6;
  } else {
    score += 10;
  }

  if (!allowRiskyPatterns && riskyPatternIds.has(pattern.id)) {
    score += 500;
  }

  if (recentPatternIds.includes(pattern.id)) {
    score += 80 + recentPatternIds.indexOf(pattern.id) * 16;
  }

  if (role === "subtitle" && pattern.unit === "letter" && wordCount > 3) {
    score += 240;
  }
  if ((role === "quote" || role === "emotional-quote") && pattern.unit === "phrase") {
    score -= 12;
  }
  if ((role === "hook" || role === "headline") && wordCount <= 3 && pattern.unit === "letter") {
    score -= 8;
  }
  if (wordCount >= 7 && pattern.unit === "letter") {
    score += 320;
  }
  if (wordCount >= 8 && pattern.unit === "word" && (role === "quote" || role === "subtitle")) {
    score += 34;
  }

  if (contentEnergy === "high") {
    if (pattern.mood === "aggressive" || pattern.mood === "trailer" || pattern.mood === "dramatic") {
      score -= 10;
    }
    if (pattern.mood === "documentary" || pattern.mood === "emotional") {
      score += 26;
    }
  }
  if (contentEnergy === "low") {
    if (pattern.mood === "emotional" || pattern.mood === "documentary" || pattern.mood === "luxury") {
      score -= 8;
    }
    if (pattern.mood === "aggressive") {
      score += 42;
    }
  }

  if ((role === "subtitle" || role === "quote") && pattern.id === "glitch-stabilize") {
    score += 640;
  }
  if ((role === "subtitle" || role === "quote" || role === "headline") && pattern.id === "cinematic-typewriter") {
    score += 640;
  }
  if (FADE_HEAVY_PATTERN_IDS.has(pattern.id)) {
    if (presentationMode === "long-form") {
      score += 140;
    }
    if (role === "subtitle" || role === "hook" || role === "headline" || role === "transition-card" || role === "cta") {
      score += 120;
    }
    if (role === "quote" || role === "emotional-quote") {
      score += contentEnergy === "low" ? 16 : 42;
    }
  }
  if (DYNAMIC_CINEMATIC_PATTERN_IDS.has(pattern.id)) {
    if (presentationMode === "long-form") {
      score -= 18;
    }
    if (role === "subtitle" || role === "hook" || role === "headline" || role === "transition-card" || role === "cta") {
      score -= 10;
    }
  }
  if (presentationMode === "long-form" && role === "subtitle" && pattern.unit === "word") {
    score -= 6;
  }

  return score;
};

const buildReadabilitySafeguards = ({
  role,
  preferredUnit,
  pattern,
  wordCount
}: {
  role: TypographyTextRole;
  preferredUnit: TypographyAnimationUnit;
  pattern: TypographyAnimationPattern;
  wordCount: number;
}): string[] => {
  const safeguards = [
    preferredUnit === "word"
      ? "Word-level rhythm preserved for readability."
      : preferredUnit === "phrase"
        ? "Unified phrase reveal preserved for emotional cohesion."
        : "Short-form impact preserved with tighter unit selection.",
    "Glitch and typewriter treatments remain opt-in, not default.",
    "Mask-heavy and blur-heavy treatments are restrained in dense sequences."
  ];

  if (role === "subtitle" && wordCount > 5) {
    safeguards.push("Dense subtitle text is steered away from letter-by-letter animation.");
  }
  if (pattern.stagger && pattern.stagger > timingGuide.wordStaggerDramatic && role === "subtitle") {
    safeguards.push("Slow stagger is being used intentionally for rhetoric, not for every caption.");
  }

  return safeguards;
};

export const selectTypographyTreatment = (input: TypographySelectionInput): TypographySelection => {
  const text = normalizeText(input.text);
  const wordCount = input.wordCount ?? Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const role = input.role ?? inferRoleFromText(text);
  const inferredRole = inferRoleFromText(text, role);
  const finalRole = input.role ?? inferredRole;
  const contentEnergy = input.contentEnergy ?? "medium";
  const speechPacing = input.speechPacing ?? "medium";
  const preferredUnit = input.preferUnit ?? inferPreferredUnit({
    role: finalRole,
    speechPacing,
    wordCount,
    contentEnergy
  });
  const targetMoods = inferTargetMoods({
    role: finalRole,
    contentEnergy,
    speechPacing,
    text
  });
  const desiredEmphasisFit = getRoleDesiredEmphasisFit(finalRole);
  const allowRiskyPatterns = input.allowRiskyPatterns === true && finalRole === "tech-overlay";
  const recentPatternIds = input.recentPatternIds ?? [];
  const candidates = (ROLE_CANDIDATES[finalRole] ?? typographyAnimationPatterns.map((pattern) => pattern.id))
    .map((patternId) => getTypographyPattern(patternId))
    .filter((pattern): pattern is TypographyAnimationPattern => pattern !== null);

  const ranked = candidates
    .map((pattern) => ({
      pattern,
      score: getPatternScore({
        pattern,
        role: finalRole,
        targetMoods,
        preferredUnit,
        contentEnergy,
        speechPacing,
        wordCount,
        desiredEmphasisFit,
        allowRiskyPatterns,
        recentPatternIds,
        presentationMode: input.presentationMode ?? null
      })
    }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      const seed = `${text}|${finalRole}|${preferredUnit}|${contentEnergy}|${speechPacing}`;
      return (hashString(`${seed}|${a.pattern.id}`) % 1000) - (hashString(`${seed}|${b.pattern.id}`) % 1000);
    });

  const selectedPattern = ranked[0]?.pattern ?? typographyAnimationPatterns[0];
  const emphasisWordCount = clamp(input.emphasisWordCount ?? 0, 0, 8);
  const combo = pickComboForRole({
    role: finalRole,
    pattern: selectedPattern,
    contentEnergy,
    emphasisWordCount
  });
  const emphasisPattern = pickEmphasisPattern({
    role: finalRole,
    contentEnergy,
    emphasisWordCount
  });
  const exitTreatment = getExitTreatmentForRole(finalRole);
  const meaningfulWordCount = countMeaningfulWords(text);

  const reasoning = [
    `role=${finalRole}`,
    `energy=${contentEnergy}`,
    `speech=${speechPacing}`,
    `unit=${preferredUnit}`,
    `pattern=${selectedPattern.id}`,
    `mood=${selectedPattern.mood}`,
    meaningfulWordCount <= 2 ? "short-copy" : meaningfulWordCount >= 7 ? "dense-copy" : "moderate-copy",
    selectedPattern.risky ? "risky-pattern-opted-in" : "safe-pattern-default"
  ];

  if (input.semanticIntent) {
    reasoning.push(`semantic-intent=${input.semanticIntent}`);
  }
  if (combo) {
    reasoning.push(`combo=${combo.id}`);
  }
  if (emphasisPattern) {
    reasoning.push(`emphasis=${emphasisPattern.id}`);
  }
  if (input.surfaceTone) {
    reasoning.push(`surface=${input.surfaceTone}`);
  }
  if (input.presentationMode) {
    reasoning.push(`presentation=${input.presentationMode}`);
  }

  return {
    role: finalRole,
    contentEnergy,
    speechPacing,
    preferredUnit,
    targetMoods,
    pattern: selectedPattern,
    styling: selectedPattern.styling,
    combo,
    emphasisPattern,
    exitTreatment,
    reasoning,
    readabilitySafeguards: buildReadabilitySafeguards({
      role: finalRole,
      preferredUnit,
      pattern: selectedPattern,
      wordCount
    })
  };
};

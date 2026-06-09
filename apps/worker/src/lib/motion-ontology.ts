import type {MotionPattern} from "@prometheus/shared-types";

/**
 * Motion Ontology Registry
 * A hardcoded semantic registry mapping emotional intent to GSAP motion patterns.
 * This is the "vocabulary" that the Director's Notes reference.
 */

export const MOTION_ONTOLOGY: Readonly<Record<string, MotionPattern>> = {
  "aggressive-entrance": {
    id: "aggressive-entrance",
    tags: ["fast", "translateZ", "impact", "tension", "aggressive"],
    category: "entrance",
    emotionalProfile: {intensity: 0.9, confidence: 0.8, chaos: 0.3},
    temporalSignature: {attack: 0.1, sustain: 0.2, decay: 0.1},
    gsapConfig: {
      from: {opacity: 0, z: -300, scale: 0.5},
      to: {opacity: 1, z: 0, scale: 1},
      duration: 0.35,
      ease: "expo.out",
      stagger: 0.02
    },
    cameraCoupling: "push-in",
    microAnimations: ["burst", "scale-punch"],
    deformation: {type: "explode", intensity: 0.5, speed: 2},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false}
  },
  "slow-drift": {
    id: "slow-drift",
    tags: ["gentle", "contemplative", "float", "release", "contemplation"],
    category: "ambient",
    emotionalProfile: {intensity: 0.2, confidence: 0.7, chaos: 0.1},
    temporalSignature: {attack: 0.5, sustain: 1.0, decay: 0.5},
    gsapConfig: {
      from: {opacity: 0, y: 20},
      to: {opacity: 1, y: 0},
      duration: 1.2,
      ease: "power2.out",
      stagger: 0.08
    },
    cameraCoupling: "drift",
    microAnimations: ["float", "sway"],
    postProcess: {bloom: false, chromaticAberration: false, motionBlur: false}
  },
  "letter-explode": {
    id: "letter-explode",
    tags: ["scatter", "shatter", "chaos", "explosion"],
    category: "emphasis",
    emotionalProfile: {intensity: 0.95, confidence: 0.9, chaos: 0.9},
    temporalSignature: {attack: 0.05, sustain: 0.1, decay: 0.3},
    gsapConfig: {
      from: {opacity: 1, scale: 1},
      to: {opacity: 0, scale: 2.5, rotation: 180, x: "random(-100, 100)", y: "random(-100, 100)"},
      duration: 0.4,
      ease: "circ.out",
      stagger: 0.01
    },
    cameraCoupling: "snap",
    microAnimations: ["particle-scatter", "burst"],
    deformation: {type: "shatter", intensity: 0.9, speed: 1.5},
    postProcess: {bloom: true, chromaticAberration: true, motionBlur: true}
  },
  "depth-establish": {
    id: "depth-establish",
    tags: ["cinematic", "establish", "tension"],
    category: "entrance",
    emotionalProfile: {intensity: 0.6, confidence: 0.85, chaos: 0.1},
    temporalSignature: {attack: 0.3, sustain: 0.5, decay: 0.2},
    gsapConfig: {
      from: {opacity: 0, z: -500},
      to: {opacity: 1, z: 0},
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.05
    },
    cameraCoupling: "push-in",
    microAnimations: ["depth-travel", "focus-pull"],
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false}
  },
  "snap-focus": {
    id: "snap-focus",
    tags: ["cut", "focus", "aggressive", "tension"],
    category: "transition",
    emotionalProfile: {intensity: 0.85, confidence: 0.8, chaos: 0.4},
    temporalSignature: {attack: 0.05, sustain: 0.1, decay: 0.05},
    gsapConfig: {
      from: {opacity: 0.3, scale: 1.1},
      to: {opacity: 1, scale: 1},
      duration: 0.15,
      ease: "circ.in",
      stagger: 0
    },
    cameraCoupling: "snap",
    microAnimations: ["snap", "flash"],
    postProcess: {bloom: false, chromaticAberration: true, motionBlur: false}
  },
  "contemplative-hold": {
    id: "contemplative-hold",
    tags: ["minimal", "breathing", "stillness", "contemplation", "release"],
    category: "ambient",
    emotionalProfile: {intensity: 0.15, confidence: 0.9, chaos: 0.05},
    temporalSignature: {attack: 0.8, sustain: 2.0, decay: 0.8},
    gsapConfig: {
      from: {opacity: 0.7},
      to: {opacity: 1},
      duration: 1.5,
      ease: "power2.out",
      stagger: 0.1
    },
    cameraCoupling: "hold",
    microAnimations: ["breathe", "gentle-pulse"],
    deformation: {type: "ripple", intensity: 0.1, speed: 0.3},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false}
  },
  "chaos-scatter": {
    id: "chaos-scatter",
    tags: ["explosion", "disorder", "chaos"],
    category: "exit",
    emotionalProfile: {intensity: 1.0, confidence: 0.95, chaos: 1.0},
    temporalSignature: {attack: 0.02, sustain: 0.05, decay: 0.4},
    gsapConfig: {
      from: {opacity: 1, scale: 1},
      to: {opacity: 0, scale: 0, rotation: "random(-360, 360)", x: "random(-200, 200)", y: "random(-200, 200)"},
      duration: 0.5,
      ease: "circ.in",
      stagger: 0.005
    },
    cameraCoupling: "pull-out",
    microAnimations: ["shatter", "scatter"],
    deformation: {type: "shatter", intensity: 1, speed: 2},
    postProcess: {bloom: true, chromaticAberration: true, motionBlur: true}
  },
  "gentle-exit": {
    id: "gentle-exit",
    tags: ["soft", "fade", "release", "contemplation"],
    category: "exit",
    emotionalProfile: {intensity: 0.3, confidence: 0.75, chaos: 0.1},
    temporalSignature: {attack: 0.2, sustain: 0.3, decay: 0.5},
    gsapConfig: {
      from: {opacity: 1, z: 0},
      to: {opacity: 0, z: 50},
      duration: 0.8,
      ease: "power2.inOut",
      stagger: 0.04
    },
    cameraCoupling: "pull-out",
    microAnimations: ["fade", "drift-away"],
    postProcess: {bloom: false, chromaticAberration: false, motionBlur: false}
  },
  "intimate-push": {
    id: "intimate-push",
    tags: ["close", "warm", "tender", "intimacy"],
    category: "entrance",
    emotionalProfile: {intensity: 0.5, confidence: 0.85, chaos: 0.2},
    temporalSignature: {attack: 0.4, sustain: 0.6, decay: 0.3},
    gsapConfig: {
      from: {opacity: 0, z: -100, scale: 0.95},
      to: {opacity: 1, z: 0, scale: 1},
      duration: 0.6,
      ease: "back.out(1.2)",
      stagger: 0.06
    },
    cameraCoupling: "push-in",
    microAnimations: ["warm-glow", "gentle-scale"],
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false}
  },
  "isolation-drift": {
    id: "isolation-drift",
    tags: ["lonely", "distance", "cold", "isolation"],
    category: "ambient",
    emotionalProfile: {intensity: 0.25, confidence: 0.7, chaos: 0.15},
    temporalSignature: {attack: 0.6, sustain: 1.2, decay: 0.6},
    gsapConfig: {
      from: {opacity: 0.5, x: -30},
      to: {opacity: 1, x: 0},
      duration: 1.0,
      ease: "power3.out",
      stagger: 0.07
    },
    cameraCoupling: "drift",
    microAnimations: ["cold-drift", "desaturate"],
    postProcess: {bloom: false, chromaticAberration: false, motionBlur: false}
  },
  "tension-build": {
    id: "tension-build",
    tags: ["anticipation", "squeeze", "tension"],
    category: "emphasis",
    emotionalProfile: {intensity: 0.75, confidence: 0.8, chaos: 0.3},
    temporalSignature: {attack: 0.15, sustain: 0.4, decay: 0.15},
    gsapConfig: {
      from: {scale: 1},
      to: {scale: 1.05},
      duration: 0.3,
      ease: "power2.in",
      stagger: 0.02
    },
    cameraCoupling: "drift",
    microAnimations: ["pulse", "compress"],
    postProcess: {bloom: false, chromaticAberration: false, motionBlur: false}
  },
  "release-settle": {
    id: "release-settle",
    tags: ["calm", "resolve", "release", "contemplation"],
    category: "transition",
    emotionalProfile: {intensity: 0.35, confidence: 0.85, chaos: 0.1},
    temporalSignature: {attack: 0.1, sustain: 0.2, decay: 0.7},
    gsapConfig: {
      from: {scale: 1.05, y: -5},
      to: {scale: 1, y: 0},
      duration: 0.6,
      ease: "back.out(1.5)",
      stagger: 0.03
    },
    cameraCoupling: "hold",
    microAnimations: ["settle", "relax"],
    deformation: {type: "ripple", intensity: 0.2, speed: 0.8},
    postProcess: {bloom: true, chromaticAberration: false, motionBlur: false}
  }
} as const;

/**
 * Retrieves patterns by their IDs, filtering out unknown IDs.
 * @param ids - Array of pattern IDs to retrieve
 * @returns Array of valid MotionPattern objects in request order
 */
export function retrievePatterns(ids: readonly string[]): readonly MotionPattern[] {
  const result: MotionPattern[] = [];
  for (const id of ids) {
    const pattern = MOTION_ONTOLOGY[id];
    if (pattern) {
      result.push(pattern);
    }
  }
  return result;
}

/**
 * Retrieves all patterns that match a given emotion tag.
 * @param emotion - The emotion tag to search for
 * @returns Array of MotionPattern objects containing the emotion tag
 */
export function retrieveByEmotion(emotion: string): readonly MotionPattern[] {
  const result: MotionPattern[] = [];
  for (const pattern of Object.values(MOTION_ONTOLOGY)) {
    if (pattern.tags.includes(emotion)) {
      result.push(pattern);
    }
  }
  return result;
}

/**
 * Finds a pattern that matches a semantic tag.
 * @param tag - The semantic tag to search for
 * @returns The matching MotionPattern or null if not found
 */
export function findPatternForSemanticTag(tag: string): MotionPattern | null {
  if (!tag || tag === "") {
    return null;
  }
  
  // First try exact match on pattern ID
  const directMatch = MOTION_ONTOLOGY[tag];
  if (directMatch) {
    return directMatch;
  }
  
  // Then search by tags
  for (const pattern of Object.values(MOTION_ONTOLOGY)) {
    if (pattern.tags.includes(tag)) {
      return pattern;
    }
  }
  
  return null;
}

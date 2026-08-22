/**
 * PROMETHEUS CORE: ANIMA #15 DYNAMIC PERSON / CHARACTER ENGINE
 * 
 * Implements high-tier, cinematic character & avatar motion suites:
 * 1. PERSON #01 — Corporate Masked Suit on Rounded Blue Card (Ref Screenshot 01)
 * 2. PERSON #02 — Die-Cut Sticker Head Cutout with Parallax Bob (Ref Screenshot 02)
 * 3. PERSON #03 — Graphic Noir Angular Vector Portrait on Crimson Card (Ref Screenshot 03 - Red)
 * 4. PERSON #04 — 3D Stylized Studio Character with Beanie & Headphones (Ref Screenshot 03 - Blue)
 * 5. PERSON #05 — Cel-Shaded Line-Art Anime Persona on Lavender Card (Ref Screenshot 03 - Purple)
 * 6. PERSON #06 — Tactile 3D Felt & Knit Character with Smartphone Interaction (Ref Screenshot 03 - Cyan)
 * 
 * Pipeline-Tinkerable Parameters:
 * - Card morph & spring physics
 * - Character body entry trajectory & easing
 * - Circular face mask scale, glow, and specular rim
 * - Head tilt / parallax float frequency & amplitude
 * - Swappable identity nameplates & metadata
 */

export type PersonArtStyle =
  | "corporate_masked_suit"     // Ref Screenshot 01: Folded hands suit with white circular face disc
  | "die_cut_sticker_head"      // Ref Screenshot 02: White outline sticker head cutout with bucket hat
  | "graphic_noir_vector"       // Ref Screenshot 03: Angular expressive ink silhouette on crimson card
  | "stylized_3d_headphones"    // Ref Screenshot 03: 3D rendered persona with beanie & studio headphones
  | "cel_shaded_anime_persona"  // Ref Screenshot 03: 2D line-art anime character with glasses on purple card
  | "tactile_felt_smartphone";  // Ref Screenshot 03: 3D clay/felt joyful character with glowing smartphone

export interface PersonAnimationKnobs {
  /** Card container entry mode */
  cardEntry: "elastic_squircle" | "subpixel_blur_rise" | "scale_snap";
  /** Card start Y position in pixels (e.g. -30px top drop) */
  cardStartYPx: number;
  /** Character body entry trajectory */
  bodyEntryTrajectory: "translate_up_deep" | "zoom_punch" | "staggered_alpha";
  /** Character body start Y position in pixels (e.g. +160px completely out of view) */
  bodyStartYPx: number;
  /** Total animation cycle duration in ms (e.g. 5000ms) */
  cycleDurationMs: number;
  /** Stagger delay between card drop and character body slide-up in ms */
  staggerDelayMs: number;
  /** Face disc / sticker peel pop delay in ms */
  maskPopDelayMs: number;
  /** Head tilt / breathing float amplitude in pixels */
  floatAmplitudePx: number;
  /** Head float frequency in Hz */
  floatFrequencyHz: number;
  /** Volumetric Gaussian body flare intensity (0.0 to 2.0) */
  gaussianFlareIntensity: number;
  /** Custom CSS easing curve (e.g. cubic-bezier(0.16, 1, 0.3, 1)) */
  easingCurve: string;
}

export interface DynamicPersonMetadata {
  schemaVersion: "3.0.0";
  archetypeId: 15;
  archetypeName: "Person / Character Asset (Depth-Matted Avatar & Stylized Persona Suite)";
  artStyle: PersonArtStyle;
  character: {
    name: string;
    roleOrTitle?: string;
    avatarMaskType: "circular_disc" | "die_cut_outline" | "full_portrait_mesh";
    accentColor: string;
    cardBgGradient: string;
  };
  animation: PersonAnimationKnobs;
  typography: {
    fontFamily: string;
    nameWeight: number | string;
    titleWeight: number | string;
  };
}

/**
 * Plan dynamic person metadata from transcript with full pipeline tinkerability
 */
export function planDynamicPerson(
  rawTranscript: string,
  overrideStyle?: PersonArtStyle,
  customKnobs?: Partial<PersonAnimationKnobs>
): DynamicPersonMetadata {
  const lower = rawTranscript.toLowerCase();

  let artStyle: PersonArtStyle = overrideStyle || "corporate_masked_suit";

  if (!overrideStyle) {
    if (lower.includes("sticker") || lower.includes("bucket hat") || lower.includes("cutout") || lower.includes("die cut")) {
      artStyle = "die_cut_sticker_head";
    } else if (lower.includes("noir") || lower.includes("red") || lower.includes("beard") || lower.includes("shadow")) {
      artStyle = "graphic_noir_vector";
    } else if (lower.includes("headphones") || lower.includes("beanie") || lower.includes("pixar") || lower.includes("3d")) {
      artStyle = "stylized_3d_headphones";
    } else if (lower.includes("anime") || lower.includes("glasses") || lower.includes("purple") || lower.includes("line art")) {
      artStyle = "cel_shaded_anime_persona";
    } else if (lower.includes("phone") || lower.includes("smartphone") || lower.includes("sweater") || lower.includes("felt")) {
      artStyle = "tactile_felt_smartphone";
    } else {
      artStyle = "corporate_masked_suit";
    }
  }

  const animation: PersonAnimationKnobs = {
    cardEntry: "elastic_squircle",
    cardStartYPx: -30,
    bodyEntryTrajectory: "translate_up_deep",
    bodyStartYPx: 160,
    cycleDurationMs: 5000,
    staggerDelayMs: 250,
    maskPopDelayMs: 400,
    floatAmplitudePx: 4,
    floatFrequencyHz: 0.28,
    gaussianFlareIntensity: 1.0,
    easingCurve: "cubic-bezier(0.16, 1, 0.3, 1)",
    ...customKnobs
  };

  let character = {
    name: "Executive Persona",
    roleOrTitle: "Chief Executive Officer",
    avatarMaskType: "circular_disc" as const,
    accentColor: "#0284c7",
    cardBgGradient: "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)"
  };

  if (artStyle === "die_cut_sticker_head") {
    character = {
      name: "Creative Director",
      roleOrTitle: "Visual Narrative Lead",
      avatarMaskType: "die_cut_outline",
      accentColor: "#10b981",
      cardBgGradient: "radial-gradient(circle, #064e3b 0%, #022c22 100%)"
    };
  } else if (artStyle === "graphic_noir_vector") {
    character = {
      name: "Lead Architect",
      roleOrTitle: "Deep Systems Engineer",
      avatarMaskType: "full_portrait_mesh",
      accentColor: "#ef4444",
      cardBgGradient: "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)"
    };
  } else if (artStyle === "stylized_3d_headphones") {
    character = {
      name: "Audio Engineer",
      roleOrTitle: "Soundscape Producer",
      avatarMaskType: "full_portrait_mesh",
      accentColor: "#38bdf8",
      cardBgGradient: "linear-gradient(180deg, #0284c7 0%, #0c4a6e 100%)"
    };
  } else if (artStyle === "cel_shaded_anime_persona") {
    character = {
      name: "Frontend Specialist",
      roleOrTitle: "UI/UX Craftsman",
      avatarMaskType: "full_portrait_mesh",
      accentColor: "#a855f7",
      cardBgGradient: "linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%)"
    };
  } else if (artStyle === "tactile_felt_smartphone") {
    character = {
      name: "Product Founder",
      roleOrTitle: "Growth Strategist",
      avatarMaskType: "full_portrait_mesh",
      accentColor: "#f59e0b",
      cardBgGradient: "linear-gradient(180deg, #0284c7 0%, #075985 100%)"
    };
  }

  return {
    schemaVersion: "3.0.0",
    archetypeId: 15,
    archetypeName: "Person / Character Asset (Depth-Matted Avatar & Stylized Persona Suite)",
    artStyle,
    character,
    animation,
    typography: {
      fontFamily: "var(--font-display)",
      nameWeight: 800,
      titleWeight: 500
    }
  };
}

import type {GodGenerationBrief} from "./types";

const joinLines = (parts: string[]): string => parts.join("\n");

export const GOD_MASTER_PROMPT_VERSION = "god-master-prompt-v1";

export const buildGodMasterPrompt = (): string => {
  return joinLines([
    "Create a self-contained HTML/CSS motion asset with no background. The canvas must be transparent so it composites cleanly over source media and vintage surfaces.",
    "Use only HTML and CSS. Do not use JavaScript.",
    "Core aesthetic: Apple-esque minimalism, premium glassmorphism, cinematic restraint, flat motion with deliberate easing-out.",
    "The asset should feel modular, editorial, and reusable, not like random stock art or clipart.",
    "Transparent background is the default. Do not bake in a solid matte unless the brief explicitly demands it.",
    "Prefer clean layering, subtle depth, luminous edges, premium blur, restrained glow, and elegant negative space.",
    "Avoid clutter, watermarks, low-end gradients, childish styling, inconsistent perspective, and hardcoded text unless explicitly requested.",
    "The outer container must isolate the composition and prevent bleed-through. Transparent outside bounds only.",
    "If text is requested, use layered text-shadow/vignette treatment with a cinematic blur-in reveal.",
    "If a glass object is requested, use backdrop-filter blur, alpha-based depth, radial inner shine, and a deep shadow that fades as it rises.",
    "Animation language should favor smooth easing, quiet drift, subtle rise, polish, and editorial timing.",
    "Return production-ready markup that can be saved directly into a reusable asset module."
  ]);
};

export const buildGodSystemPrompt = (brief: GodGenerationBrief): string => {
  return joinLines([
    "You are the GOD asset generation engine.",
    "GOD means governed on-demand asset generation.",
    "You generate custom motion modules only when the existing asset library is not good enough for the exact visual moment.",
    "Return strict JSON only. No prose, no markdown, no code fences.",
    `Master prompt version: ${GOD_MASTER_PROMPT_VERSION}`,
    `Preferred visual form: ${brief.preferredForm}`,
    `Asset purpose: ${brief.assetPurpose}`,
    `Semantic role: ${brief.semanticRole}`,
    `Visual tone: ${brief.visualTone}`,
    `Motion language: ${brief.motionLanguage}`,
    `Reusability goal: ${brief.reusabilityGoal}`,
    `Forbidden elements: ${brief.forbiddenElements.join(", ") || "none"}`,
    `Required elements: ${brief.requiredElements.join(", ") || "none"}`,
    `Composition constraints: ${brief.compositionConstraints.join(", ") || "none"}`,
    `Palette guidance: ${brief.paletteGuidance.join(", ") || "none"}`
  ]);
};

export const buildGodUserPrompt = (brief: GodGenerationBrief): string => {
  return joinLines([
    "Generate one premium modular asset that obeys the brief exactly.",
    "The returned asset must be cleanly compositable over video.",
    "Default to transparent background and transparent outer bounds.",
    "Return JSON with these keys: title, label, assetRole, family, tier, renderMode, preferredForm, html, css, svg, themeTags, semanticTags, subjectTags, emotionalTags, functionalTags, placementZone, safeArea, durationPolicy, opacity, blendMode, loopable, transparencyRequired, noBackgroundRequired, paletteGuidance, reusabilityGoal, forbiddenElements, motionMetadata, sourceProvider, providerConfidence, previewCopy, notes.",
    "If you cannot satisfy the brief, lower your confidence rather than inventing a sloppy substitute.",
    "Do not add watermarks, hardcoded background fills, or baked-in body backgrounds.",
    "Prefer modular forms that can be reused in multiple scenes.",
    `Scene context: ${JSON.stringify(brief.sceneContext)}`,
    `Brief payload: ${JSON.stringify(brief)}`
  ]);
};

export const buildGodPromptPack = (brief: GodGenerationBrief): {
  masterPrompt: string;
  systemPrompt: string;
  userPrompt: string;
} => {
  const masterPrompt = buildGodMasterPrompt();
  return {
    masterPrompt,
    systemPrompt: buildGodSystemPrompt(brief),
    userPrompt: buildGodUserPrompt(brief)
  };
};

export type DirectorNotesPromptInput = {
  transcript: string;
  brief: string;
  durationMs: number;
  mood: string;
};

export const buildDirectorNotesSystemPrompt = (): string => joinLines([
  "You are a Motion Design Director.",
  "You reason about pacing, tension, and spatial relationships.",
  "You never produce generic motion.",
  "You direct emotional experiences through motion."
]);

export const buildDirectorNotesUserPrompt = ({
  transcript,
  brief,
  durationMs,
  mood
}: DirectorNotesPromptInput): string => joinLines([
  "You are a Motion Design Director for a cinematic kinetic typography studio.",
  "Your work is compared to Lusion, Supreme, and Buck.",
  "You do not animate text. You direct emotional experiences through motion.",
  "",
  "INPUT:",
  `- Lyrics/Transcript: ${transcript}`,
  `- Visual Brief: ${brief}`,
  `- Duration: ${durationMs}ms`,
  `- Target Mood: ${mood}`,
  "",
  "STEP 1 - SEMANTIC ANALYSIS:",
  "Analyze the transcript beat by beat. Identify:",
  "- Emotional shifts (where does tension build? where does it release?)",
  "- Narrative peaks and valleys",
  "- Words that demand emphasis vs. words that should drift by",
  "Output: A numbered list of emotional beats with timestamps.",
  "",
  "STEP 2 - MOTION VOCABULARY SELECTION:",
  "For each emotional beat, choose 1-2 motion patterns from this vocabulary:",
  "- aggressive-entrance: fast translateZ + overshoot + deceleration",
  "- slow-drift: gentle position wander + micro-rotation",
  "- letter-explode: per-character scatter with stagger",
  "- depth-establish: push-in to text, hold, then release",
  "- snap-focus: sudden camera cut to tight framing",
  "- contemplative-hold: minimal motion, breathing scale",
  "- chaos-scatter: high randomness, fast decay",
  "Output: Which patterns you selected and why.",
  "",
  "STEP 3 - TEMPORAL INTENSITY CURVE:",
  "Construct an intensity curve over the full duration.",
  "- At t=0ms, intensity = 0.2 (establishing)",
  "- Mark every peak and valley with exact timestamps",
  "- Ensure derivative spikes before emotional peaks (anticipation)",
  "Output: A JSON array of {t, intensity, derivative} points. Minimum 8 points.",
  "",
  "STEP 4 - CAMERA BLOCKING:",
  "Plan camera moves that serve the emotional arc, not just show the text.",
  "- Specify push-in, pull-out, orbit, drift, snap, or hold",
  "- Couple camera motion to text motion (tight/loose/none)",
  "- Add overshoot for dynamic energy",
  "Output: Camera directives per beat.",
  "",
  "STEP 5 - IMPERFECTION PROFILE:",
  "Decide how human this piece should feel.",
  "- High chaos = more timing noise and rotational drift",
  "- Low chaos = precise, mechanical motion",
  "- Contemplative pieces get gentle drift; aggressive pieces get jitter",
  "Output: {timingNoiseMs, spacingVariance, easingPerturbation, rotationalDrift}",
  "",
  "STEP 6 - DIRECTOR'S NOTES JSON:",
  "Compile Steps 1-5 into strict JSON matching the DirectorNotes schema.",
  "Return strict JSON only. No prose, no markdown, no code fences.",
  "",
  "DirectorNotes schema:",
  "{",
  "  version: \"1.0\",",
  "  emotionalArc: Array<{",
  "    id: string,",
  "    timestamp: [startMs: number, endMs: number],",
  "    emotion: \"tension\" | \"release\" | \"contemplation\" | \"explosion\" | \"intimacy\" | \"isolation\" | \"chaos\",",
  "    intensity: number,",
  "    motionVocabulary: string[],",
  "    cameraDirective: { type: \"push-in\" | \"pull-out\" | \"orbit\" | \"drift\" | \"snap\" | \"hold\", target: [number, number, number] | null, intensity: number, overshoot: number, coupling: \"tight\" | \"loose\" | \"none\" } | null,",
  "    why: string",
  "  }>,",
  "  temporalIntensity: { points: Array<{ t: number, intensity: number, derivative: number }> },",
  "  imperfectionProfile: { timingNoiseMs: number, spacingVariance: number, easingPerturbation: number, rotationalDrift: number },",
  "  globalCameraStrategy: \"intimate\" | \"cinematic\" | \"aggressive\" | \"contemplative\",",
  "  assetDirectives: Array<{ timestamp: [number, number], semanticNeed: string, motionRole: \"background\" | \"overlay\" | \"matte\" }>",
  "}",
  "",
  "Include why reasoning traces for at least 3 emotional beats whenever the transcript supports 3 or more beats."
]);

export const buildDirectorNotesPromptPack = (input: DirectorNotesPromptInput): {
  systemPrompt: string;
  userPrompt: string;
  temperature: 0.7;
} => ({
  systemPrompt: buildDirectorNotesSystemPrompt(),
  userPrompt: buildDirectorNotesUserPrompt(input),
  temperature: 0.7
});

import {z} from "zod";

export const soundDesignPresetNameSchema = z.enum([
  "tail_wash_out",
  "reverb_throw",
  "echo_throw_cut",
  "filter_sink",
  "soft_overlap_in",
  "impact_handoff",
  "dialogue_safe_bed"
]);

export type SoundDesignPresetName = z.infer<typeof soundDesignPresetNameSchema>;

export const soundDesignCueRoleSchema = z.enum(["music", "sfx"]);
export type SoundDesignCueRole = z.infer<typeof soundDesignCueRoleSchema>;

export const soundDesignDialogueSpanSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  gainDb: z.number().optional(),
  label: z.string().optional()
}).refine((value) => value.end > value.start, {
  message: "Dialogue span end must be greater than start."
});

export type SoundDesignDialogueSpan = z.infer<typeof soundDesignDialogueSpanSchema>;

export const soundDesignPresetSettingsSchema = z.object({
  fadeInSeconds: z.number().positive().optional(),
  fadeOutSeconds: z.number().positive().optional(),
  echoMix: z.number().min(0).max(1).optional(),
  echoDelayMs: z.number().int().positive().optional(),
  echoDecay: z.number().min(0).max(1).optional(),
  lowpassHz: z.number().positive().optional(),
  highpassHz: z.number().positive().optional(),
  tailGainDb: z.number().optional(),
  wetMix: z.number().min(0).max(1).optional(),
  dryMix: z.number().min(0).max(1).optional(),
  thresholdDb: z.number().optional(),
  ratio: z.number().positive().optional(),
  attackMs: z.number().positive().optional(),
  releaseMs: z.number().positive().optional(),
  impulseResponse: z.string().trim().optional(),
  tempoStretchRatio: z.number().positive().optional(),
  duckingGainDb: z.number().optional()
}).passthrough();

export type SoundDesignPresetSettings = z.infer<typeof soundDesignPresetSettingsSchema>;

export const soundDesignPresetOverrideSchema = soundDesignPresetSettingsSchema.partial().passthrough();
export type SoundDesignPresetOverride = z.infer<typeof soundDesignPresetOverrideSchema>;
export const soundDesignPresetOverridesSchema = z.record(z.string(), soundDesignPresetOverrideSchema)
  .default({})
  .refine((value) => Object.keys(value).every((key) => soundDesignPresetNameSchema.safeParse(key).success), {
    message: "Preset override keys must match a known sound design preset."
  });

export const soundDesignCueTransitionSchema = z.object({
  preset: soundDesignPresetNameSchema,
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  settings: z.record(z.string(), z.unknown()).default(() => ({} as Record<string, unknown>))
}).refine((value) => value.duration > 0, {
  message: "Transition duration must be positive."
});

export type SoundDesignCueTransition = z.infer<typeof soundDesignCueTransitionSchema>;

const soundDesignCueBaseSchema = z.object({
  id: z.string().trim().min(1),
  file: z.string().trim().min(1),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  role: soundDesignCueRoleSchema.default("music"),
  gainDb: z.number().default(0),
  sourceStart: z.number().nonnegative().optional(),
  sourceEnd: z.number().positive().optional(),
  transitionIn: soundDesignCueTransitionSchema.optional(),
  transitionOut: soundDesignCueTransitionSchema.optional(),
  tempoStretchRatio: z.number().positive().optional(),
  tags: z.array(z.string().trim().min(1)).default([])
});

export const soundDesignCueSchema = soundDesignCueBaseSchema.refine((value) => value.end > value.start, {
  message: "Cue end must be greater than cue start."
});

export type SoundDesignCue = z.infer<typeof soundDesignCueSchema>;

const soundDesignSfxCueSchema = soundDesignCueBaseSchema.safeExtend({
  role: z.literal("sfx")
}).refine((value) => value.end > value.start, {
  message: "Cue end must be greater than cue start."
});

export const soundDesignMasterSchema = z.object({
  targetI: z.number().min(-30).max(-6).default(-16),
  truePeak: z.number().min(-6).max(0).default(-1.5),
  lra: z.number().min(0).max(20).default(11),
  sampleRate: z.number().int().positive().default(48000),
  previewSampleRate: z.number().int().positive().default(22050)
});

export type SoundDesignMasterTargets = z.infer<typeof soundDesignMasterSchema>;

export const soundDesignManifestSchema = z.object({
  duration: z.number().positive(),
  dialogueSource: z.string().trim().optional(),
  dialogue: z.array(soundDesignDialogueSpanSchema).default([]),
  musicCues: z.array(soundDesignCueSchema).default([]),
  sfx: z.array(soundDesignSfxCueSchema).default([]),
  master: soundDesignMasterSchema,
  presetOverrides: soundDesignPresetOverridesSchema
}).refine((value) => value.musicCues.every((cue) => cue.role === "music"), {
  message: "All music cues must use the music role."
}).refine((value) => value.sfx.every((cue) => cue.role === "sfx"), {
  message: "All SFX cues must use the sfx role."
});

export type SoundDesignManifest = z.infer<typeof soundDesignManifestSchema>;

export type SoundDesignCapabilityFlags = {
  afir: boolean;
  rubberband: boolean;
  loudnorm: boolean;
  alimiter: boolean;
  sidechaincompress: boolean;
  showwavespic: boolean;
};

export type SoundDesignResolvedInput = {
  index: number;
  id: string;
  role: "dialogue" | "music" | "sfx" | "impulse-response";
  path: string;
};

export type SoundDesignResolvedTransition = {
  preset: SoundDesignPresetName;
  startSeconds: number;
  durationSeconds: number;
  settings: SoundDesignPresetSettings;
  phase: "in" | "out";
};

export type SoundDesignResolvedCue = {
  index: number;
  id: string;
  role: SoundDesignCueRole;
  inputIndex: number;
  sourcePath: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  gainDb: number;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  tempoStretchRatio?: number;
  transitionIn?: SoundDesignResolvedTransition;
  transitionOut?: SoundDesignResolvedTransition;
  presetSettings: Partial<Record<SoundDesignPresetName, SoundDesignPresetSettings>>;
  tags: string[];
};

export type SoundDesignDialogueSpanPlan = {
  index: number;
  label: string;
  startSeconds: number;
  endSeconds: number;
  gainDb: number;
};

export type SoundDesignPlan = {
  manifest: SoundDesignManifest;
  baseDir: string;
  resolvedInputs: SoundDesignResolvedInput[];
  dialogueSpans: SoundDesignDialogueSpanPlan[];
  musicCues: SoundDesignResolvedCue[];
  sfxCues: SoundDesignResolvedCue[];
  capabilities: SoundDesignCapabilityFlags;
  warnings: string[];
  notes: string[];
};

export type SoundDesignFilterGraphCompilation = {
  filterComplexScript: string;
  previewFilterComplexScript: string;
  inputFiles: string[];
  masterLabel: string;
  previewLabel: string;
  stemLabels: {
    dialogue: string | null;
    music: string | null;
    sfx: string | null;
  };
  appliedPresets: Array<{
    cueId: string;
    preset: SoundDesignPresetName;
    phase: "in" | "out" | "bed";
  }>;
  debug: Record<string, unknown>;
};

export type SoundDesignRenderOptions = {
  baseDir?: string;
  previewMixPath?: string;
  waveformPngPath?: string;
  peaksJsonPath?: string;
  stemsDir?: string;
  aacPath?: string;
  debugPlanPath?: string;
  logCommand?: (command: string) => void;
};

export type SoundDesignRenderResult = {
  manifest: SoundDesignManifest;
  plan: SoundDesignPlan;
  compilation: SoundDesignFilterGraphCompilation;
  masterPath: string;
  aacPath: string | null;
  previewMixPath: string | null;
  waveformPngPath: string | null;
  peaksJsonPath: string | null;
  stemPaths: {
    dialogue: string | null;
    music: string | null;
    sfx: string | null;
  };
  ffmpegCommand: string;
  previewFfmpegCommand: string | null;
  warnings: string[];
  debug: Record<string, unknown>;
};

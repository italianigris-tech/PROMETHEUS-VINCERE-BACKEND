import {z} from "zod";

export const WordSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  confidence: z.number().min(0).max(1).optional(),
  emphasis: z.number().min(0).max(1).optional(),
});

export const SFXEventSchema = z.object({
  id: z.string(),
  cue: z.enum([
    "whoosh_fast",
    "whoosh_slow",
    "impact_deep",
    "impact_sharp",
    "riser_short",
    "sub_drop",
    "glitch_digital",
    "pop_text",
  ]),
  variant: z.number().int().min(1).max(5).optional(),
  triggerMs: z.number(),
  durationMs: z.number().default(300),
  volumeDb: z.number().default(-12),
  duckMusicDb: z.number().default(-6),
});

export const TextEventSchema = z.object({
  type: z.literal("text"),
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  style: z.enum([
    "pop",
    "slide_up",
    "slide_down",
    "glitch",
    "typewriter",
    "elastic_scale",
  ]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFFFFF"),
  highlightColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.object({
    x: z.number().min(0).max(1).default(0.5),
    y: z.number().min(0).max(1).default(0.12),
    z: z.number().default(0.1),
  }).default({x: 0.5, y: 0.12, z: 0.1}),
  scale: z.number().default(1),
  cameraPush: z.number().min(0).max(1).default(0),
  shake: z.number().min(0).max(1).default(0),
});

export const CutEventSchema = z.object({
  type: z.literal("cut"),
  atMs: z.number(),
  toMs: z.number(),
  style: z.enum(["hard", "whip_right", "whip_left", "zoom_blur"]),
  intensity: z.number().min(0).max(1).default(0.5),
});

export const CameraEventSchema = z.object({
  type: z.literal("camera"),
  move: z.enum([
    "push_in",
    "pull_out",
    "dutch_left",
    "dutch_right",
    "handheld_shake",
  ]),
  startMs: z.number(),
  endMs: z.number(),
  intensity: z.number().min(0).max(1).default(0.5),
  curve: z.enum(["linear", "ease_in", "ease_out", "elastic"]).default("ease_out"),
});

export const ColorEventSchema = z.object({
  type: z.literal("color"),
  lut: z.enum(["high_energy", "reflective", "neutral", "dramatic_cool"]),
  startMs: z.number(),
  endMs: z.number(),
  intensity: z.number().min(0).max(1).default(0.5),
});

export const TransitionEventSchema = z.object({
  type: z.literal("transition"),
  style: z.enum(["zoom_blur", "whip_pan", "glitch_flash"]),
  atMs: z.number(),
  durationMs: z.number().default(400),
  intensity: z.number().min(0).max(1).default(0.7),
});

export const TimelineEventSchema = z.union([
  CutEventSchema,
  TextEventSchema,
  CameraEventSchema,
  ColorEventSchema,
  TransitionEventSchema,
]);

export const VideoTrackSchema = z.object({
  id: z.string().optional(),
  sourcePath: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

export const CameraMoveSchema = z.object({
  type: z.enum(["push_in", "dutch", "shake"]),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

export const TextOverlaySchema = z.object({
  text: z.string(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  animation: z.enum(["pop", "slide_up", "glitch", "typewriter", "elastic_scale"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const TransitionSchema = z.object({
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

export const UnifiedRenderManifestSchema = z.object({
  version: z.literal("2.0"),
  jobId: z.string().uuid(),
  seed: z.number().int().min(0).max(2147483647),
  createdAt: z.string().datetime(),

  durationFrames: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  videoTracks: z.array(VideoTrackSchema).default([]),
  cameraMoves: z.array(CameraMoveSchema).default([]),
  textOverlays: z.array(TextOverlaySchema).default([]),
  transitions: z.array(TransitionSchema).default([]),

  source: z.object({
    videoUrl: z.string().min(1),
    audioUrl: z.string().min(1).optional(),
    transcript: z.array(WordSchema).default([]),
    durationMs: z.number().positive(),
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    fps: z.number().int().positive().default(30),
  }),

  audio: z.object({
    beats: z.array(z.number()).default([]),
    onsets: z.array(z.number()).default([]),
    energyCurve: z.array(z.number()).optional(),
    musicTrackUrl: z.string().min(1).optional(),
    musicBpm: z.number().optional(),
    sfx: z.array(SFXEventSchema).default([]),
    voiceVolumeDb: z.number().default(0),
    musicVolumeDb: z.number().default(-18),
    targetLufs: z.number().default(-14),
  }),

  timeline: z.array(TimelineEventSchema).default([]),

  creativeProfile: z.object({
    name: z.enum(["joseph_aggressive", "joseph_cinematic", "joseph_minimal"]),
    cutDensity: z.number().min(0.1).max(2),
    textDensity: z.number().min(0).max(1),
    sfxDensity: z.number().min(0).max(1),
    cameraAggression: z.number().min(0).max(1),
    colorIntensity: z.number().min(0).max(1),
  }),

  output: z.object({
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    fps: z.number().int().positive().default(30),
    codec: z.enum(["h264", "h265"]).default("h264"),
    crf: z.number().int().default(18),
  }),
});

export type UnifiedRenderManifest = z.infer<typeof UnifiedRenderManifestSchema>;
export type Word = z.infer<typeof WordSchema>;
export type SFXEvent = z.infer<typeof SFXEventSchema>;
export type TextEvent = z.infer<typeof TextEventSchema>;
export type CutEvent = z.infer<typeof CutEventSchema>;
export type CameraEvent = z.infer<typeof CameraEventSchema>;
export type ColorEvent = z.infer<typeof ColorEventSchema>;
export type TransitionEvent = z.infer<typeof TransitionEventSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type VideoTrack = z.infer<typeof VideoTrackSchema>;
export type CameraMove = z.infer<typeof CameraMoveSchema>;
export type TextOverlay = z.infer<typeof TextOverlaySchema>;
export type Transition = z.infer<typeof TransitionSchema>;

/**
 * Single authority map for Joseph audio lanes.
 * Joseph production audio must flow through the video-aware DJ plan compiled into UnifiedRenderManifest.audio.djPlan.
 */

export type JosephAudioLaneStatus = "live" | "dry_run_only" | "deferred" | "evidence_optional";

export type JosephAudioLane = {
  module: string;
  status: JosephAudioLaneStatus;
  role: string;
};

export type JosephAudioSpineStatus = {
  version: "joseph-audio-spine-v1";
  livePath: JosephAudioLane[];
  dryRunOnly: JosephAudioLane[];
  irlEvidence: Array<{
    artifact: string;
    status: JosephAudioLaneStatus;
    role: string;
  }>;
  productionRule: string;
};

export const JOSEPH_AUDIO_SPINE_STATUS: JosephAudioSpineStatus = {
  version: "joseph-audio-spine-v1",
  livePath: [
    {
      module: "backend/src/upload/joseph-upload-pipeline.ts",
      status: "live",
      role: "Manifest Compiler adapter: builds a render_ready video-aware DJ plan from render-safe local tracks and writes it to UnifiedRenderManifest.audio.djPlan.",
    },
    {
      module: "backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts",
      status: "live",
      role: "Production DJ planner: arranges music cues, transitions, fades, and ducking regions against video/transcript timing.",
    },
    {
      module: "backend/src/audio/mix-audio.ts",
      status: "live",
      role: "Worker final mix: renders UnifiedRenderManifest.audio.djPlan music events with voice, SFX, fades, delays, and ducking.",
    },
  ],
  dryRunOnly: [
    {
      module: "backend/src/music/renderer/manifest-adapter.ts",
      status: "dry_run_only",
      role: "SoundDesignManifest rehearsal adapter; not the Joseph production render authority.",
    },
    {
      module: "backend/src/music/renderer/mix-renderer.ts",
      status: "dry_run_only",
      role: "Music preview/rehearsal renderer; not the Joseph production mix path.",
    },
  ],
  irlEvidence: [
    {
      artifact: "audio-artifacts/*.audio-artifact.json",
      status: "evidence_optional",
      role: "Local ffmpeg WAV energy/onset evidence for IRL labels.",
    },
    {
      artifact: "transcript-evidence/*.transcript-evidence.json",
      status: "evidence_optional",
      role: "AssemblyAI when configured; trainable only when status completed.",
    },
  ],
  productionRule:
    "Joseph production DJ authority is upload pipeline -> video-aware audio plan -> UnifiedRenderManifest.audio.djPlan -> mixAudio. Legacy musicTrackUrl/musicReference are compatibility fallback fields, not Joseph creative authority.",
};

const normalizedLiveModules = new Set(JOSEPH_AUDIO_SPINE_STATUS.livePath.map((lane) => lane.module));

export const isLiveJosephAudioModule = (modulePath: string): boolean =>
  normalizedLiveModules.has(modulePath.replace(/\\/g, "/"));

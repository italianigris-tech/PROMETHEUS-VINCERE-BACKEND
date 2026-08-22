/**
 * Prometheus Mini-Run Studio — Spatio-Temporal Spatial Audio Orchestrator
 * 
 * Generates authoritative, sample-accurate, spatio-temporal sound design manifests
 * locked to the 120 BPM orchestral beat grid with 3D stereo panning, Z-depth acoustic
 * filtering, dynamic voice ducking envelopes, and zero playback latency.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

export type AudioStem = "music_stem" | "sfx_stem" | "atmos_stem";

export type SpatioTemporalCategory = 
  | "beat_pulse"
  | "typewriter_tick"
  | "counter_roll"
  | "braaam_slam"
  | "impact_hit"
  | "riser_sweep"
  | "whoosh_swish"
  | "telemetry_chirp"
  | "drone_atmos";

export interface SpatioTemporalSynthesisParams {
  oscType?: OscillatorType;
  baseFreqHz?: number;
  endFreqHz?: number;
  attackSec: number;
  decaySec: number;
  sustainLevel: number;
  releaseSec: number;
  filterType?: BiquadFilterType;
  filterQ?: number;
  noiseBurst?: boolean;
  distortionAmount?: number;
}

export interface SpatioTemporalSoundCue {
  id: string;
  chunkIndex: number;
  videoTimeSec: number;
  durationSec: number;
  category: SpatioTemporalCategory;
  stem: AudioStem;
  label: string;
  spatialPan: number; // -1.0 (Full Left) to +1.0 (Full Right)
  depthPlane: 10 | 20 | 30; // 10 = Behind Head, 20 = Speaker, 30 = Foreground
  lowpassCutoffHz: number; // Acoustic distance attenuation
  gainDb: number;
  voiceDuckingGainDb: number;
  synthesis: SpatioTemporalSynthesisParams;
}

export interface BeatGridMark {
  beatIndex: number;
  timeSec: number;
  isDownbeat: boolean; // True for beat 1 of each 4-beat bar (every 2.0s)
  bpm: number;
}

export interface OrchestratedAudioPlan {
  totalDurationSec: number;
  bpm: number;
  beatIntervalSec: number;
  beats: BeatGridMark[];
  cues: SpatioTemporalSoundCue[];
  masterTargetLufs: number;
  truePeakDb: number;
}

/**
 * Calculates real-time 3D stereo panning from on-screen horizontal percentage
 */
export function calculateSpatialPan(screenXPercent: number): number {
  const pan = (screenXPercent - 50) / 40;
  return Math.max(-1.0, Math.min(1.0, Number(pan.toFixed(2))));
}

/**
 * Calculates acoustic low-pass filter cutoff from 3D depth plane
 */
export function calculateDepthCutoffHz(depthPlane: 10 | 20 | 30): number {
  switch (depthPlane) {
    case 10:
      return 1400; // Muffled acoustic dispersion behind speaker
    case 20:
      return 6500; // Neutral mid-field
    case 30:
    default:
      return 18500; // Crisp high-transient foreground
  }
}

/** Last-known duration of the real working sample (raw_original_video.mp4, 60.10s,
 *  23.98 fps, AAC audio). Used ONLY as a fallback when the video or ffmpeg is
 *  unavailable — the builder normally probes the short on disk and adapts to
 *  whatever length is actually present. */
export const AUTHORITATIVE_VIDEO_DURATION_SEC = 60.1;
/** Number of spoken content sections the 20 authored cues map to across the video. */
const AUTHORITATIVE_CONTENT_CHUNKS = 20;
/** Legacy grid the cues were authored on (2.0s per chunk = the old 40s cut). */
const LEGACY_CHUNK_SEC = 2.0;

/* Duration resolution — the plan must rebuild from the SHORT ITSELF, never a
 * guessed constant. */
const WORKING_VIDEO_FILENAME = "raw_original_video.mp4";

function runCmd(cmd: string[]): string {
  try {
    const r = spawnSync(cmd[0], cmd.slice(1), {
      encoding: "latin1",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    return `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  } catch {
    return "";
  }
}

function resolveFfmpegPath(): string | null {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const candidates = [
    "/home/ec2-user/.local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

/** Probe the working short's true duration from disk; null when unavailable. */
export function probeWorkingVideoDurationSec(): number | null {
  const abs = path.join(__dirname, WORKING_VIDEO_FILENAME);
  if (!fs.existsSync(abs)) return null;
  const ffmpeg = resolveFfmpegPath();
  if (!ffmpeg) return null;
  const out = runCmd([ffmpeg, "-hide_banner", "-i", abs]);
  const m = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * CAUSAL VOICE DUCKING — the video is a spoken presentation, so every SFX cue
 * must yield bed headroom for speech. Cues authored with a duck keep it; cues
 * authored with 0.0 (no ducking) derive one from their loudness pressure and
 * duration, clamped into the [-8.0, -3.0] speech-preservation band.
 */
function causalDuckDepth(cue: SpatioTemporalSoundCue): number {
  if (cue.voiceDuckingGainDb < 0) return cue.voiceDuckingGainDb;
  const pressure = Math.max(0, 8 + cue.gainDb); // quieter (more -dB) presses less
  const depth = 3.0 + Math.min(5.0, pressure * 0.18 + cue.durationSec * 0.6);
  return -Number(Math.max(3.0, Math.min(8.0, depth)).toFixed(1));
}

/**
 * Builds the Authoritative Spatio-Temporal Orchestrated Audio Plan, causally
 * locked to the duration of the short ITSELF. Call with no argument and the
 * builder probes the working video on disk (ffmpeg) and adapts the beat grid,
 * chunk scaling and every cue anchor to whatever length is present — a 30s cut
 * yields 60 beats, a 90s cut 180 beats. An explicit `videoDurationSec` overrides
 * the probe; the constant is only a last-resort fallback. The 20 spoken content
 * sections are scaled evenly across the full video so cue #N stays pinned to
 * content section #N and the master climax lands on the video's final section —
 * not a 40.0s cut.
 */
export function buildAuthoritativeSequenceAudioPlan(
  videoDurationSec?: number,
): OrchestratedAudioPlan {
  // Explicit duration wins; otherwise probe the short on disk; constant is the
  // last-resort fallback so the studio never builds against a guessed length.
  const totalDurationSec =
    videoDurationSec ?? probeWorkingVideoDurationSec() ?? AUTHORITATIVE_VIDEO_DURATION_SEC;
  const bpm = 120;
  const beatIntervalSec = 60 / bpm; // 0.500s per beat (4 beats per 2.0s downbeat cell)
  const totalBeats = Math.max(1, Math.round(totalDurationSec / beatIntervalSec)); // 120 beats @ 60.1s
  const chunkDurationSec = totalDurationSec / AUTHORITATIVE_CONTENT_CHUNKS; // 3.005s per section

  const beats: BeatGridMark[] = [];
  for (let i = 0; i < totalBeats; i++) {
    beats.push({
      beatIndex: i,
      timeSec: Number((i * beatIntervalSec).toFixed(3)),
      isDownbeat: i % 4 === 0,
      bpm
    });
  }

  const authoredCues: SpatioTemporalSoundCue[] = [
    // CHUNK 1: "You can make" (0.00s — 2.00s) | Context / Setup
    {
      id: "cue_01_drone",
      chunkIndex: 1,
      videoTimeSec: 0.0,
      durationSec: 2.0,
      category: "drone_atmos",
      stem: "atmos_stem",
      label: "Atmospheric Sub Drone Warmth",
      spatialPan: 0.0,
      depthPlane: 10,
      lowpassCutoffHz: 3200,
      gainDb: -12.0,
      voiceDuckingGainDb: -6.0,
      synthesis: {
        oscType: "sine",
        baseFreqHz: 55.0, // A1
        endFreqHz: 55.0,
        attackSec: 0.4,
        decaySec: 0.2,
        sustainLevel: 0.8,
        releaseSec: 0.6,
        filterType: "lowpass",
        filterQ: 1.5
      }
    },
    // CHUNK 2: "$50,000 a month" (2.00s — 4.00s) | Hero Metric Roll-Up
    {
      id: "cue_02_counter_roll",
      chunkIndex: 2,
      videoTimeSec: 2.0,
      durationSec: 0.8,
      category: "counter_roll",
      stem: "sfx_stem",
      label: "3D Film Roll-Up Ratchet Clicks",
      spatialPan: 0.35,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -8.0,
      voiceDuckingGainDb: -3.5,
      synthesis: {
        oscType: "triangle",
        baseFreqHz: 1800,
        endFreqHz: 3400,
        attackSec: 0.01,
        decaySec: 0.04,
        sustainLevel: 0.1,
        releaseSec: 0.05,
        noiseBurst: true,
        filterType: "bandpass",
        filterQ: 4.0
      }
    },
    {
      id: "cue_02_cash_chime",
      chunkIndex: 2,
      videoTimeSec: 2.8,
      durationSec: 1.2,
      category: "impact_hit",
      stem: "sfx_stem",
      label: "Golden Metric Resolution Chime",
      spatialPan: 0.4,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -6.5,
      voiceDuckingGainDb: -4.0,
      synthesis: {
        oscType: "sine",
        baseFreqHz: 1760, // A6
        endFreqHz: 880,
        attackSec: 0.005,
        decaySec: 0.3,
        sustainLevel: 0.3,
        releaseSec: 0.8,
        filterType: "highpass",
        filterQ: 2.0
      }
    },
    // CHUNK 3: "and still" (4.00s — 6.00s) | Transition Bridge
    {
      id: "cue_03_whoosh",
      chunkIndex: 3,
      videoTimeSec: 4.0,
      durationSec: 0.65,
      category: "whoosh_swish",
      stem: "sfx_stem",
      label: "Aperture Soft Transition Whoosh",
      spatialPan: -0.2,
      depthPlane: 30,
      lowpassCutoffHz: 14000,
      gainDb: -10.0,
      voiceDuckingGainDb: -3.4,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 400,
        endFreqHz: 1600,
        attackSec: 0.15,
        decaySec: 0.25,
        sustainLevel: 0.2,
        releaseSec: 0.25,
        filterType: "bandpass",
        filterQ: 1.8
      }
    },
    // CHUNK 4: "have a broken business." (6.00s — 8.00s) | Inflection Tension Slam
    {
      id: "cue_04_braaam",
      chunkIndex: 4,
      videoTimeSec: 6.0,
      durationSec: 1.8,
      category: "braaam_slam",
      stem: "sfx_stem",
      label: "Cinematic Tension Braaam & Sub-Drop",
      spatialPan: 0.0,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -4.0,
      voiceDuckingGainDb: -4.0,
      synthesis: {
        oscType: "sawtooth",
        baseFreqHz: 73.4, // D2
        endFreqHz: 36.7, // D1 Sub drop
        attackSec: 0.02,
        decaySec: 0.6,
        sustainLevel: 0.5,
        releaseSec: 1.1,
        distortionAmount: 0.4,
        filterType: "lowpass",
        filterQ: 3.5
      }
    },
    // CHUNK 5: "Because revenue" (8.00s — 10.00s) | Context Logic
    {
      id: "cue_05_typewriter",
      chunkIndex: 5,
      videoTimeSec: 8.0,
      durationSec: 0.7,
      category: "typewriter_tick",
      stem: "sfx_stem",
      label: "Micro-Keystroke Mechanical Ticks",
      spatialPan: -0.15,
      depthPlane: 10,
      lowpassCutoffHz: 4500,
      gainDb: -14.0,
      voiceDuckingGainDb: -3.4,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 2200,
        endFreqHz: 800,
        attackSec: 0.005,
        decaySec: 0.03,
        sustainLevel: 0.0,
        releaseSec: 0.02,
        filterType: "highpass",
        filterQ: 5.0
      }
    },
    // CHUNK 6: "doesn't automatically mean" (10.00s — 12.00s) | Clause Glitch
    {
      id: "cue_06_glitch",
      chunkIndex: 6,
      videoTimeSec: 10.0,
      durationSec: 0.5,
      category: "telemetry_chirp",
      stem: "sfx_stem",
      label: "Digital Matrix Telemetry Chirp",
      spatialPan: 0.25,
      depthPlane: 30,
      lowpassCutoffHz: 12000,
      gainDb: -12.0,
      voiceDuckingGainDb: -3.3,
      synthesis: {
        oscType: "square",
        baseFreqHz: 1200,
        endFreqHz: 2800,
        attackSec: 0.01,
        decaySec: 0.1,
        sustainLevel: 0.1,
        releaseSec: 0.2,
        filterType: "bandpass",
        filterQ: 6.0
      }
    },
    // CHUNK 7: "you're building something scalable." (12.00s — 14.00s) | Hero Concept Impact
    {
      id: "cue_07_riser_hit",
      chunkIndex: 7,
      videoTimeSec: 12.0,
      durationSec: 1.6,
      category: "impact_hit",
      stem: "sfx_stem",
      label: "Riser Crescendo into Heavy Punch Hit",
      spatialPan: 0.0,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -5.0,
      voiceDuckingGainDb: -3.0,
      synthesis: {
        oscType: "triangle",
        baseFreqHz: 130,
        endFreqHz: 45,
        attackSec: 0.01,
        decaySec: 0.4,
        sustainLevel: 0.4,
        releaseSec: 1.0,
        distortionAmount: 0.3,
        filterType: "lowpass",
        filterQ: 2.8
      }
    },
    // CHUNK 8: "I've seen founders" (14.00s — 16.00s) | Vintage Trio Asset
    {
      id: "cue_08_vintage_telemetry",
      chunkIndex: 8,
      videoTimeSec: 14.0,
      durationSec: 1.5,
      category: "telemetry_chirp",
      stem: "sfx_stem",
      label: "Vintage Foundry Telemetry Texture",
      spatialPan: -0.45,
      depthPlane: 10,
      lowpassCutoffHz: 1400,
      gainDb: -15.0,
      voiceDuckingGainDb: -3.9,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 600,
        endFreqHz: 300,
        attackSec: 0.05,
        decaySec: 0.3,
        sustainLevel: 0.3,
        releaseSec: 0.8,
        filterType: "bandpass",
        filterQ: 2.0
      }
    },
    // CHUNK 9: "make serious money" (16.00s — 18.00s) | Key Point Accent
    {
      id: "cue_09_keystroke_accent",
      chunkIndex: 9,
      videoTimeSec: 16.0,
      durationSec: 0.9,
      category: "typewriter_tick",
      stem: "sfx_stem",
      label: "Dual Mechanical Impact Keystrokes",
      spatialPan: 0.3,
      depthPlane: 30,
      lowpassCutoffHz: 16000,
      gainDb: -9.0,
      voiceDuckingGainDb: -3.5,
      synthesis: {
        oscType: "sine",
        baseFreqHz: 800,
        endFreqHz: 200,
        attackSec: 0.005,
        decaySec: 0.15,
        sustainLevel: 0.1,
        releaseSec: 0.2,
        noiseBurst: true,
        filterType: "highpass",
        filterQ: 3.0
      }
    },
    // CHUNK 10: "while working" (18.00s — 20.00s) | Transition Snare
    {
      id: "cue_10_whoosh_snare",
      chunkIndex: 10,
      videoTimeSec: 18.0,
      durationSec: 0.6,
      category: "whoosh_swish",
      stem: "sfx_stem",
      label: "Fast Whoosh Swish & Acoustic Snare",
      spatialPan: -0.25,
      depthPlane: 30,
      lowpassCutoffHz: 15000,
      gainDb: -10.0,
      voiceDuckingGainDb: -3.4,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 350,
        endFreqHz: 1200,
        attackSec: 0.08,
        decaySec: 0.2,
        sustainLevel: 0.1,
        releaseSec: 0.2,
        filterType: "bandpass",
        filterQ: 2.2
      }
    },
    // CHUNK 11: "seventy hours every week." (20.00s — 22.00s) | Hero Metric Clock
    {
      id: "cue_11_clock_ratchet",
      chunkIndex: 11,
      videoTimeSec: 20.0,
      durationSec: 1.2,
      category: "counter_roll",
      stem: "sfx_stem",
      label: "Ratchet Clock Ticking + High-Ring Accent",
      spatialPan: 0.4,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -7.5,
      voiceDuckingGainDb: -3.8,
      synthesis: {
        oscType: "triangle",
        baseFreqHz: 2400,
        endFreqHz: 1200,
        attackSec: 0.008,
        decaySec: 0.08,
        sustainLevel: 0.2,
        releaseSec: 0.3,
        filterType: "highpass",
        filterQ: 4.5
      }
    },
    // CHUNK 12: "That's not freedom." (22.00s — 24.00s) | Tension Thud
    {
      id: "cue_12_sub_thud",
      chunkIndex: 12,
      videoTimeSec: 22.0,
      durationSec: 1.4,
      category: "braaam_slam",
      stem: "sfx_stem",
      label: "Sub-Bass Thud & Lowpass Tremolo Hit",
      spatialPan: 0.0,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -5.0,
      voiceDuckingGainDb: -4.0,
      synthesis: {
        oscType: "sawtooth",
        baseFreqHz: 65.4, // C2
        endFreqHz: 32.7, // C1
        attackSec: 0.015,
        decaySec: 0.5,
        sustainLevel: 0.4,
        releaseSec: 0.8,
        filterType: "lowpass",
        filterQ: 3.0
      }
    },
    // CHUNK 13: "That's a" (24.00s — 26.00s) | Transition Pop
    {
      id: "cue_13_camera_shutter",
      chunkIndex: 13,
      videoTimeSec: 24.0,
      durationSec: 0.4,
      category: "telemetry_chirp",
      stem: "sfx_stem",
      label: "Camera Shutter Acoustic Click",
      spatialPan: -0.1,
      depthPlane: 30,
      lowpassCutoffHz: 14000,
      gainDb: -12.0,
      voiceDuckingGainDb: -3.2,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 1400,
        endFreqHz: 500,
        attackSec: 0.005,
        decaySec: 0.08,
        sustainLevel: 0.0,
        releaseSec: 0.08,
        filterType: "highpass",
        filterQ: 3.5
      }
    },
    // CHUNK 14: "very expensive job." (26.00s — 28.00s) | Metallic Impact
    {
      id: "cue_14_metallic_impact",
      chunkIndex: 14,
      videoTimeSec: 26.0,
      durationSec: 1.5,
      category: "impact_hit",
      stem: "sfx_stem",
      label: "Metallic Heavy Impact + Reverb Throw",
      spatialPan: 0.2,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -4.5,
      voiceDuckingGainDb: -3.0,
      synthesis: {
        oscType: "triangle",
        baseFreqHz: 440,
        endFreqHz: 80,
        attackSec: 0.01,
        decaySec: 0.4,
        sustainLevel: 0.3,
        releaseSec: 1.0,
        distortionAmount: 0.35,
        filterType: "bandpass",
        filterQ: 4.0
      }
    },
    // CHUNK 15: "The real goal" (28.00s — 30.00s) | Flywheel Asset Pulse
    {
      id: "cue_15_flywheel_pulse",
      chunkIndex: 15,
      videoTimeSec: 28.0,
      durationSec: 1.8,
      category: "drone_atmos",
      stem: "atmos_stem",
      label: "Acoustic Flywheel Harmonic Pulse",
      spatialPan: -0.35,
      depthPlane: 10,
      lowpassCutoffHz: 2200,
      gainDb: -14.0,
      voiceDuckingGainDb: -4.1,
      synthesis: {
        oscType: "sine",
        baseFreqHz: 110, // A2
        endFreqHz: 110,
        attackSec: 0.3,
        decaySec: 0.3,
        sustainLevel: 0.6,
        releaseSec: 0.8,
        filterType: "lowpass",
        filterQ: 2.0
      }
    },
    // CHUNK 16: "isn't just making more money." (30.00s — 32.00s) | Contrast Burst
    {
      id: "cue_16_typewriter_burst",
      chunkIndex: 16,
      videoTimeSec: 30.0,
      durationSec: 0.8,
      category: "typewriter_tick",
      stem: "sfx_stem",
      label: "Typewriter Rapid Fire Keystroke Burst",
      spatialPan: 0.15,
      depthPlane: 30,
      lowpassCutoffHz: 15000,
      gainDb: -11.0,
      voiceDuckingGainDb: -3.5,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 1800,
        endFreqHz: 600,
        attackSec: 0.005,
        decaySec: 0.04,
        sustainLevel: 0.05,
        releaseSec: 0.05,
        filterType: "highpass",
        filterQ: 4.0
      }
    },
    // CHUNK 17: "It's building systems" (32.00s — 34.00s) | Robotic Arm Asset
    {
      id: "cue_17_robotic_arm_servo",
      chunkIndex: 17,
      videoTimeSec: 32.0,
      durationSec: 1.5,
      category: "whoosh_swish",
      stem: "sfx_stem",
      label: "Robotic Arm Servo-Whoosh + Harmonic Chord",
      spatialPan: -0.4,
      depthPlane: 10,
      lowpassCutoffHz: 1800,
      gainDb: -13.0,
      voiceDuckingGainDb: -3.9,
      synthesis: {
        oscType: "sawtooth",
        baseFreqHz: 220,
        endFreqHz: 440,
        attackSec: 0.1,
        decaySec: 0.4,
        sustainLevel: 0.4,
        releaseSec: 0.8,
        filterType: "bandpass",
        filterQ: 3.5
      }
    },
    // CHUNK 18: "that keep producing results" (34.00s — 36.00s) | Industrial Gears Asset
    {
      id: "cue_18_gear_mesh",
      chunkIndex: 18,
      videoTimeSec: 34.0,
      durationSec: 1.4,
      category: "telemetry_chirp",
      stem: "sfx_stem",
      label: "Industrial Gear Mesh Click + Harmonic Lift",
      spatialPan: 0.35,
      depthPlane: 10,
      lowpassCutoffHz: 2000,
      gainDb: -14.0,
      voiceDuckingGainDb: -3.8,
      synthesis: {
        oscType: "triangle",
        baseFreqHz: 520,
        endFreqHz: 1040,
        attackSec: 0.05,
        decaySec: 0.3,
        sustainLevel: 0.3,
        releaseSec: 0.6,
        filterType: "bandpass",
        filterQ: 3.0
      }
    },
    // CHUNK 19: "without requiring you" (36.00s — 38.00s) | High Riser Pre-Roll
    {
      id: "cue_19_riser_pre",
      chunkIndex: 19,
      videoTimeSec: 36.0,
      durationSec: 1.9,
      category: "riser_sweep",
      stem: "sfx_stem",
      label: "High-Pass Sub Riser Pre-Roll to Climax",
      spatialPan: -0.15,
      depthPlane: 30,
      lowpassCutoffHz: 16000,
      gainDb: -8.0,
      voiceDuckingGainDb: -4.1,
      synthesis: {
        noiseBurst: true,
        baseFreqHz: 150,
        endFreqHz: 3200,
        attackSec: 0.6,
        decaySec: 0.5,
        sustainLevel: 0.8,
        releaseSec: 0.6,
        filterType: "highpass",
        filterQ: 2.5
      }
    },
    // CHUNK 20: "every single time." (38.00s — 40.00s) | Grand Climax Payoff
    {
      id: "cue_20_master_climax",
      chunkIndex: 20,
      videoTimeSec: 38.0,
      durationSec: 2.0,
      category: "braaam_slam",
      stem: "sfx_stem",
      label: "Master Orchestral Climax Slam & Sub-Drop",
      spatialPan: 0.0,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -3.5,
      voiceDuckingGainDb: -4.0,
      synthesis: {
        oscType: "sawtooth",
        baseFreqHz: 82.4, // E2
        endFreqHz: 41.2, // E1
        attackSec: 0.01,
        decaySec: 0.8,
        sustainLevel: 0.6,
        releaseSec: 1.2,
        distortionAmount: 0.45,
        filterType: "lowpass",
        filterQ: 4.0
      }
    }
  ];

  // CAUSAL RE-ANCHOR + DUCKING: the cues were authored on the legacy 40s grid
  // (2.0s/chunk). Scale each cue's in-chunk offset onto the true video timeline
  // so cue #N stays bound to spoken section #N, and ensure every cue ducks the
  // bed under speech (no 0.0-duck cues survive the plan).
  const cues: SpatioTemporalSoundCue[] = authoredCues.map((c) => {
    const legacyChunkStart = (c.chunkIndex - 1) * LEGACY_CHUNK_SEC;
    const offsetInChunk = Math.max(0, Math.min(LEGACY_CHUNK_SEC, c.videoTimeSec - legacyChunkStart));
    const scaledStart = (c.chunkIndex - 1) * chunkDurationSec;
    const scale = chunkDurationSec / LEGACY_CHUNK_SEC;
    return {
      ...c,
      videoTimeSec: Number((scaledStart + offsetInChunk * scale).toFixed(3)),
      durationSec: Number((c.durationSec * scale).toFixed(3)),
      voiceDuckingGainDb: causalDuckDepth(c),
    };
  });

  return {
    totalDurationSec,
    bpm,
    beatIntervalSec,
    beats,
    cues,
    masterTargetLufs: -16.0,
    truePeakDb: -1.5
  };
}

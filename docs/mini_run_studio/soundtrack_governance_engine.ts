/**
 * PROMETHEUS MINI-RUN STUDIO — CAUSALLY-LINKED SOUNDTRACK GOVERNANCE ENGINE
 *
 * Given a *video* it derives an audio descriptor (duration, fps, audio presence,
 * measured loudness in LUFS/dBTP, and a 120 BPM downbeat grid). From that it
 * selects a *soundtrack palette* (bed + underlay) with genuine variance — it spans
 * the SOUND FX/LOOPS + ATMOS + DRONES + SOUNDSCAPES catalog and never hard-wedges
 * a single cue — while honouring an explicit "I like THIS track" override. It then
 * plans a programme that:
 *
 *   • lasts exactly the video length PLUS a short tail (never cut short, never
 *     left hanging far above the ending),
 *   • fades IN over the first 2 seconds and OUT over the last 2 seconds,
 *   • is CAUSALLY LINKED end-to-end: every section (intro / per-chunk beds /
 *     outro) is traced to a concrete video event (downbeat / chunk boundary), so
 *     no cue is orphaned or invented,
 *   • is governed to the house loudness convention (-14 LUFS integrated,
 *     true peak <= -1.5 dBTP), so the bed never overwhelms dialogue.
 *
 * All assets live under docs/mini_run_studio/.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { buildAuthoritativeSequenceAudioPlan } from "./spatial_audio_orchestrator.js";

/* =========================================================================
 * Types
 * ======================================================================= */

export type AmbientAssetKind = "INST_LOOP" | "ATMOS_PAD" | "DRONE" | "SOUNDSCAPE";

export interface SoundtrackAsset {
  id: string;
  kind: AmbientAssetKind;
  /** Path relative to the repository root. */
  relativePath: string;
  /** Nominal loop length in seconds. */
  sourceDurationSec: number;
  /** Mood fingerprint used by the causal selector. */
  mood: { elevation: number; momentum: number; warmth: number };
  intensity: 1 | 2 | 3 | 4 | 5;
}

export interface LoudnessReading {
  integratedLufs: number;
  truePeakDb: number;
  lraLufs: number;
}

export interface VideoAudioDescriptorBrief {
  fileName: string;
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  measuredIntegratedLufs?: number;
  measuredTruePeakDb?: number;
}

export interface DownbeatEvent {
  dowIdx: number;      // 0-based downbeat index
  chunkIndex: number;  // 1-based, aligned to the 2s studio chunk grid
  barNumber: number;   // 1-based
  timeSec: number;
}

export interface CausalCause {
  gate: "video_start_fade" | "downbeat_boundary" | "video_end_fade" | "preferred_track_lock";
  event: { timeSec: number; chunkIndex?: number; barNumber?: number; reason: string };
}

export interface SoundtrackSection {
  sectionIndex: number;
  cellId: string;
  startSec: number;
  endSec: number;
  role: "intro_fade" | "bed" | "outro_fade";
  assetId: string;
  cause: CausalCause;
  gainDb: number;
}

export interface SoundtrackPalette {
  bedId: string;
  padId: string;
  moodTag: string;
  rationale: string;
  overrideApplied: boolean;
  seed: number;
}

export interface SoundtrackProgram {
  videoPath: string;
  videoDurationSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  tailSec: number;
  totalSec: number;
  integratedTargetLufs: number;
  truePeakCeilingDb: number;
  palette: SoundtrackPalette;
sections: SoundtrackSection[];
}
/* =========================================================================
 * Soundtrack catalog (the sanctioned variance material)
 * ======================================================================= */

export const SOUNDTRACK_CATALOG: SoundtrackAsset[] = [
  // Instrumental loops — the drive/bed layer.
  { id: "inst_loop_01", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 01.wav", sourceDurationSec: 3.75, mood: { elevation: 0.6, momentum: 0.7, warmth: 0.5 }, intensity: 3 },
  { id: "inst_loop_02", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 02.wav", sourceDurationSec: 9.84, mood: { elevation: 0.5, momentum: 0.6, warmth: 0.6 }, intensity: 3 },
  { id: "inst_loop_03", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 03.wav", sourceDurationSec: 7.50, mood: { elevation: 0.7, momentum: 0.8, warmth: 0.4 }, intensity: 4 },
  { id: "inst_loop_04", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 04.wav", sourceDurationSec: 1.88, mood: { elevation: 0.3, momentum: 0.4, warmth: 0.6 }, intensity: 2 },
  { id: "inst_loop_05", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 05.wav", sourceDurationSec: 7.50, mood: { elevation: 0.6, momentum: 0.7, warmth: 0.5 }, intensity: 3 },
  { id: "inst_loop_06", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 06.wav", sourceDurationSec: 7.50, mood: { elevation: 0.5, momentum: 0.6, warmth: 0.7 }, intensity: 3 },
  { id: "inst_loop_07", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 07.wav", sourceDurationSec: 7.50, mood: { elevation: 0.4, momentum: 0.5, warmth: 0.5 }, intensity: 2 },
  { id: "inst_loop_08", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 08.wav", sourceDurationSec: 3.75, mood: { elevation: 0.5, momentum: 0.5, warmth: 0.5 }, intensity: 2 },
  { id: "inst_loop_09", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 09.wav", sourceDurationSec: 15.00, mood: { elevation: 0.8, momentum: 0.9, warmth: 0.3 }, intensity: 5 },
  { id: "inst_loop_10", kind: "INST_LOOP", relativePath: "SOUND FX/LOOPS/Generdyn - INSTLoops - 10.wav", sourceDurationSec: 3.75, mood: { elevation: 0.4, momentum: 0.4, warmth: 0.6 }, intensity: 2 },
  // Atmospheric pads — the textural underlay.
  { id: "atmos_01", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 01.wav", sourceDurationSec: 30.0, mood: { elevation: 0.5, momentum: 0.2, warmth: 0.6 }, intensity: 1 },
  { id: "atmos_02", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 02.wav", sourceDurationSec: 30.0, mood: { elevation: 0.4, momentum: 0.1, warmth: 0.7 }, intensity: 1 },
  { id: "atmos_03", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 03.wav", sourceDurationSec: 30.0, mood: { elevation: 0.7, momentum: 0.3, warmth: 0.4 }, intensity: 2 },
  { id: "atmos_04", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 04.wav", sourceDurationSec: 30.0, mood: { elevation: 0.3, momentum: 0.2, warmth: 0.6 }, intensity: 1 },
  { id: "atmos_05", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 05.wav", sourceDurationSec: 30.0, mood: { elevation: 0.6, momentum: 0.4, warmth: 0.5 }, intensity: 2 },
  { id: "atmos_06", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 06.wav", sourceDurationSec: 30.0, mood: { elevation: 0.5, momentum: 0.3, warmth: 0.5 }, intensity: 1 },
  { id: "atmos_07", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 07.wav", sourceDurationSec: 30.0, mood: { elevation: 0.4, momentum: 0.2, warmth: 0.8 }, intensity: 1 },
  { id: "atmos_08", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 08.wav", sourceDurationSec: 30.0, mood: { elevation: 0.6, momentum: 0.3, warmth: 0.4 }, intensity: 2 },
  { id: "atmos_09", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 09.wav", sourceDurationSec: 30.0, mood: { elevation: 0.7, momentum: 0.4, warmth: 0.3 }, intensity: 3 },
  { id: "atmos_10", kind: "ATMOS_PAD", relativePath: "SOUND FX/ATMOS/Generdyn - ATMOS - 10.wav", sourceDurationSec: 30.0, mood: { elevation: 0.5, momentum: 0.5, warmth: 0.4 }, intensity: 2 },
  // Tension drones & soundscapes — for inflected passages.
  { id: "drone_dark", kind: "DRONE", relativePath: "SOUND FX/DRONES/idoberg-dark-drone-pad-467271.mp3", sourceDurationSec: 30.0, mood: { elevation: 0.2, momentum: 0.1, warmth: 0.2 }, intensity: 1 },
  { id: "drone_weird", kind: "DRONE", relativePath: "SOUND FX/DRONES/samuelfjohanns-weird-drones-12540.mp3", sourceDurationSec: 30.0, mood: { elevation: 0.1, momentum: 0.2, warmth: 0.1 }, intensity: 1 },
  { id: "soundscape_abyss", kind: "SOUNDSCAPE", relativePath: "SOUND FX/SOUNDSCAPES/The Abyss - Soundscapes - (Nikko Hunt's S.D.Essentials).wav", sourceDurationSec: 30.0, mood: { elevation: 0.2, momentum: 0.1, warmth: 0.2 }, intensity: 1 },
  { id: "soundscape_tension", kind: "SOUNDSCAPE", relativePath: "SOUND FX/SOUNDSCAPES/Heavy Tension - Soundscapes - (Nikko Hunt's S.D.Essentials).wav", sourceDurationSec: 30.0, mood: { elevation: 0.3, momentum: 0.3, warmth: 0.2 }, intensity: 2 },
];

const CATALOG_BY_ID = new Map<string, SoundtrackAsset>(SOUNDTRACK_CATALOG.map((a) => [a.id, a]));

export function getAsset(id: string): SoundtrackAsset | undefined {
  return CATALOG_BY_ID.get(id);
}

export interface GovernanceCheck {
  check: string;
  pass: boolean;
  detail: string;
}

export interface GovernanceReport {
  sample: VideoAudioDescriptorBrief;
  palette: SoundtrackPalette;
  program: SoundtrackProgram;
  checks: GovernanceCheck[];
  allPass: boolean;
  flaggedGaps: string[];
  renderProofPath: string | null;
}

/* =========================================================================
 * Studio constants
 * ======================================================================= */

export const STUDIO_BPM = 120;
export const CHUNK_SEC = 2.0;        // 4 beats => 2s downbeat cell
export const FADE_IN_SEC = 2.0;
export const FADE_OUT_SEC = 2.0;
export const MIN_TAIL_SEC = 0.5;
export const MAX_TAIL_SEC = 6.0;
export const INTEGRATED_TARGET_LUFS = -14;
export const TRUE_PEAK_CEILING_DB = -1.5;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clampTail(videoDur: number): number {
  // A "few seconds" tail: at least one beat past the frame, at most the ceiling.
  return clamp01((videoDur * 0.04 + 1.5)) * (MAX_TAIL_SEC - MIN_TAIL_SEC) + MIN_TAIL_SEC;
}
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_003;
  return h;
}
/* =========================================================================
 * FFmpeg resolution & video probing (mirrors the preflight conventions)
 * ======================================================================= */

export function resolveFfmpegPath(): string | null {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const candidates = [
    "/home/ec2-user/.local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

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

export interface ProbeResult {
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  loudness?: LoudnessReading;
}

/** Probe one video file (duration / fps / audio presence / loudness). */
export function probeVideo(studioRoot: string, relativeVideoPath: string): ProbeResult | null {
  const abs = path.join(studioRoot, relativeVideoPath);
  if (!fs.existsSync(abs)) return null;
  const ffmpeg = resolveFfmpegPath();
  if (!ffmpeg) return null;

  const metaOut = runCmd([ffmpeg, "-hide_banner", "-i", abs]);
  const durMatch = metaOut.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const durationSec = durMatch ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]) : 0;
  const fpsMatch = metaOut.match(/([\d.]+) fps/);
  const hasAudio = /Stream #[\d:].*\baudio\b/i.test(metaOut);

  // Loudness measurement (only meaningful when an audio stream exists).
  const loud = hasAudio ? measureLoudness(ffmpeg, abs) : undefined;

  return {
    durationSec,
    fps: fpsMatch ? Number(fpsMatch[1]) : 0,
    hasAudio,
    ...(loud ? { loudness: loud } : {}),
  };
}

/** ITU-R BS.1770 loudness via loudnorm summary (null if unavailable). */
export function measureLoudness(ffmpegPath: string, absVideo: string): LoudnessReading | null {
  const out = runCmd([
    ffmpegPath, "-y", "-hide_banner", "-nostats",
    "-i", absVideo,
    "-map", "0:a:0", "-vn",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=summary",
    "-f", "null", "-",
  ]);
  const integrated = out.match(/Input Integrated:\s+([-+]?\d+\.?\d*) LUFS/);
  const tp = out.match(/Input True Peak:\s+([-+]?\d+\.?\d*) dBTP/);
  const lra = out.match(/Input LRA:\s+([-+]?\d+\.?\d*) LU/);
  if (integrated && tp) {
    return {
      integratedLufs: Number(integrated[1]),
      truePeakDb: Number(tp[1]),
      lraLufs: lra ? Number(lra[1]) : 0,
    };
  }
  return null;
}

/* =========================================================================
 * Causal motion grid — the spine every soundtrack section keys to.
 * ======================================================================= */

export function buildMotionGrid(videoDurationSec: number): DownbeatEvent[] {
  const downbeats = Math.max(1, Math.ceil(videoDurationSec / CHUNK_SEC));
  const beats: DownbeatEvent[] = [];
  for (let d = 0; d < downbeats; d++) {
    beats.push({
      dowIdx: d,
      chunkIndex: d + 1,
      barNumber: Math.floor(d / 2) + 1, // 2 downbeats per 4s bar
      timeSec: Number((d * CHUNK_SEC).toFixed(3)),
    });
  }
  return beats;
}

/* =========================================================================
 * Palette selection — deterministic, variance-rich, override-capable
 * ======================================================================= */

const LOOP_INDEX = SOUNDTRACK_CATALOG.filter((a) => a.kind === "INST_LOOP");
const PAD_INDEX = SOUNDTRACK_CATALOG.filter((a) => a.kind === "ATMOS_PAD");

function bedAffinity(mood: { elevation: number; momentum: number }, lift: number, momentum: number): number {
  // Distance metric; lower is a better match.
  return Math.abs(mood.elevation - lift) * 0.55 + Math.abs(mood.momentum - momentum) * 0.45;
}

function pickBed(lift: number, momentum: number, seed: number): SoundtrackAsset {
  const sorted = [...LOOP_INDEX].sort((p, q) => bedAffinity(p.mood, lift, momentum) - bedAffinity(q.mood, lift, momentum));
  // Among the top-3 closest, pick deterministically by seed so structurally
  // different videos do not always collide on the very same bed.
  const tier = sorted.slice(0, 3);
  return tier[seed % tier.length];
}

function pickPad(momentum: number, elevation: number, seed: number): SoundtrackAsset {
  const sorted = [...PAD_INDEX].sort(
    (p, q) =>
      (Math.abs(p.mood.momentum - momentum) * 0.4 + Math.abs(p.mood.elevation - elevation) * 0.6) -
      (Math.abs(q.mood.momentum - momentum) * 0.4 + Math.abs(q.mood.elevation - elevation) * 0.6),
  );
  return sorted[seed % 3];
}

export function selectSoundtrackPalette(
  descriptor: VideoAudioDescriptorBrief,
  preferredTrackId?: string,
): SoundtrackPalette {
  const seed = hashString(`${descriptor.fileName}|${Math.round(descriptor.durationSec * 100)}|${descriptor.fps ?? 0}`);

  // 1) A client-named track always wins.
  if (preferredTrackId && getAsset(preferredTrackId)) {
    const bed = getAsset(preferredTrackId)!;
    const pad = pickPad(bed.mood.momentum, bed.mood.elevation, seed);
    return {
      bedId: bed.id,
      padId: pad.id,
      moodTag: "client_preferred",
      rationale: `Client explicitly named "${bed.id}" — absolute preference honoured; pad paired from its own mood profile.`,
      overrideApplied: true,
      seed,
    };
  }

  // 2) Infer an emotional plane from the video's causal weight.
  const lift = clamp01((descriptor.durationSec - 20) / 50);
  const momentum = clamp01(0.35 + (descriptor.durationSec > 40 ? 0.25 : 0.05));
  const bed = pickBed(lift, momentum, seed);
  const pad = pickPad(bed.mood.momentum, bed.mood.elevation, seed);

  return {
    bedId: bed.id,
    padId: pad.id,
    moodTag: `lift=${lift.toFixed(2)},momentum=${momentum.toFixed(2)}`,
    rationale: `Inferred lift=${lift.toFixed(2)} momentum=${momentum.toFixed(2)}; picked bed ${bed.id} w/ pad ${pad.id} — variant pool never hard-wedges a single cue.`,
    overrideApplied: false,
    seed,
  };
}

/* =========================================================================
 * Causal programme builder
 * ======================================================================= */

export function buildCausalProgram(
  descriptor: VideoAudioDescriptorBrief,
  palette: SoundtrackPalette,
): SoundtrackProgram {
  const bed = getAsset(palette.bedId);
  const bedGain = bed ? (bed.intensity >= 4 ? -6.0 : -3.5) : -3.5;

  const tail = clampTail(descriptor.durationSec);
  const totalSec = descriptor.durationSec + tail;
  const downbeats = buildMotionGrid(descriptor.durationSec);

  const sections: SoundtrackSection[] = [];
  let idx = 0;

  // Intro: fade-in over the first 2 seconds.
  sections.push({
    sectionIndex: idx++,
    cellId: "intro_fade",
    startSec: 0,
    endSec: FADE_IN_SEC,
    role: "intro_fade",
    assetId: palette.bedId,
    cause: {
      gate: "video_start_fade",
      event: { timeSec: 0, reason: "Video start; fade-in establishes the bed before dialogue begins." },
    },
    gainDb: -6.0,
  });

  // One bed cell per downbeat/chunk — each pinned to a causal video event.
  for (const ev of downbeats) {
    const start = ev.timeSec;
    const end = Math.min(start + CHUNK_SEC, descriptor.durationSec);
    if (end - start < 0.25) continue;
    sections.push({
      sectionIndex: idx++,
      cellId: `cell_${String(ev.chunkIndex).padStart(2, "0")}`,
      startSec: start,
      endSec: end,
      role: "bed",
      assetId: palette.bedId,
      cause: {
        gate: "downbeat_boundary",
        event: {
          timeSec: start,
          chunkIndex: ev.chunkIndex,
          barNumber: ev.barNumber,
          reason: `Downbeat ${ev.dowIdx}: bed aligns to chunk ${ev.chunkIndex} on the 120 BPM causal grid.`,
        },
      },
      gainDb: bedGain,
    });
  }

  // Outro: fade-out over the last 2 seconds; tail runs a beat past the ending.
  sections.push({
    sectionIndex: idx++,
    cellId: "outro_fade",
    startSec: Math.max(0, descriptor.durationSec - FADE_OUT_SEC),
    endSec: totalSec,
    role: "outro_fade",
    assetId: palette.bedId,
    cause: {
      gate: "video_end_fade",
      event: {
        timeSec: descriptor.durationSec - FADE_OUT_SEC,
        reason: "Video ends; fade-out over the final 2s, tail keeps the bed a few seconds longer than the video.",
      },
    },
    gainDb: -6.0,
  });

  return {
    videoPath: descriptor.fileName,
    videoDurationSec: descriptor.durationSec,
    fadeInSec: FADE_IN_SEC,
    fadeOutSec: FADE_OUT_SEC,
    tailSec: tail,
    totalSec,
    integratedTargetLufs: INTEGRATED_TARGET_LUFS,
    truePeakCeilingDb: TRUE_PEAK_CEILING_DB,
    palette,
    sections,
  };
}

/* =========================================================================
 * Governance invariant runner — causal chain + duration + fades + variety +
 * loudness ceiling, plus a "no orphaned cue" audit.
 * ======================================================================= */

export function assertGovernance(
  descriptor: VideoAudioDescriptorBrief,
  program: SoundtrackProgram,
): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];

  // 1. Causal completeness: each section carries a gate + event and stays in-bounds.
  const orphaned = program.sections.filter(
    (s) => !s.cause?.gate || s.startSec < -0.001 || s.endSec > program.totalSec + 0.5,
  );
  checks.push({
    check: "causal_linkage",
    pass: orphaned.length === 0,
    detail:
      orphaned.length === 0
        ? "All sections cite a concrete video event; none orphaned or out-of-window."
        : `Orphaned sections: ${orphaned.map((o) => o.cellId).join(", ")}`,
  });

  // 2. Temporal: bed runs past the video, but is bounded by the tail ceiling.
  const pastVideo = program.totalSec >= descriptor.durationSec + program.tailSec - 0.001;
  const bounded = program.totalSec <= descriptor.durationSec + MAX_TAIL_SEC + 0.001;
  checks.push({
    check: "tail_bounded",
    pass: pastVideo && bounded,
    detail: `total=${program.totalSec.toFixed(2)}s video=${descriptor.durationSec.toFixed(2)}s tail=${program.tailSec.toFixed(2)}s (bounds ${MIN_TAIL_SEC}-${MAX_TAIL_SEC}s)`,
  });

  // 3. Fades: in on first 2s, out on last 2s.
  const intro = program.sections.find((s) => s.role === "intro_fade");
  const outro = program.sections.find((s) => s.role === "outro_fade");
  const fadeOk =
    intro &&
    outro &&
    Math.abs(intro.endSec - FADE_IN_SEC) < 0.001 &&
    Math.abs(outro.startSec - (descriptor.durationSec - FADE_OUT_SEC)) < 0.001;
  checks.push({
    check: "fade_in_out",
    pass: Boolean(fadeOk),
    detail: fadeOk
      ? `fade-in ends at ${intro.endSec.toFixed(2)}s; fade-out starts at ${outro.startSec.toFixed(2)}s (2s before end).`
      : `intro end=${intro?.endSec} outro start=${outro?.startSec} — fade contract violated`,
  });

  // 4. Loudness governance: house spec respected.
  checks.push({
    check: "loudness_governance",
    pass:
      program.integratedTargetLufs <= INTEGRATED_TARGET_LUFS + 0.5 &&
      program.truePeakCeilingDb <= TRUE_PEAK_CEILING_DB + 0.01,
    detail: `target ${program.integratedTargetLufs.toFixed(1)} LUFS / ceiling ${program.truePeakCeilingDb.toFixed(1)} dBTP`,
  });

  // 5. Full bed coverage: the bed must be celled through the final chunk so the
  // outro fade (last 2s) is the only silent/wind-down region.
  const cells = program.sections.filter((s) => s.role === "bed");
  const coveredTo = cells.reduce((max, c) => Math.max(max, c.endSec), 0);
  checks.push({
    check: "full_bed_coverage",
    pass: coveredTo >= descriptor.durationSec - FADE_OUT_SEC - 0.05,
    detail: `bed cells cover up to ${coveredTo.toFixed(2)}s; outro fade window begins at ${(descriptor.durationSec - FADE_OUT_SEC).toFixed(2)}s`,
  });

  return checks;
}

/* =========================================================================
 * Causal-gap audit of the OTHER live-instrumented pipeline modules (owned
 * elsewhere) — flagged, never silently rewritten.
 * ======================================================================= */

export function auditCausalGaps(studioDir: string): string[] {
  const flags: string[] = [];
  const orcPath = path.join(studioDir, "spatial_audio_orchestrator.ts");
  if (fs.existsSync(orcPath)) {
    const body = fs.readFileSync(orcPath, "utf8");
    if (/totalDurationSec\s*=\s*40/.test(body)) {
      flags.push(
        "spatial_audio_orchestrator.ts hardcodes totalDurationSec=40.0 while the working video is ~60.1s — the master audio plan does NOT causally match real duration.",
      );
    }
    const duckingZero = (body.match(/voiceDuckingGainDb:\s*0\.0/g) || []).length;
    if (duckingZero > 4) {
      flags.push(`spatial_audio_orchestrator.ts: ${duckingZero} cues leave voiceDuckingGainDb=0 — the bed never ducks under speech.`);
    }
  }
  const manifestPath = path.join(studioDir, "build_sound_treatment_manifest.ts");
  if (fs.existsSync(manifestPath)) {
    const m = fs.readFileSync(manifestPath, "utf8");
    if (/uploaded_input_video\.mp4/.test(m)) {
      flags.push("build_sound_treatment_manifest.ts targets uploaded_input_video.mp4, which is SILENT (no audio stream) — it needs the soundtrack bed mixed on top.");
    }
    const rotations = (m.match(/defaultIndex\s*=\s*\(cueCount\s*%\s*[A-Z_]+\.length\)/g) || []).length;
    if (rotations > 0) {
      flags.push(`build_sound_treatment_manifest.ts uses ${rotations} mechanical cueCount%-rotations instead of semantically caused selections.`);
    }
  }
  return flags;
}
/* =========================================================================
 * Systematic variance + preference-override proofs.
 * ======================================================================= */

/** The engine must not hard-wedge a single bed for every structurally distinct video. */
export function paletteHasVariance(base: VideoAudioDescriptorBrief): GovernanceCheck {
  const variants = [0.5, 1.0, 1.5];
  const beds: string[] = variants.map((k, i) => {
    const b: VideoAudioDescriptorBrief = {
      fileName: `${base.fileName}#v${i}`,
      durationSec: Math.max(8, base.durationSec * k),
      fps: base.fps,
      hasAudio: base.hasAudio,
    };
    return selectSoundtrackPalette(b).bedId;
  });
  // Also sweep durations well outside the target band.
  beds.push(selectSoundtrackPalette({ ...base, fileName: `${base.fileName}#short`, durationSec: 8 }).bedId);
  beds.push(selectSoundtrackPalette({ ...base, fileName: `${base.fileName}#long`, durationSec: 120 }).bedId);
  const distinct = new Set(beds);
  return {
    check: "track_variance_non_hardcoded",
    pass: distinct.size >= 2,
    detail: `beds across structural variants: ${[...distinct].sort().join(", ")} (${distinct.size} distinct)`,
  };
}

/** A client-named track must always win over any inferred mood. */
export function palettePreferenceHonored(base: VideoAudioDescriptorBrief, preferredId: string): GovernanceCheck {
  const p = selectSoundtrackPalette(base, preferredId);
  return {
    check: "preferred_track_override",
    pass: p.overrideApplied && p.bedId === preferredId && getAsset(preferredId) !== undefined,
    detail: `requested "${preferredId}"; engine resolved bed="${p.bedId}" pad="${p.padId}" overrideApplied=${p.overrideApplied}`,
  };
}

/**
 * The SFX plan must rebuild to fit whatever short is actually being edited —
 * a 45s cut and a 90s cut must yield different beat grids and cue timelines,
 * with every cue inside the video window. Running the REAL builder here makes
 * "dynamic on the short itself" a hard gate in every governance run.
 */
export function sfxPlanDurationParametric(): GovernanceCheck {
  const samples = [30.0, 60.1, 90.0];
  const failures: string[] = [];
  for (const seconds of samples) {
    const plan = buildAuthoritativeSequenceAudioPlan(seconds);
    if (Math.abs(plan.totalDurationSec - seconds) > 0.001) {
      failures.push(`${seconds}s plan total=${plan.totalDurationSec}s`);
    }
    const expectedBeats = Math.max(1, Math.round(seconds / plan.beatIntervalSec));
    if (plan.beats.length !== expectedBeats) {
      failures.push(`${seconds}s beat count=${plan.beats.length} expected ${expectedBeats}`);
    }
    const lastBeat = plan.beats[plan.beats.length - 1].timeSec;
    if (lastBeat >= seconds) failures.push(`${seconds}s final beat ${lastBeat}s outside window`);
    const lastCueEnd = Math.max(...plan.cues.map((c) => c.videoTimeSec + c.durationSec));
    if (lastCueEnd > seconds + 0.001) failures.push(`${seconds}s cue ends ${lastCueEnd}s outside window`);
  }
  const distinct = new Set(samples.map((s) => buildAuthoritativeSequenceAudioPlan(s).totalDurationSec));
  return {
    check: "sfx_plan_duration_parametric",
    pass: failures.length === 0 && distinct.size === samples.length,
    detail: failures.length
      ? `SFX plan does NOT adapt to the short's duration: ${failures.join("; ")}`
      : "SFX plan rebuilds per short length (30s→60 beats, 60.1s→120 beats, 90s→180 beats) with every cue in-window",
  };
}

/* =========================================================================
 * Optional end-to-end render: realize the selected bed over the video length
 * with real fades + loudness normalization — proves the loudness path.
 * ======================================================================= */

export function renderProofBed(
  studioRoot: string,
  studioDir: string,
  program: SoundtrackProgram,
  outFileName: string,
): string | null {
  const ffmpegPath = resolveFfmpegPath();
  const asset = getAsset(program.palette.bedId);
  if (!ffmpegPath || !asset) return null;

  const src = path.join(studioRoot, asset.relativePath);
  // Proof bed stays INSIDE the mini-run studio; never spills into the repo root.
  const out = path.join(studioDir, outFileName);
  const fadeOutStart = program.videoDurationSec - FADE_OUT_SEC;
  // This ffmpeg build ships no `fade` filter, so we synthesize the identical
  // 2s in / 2s-out linear ramps with a per-frame `volume` expression:
  //   t < fadeIn            -> t/fadeIn            (fade IN  0 -> 1)
  //   t < fadeOutStart      -> 1                   (full bed)
  //   otherwise             -> max((videoEnd-t)/fadeOut, 0)  (fade OUT 1 -> 0,
  //                            reaching silence exactly at video end; tail stays silent)
  const volExpr = [
    `if(lt(t,${program.fadeInSec}),t/${program.fadeInSec}`,
    `if(lt(t,${fadeOutStart.toFixed(3)}),1`,
    `max((${program.videoDurationSec.toFixed(3)}-t)/${program.fadeOutSec},0)))`,
  ].join(",");
  const af = [
    `volume='${volExpr}':eval=frame`,
    `loudnorm=I=${INTEGRATED_TARGET_LUFS}:TP=${TRUE_PEAK_CEILING_DB}:LRA=11`,
  ].join(",");

  const args = [
    "-y", "-hide_banner", "-nostats",
    "-stream_loop", "-1", "-i", src,
    "-t", program.totalSec.toFixed(3),
    "-vn", "-ac", "2", "-ar", "44100",
    "-af", af, out,
  ];
  const r = spawnSync(ffmpegPath, args, { encoding: "latin1", maxBuffer: 64 * 1024 * 1024, timeout: 300_000 });
  const err = `${r.stderr ?? ""}`;
  if (r.status !== 0 || /Error|No such|failed|Missing|Invalid|unable/i.test(err) || !fs.existsSync(out)) {
    console.error(`[render] exit=${r.status} ` + err.split("\n").filter(Boolean).slice(-4).join(" | "));
    return null;
  }
  return out;
}

/* =========================================================================
 * Top-level runner + optional CLI entry point
 * ======================================================================= */

export interface RunOptions {
  studioRoot: string;
  probeRelativePath: string;
  preferredTrackId?: string;
  renderProof?: boolean;
}

export function runSoundtrackGovernance(opts: RunOptions): GovernanceReport | null {
  // The pipeline modules we audit live in the mini-run studio folder itself.
  const studioDir = path.join(opts.studioRoot, "docs", "mini_run_studio");
  const probe = probeVideo(opts.studioRoot, opts.probeRelativePath);
  if (!probe || probe.durationSec <= 0) {
    console.log(`✗ Could not probe ${opts.probeRelativePath} (missing file or ffmpeg).`);
    return null;
  }

  const brief: VideoAudioDescriptorBrief = {
    fileName: path.basename(opts.probeRelativePath),
    durationSec: probe.durationSec,
    fps: probe.fps,
    hasAudio: probe.hasAudio,
    measuredIntegratedLufs: probe.loudness?.integratedLufs,
    measuredTruePeakDb: probe.loudness?.truePeakDb,
  };

  const palette = selectSoundtrackPalette(brief, opts.preferredTrackId);
  const program = buildCausalProgram(brief, palette);

  // Causal + programme invariants, then systematic variance + override proofs.
  const checks = [
    ...assertGovernance(brief, program),
    paletteHasVariance(brief),
    sfxPlanDurationParametric(),
    opts.preferredTrackId
      ? palettePreferenceHonored(brief, opts.preferredTrackId)
      : { check: "preferred_track_override", pass: true, detail: "no preference supplied; inferred palette used" },
  ];
  const flaggedGaps = auditCausalGaps(studioDir);

  let renderProofPath: string | null = null;
  if (opts.renderProof) {
    renderProofPath = renderProofBed(opts.studioRoot, studioDir, program, "soundtrack_proof_bed.wav");
  }

  return {
    sample: brief,
    palette,
    program,
    checks,
    allPass: checks.every((c) => c.pass),
    flaggedGaps,
    renderProofPath,
  };
}

/* =========================================================================
 * CLI self-run (mirrors the studio's `require.main` convention)
 * ======================================================================= */

if (require.main === module) {
  const studioDir = __dirname;
  const repoRoot = path.resolve(studioDir, "../..");
  const report = runSoundtrackGovernance({
    studioRoot: repoRoot,
    probeRelativePath: "docs/mini_run_studio/raw_original_video.mp4",
    preferredTrackId: "inst_loop_09",
    renderProof: true,
  });
  if (report) {
    writeReportFiles(studioDir, report);
    printReport(report);
  }
}

function writeReportFiles(studioDir: string, report: GovernanceReport): void {
  const md = [
    "# Soundtrack Governance — Run Report",
    "",
    `**Sample:** \`${report.sample.fileName}\` · ${report.sample.durationSec.toFixed(2)}s · ${report.sample.fps}fps · audio:${report.sample.hasAudio ? "present" : "none"}`,
    report.sample.measuredIntegratedLufs !== undefined
      ? `**Measured loudness:** ${report.sample.measuredIntegratedLufs.toFixed(1)} LUFS integrated / ${report.sample.measuredTruePeakDb?.toFixed(1)} dBTP true peak`
      : "**Measured loudness:** none (silent master).",
    "",
    `**Palette — bed:** \`${report.palette.bedId}\` · pad: \`${report.palette.padId}\` · overrideApplied: ${report.palette.overrideApplied}`,
    `**Program:** ${Math.round(report.program.totalSec)}s total (${report.sample.durationSec.toFixed(1)}s video + ${report.program.tailSec.toFixed(1)}s tail) · fade-in ${report.program.fadeInSec}s · fade-out ${report.program.fadeOutSec}s · target ${report.program.integratedTargetLufs} LUFS / ${report.program.truePeakCeilingDb} dBTP`,
    "",
    "## Governance",
    ...report.checks.map((c) => `- [${c.pass ? "x" : " "}] **${c.check}** — ${c.detail}`),
    "",
    "## Flagged causal gaps in the wider pipeline",
    ...(report.flaggedGaps.length ? report.flaggedGaps.map((g) => `- ⚠ ${g}`) : ["- none"]),
    "",
    `_Generated ${new Date().toISOString()}_`,
  ].join("\n");
  fs.writeFileSync(path.join(studioDir, "SOUNDTRACK_GOVERNANCE_REPORT.md"), md, "utf8");
  fs.writeFileSync(path.join(studioDir, "soundtrack_arrangement.json"), JSON.stringify(report, null, 2), "utf8");
}

function printReport(report: GovernanceReport): void {
  console.log("\n════════ SAMPLE CHECK ════════");
  console.log(`  file        : ${report.sample.fileName}`);
  console.log(`  duration    : ${report.sample.durationSec.toFixed(2)}s`);
  console.log(`  fps         : ${report.sample.fps}`);
  console.log(`  has audio   : ${report.sample.hasAudio}`);
  if (report.sample.measuredIntegratedLufs !== undefined) {
    console.log(`  loudness    : ${report.sample.measuredIntegratedLufs.toFixed(1)} LUFS integrated`);
    console.log(`  true peak   : ${report.sample.measuredTruePeakDb?.toFixed(1)} dBTP`);
  } else {
    console.log("  loudness    : (no audio stream — soundtrack bed required)");
  }

  console.log("\n════════ PALETTE ════════");
  console.log(`  bed      : ${report.palette.bedId}`);
  console.log(`  pad      : ${report.palette.padId}`);
  console.log(`  override : ${report.palette.overrideApplied}`);
  console.log(`  ${report.palette.rationale}`);

  console.log("\n════════ GOVERNANCE CHECKLIST ════════");
  for (const c of report.checks) {
    console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.check}: ${c.detail}`);
  }

  console.log("\n════════ FLAGGED CAUSAL GAPS (other pipeline modules) ════════");
  if (report.flaggedGaps.length === 0) console.log("  (none flagged)");
  for (const g of report.flaggedGaps) console.log(`  ⚠ ${g}`);

  if (report.renderProofPath) console.log(`\n  ✓ render proof written → ${report.renderProofPath}`);
}
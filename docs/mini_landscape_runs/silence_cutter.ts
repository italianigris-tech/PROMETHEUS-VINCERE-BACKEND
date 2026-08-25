/**
 * MINI LANDSCAPE RUNS — STAGE 1: SILENCE / DEAD-AIR CUTTER
 *
 * The first sequential event in the long-form treatment. Uses FFmpeg
 * `silencedetect` to find dead air, plans a keep-segment map, and optionally
 * executes a concat re-encode that keeps speech and drops the rest.
 *
 * Pure planning functions are separated from FFmpeg execution so tests run
 * without encoding anything.
 *
 * CLI:
 *   npx tsx docs/mini_landscape_runs/silence_cutter.ts --input <src.mp4> --out docs/mini_landscape_runs/out/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { KeepSegment, SilenceCutPlan, SilenceRange } from "./types.js";

export interface SilenceCutterOptions {
  noiseDb?: number; // silencedetect noise floor (dB), default -35
  minSilenceSec?: number; // silences >= this are cut candidates, default 0.6
  minKeepPauseSec?: number; // gaps between keep segments < this are folded into the cut, default 0.4
  paddingSec?: number; // speech padding kept on either side of a cut, default 0.15
  detectGranularitySec?: number; // silencedetect d=, default 0.25 (finer than cut threshold)
  hasAudio?: boolean;
}

export interface SilenceDetection {
  silences: SilenceRange[];
  durationSec: number;
}

const DEFAULTS = {
  noiseDb: -35,
  minSilenceSec: 0.6,
  minKeepPauseSec: 0.4,
  paddingSec: 0.15,
  detectGranularitySec: 0.25,
  hasAudio: true,
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Parse `ffmpeg ... silencedetect ...` stderr into silences + duration. */
export function parseSilencedetectLog(log: string): SilenceDetection {
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  const re = /silence_start:\s*([0-9.]+)/g;
  while ((m = re.exec(log)) !== null) starts.push(Number(m[1]));

  const ends: number[] = [];
  const re2 = /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g;
  while ((m = re2.exec(log)) !== null) ends.push(Number(m[1]));

  const dur = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSec = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;

  const silences: SilenceRange[] = starts.map((start, i) => {
    const end = ends[i] ?? durationSec;
    return {
      startSec: round3(start),
      endSec: round3(end),
      durationSec: round3(Math.max(0, end - start)),
      kind: "silence",
    };
  });
  return { silences, durationSec };
}

/**
 * Build a SilenceCutPlan from a detection. Pure — no ffmpeg called here.
 * Policy: SIL-01..SIL-07 (see policies/joseph_landscape_governance_policy.md §6).
 */
export function buildSilenceCutPlan(
  sourcePath: string,
  detection: SilenceDetection,
  opts: SilenceCutterOptions = {},
): SilenceCutPlan {
  const { noiseDb, minSilenceSec, minKeepPauseSec, paddingSec, hasAudio } = { ...DEFAULTS, ...opts };
  const durationSec = detection.durationSec;

  // SIL-01: only silences >= threshold are cut candidates.
  const cutSilences = detection.silences.filter((s) => s.durationSec >= minSilenceSec);

  const noCut = (reason: string, skip: boolean): SilenceCutPlan => {
    const keep: KeepSegment[] = [
      {
        index: 0,
        srcStartSec: 0,
        srcEndSec: durationSec,
        durationSec,
        dstStartSec: 0,
        dstEndSec: durationSec,
        cause: { gate: "silence_cut", reason: "Full timeline kept; no dead-air removal." },
      },
    ];
    return {
      sourcePath,
      outputPath: null,
      hasAudio,
      noiseDb,
      minSilenceSec,
      minKeepPauseSec,
      paddingSec,
      detectedSilences: detection.silences,
      keepSegments: keep,
      sourceDurationSec: durationSec,
      outputDurationSec: durationSec,
      removedSec: 0,
      skipSilenceCut: skip,
      cause: { gate: "silence_cut", reason },
    };
  };

  if (durationSec <= 0 || cutSilences.length === 0) {
    return noCut("No silences above the cut threshold — dead-air pass skipped.", true);
  }

  // SIL-03: build raw keep segments between silences, then apply speech padding.
  const raw: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const s of cutSilences) {
    raw.push({ start: cursor, end: s.startSec });
    cursor = s.endSec;
  }
  raw.push({ start: cursor, end: durationSec });

  const padded = raw
    .map((seg) => ({
      start: Math.min(seg.end, seg.start + paddingSec),
      end: Math.max(seg.start, seg.end - paddingSec),
    }))
    .filter((seg) => seg.end - seg.start > 0.05);

  // SIL-04: fold tiny gaps (< minKeepPauseSec) between keep segments into the cut.
  const merged: Array<{ start: number; end: number }> = [];
  for (const seg of padded) {
    const last = merged[merged.length - 1];
    if (last && seg.start - last.end < minKeepPauseSec) {
      last.end = seg.end;
    } else {
      merged.push({ start: seg.start, end: seg.end });
    }
  }

  // Assign destination timeline.
  const keepSegments: KeepSegment[] = [];
  let dst = 0;
  merged.forEach((seg, i) => {
    const dur = round3(seg.end - seg.start);
    keepSegments.push({
      index: i,
      srcStartSec: round3(seg.start),
      srcEndSec: round3(seg.end),
      durationSec: dur,
      dstStartSec: round3(dst),
      dstEndSec: round3(dst + dur),
      cause: { gate: "silence_cut", reason: `Keep segment ${i + 1} after dead-air removal.` },
    });
    dst += dur;
  });

  const removedSec = round3(durationSec - dst);
  const skipSilenceCut = keepSegments.length <= 1 && Math.abs(dst - durationSec) < 0.01;

  return {
    sourcePath,
    outputPath: null,
    hasAudio,
    noiseDb,
    minSilenceSec,
    minKeepPauseSec,
    paddingSec,
    detectedSilences: detection.silences.map((s) => ({
      ...s,
      // SIL-02: classify pauses below the cut threshold as protected pacing.
      kind: s.durationSec >= minSilenceSec ? "silence" : "protected_pause",
    })),
    keepSegments,
    sourceDurationSec: durationSec,
    outputDurationSec: round3(dst),
    removedSec,
    skipSilenceCut,
    cause: { gate: "silence_cut", reason: `Removed ${removedSec.toFixed(2)}s of dead air.` },
  };
}


/** Run FFmpeg silencedetect against an input file. */
export function detectSilences(inputPath: string, opts: SilenceCutterOptions = {}): SilenceDetection {
  const { noiseDb, detectGranularitySec } = { ...DEFAULTS, ...opts };
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", inputPath, "-af", `silencedetect=noise=${noiseDb}dB:d=${detectGranularitySec}`, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return parseSilencedetectLog(r.stderr || "");
}

/**
 * Concatenate the plan's keep segments into a cut MP4.
 *
 * Uses the approach that is provably sample-accurate for A/V sync:
 *   1. Extract each keep segment TWICE via `-ss`/`-t` input seeking:
 *        - video-only MP4 (H.264 re-encode; no audio codec priming issues)
 *        - audio-only WAV (PCM; sample-exact, no AAC frame quantization)
 *   2. Concat the video intermediates and the PCM audio intermediates with the
 *      concat DEMUXER + stream copy (clean for H.264 video and for PCM audio).
 *   3. Mux video + PCM audio into the final MP4, capping at the video length.
 *
 * Why not simpler options? The concat demuxer with inpoint/outpoint leaves AAC
 * audio on the source timeline (the ORIGINAL bug — audio desynced ~150 ms and
 * the file ran 4 s long). The filter-complex concat of one shared input hangs
 * on this source, and stream-copying AAC through the concat demuxer drops
 * leading samples at every boundary (~25-60 ms per segment, cumulative). PCM
 * intermediates eliminate every codec-priming loss — verified 0.0 ms drift.
 */
export function executeSilenceCut(
  plan: SilenceCutPlan,
  outDir: string,
  opts: SilenceCutterOptions = {},
): { outputPath: string; exitCode: number } {
  const { hasAudio } = { ...DEFAULTS, ...opts, hasAudio: plan.hasAudio };
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(plan.sourcePath, path.extname(plan.sourcePath));
  const outputPath = path.join(outDir, `${base}_cut.mp4`);

  const hasVideo = detectVideoPresence(plan.sourcePath);
  const encodeArgs = hasVideo ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"] : [];
  const segDir = path.join(outDir, `${base}_segments`);
  fs.mkdirSync(segDir, { recursive: true });


  if (plan.skipSilenceCut) {
    const audioArgs = hasAudio ? ["-c:a", "aac", "-b:a", "192k"] : ["-an"];
    const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-i", plan.sourcePath, ...encodeArgs, ...audioArgs, outputPath], {
      encoding: "utf8",
    });
    return { outputPath, exitCode: r.status ?? 1 };
  }

  // Keep a human-readable record of the segment map for auditability.
  const listPath = path.join(outDir, `${base}_cut_segments.txt`);
  const lines: string[] = [];
  for (const seg of plan.keepSegments) {
    lines.push(`file '${plan.sourcePath.replace(/'/g, "'\\''")}'`);
    lines.push(`inpoint ${seg.srcStartSec.toFixed(3)}`);
    lines.push(`outpoint ${seg.srcEndSec.toFixed(3)}`);
  }
  fs.writeFileSync(listPath, lines.join("\n") + "\n", "utf8");

  // --- PASS 1: per-segment extraction (video-only MP4 + audio-only WAV) ---
  const videoFiles: string[] = [];
  const audioFiles: string[] = [];
  for (let i = 0; i < plan.keepSegments.length; i++) {
    const seg = plan.keepSegments[i];
    const dur = seg.srcEndSec - seg.srcStartSec;
    const seekArgs = ["-ss", seg.srcStartSec.toFixed(3), "-t", dur.toFixed(3), "-i", plan.sourcePath];
    if (hasVideo) {
      const vPath = path.join(segDir, `seg_${i}.mp4`);
      const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...seekArgs, "-an", ...encodeArgs, vPath], {
        encoding: "utf8",
      });
      if (r.status !== 0) {
        console.error(`segment ${i} video extraction failed: ${r.stderr?.slice(-400)}`);
        return { outputPath, exitCode: r.status ?? 1 };
      }
      videoFiles.push(vPath);
    }
    if (hasAudio) {
      const aPath = path.join(segDir, `seg_${i}.wav`);
      const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...seekArgs, "-vn", "-c:a", "pcm_s16le", aPath], {
        encoding: "utf8",
      });
      if (r.status !== 0) {
        console.error(`segment ${i} audio extraction failed: ${r.stderr?.slice(-400)}`);
        return { outputPath, exitCode: r.status ?? 1 };
      }
      audioFiles.push(aPath);
    }
  }

  const q = (p: string) => `file '${p.replace(/'/g, "'\\''")}'`;

  // --- PASS 2: concat per stream type (stream copy is clean for H.264 + PCM) ---
  let videoAllPath: string | null = null;
  let audioAllPath: string | null = null;

  if (hasVideo && videoFiles.length > 0) {
    const vList = path.join(segDir, "video_concat.txt");
    fs.writeFileSync(vList, videoFiles.map(q).join("\n") + "\n", "utf8");
    videoAllPath = path.join(segDir, "video_all.mp4");
    const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", vList, "-c", "copy", videoAllPath], { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(`video concat failed: ${r.stderr?.slice(-400)}`);
      return { outputPath, exitCode: r.status ?? 1 };
    }
  }

  if (hasAudio && audioFiles.length > 0) {
    const aList = path.join(segDir, "audio_concat.txt");
    fs.writeFileSync(aList, audioFiles.map(q).join("\n") + "\n", "utf8");
    audioAllPath = path.join(segDir, "audio_all.wav");
    const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", aList, "-c", "copy", audioAllPath], { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(`audio concat failed: ${r.stderr?.slice(-400)}`);
      return { outputPath, exitCode: r.status ?? 1 };
    }
  }

  // --- PASS 3: final mux ---
  const r =
    hasVideo && hasAudio && videoAllPath && audioAllPath
      ? (() => {
          const dur = probeDurationSec(videoAllPath);
          const t = dur > 0 ? dur.toFixed(3) : "57.000";
          return spawnSync(
            "ffmpeg",
            ["-y", "-hide_banner", "-loglevel", "error", "-i", videoAllPath, "-i", audioAllPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", t, outputPath],
            { encoding: "utf8" },
          );
        })()
      : hasVideo && videoAllPath
        ? spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", videoAllPath, "-c", "copy", outputPath], { encoding: "utf8" })
        : hasAudio && audioAllPath
          ? spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", audioAllPath, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", outputPath], { encoding: "utf8" })
          : { status: 1 };

  // Clean up intermediate files on success (keep them on failure for debugging).
  if (r.status === 0) {
    for (const f of [...videoFiles, ...audioFiles, videoAllPath, audioAllPath]) {
      if (f) { try { fs.unlinkSync(f); } catch { /* best-effort */ } }
    }
    try { fs.rmdirSync(segDir); } catch { /* best-effort */ }
  }
  return { outputPath, exitCode: r.status ?? 1 };
}

/** Probe a media file's duration (seconds) via `ffmpeg -i` stderr. */
function probeDurationSec(filePath: string): number {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", filePath], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Quick audio-presence check via `ffmpeg -i` stderr (no ffprobe needed). */
export function detectAudioPresence(inputPath: string): boolean {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", inputPath], { encoding: "utf8" });
  return /^\s*Stream.*Audio:/m.test(r.stderr || "");
}

/** Quick video-presence check via `ffmpeg -i` stderr. Audio-only feeds are valid inputs. */
export function detectVideoPresence(inputPath: string): boolean {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", inputPath], { encoding: "utf8" });
  return /^\s*Stream.*Video:/m.test(r.stderr || "");
}


/** Full stage-1 run: detect → plan → execute. */
export function runSilenceCutter(
  inputPath: string,
  outDir: string,
  opts: SilenceCutterOptions = {},
): { plan: SilenceCutPlan; outputPath: string | null; exitCode: number } {
  const detection = detectSilences(inputPath, opts);
  const plan = buildSilenceCutPlan(inputPath, detection, {
    ...opts,
    hasAudio: opts.hasAudio ?? detectAudioPresence(inputPath),
  });
  const { outputPath, exitCode } = executeSilenceCut(plan, outDir, opts);
  plan.outputPath = outputPath;
  return { plan, outputPath, exitCode };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const outIdx = args.indexOf("--out");
  if (inputIdx < 0 || !args[inputIdx + 1]) {
    console.error("Usage: npx tsx silence_cutter.ts --input <src.mp4> --out <outDir> [--noiseDb -35]");
    process.exit(1);
  }
  const inputPath = path.resolve(args[inputIdx + 1]);
  const outDir = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(__dirname, "out");

  const { plan, outputPath, exitCode } = runSilenceCutter(inputPath, outDir);
  console.log("════════ SILENCE CUTTER ════════");
  console.log(`  source      : ${plan.sourceDurationSec.toFixed(2)}s (${plan.detectedSilences.length} silences detected)`);
  console.log(`  removed     : ${plan.removedSec.toFixed(2)}s dead air`);
  console.log(`  kept        : ${plan.outputDurationSec.toFixed(2)}s across ${plan.keepSegments.length} segment(s)`);
  console.log(`  skipCut     : ${plan.skipSilenceCut}`);
  console.log(`  output      : ${outputPath ?? "(not executed)"}`);
  console.log(`  exitCode    : ${exitCode}`);
  console.log("═══════════════════════════════");
  process.exit(exitCode === 0 ? 0 : 1);
}


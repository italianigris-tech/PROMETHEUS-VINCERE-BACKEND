/**
 * MINI LANDSCAPE RUNS — STAGE 0: CALL PARSER
 *
 * Decides whether an incoming frontend call is a short-form feed
 * (→ docs/mini_run_studio) or a long-form feed (→ this studio). It optionally
 * probes a media file with FFmpeg (no ffprobe dependency) and folds explicit
 * prompt hints into a deterministic, causal FormDecision.
 *
 * CLI:
 *   npx tsx docs/mini_landscape_runs/call_parser.ts --prompt "long form tutorial"
 *   npx tsx docs/mini_landscape_runs/call_parser.ts --probe <path>
 */

import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { FormDecision, MediaProbe } from "./types.js";

export interface CallParserInput {
  prompt?: string;
  mediaPath?: string;
}

const SHORT_FORM_HINTS: RegExp[] = [
  /\bshort[- ]form\b/i,
  /\breel/i,
  /\bshorts\b/i,
  /\bvertical\b/i,
  /\bportrait\b/i,
  /\b9\s*:?\s*16\b/i,
  /\bviral (clip|reel|cut)\b/i,
  /\btiktok\b/i,
  /\breels? feed\b/i,
];

const LONG_FORM_HINTS: RegExp[] = [
  /\blong[- ]form\b/i,
  /\blandscape\b/i,
  /\b16\s*:?\s*9\b/i,
  /\bhorizontal\b/i,
  /\bwide\b/i,
  /\b(tutorial|masterclass|workshop|podcast|documentary|deep dive|full video|long video)\b/i,
  /\byoutube\b/i,
];

export function extractPromptHints(prompt: string): { shortHints: string[]; longHints: string[] } {
  const shortHints = SHORT_FORM_HINTS.filter((r) => r.test(prompt)).map((r) => r.source);
  const longHints = LONG_FORM_HINTS.filter((r) => r.test(prompt)).map((r) => r.source);
  return { shortHints, longHints };
}

/** Parse `ffmpeg -i` stderr into a MediaProbe. Works without ffprobe in PATH. */
export function parseFfmpegProbe(stderr: string, mediaPath: string): MediaProbe {
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSec = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
  const v = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  const width = v ? Number(v[1]) : 0;
  const height = v ? Number(v[2]) : 0;
  const fpsM = stderr.match(/(\d+(?:\.\d+)?)\s*fps/);
  const fps = fpsM ? Number(fpsM[1]) : 0;
  const hasAudio = /Audio:/.test(stderr);
  const aspect: MediaProbe["aspect"] =
    width && height ? (width > height ? "landscape" : height > width ? "portrait" : "square") : "unknown";
  return { path: mediaPath, durationSec, width, height, fps, hasAudio, aspect };
}

export function probeMedia(mediaPath: string): MediaProbe {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-i", mediaPath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  return parseFfmpegProbe(result.stderr, mediaPath);
}

export function classifyCall(input: CallParserInput): FormDecision {
  const reasons: string[] = [];
  const promptHints: string[] = [];
  const cause = { gate: "form_decision" as const, reason: "Call Parser classified the feed form." };

  let probe: MediaProbe | undefined;
  if (input.mediaPath) {
    const p = probeMedia(input.mediaPath);
    probe = p.durationSec === 0 && p.width === 0 ? undefined : p;
  }

  const shortHints = input.prompt ? extractPromptHints(input.prompt).shortHints : [];
  const longHints = input.prompt ? extractPromptHints(input.prompt).longHints : [];
  promptHints.push(...shortHints, ...longHints);

  let form: "short_form" | "long_form" = "short_form";
  let confidence = 0.3;

  // Explicit prompt intent is the strongest signal.
  if (longHints.length > 0 && shortHints.length === 0) {
    form = "long_form";
    confidence = 0.95;
    reasons.push(`Prompt explicitly requests long-form: ${longHints.join(", ")}`);
  } else if (shortHints.length > 0 && longHints.length === 0) {
    form = "short_form";
    confidence = 0.95;
    reasons.push(`Prompt explicitly requests short-form: ${shortHints.join(", ")}`);
  }

  if (probe) {
    if (probe.aspect === "landscape") {
      confidence = Math.max(confidence, 0.8);
      reasons.push(`Media probe geometry is landscape (${probe.width}x${probe.height}).`);
      if (!reasons.some((r) => r.startsWith("Prompt"))) form = "long_form";
    } else if (probe.aspect === "portrait") {
      confidence = Math.max(confidence, 0.8);
      reasons.push(`Media probe geometry is portrait (${probe.width}x${probe.height}).`);
      if (!reasons.some((r) => r.startsWith("Prompt"))) form = "short_form";
    }
    if (probe.durationSec >= 120) {
      confidence = Math.max(confidence, 0.85);
      reasons.push(`Media probe duration ${Math.round(probe.durationSec)}s is long-form length.`);
      if (!reasons.some((r) => r.startsWith("Prompt"))) form = "long_form";
    } else if (probe.durationSec > 0 && probe.durationSec <= 60) {
      reasons.push(`Media probe duration ${Math.round(probe.durationSec)}s is short-form length.`);
      if (!reasons.some((r) => r.startsWith("Prompt"))) form = "short_form";
    }
  }

  if (!reasons.length) {
    reasons.push("No prompt hints or media probe; defaulting to short_form (feed default).");
  }

  return { form, confidence: Math.min(1, confidence), reasons, probe, promptHints, cause };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const input: CallParserInput = {};
  const promptIdx = args.indexOf("--prompt");
  const probeIdx = args.indexOf("--probe");
  if (promptIdx >= 0 && args[promptIdx + 1]) input.prompt = args[promptIdx + 1];
  if (probeIdx >= 0 && args[probeIdx + 1]) input.mediaPath = path.resolve(args[probeIdx + 1]);

  const decision = classifyCall(input);
  console.log("════════ CALL PARSER ════════");
  console.log(`  form       : ${decision.form} (confidence ${decision.confidence.toFixed(2)})`);
  console.log(`  promptHints: ${decision.promptHints.length ? decision.promptHints.join(", ") : "(none)"}`);
  for (const r of decision.reasons) console.log(`  reason     : ${r}`);
  if (decision.probe) {
    const p = decision.probe;
    console.log(
      `  probe      : ${p.width}x${p.height} @${p.fps}fps · ${p.durationSec.toFixed(2)}s · audio:${p.hasAudio ? "yes" : "no"} · aspect:${p.aspect}`,
    );
  }
  console.log("════════════════════════════");
  if (decision.form !== "long_form") {
    console.log("→ Short-form feed: hand off to docs/mini_run_studio (not this studio).");
  } else {
    console.log("→ Long-form feed: proceed to silence_cutter.ts in this studio.");
  }
}


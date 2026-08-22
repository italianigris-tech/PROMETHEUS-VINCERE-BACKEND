/**
 * MINI LANDSCAPE RUNS — STAGE 2: SECTION SEGMENTER
 *
 * Tiles the cut timeline into role-driven sections (hook / setup / explain /
 * demonstrate / payoff / outro) using the Joseph five-audit role fractions.
 * When a timed transcript is available, boundaries snap to the nearest
 * transcript point (within tolerance) so sections align to content, never
 * mid-sentence.
 */

import type { LandscapeSection, SectionRole } from "./types.js";

export interface TranscriptPoint {
  timeSec: number;
  text: string;
}

export interface SegmenterOptions {
  transcript?: TranscriptPoint[];
  snapToleranceSec?: number;
}

const ROLE_TEMPLATE: Array<{
  role: SectionRole;
  fraction: number;
  semanticWeight: number;
  commercialPressure: number;
  fatigueRisk: number;
}> = [
  { role: "hook", fraction: 0.09, semanticWeight: 0.9, commercialPressure: 0.3, fatigueRisk: 0.8 },
  { role: "setup", fraction: 0.16, semanticWeight: 0.6, commercialPressure: 0.4, fatigueRisk: 0.5 },
  { role: "explain", fraction: 0.3, semanticWeight: 0.7, commercialPressure: 0.5, fatigueRisk: 0.6 },
  { role: "demonstrate", fraction: 0.26, semanticWeight: 0.8, commercialPressure: 0.6, fatigueRisk: 0.5 },
  { role: "payoff", fraction: 0.12, semanticWeight: 1.0, commercialPressure: 0.8, fatigueRisk: 0.7 },
  { role: "outro", fraction: 0.07, semanticWeight: 0.5, commercialPressure: 0.9, fatigueRisk: 0.4 },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function nearestSnapPoint(minimum: number, target: number, durationSec: number, points: number[], tolerance: number): number {
  let best = target;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of points) {
    if (p <= minimum + 0.5 || p >= durationSec - 0.5) continue;
    const d = Math.abs(p - target);
    if (d <= tolerance && d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function transcriptText(transcript: TranscriptPoint[], startSec: number, endSec: number): string | undefined {
  const texts = transcript
    .filter((t) => t.timeSec >= startSec && t.timeSec < endSec)
    .map((t) => t.text)
    .filter(Boolean);
  return texts.length ? texts.join(" ") : undefined;
}

export function segmentCutVideo(durationSec: number, opts: SegmenterOptions = {}): LandscapeSection[] {
  if (durationSec <= 0) return [];
  const { transcript = [], snapToleranceSec = 4 } = opts;
  const points = transcript
    .map((t) => t.timeSec)
    .filter((t) => t > 0 && t < durationSec)
    .sort((a, b) => a - b);

  const boundaries: number[] = [0];
  let acc = 0;
  for (let i = 0; i < ROLE_TEMPLATE.length - 1; i++) {
    acc += ROLE_TEMPLATE[i].fraction;
    const target = acc * durationSec;
    boundaries.push(nearestSnapPoint(boundaries[boundaries.length - 1], target, durationSec, points, snapToleranceSec));
  }
  boundaries.push(durationSec);

  // Guarantee strictly monotonic boundaries.
  for (let i = 1; i < boundaries.length; i++) {
    if (boundaries[i] <= boundaries[i - 1]) boundaries[i] = Math.min(durationSec, boundaries[i - 1] + 1);
  }

  const sections: LandscapeSection[] = [];
  for (let i = 0; i < ROLE_TEMPLATE.length; i++) {
    const start = round2(boundaries[i]);
    const end = round2(Math.min(durationSec, boundaries[i + 1]));
    if (end - start <= 0.05) continue;
    const tpl = ROLE_TEMPLATE[i];
    sections.push({
      sectionId: `sec_${i + 1}_${tpl.role}`,
      role: tpl.role,
      startSec: start,
      endSec: end,
      durationSec: round2(end - start),
      text: transcriptText(transcript, start, end),
      semanticWeight: tpl.semanticWeight,
      commercialPressure: tpl.commercialPressure,
      fatigueRisk: tpl.fatigueRisk,
      cause: {
        gate: "section_role",
        reason: `Role ${tpl.role} allocated ${(tpl.fraction * 100).toFixed(0)}% of the cut timeline.`,
        timeSec: start,
      },
    });
  }
  return sections;
}

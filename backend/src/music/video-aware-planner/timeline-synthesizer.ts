import type {TranscribedWord} from "../../schemas";
import {
  videoTimelineSegmentSchema,
  type VideoTimelineSegment
} from "../schemas/video-timeline.schema";

export type CaptionTimingInput = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type ClipTimingInput = {
  id: string;
  startSec: number;
  endSec: number;
  label?: string;
};

export type SynthesizeVideoTimelineInput = {
  videoDurationSec: number;
  transcriptWords?: TranscribedWord[];
  captionChunks?: CaptionTimingInput[];
  selectedClips?: ClipTimingInput[];
  previewStartSec?: number;
  previewEndSec?: number;
  source?: string;
};

const clamp = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

const KEYWORDS = {
  problem: new Set(["problem", "mistake", "wrong", "fail", "losing", "risk", "danger"]),
  urgency: new Set(["time", "deadline", "seconds", "now", "fast", "quickly", "before"]),
  proof: new Set(["proof", "results", "data", "numbers", "evidence", "case", "study"]),
  reveal: new Set(["changed", "secret", "discovered", "unlock", "breakthrough"]),
  cta: new Set(["click", "subscribe", "buy", "join", "start", "try", "download", "book"])
} as const;

const ROLE_BASELINES: Record<VideoTimelineSegment["role"], Omit<VideoTimelineSegment, "id" | "startSec" | "endSec" | "role" | "text" | "speechDensity" | "source">> = {
  hook: {
    energy: 0.72,
    valence: 0.52,
    arousal: 0.8,
    tension: 0.7,
    prestige: 0.58,
    urgency: 0.68,
    clarity: 0.7,
    hookStrength: 0.95,
    proofStrength: 0.15,
    ctaStrength: 0.1
  },
  setup: {
    energy: 0.42,
    valence: 0.48,
    arousal: 0.42,
    tension: 0.28,
    prestige: 0.5,
    urgency: 0.22,
    clarity: 0.72,
    hookStrength: 0.25,
    proofStrength: 0.2,
    ctaStrength: 0.05
  },
  problem: {
    energy: 0.56,
    valence: 0.3,
    arousal: 0.62,
    tension: 0.78,
    prestige: 0.44,
    urgency: 0.58,
    clarity: 0.68,
    hookStrength: 0.35,
    proofStrength: 0.18,
    ctaStrength: 0.05
  },
  explanation: {
    energy: 0.45,
    valence: 0.5,
    arousal: 0.45,
    tension: 0.32,
    prestige: 0.56,
    urgency: 0.24,
    clarity: 0.82,
    hookStrength: 0.12,
    proofStrength: 0.24,
    ctaStrength: 0.06
  },
  proof: {
    energy: 0.54,
    valence: 0.55,
    arousal: 0.55,
    tension: 0.42,
    prestige: 0.66,
    urgency: 0.34,
    clarity: 0.84,
    hookStrength: 0.18,
    proofStrength: 0.9,
    ctaStrength: 0.08
  },
  reveal: {
    energy: 0.7,
    valence: 0.58,
    arousal: 0.76,
    tension: 0.74,
    prestige: 0.6,
    urgency: 0.46,
    clarity: 0.7,
    hookStrength: 0.44,
    proofStrength: 0.4,
    ctaStrength: 0.08
  },
  transition: {
    energy: 0.4,
    valence: 0.45,
    arousal: 0.42,
    tension: 0.3,
    prestige: 0.48,
    urgency: 0.22,
    clarity: 0.68,
    hookStrength: 0.1,
    proofStrength: 0.1,
    ctaStrength: 0.04
  },
  emotional_reset: {
    energy: 0.24,
    valence: 0.52,
    arousal: 0.18,
    tension: 0.1,
    prestige: 0.45,
    urgency: 0.08,
    clarity: 0.64,
    hookStrength: 0.04,
    proofStrength: 0.08,
    ctaStrength: 0.02
  },
  cta: {
    energy: 0.63,
    valence: 0.68,
    arousal: 0.62,
    tension: 0.38,
    prestige: 0.54,
    urgency: 0.72,
    clarity: 0.82,
    hookStrength: 0.2,
    proofStrength: 0.14,
    ctaStrength: 0.98
  },
  outro: {
    energy: 0.3,
    valence: 0.56,
    arousal: 0.24,
    tension: 0.14,
    prestige: 0.45,
    urgency: 0.14,
    clarity: 0.7,
    hookStrength: 0.03,
    proofStrength: 0.06,
    ctaStrength: 0.2
  },
  unknown: {
    energy: 0.5,
    valence: 0.5,
    arousal: 0.5,
    tension: 0.5,
    prestige: 0.5,
    urgency: 0.5,
    clarity: 0.5,
    hookStrength: 0,
    proofStrength: 0,
    ctaStrength: 0
  }
};

const normalizeToken = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
};

const countKeywordHits = (text: string, set: Set<string>): number => {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  return tokens.filter((token) => set.has(token)).length;
};

const textFromCaptionChunks = ({
  startSec,
  endSec,
  captionChunks
}: {
  startSec: number;
  endSec: number;
  captionChunks: CaptionTimingInput[];
}): string => {
  return captionChunks
    .filter((chunk) => (chunk.startMs / 1000) < endSec && (chunk.endMs / 1000) > startSec)
    .map((chunk) => chunk.text.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
};

const toWindowText = ({
  startSec,
  endSec,
  transcriptWords,
  captionChunks
}: {
  startSec: number;
  endSec: number;
  transcriptWords: TranscribedWord[];
  captionChunks: CaptionTimingInput[];
}): string => {
  const overlap = transcriptWords.filter((word) => {
    const wordStartSec = word.start_ms / 1000;
    const wordEndSec = word.end_ms / 1000;
    return wordStartSec < endSec && wordEndSec > startSec;
  });

  if (overlap.length > 0) {
    return overlap.slice(0, 24).map((word) => word.text).join(" ");
  }

  return textFromCaptionChunks({
    startSec,
    endSec,
    captionChunks
  });
};

const toSpeechDensity = ({
  startSec,
  endSec,
  transcriptWords
}: {
  startSec: number;
  endSec: number;
  transcriptWords: TranscribedWord[];
}): number => {
  const durationSec = Math.max(endSec - startSec, 0.001);
  const overlappingWords = transcriptWords.filter((word) => {
    const wordStartSec = word.start_ms / 1000;
    const wordEndSec = word.end_ms / 1000;
    return wordStartSec < endSec && wordEndSec > startSec;
  }).length;

  return clamp(overlappingWords / Math.max(1, durationSec * 3));
};

const detectRole = ({
  text,
  isHook,
  isFinalWindow
}: {
  text: string;
  isHook: boolean;
  isFinalWindow: boolean;
}): VideoTimelineSegment["role"] => {
  if (!text.trim()) {
    return isHook ? "unknown" : "explanation";
  }

  if (isHook) {
    return "hook";
  }

  const ctaHits = countKeywordHits(text, KEYWORDS.cta);
  const problemHits = countKeywordHits(text, KEYWORDS.problem);
  const proofHits = countKeywordHits(text, KEYWORDS.proof);
  const revealHits = countKeywordHits(text, KEYWORDS.reveal);

  if (isFinalWindow && ctaHits > 0) {
    return "cta";
  }
  if (revealHits > 0) {
    return "reveal";
  }
  if (proofHits > 0) {
    return "proof";
  }
  if (problemHits > 0) {
    return "problem";
  }
  if (isFinalWindow) {
    return "outro";
  }

  return "explanation";
};

const buildSegment = ({
  id,
  startSec,
  endSec,
  transcriptWords,
  captionChunks,
  source,
  isHook,
  isFinalWindow
}: {
  id: string;
  startSec: number;
  endSec: number;
  transcriptWords: TranscribedWord[];
  captionChunks: CaptionTimingInput[];
  source: string;
  isHook: boolean;
  isFinalWindow: boolean;
}): VideoTimelineSegment => {
  const text = toWindowText({
    startSec,
    endSec,
    transcriptWords,
    captionChunks
  });
  const role = detectRole({
    text,
    isHook,
    isFinalWindow
  });
  const baseline = ROLE_BASELINES[role];
  const speechDensity = toSpeechDensity({
    startSec,
    endSec,
    transcriptWords
  });
  const problemHits = countKeywordHits(text, KEYWORDS.problem);
  const urgencyHits = countKeywordHits(text, KEYWORDS.urgency);
  const proofHits = countKeywordHits(text, KEYWORDS.proof);
  const ctaHits = countKeywordHits(text, KEYWORDS.cta);
  const revealHits = countKeywordHits(text, KEYWORDS.reveal);

  return videoTimelineSegmentSchema.parse({
    id,
    startSec: Number(startSec.toFixed(3)),
    endSec: Number(endSec.toFixed(3)),
    role,
    text,
    energy: clamp(baseline.energy + (urgencyHits * 0.05) + (revealHits * 0.06)),
    valence: clamp(baseline.valence - (problemHits * 0.05) + (ctaHits * 0.04)),
    arousal: clamp(baseline.arousal + (urgencyHits * 0.06) + (revealHits * 0.04)),
    tension: clamp(baseline.tension + (problemHits * 0.08) + (revealHits * 0.05)),
    prestige: clamp(baseline.prestige + (proofHits * 0.05)),
    urgency: clamp(baseline.urgency + (urgencyHits * 0.08) + (ctaHits * 0.05)),
    clarity: clamp(baseline.clarity + (proofHits * 0.04) - (urgencyHits * 0.02)),
    speechDensity,
    hookStrength: clamp(baseline.hookStrength + (isHook ? 0.03 : 0)),
    proofStrength: clamp(baseline.proofStrength + (proofHits * 0.12)),
    ctaStrength: clamp(baseline.ctaStrength + (ctaHits * 0.15)),
    source
  });
};

export const synthesizeVideoTimeline = (input: SynthesizeVideoTimelineInput): VideoTimelineSegment[] => {
  const transcriptWords = [...(input.transcriptWords ?? [])].sort((left, right) => left.start_ms - right.start_ms);
  const captionChunks = input.captionChunks ?? [];
  const source = input.source ?? "phase2_dry_run";
  const previewStartSec = Math.max(0, input.previewStartSec ?? 0);
  const previewEndSec = Math.min(
    input.videoDurationSec,
    Math.max(previewStartSec + 0.25, input.previewEndSec ?? input.videoDurationSec)
  );
  const previewDurationSec = Math.max(0.25, previewEndSec - previewStartSec);
  const previewTranscript = transcriptWords.filter((word) => {
    const wordStartSec = word.start_ms / 1000;
    const wordEndSec = word.end_ms / 1000;
    return wordStartSec < previewEndSec && wordEndSec > previewStartSec;
  });

  if (previewTranscript.length === 0 && captionChunks.length === 0) {
    return [
      buildSegment({
        id: "timeline-segment-01",
        startSec: previewStartSec,
        endSec: previewEndSec,
        transcriptWords,
        captionChunks,
        source,
        isHook: false,
        isFinalWindow: false
      })
    ];
  }

  const segments: VideoTimelineSegment[] = [];
  const hookEndSec = Math.min(previewEndSec, previewStartSec + 3);
  const finalWindowDurationSec = Math.min(
    Math.max(previewDurationSec * 0.12, 1.5),
    Math.max(1.5, previewDurationSec * 0.15)
  );
  const finalStartSec = previewDurationSec > 6
    ? Math.max(hookEndSec, previewEndSec - finalWindowDurationSec)
    : previewEndSec;

  if (hookEndSec > previewStartSec) {
    segments.push(
      buildSegment({
        id: "timeline-segment-01",
        startSec: previewStartSec,
        endSec: hookEndSec,
        transcriptWords,
        captionChunks,
        source,
        isHook: previewTranscript.length > 0,
        isFinalWindow: false
      })
    );
  }

  const middleStartSec = hookEndSec;
  const middleEndSec = finalStartSec;
  const middleDurationSec = Math.max(0, middleEndSec - middleStartSec);
  const middleSegmentCount = middleDurationSec >= 8 ? 2 : middleDurationSec >= 1.5 ? 1 : 0;

  for (let index = 0; index < middleSegmentCount; index += 1) {
    const segmentStartSec = middleStartSec + ((middleDurationSec / middleSegmentCount) * index);
    const segmentEndSec = index === middleSegmentCount - 1
      ? middleEndSec
      : middleStartSec + ((middleDurationSec / middleSegmentCount) * (index + 1));

    if (segmentEndSec - segmentStartSec <= 0.2) {
      continue;
    }

    segments.push(
      buildSegment({
        id: `timeline-segment-${String(segments.length + 1).padStart(2, "0")}`,
        startSec: segmentStartSec,
        endSec: segmentEndSec,
        transcriptWords,
        captionChunks,
        source,
        isHook: false,
        isFinalWindow: false
      })
    );
  }

  if (previewEndSec - finalStartSec > 0.2 && finalStartSec < previewEndSec) {
    segments.push(
      buildSegment({
        id: `timeline-segment-${String(segments.length + 1).padStart(2, "0")}`,
        startSec: finalStartSec,
        endSec: previewEndSec,
        transcriptWords,
        captionChunks,
        source,
        isHook: false,
        isFinalWindow: true
      })
    );
  }

  return segments.filter((segment, index, array) => {
    if (segment.endSec > previewEndSec + 0.001 || segment.startSec < previewStartSec - 0.001) {
      return false;
    }
    if (segment.endSec <= segment.startSec) {
      return false;
    }
    return index === 0 || segment.startSec >= array[index - 1].startSec;
  });
};

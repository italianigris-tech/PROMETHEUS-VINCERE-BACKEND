import type {MetadataProfile, TranscribedWord} from "../schemas";

export type MotionMoment = "Hook" | "Expansion" | "Reinforcement" | "Pause/Restraint";

export type MotionDialect = {
  motionPreset: "hookWhip" | "expansionGlide" | "reinforcementLock" | "pauseRestraint";
  axis: "x" | "y";
  yDriftPx: number;
  opacityRange: [number, number];
  whip: boolean;
  heavyWeight: boolean;
  durationScale: number;
  staggerMs: number;
  intensity: number;
};

export type MotionDialectSegment = {
  label: string;
  moment: MotionMoment;
  startMs: number;
  endMs: number;
  intensity: number;
  highIntensityDensity: number;
  text: string;
  dialect: MotionDialect;
};

export type MotionDialectPlan = {
  sceneRestraintApplied: boolean;
  segments: MotionDialectSegment[];
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeText = (value: string): string => value.trim().toLowerCase();

const hasPausePunctuation = (value: string): boolean => /[.!?;:]$/.test(value.trim());

const isHighIntensityWord = (value: string): boolean => {
  const normalized = normalizeText(value);
  return /!$/.test(value.trim()) || ["now", "move", "push", "must", "never", "always", "critical", "urgent", "shock"].includes(normalized);
};

const shouldSplitSegment = (current: TranscribedWord, next: TranscribedWord | undefined): boolean => {
  if (!next) {
    return true;
  }

  const gapMs = Math.max(0, next.start_ms - current.end_ms);
  return hasPausePunctuation(current.text) || gapMs >= 420;
};

const groupTranscriptWords = (words: TranscribedWord[]): Array<{
  startMs: number;
  endMs: number;
  text: string;
  words: TranscribedWord[];
}> => {
  const filtered = words.filter((word) => word.text.trim().length > 0);
  if (filtered.length === 0) {
    return [];
  }

  const segments: Array<{startMs: number; endMs: number; text: string; words: TranscribedWord[]}> = [];
  let currentWords: TranscribedWord[] = [];

  filtered.forEach((word, index) => {
    currentWords.push(word);
    if (shouldSplitSegment(word, filtered[index + 1])) {
      segments.push({
        startMs: currentWords[0]!.start_ms,
        endMs: currentWords[currentWords.length - 1]!.end_ms,
        text: currentWords.map((entry) => entry.text).join(" ").replace(/\s+([,.!?;:])/g, "$1"),
        words: currentWords
      });
      currentWords = [];
    }
  });

  return segments;
};

const determineMoment = ({
  index,
  total,
  segmentText
}: {
  index: number;
  total: number;
  segmentText: string;
}): MotionMoment => {
  if (index === 0) {
    return "Hook";
  }
  if (hasPausePunctuation(segmentText) && /pause|breathe|listen|wait|hold/i.test(segmentText)) {
    return "Pause/Restraint";
  }
  if (index === total - 1) {
    return "Reinforcement";
  }
  return "Expansion";
};

const buildDialectForMoment = (moment: MotionMoment, intensity: number): MotionDialect => {
  if (moment === "Hook") {
    return {
      motionPreset: "hookWhip",
      axis: "x",
      yDriftPx: 6,
      opacityRange: [0.65, 1],
      whip: true,
      heavyWeight: true,
      durationScale: 0.84,
      staggerMs: 28,
      intensity
    };
  }

  if (moment === "Pause/Restraint") {
    return {
      motionPreset: "pauseRestraint",
      axis: "y",
      yDriftPx: 18,
      opacityRange: [0.08, 0.18],
      whip: false,
      heavyWeight: false,
      durationScale: 1.24,
      staggerMs: 42,
      intensity
    };
  }

  if (moment === "Reinforcement") {
    return {
      motionPreset: "reinforcementLock",
      axis: "y",
      yDriftPx: 10,
      opacityRange: [0.84, 1],
      whip: false,
      heavyWeight: true,
      durationScale: 1,
      staggerMs: 34,
      intensity
    };
  }

  return {
    motionPreset: "expansionGlide",
    axis: "y",
    yDriftPx: 12,
    opacityRange: [0.8, 1],
    whip: false,
    heavyWeight: false,
    durationScale: 1.06,
    staggerMs: 36,
    intensity
  };
};

const computeBaseIntensity = (metadata: MetadataProfile): number => {
  const speechRate = Number(metadata.timing_pacing?.speech_rate_estimate ?? 2.8);
  const toneTarget = String(metadata.user_intent?.tone_target ?? "");
  const editingKeywords = Array.isArray(metadata.user_intent?.editing_style_keywords)
    ? metadata.user_intent.editing_style_keywords.map(String)
    : [];

  let intensity = speechRate >= 3.8 ? 0.82 : speechRate <= 2.2 ? 0.34 : 0.56;
  if (/aggressive|shock|urgent/i.test(toneTarget)) {
    intensity += 0.14;
  }
  if (editingKeywords.some((keyword) => /restraint|calm|luxury|empathy/i.test(keyword))) {
    intensity -= 0.12;
  }

  return clamp(intensity, 0.16, 0.94);
};

export const buildMotionDialectPlan = ({
  metadata,
  transcriptWords
}: {
  metadata: MetadataProfile;
  transcriptWords: TranscribedWord[];
}): MotionDialectPlan => {
  const grouped = groupTranscriptWords(transcriptWords);
  const baseIntensity = computeBaseIntensity(metadata);
  const totalWords = Math.max(1, transcriptWords.length);
  const totalHighIntensityWords = transcriptWords.filter((word) => isHighIntensityWord(word.text)).length;
  const sceneHighIntensityDensity = totalHighIntensityWords / totalWords;
  const sceneRestraintApplied = sceneHighIntensityDensity > 0.4;

  const segments = grouped.map<MotionDialectSegment>((segment, index) => {
    const highIntensityWords = segment.words.filter((word) => isHighIntensityWord(word.text)).length;
    const highIntensityDensity = highIntensityWords / Math.max(1, segment.words.length);
    const moment = determineMoment({
      index,
      total: grouped.length,
      segmentText: segment.text
    });
    const momentBias = moment === "Hook"
      ? 0.18
      : moment === "Pause/Restraint"
        ? -0.18
        : moment === "Reinforcement"
          ? 0.04
          : 0;
    const rawIntensity = clamp(baseIntensity + momentBias + highIntensityDensity * 0.18, 0.14, 0.96);
    const intensity = sceneRestraintApplied ? Math.min(rawIntensity, 0.7) : rawIntensity;

    return {
      label: `segment_${index + 1}`,
      moment,
      startMs: segment.startMs,
      endMs: segment.endMs,
      intensity,
      highIntensityDensity,
      text: segment.text,
      dialect: buildDialectForMoment(moment, intensity)
    };
  });

  return {
    sceneRestraintApplied,
    segments
  };
};

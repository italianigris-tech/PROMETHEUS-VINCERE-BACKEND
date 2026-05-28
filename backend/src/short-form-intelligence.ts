import type {
  ClipHeuristicSignals,
  ClipScore,
  NormalizedJobRequest,
  TargetPlatform,
  TranscribedWord
} from "./schemas";

export const SHORT_FORM_RANKING_MODEL = "correlated_signal_stacking_v1" as const;

type ShortFormStyle = "cinematic" | "viral" | "manga" | "minimal";
type ShortFormIntent = "hook" | "insight" | "payoff" | "story" | "fallback";

export type ShortFormIntelligenceInput = {
  request: NormalizedJobRequest;
  targetPlatform: TargetPlatform;
  transcriptExcerpt: string;
  leadingContext: string;
  trailingContext: string;
  clipWords: TranscribedWord[];
  startMs: number;
  endMs: number;
  baseScores: ClipScore;
  heuristicSignals: ClipHeuristicSignals;
  sourceMetadata?: {
    hasSourceVideo?: boolean;
    width?: number | null;
    height?: number | null;
    fps?: number | null;
    durationMs?: number | null;
  };
  fallbackMode?: "transcript_semantic_segmentation" | "acoustic_segmentation";
};

export type ShortFormIntelligence = {
  semantic_summary: string;
  semantic_segment: {
    summary: string;
    intent: ShortFormIntent;
    boundary_reasons: string[];
    topic_terms: string[];
    topic_drift_score: number;
    speech_intent_shift_score: number;
  };
  score_breakdown: {
    model: typeof SHORT_FORM_RANKING_MODEL;
    semantic: {
      score: number;
      hook_score: number;
      density_score: number;
      insight_score: number;
    };
    acoustic: {
      analysis_mode: "transcript_timing_proxy" | "acoustic_fallback_proxy";
      rms_energy_proxy: number;
      speech_velocity_wps: number;
      silence_ratio: number;
      burst_spikes: number;
      emotional_intensity_proxy: number;
      score: number;
    };
    visual: {
      analysis_mode: "metadata_proxy" | "source_probe_proxy";
      motion_variance_proxy: number;
      scene_change_frequency_proxy: number;
      face_object_stability_proxy: number;
      camera_movement_proxy: number;
      score: number;
    };
    pacing: {
      duration_fit: number;
      emotional_peak_alignment: number;
      silence_penalty: number;
      score: number;
    };
    penalties: {
      low_clarity: number;
      excessive_silence: number;
      low_semantic_density: number;
      context_dependency: number;
    };
    final: {
      semantic_weighted: number;
      acoustic_score: number;
      visual_intensity_score: number;
      pacing_alignment_score: number;
      virality_score: number;
    };
    layers: {
      deterministic_scoring: "active";
      learned_weighting: "not_trained";
      llm_reasoning: "optional_refinement";
    };
  };
  recommended_music_pairing: {
    source: "selected_song" | "internal_catalog" | "placeholder";
    track_id: string;
    intensity: "low" | "medium" | "high";
    bpm_range: [number, number];
    emotional_peak_ms: number;
    drop_alignment_ms: number;
    reason: string;
  };
  rendering_style_metadata: {
    style: ShortFormStyle;
    transitions: string[];
    typography_density: "low" | "medium" | "high";
    motion_curve: string;
    color_grade: string;
  };
};

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "because",
  "before",
  "being",
  "every",
  "from",
  "have",
  "into",
  "just",
  "long",
  "more",
  "that",
  "their",
  "then",
  "there",
  "they",
  "this",
  "when",
  "with",
  "your"
]);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const splitSentences = (value: string): string[] =>
  normalizeText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const normalizeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9']/g, "");

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const countMatches = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;

const resolveStyle = (request: NormalizedJobRequest): ShortFormStyle => {
  const override = String(request.metadata_overrides.stylePreference ?? request.metadata_overrides.style ?? "").toLowerCase();
  const prompt = request.prompt.toLowerCase();
  if (/\bmanga|anime|comic\b/.test(override) || /\bmanga|anime|comic\b/.test(prompt)) {
    return "manga";
  }
  if (/\bminimal|clean|simple\b/.test(override) || /\bminimal|clean|simple\b/.test(prompt)) {
    return "minimal";
  }
  if (/\bviral|fast|punchy\b/.test(override) || /\bviral|fast|punchy\b/.test(prompt)) {
    return "viral";
  }
  return "cinematic";
};

const buildRenderingStyle = (style: ShortFormStyle): ShortFormIntelligence["rendering_style_metadata"] => {
  switch (style) {
    case "manga":
      return {
        style,
        transitions: ["panel_snap", "speed_line_push", "ink_flash"],
        typography_density: "high",
        motion_curve: "snappy-ease-out",
        color_grade: "high-contrast-ink"
      };
    case "minimal":
      return {
        style,
        transitions: ["hard_cut", "soft_fade"],
        typography_density: "low",
        motion_curve: "linear-restrained",
        color_grade: "neutral-clean"
      };
    case "viral":
      return {
        style,
        transitions: ["jump_cut", "punch_zoom", "beat_pop"],
        typography_density: "high",
        motion_curve: "fast-elastic",
        color_grade: "bright-social"
      };
    case "cinematic":
      return {
        style,
        transitions: ["slow_push", "match_cut", "dramatic_hold"],
        typography_density: "medium",
        motion_curve: "cubic-dramatic",
        color_grade: "cinematic-contrast"
      };
  }
};

const topicTermsForText = (text: string): string[] =>
  uniqueStrings(
    text
      .split(/[^a-zA-Z0-9']+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 5 && !STOPWORDS.has(token))
  ).slice(0, 8);

const summarizeSegment = (text: string): string => {
  const sentence = splitSentences(text)[0] ?? normalizeText(text);
  const words = sentence.split(/\s+/).slice(0, 18);
  return words.join(" ").replace(/[.!?]+$/, "");
};

const resolveIntent = (text: string, scores: ClipScore): ShortFormIntent => {
  const lower = text.toLowerCase();
  if (scores.hook >= 7 || /^(why|how|what|stop|listen)\b|here's the thing|nobody talks/i.test(text)) {
    return "hook";
  }
  if (scores.payoff >= 7 || /\b(the lesson|the point|which means|that's why|the reason)\b/i.test(lower)) {
    return "payoff";
  }
  if (/\b(i was|when i|then|story|remember)\b/i.test(lower)) {
    return "story";
  }
  if (text.trim().length === 0) {
    return "fallback";
  }
  return "insight";
};

const sumSilenceMs = (words: TranscribedWord[]): number => {
  let silenceMs = 0;
  for (let index = 1; index < words.length; index += 1) {
    silenceMs += Math.max(0, words[index].start_ms - words[index - 1].end_ms);
  }
  return silenceMs;
};

const firstEmotionalPeakMs = (
  words: TranscribedWord[],
  startMs: number,
  endMs: number,
  fallbackRatio: number
): number => {
  const emotionalWord = words.find((word) =>
    /\b(mistake|wrong|truth|nobody|reason|kills|doubled|necessary|conflict|tension)\b/i.test(word.text)
  );
  return emotionalWord?.start_ms ?? Math.round(startMs + (endMs - startMs) * fallbackRatio);
};

const resolveSelectedSong = (request: NormalizedJobRequest): string | null => {
  const raw = request.metadata_overrides.selectedSongs;
  if (Array.isArray(raw)) {
    const first = raw.find((entry) => typeof entry === "string" && entry.trim().length > 0);
    return first ? first.trim() : null;
  }
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
};

const buildMusicPairing = ({
  request,
  acousticScore,
  pacingScore,
  emotionalPeakMs
}: {
  request: NormalizedJobRequest;
  acousticScore: number;
  pacingScore: number;
  emotionalPeakMs: number;
}): ShortFormIntelligence["recommended_music_pairing"] => {
  const selectedSong = resolveSelectedSong(request);
  const combined = (acousticScore * 0.6) + (pacingScore * 0.4);
  const intensity: "low" | "medium" | "high" = combined >= 7.2 ? "high" : combined >= 5.2 ? "medium" : "low";
  const bpmRange: [number, number] = intensity === "high"
    ? [128, 150]
    : intensity === "medium"
      ? [104, 128]
      : [78, 104];

  return {
    source: selectedSong ? "selected_song" : "internal_catalog",
    track_id: selectedSong ?? `internal-${intensity}-shortform-bed`,
    intensity,
    bpm_range: bpmRange,
    emotional_peak_ms: emotionalPeakMs,
    drop_alignment_ms: Math.max(0, emotionalPeakMs - 600),
    reason:
      intensity === "high"
        ? "High speech energy and tight pacing call for a faster internal catalog bed."
        : intensity === "medium"
          ? "Balanced intensity pairs with a mid-tempo bed that can lift the payoff."
          : "Lower intensity should stay under the dialogue with a restrained music bed."
  };
};

export const buildShortFormIntelligence = (input: ShortFormIntelligenceInput): ShortFormIntelligence => {
  const text = normalizeText(input.transcriptExcerpt);
  const lowerText = text.toLowerCase();
  const durationMs = Math.max(1, input.endMs - input.startMs);
  const durationSeconds = durationMs / 1000;
  const wordCount = input.clipWords.length || Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const speechVelocity = round(wordCount / Math.max(1, durationSeconds), 2);
  const silenceRatio = input.clipWords.length > 1
    ? round(clamp(sumSilenceMs(input.clipWords) / durationMs, 0, 1), 3)
    : input.fallbackMode === "acoustic_segmentation"
      ? 0.28
      : 0;
  const punctuationSpikes = countMatches(text, /[!?]/g);
  const emphasisSpikes = input.heuristicSignals.emphasis_words.length;
  const burstSpikes = round(clamp((punctuationSpikes + emphasisSpikes) / Math.max(1, wordCount / 8), 0, 1), 3);
  const rmsEnergyProxy = round(clamp(0.26 + burstSpikes * 0.38 + speechVelocity * 0.08 - silenceRatio * 0.16, 0, 1), 3);
  const velocityNorm = clamp(speechVelocity / 3.8, 0, 1);
  const emotionalIntensityProxy = round(
    clamp((input.baseScores.emotion / 10) * 0.52 + rmsEnergyProxy * 0.28 + burstSpikes * 0.2, 0, 1),
    3
  );
  const acousticScore = round(
    clamp(
      (rmsEnergyProxy * 10 * 0.4) +
        (velocityNorm * 10 * 0.3) -
        (silenceRatio * 10 * 0.2) +
        (burstSpikes * 10 * 0.1),
      0,
      10
    ),
    2
  );

  const sourceProbeAvailable = Boolean(input.sourceMetadata?.hasSourceVideo || input.sourceMetadata?.width || input.sourceMetadata?.height);
  const motionWords = countMatches(lowerText, /\b(move|scroll|open|start|change|arrive|land|double|watch|look|cut|jump)\b/g);
  const motionVarianceProxy = round(clamp(0.22 + motionWords * 0.08 + (input.sourceMetadata?.hasSourceVideo ? 0.14 : 0), 0, 1), 3);
  const sceneChangeFrequencyProxy = round(clamp(0.16 + (input.heuristicSignals.contrast_phrase ? 0.24 : 0), 0, 1), 3);
  const faceObjectStabilityProxy = round(input.sourceMetadata?.hasSourceVideo ? 0.76 : 0.48, 3);
  const cameraMovementProxy = round(clamp(0.18 + motionWords * 0.05, 0, 1), 3);
  const visualScore = round(
    clamp(
      (motionVarianceProxy * 3.4) +
        (sceneChangeFrequencyProxy * 2.2) +
        (faceObjectStabilityProxy * 2.4) +
        (cameraMovementProxy * 2),
      0,
      10
    ),
    2
  );

  const targetDuration = input.targetPlatform === "youtube" ? 32000 : 22000;
  const durationFit = round(clamp(1 - Math.abs(durationMs - targetDuration) / targetDuration, 0, 1), 3);
  const emotionalPeakAlignment = round(clamp(1 - Math.abs(0.55 - ((firstEmotionalPeakMs(input.clipWords, input.startMs, input.endMs, 0.55) - input.startMs) / durationMs)), 0, 1), 3);
  const silencePenalty = round(clamp(silenceRatio * 1.4, 0, 1), 3);
  const pacingScore = round(clamp((durationFit * 4.2) + (emotionalPeakAlignment * 4.2) + ((1 - silencePenalty) * 1.6), 0, 10), 2);

  const topicTerms = topicTermsForText(`${input.leadingContext} ${text} ${input.trailingContext}`);
  const semanticDensity = round(clamp(topicTerms.length / 8, 0, 1), 3);
  const semanticScore = round(
    clamp(
      (input.baseScores.hook * 0.28) +
        (input.baseScores.clarity * 0.2) +
        (input.baseScores.payoff * 0.2) +
        (input.baseScores.emotion * 0.12) +
        (input.baseScores.shareability * 0.12) +
        (semanticDensity * 10 * 0.08),
      0,
      10
    ),
    2
  );
  const penalties = {
    low_clarity: round(clamp(6 - input.baseScores.clarity, 0, 10), 2),
    excessive_silence: round(clamp(silenceRatio * 7, 0, 10), 2),
    low_semantic_density: round(clamp((1 - semanticDensity) * 3, 0, 10), 2),
    context_dependency: input.heuristicSignals.context_dependency_penalty ? 1.6 : 0
  };
  const penaltyTotal = (penalties.low_clarity * 0.18) +
    (penalties.excessive_silence * 0.18) +
    (penalties.low_semantic_density * 0.14) +
    (penalties.context_dependency * 0.2);
  const viralityScore = round(
    clamp((semanticScore * 0.45) + (acousticScore * 0.2) + (visualScore * 0.15) + (pacingScore * 0.2) - penaltyTotal, 0, 10),
    2
  );
  const emotionalPeakMs = firstEmotionalPeakMs(input.clipWords, input.startMs, input.endMs, 0.55);

  return {
    semantic_summary: summarizeSegment(text),
    semantic_segment: {
      summary: summarizeSegment(text),
      intent: resolveIntent(text, input.baseScores),
      boundary_reasons: uniqueStrings([
        input.fallbackMode === "acoustic_segmentation" ? "acoustic_fallback" : "semantic_window",
        input.heuristicSignals.clean_start_boundary || input.heuristicSignals.clean_end_boundary ? "speech_boundary" : "",
        silenceRatio > 0.18 ? "silence_gap" : "",
        input.heuristicSignals.contrast_phrase ? "intent_shift" : ""
      ]),
      topic_terms: topicTerms,
      topic_drift_score: round(clamp(topicTermsForText(input.leadingContext).filter((term) => !topicTerms.includes(term)).length / 8, 0, 1), 3),
      speech_intent_shift_score: round(input.heuristicSignals.contrast_phrase ? 0.72 : input.heuristicSignals.strong_hook_phrase ? 0.58 : 0.32, 3)
    },
    score_breakdown: {
      model: SHORT_FORM_RANKING_MODEL,
      semantic: {
        score: semanticScore,
        hook_score: input.baseScores.hook,
        density_score: round(semanticDensity * 10, 2),
        insight_score: round((input.baseScores.payoff + input.baseScores.clarity) / 2, 2)
      },
      acoustic: {
        analysis_mode: input.fallbackMode === "acoustic_segmentation" ? "acoustic_fallback_proxy" : "transcript_timing_proxy",
        rms_energy_proxy: rmsEnergyProxy,
        speech_velocity_wps: speechVelocity,
        silence_ratio: silenceRatio,
        burst_spikes: burstSpikes,
        emotional_intensity_proxy: emotionalIntensityProxy,
        score: acousticScore
      },
      visual: {
        analysis_mode: sourceProbeAvailable ? "source_probe_proxy" : "metadata_proxy",
        motion_variance_proxy: motionVarianceProxy,
        scene_change_frequency_proxy: sceneChangeFrequencyProxy,
        face_object_stability_proxy: faceObjectStabilityProxy,
        camera_movement_proxy: cameraMovementProxy,
        score: visualScore
      },
      pacing: {
        duration_fit: durationFit,
        emotional_peak_alignment: emotionalPeakAlignment,
        silence_penalty: silencePenalty,
        score: pacingScore
      },
      penalties,
      final: {
        semantic_weighted: semanticScore,
        acoustic_score: acousticScore,
        visual_intensity_score: visualScore,
        pacing_alignment_score: pacingScore,
        virality_score: viralityScore
      },
      layers: {
        deterministic_scoring: "active",
        learned_weighting: "not_trained",
        llm_reasoning: "optional_refinement"
      }
    },
    recommended_music_pairing: buildMusicPairing({
      request: input.request,
      acousticScore,
      pacingScore,
      emotionalPeakMs
    }),
    rendering_style_metadata: buildRenderingStyle(resolveStyle(input.request))
  };
};

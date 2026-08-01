import {execFile} from "node:child_process";

import type {
  MaulEditorialTimelinePayload,
  MaulEditorialTimelineRequest
} from "@prometheus/shared-types";

export type DetectedSilenceSpan = {
  sourceStartMs: number;
  sourceEndMs: number;
  confidence: number;
};

type TimestampMapSegment = MaulEditorialTimelinePayload["timestampMap"][number];

const roundMs = (seconds: string): number => Math.round(Number(seconds) * 1000);
const seconds = (milliseconds: number): string =>
  Number((milliseconds / 1000).toFixed(3)).toString();
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const parseFfmpegSilenceDetect = (
  output: string,
  sourceDurationMs: number
): DetectedSilenceSpan[] => {
  const spans: DetectedSilenceSpan[] = [];
  let openStartMs: number | null = null;

  for (const line of output.split(/\r?\n/)) {
    const startMatch = /silence_start:\s*([0-9.]+)/.exec(line);
    if (startMatch?.[1]) {
      openStartMs = roundMs(startMatch[1]);
    }

    const endMatch = /silence_end:\s*([0-9.]+)/.exec(line);
    if (endMatch?.[1] && openStartMs !== null) {
      const sourceEndMs = Math.min(sourceDurationMs, roundMs(endMatch[1]));
      if (sourceEndMs > openStartMs) {
        spans.push({
          sourceStartMs: openStartMs,
          sourceEndMs,
          confidence: 1
        });
      }
      openStartMs = null;
    }
  }

  if (openStartMs !== null && sourceDurationMs > openStartMs) {
    spans.push({
      sourceStartMs: openStartMs,
      sourceEndMs: sourceDurationMs,
      confidence: 1
    });
  }

  return spans.sort((left, right) => left.sourceStartMs - right.sourceStartMs);
};

export const detectSilenceWithFfmpeg = async ({
  sourcePath,
  sourceDurationMs,
  noiseThresholdDb,
  minimumSilenceMs,
  ffmpegBinary = "ffmpeg"
}: {
  sourcePath: string;
  sourceDurationMs: number;
  noiseThresholdDb: number;
  minimumSilenceMs: number;
  ffmpegBinary?: string;
}): Promise<DetectedSilenceSpan[]> => {
  const stderr = await new Promise<string>((resolve, reject) => {
    execFile(
      ffmpegBinary,
      [
        "-hide_banner",
        "-nostats",
        "-i",
        sourcePath,
        "-af",
        `silencedetect=noise=${noiseThresholdDb}dB:d=${(minimumSilenceMs / 1000).toFixed(3)}`,
        "-f",
        "null",
        "-"
      ],
      {windowsHide: true},
      (error, _stdout, errorOutput) => {
        if (error) {
          reject(new Error(`MAUL silence detection failed: ${errorOutput.trim() || error.message}`));
          return;
        }
        resolve(errorOutput);
      }
    );
  });
  return parseFfmpegSilenceDetect(stderr, sourceDurationMs);
};

const buildVoiceSpans = (
  request: MaulEditorialTimelineRequest,
  silenceSpans: DetectedSilenceSpan[],
  provider: string
) => {
  const spans: Array<{
    sourceStartMs: number;
    sourceEndMs: number;
    speakerId: string | null;
    confidence: number;
    detectionSource: string;
    verified: boolean;
  }> = [];
  const principalSpeakerId = principalSpeaker(request.speakerDetections)?.speakerId ?? null;
  let bucket = [request.transcript.words[0]!];

  const flush = () => {
    if (bucket.length === 0) {
      return;
    }
    spans.push({
      sourceStartMs: bucket[0]!.startMs,
      sourceEndMs: bucket[bucket.length - 1]!.endMs,
      speakerId: principalSpeakerId,
      confidence: Math.min(...bucket.map((word) => word.confidence)),
      detectionSource: `timed_transcript+${provider}`,
      verified: true
    });
    bucket = [];
  };

  for (const word of request.transcript.words.slice(1)) {
    const previous = bucket[bucket.length - 1]!;
    const crossesVerifiedSilence = silenceSpans.some(
      (silence) =>
        silence.sourceStartMs >= previous.endMs
        && silence.sourceEndMs <= word.startMs
    );
    if (crossesVerifiedSilence || word.startMs - previous.endMs > 600) {
      flush();
    }
    bucket.push(word);
  }
  flush();
  return spans;
};

const principalSpeaker = (
  detections: MaulEditorialTimelineRequest["speakerDetections"]
): {speakerId: string; confidence: number} | null => {
  const scores = new Map<string, {total: number; count: number}>();
  for (const detection of detections) {
    const current = scores.get(detection.speakerId) ?? {total: 0, count: 0};
    current.total += detection.confidence;
    current.count += 1;
    scores.set(detection.speakerId, current);
  }
  const ranked = [...scores.entries()]
    .map(([speakerId, score]) => ({
      speakerId,
      confidence: score.total / score.count,
      count: score.count
    }))
    .sort((left, right) => right.count - left.count || right.confidence - left.confidence);
  return ranked[0] ?? null;
};

const buildSpeakerCropTracks = ({
  request,
  outputDurationMs,
  sourceWidth,
  sourceHeight
}: {
  request: MaulEditorialTimelineRequest;
  outputDurationMs: number;
  sourceWidth: number;
  sourceHeight: number;
}): MaulEditorialTimelinePayload["speakerCropTracks"] => {
  const principal = principalSpeaker(request.speakerDetections);
  if (!principal) {
    const cropWidth = Math.min(1, (sourceHeight * 9) / (sourceWidth * 16));
    return [{
      speakerId: "principal_unknown",
      outputStartMs: 0,
      outputEndMs: outputDurationMs,
      crop: {
        x: Number(((1 - cropWidth) / 2).toFixed(4)),
        y: 0,
        width: Number(cropWidth.toFixed(4)),
        height: 1
      }
    }];
  }

  const samples = request.speakerDetections.filter(
    (detection) => detection.speakerId === principal.speakerId
  );
  const averageCenterX = samples.reduce(
    (total, sample) => total + sample.x + sample.width / 2,
    0
  ) / samples.length;
  const cropWidth = Math.min(1, (sourceHeight * 9) / (sourceWidth * 16));
  return [{
    speakerId: principal.speakerId,
    outputStartMs: 0,
    outputEndMs: outputDurationMs,
    crop: {
      x: Number(clamp(averageCenterX - cropWidth / 2, 0, 1 - cropWidth).toFixed(4)),
      y: 0,
      width: Number(cropWidth.toFixed(4)),
      height: 1
    }
  }];
};

const classifyProtectedPause = (
  silence: DetectedSilenceSpan,
  request: MaulEditorialTimelineRequest
): MaulEditorialTimelinePayload["protectedRanges"][number] | null => {
  const durationMs = silence.sourceEndMs - silence.sourceStartMs;
  const precedingWord = [...request.transcript.words]
    .reverse()
    .find((word) => word.endMs <= silence.sourceStartMs);
  const followingWord = request.transcript.words.find(
    (word) => word.startMs >= silence.sourceEndMs
  );
  if (
    durationMs <= 900
    && precedingWord
    && followingWord
    && /[.!?]["']?$/.test(precedingWord.text)
  ) {
    return {
      sourceStartMs: silence.sourceStartMs,
      sourceEndMs: silence.sourceEndMs,
      kind: "rhetorical_pause",
      reason: `Protected after sentence-ending "${precedingWord.text}" before the next thought.`
    };
  }
  return null;
};

const buildTimestampMap = ({
  selectedWindow,
  cutRanges,
  protectedRanges
}: {
  selectedWindow: MaulEditorialTimelineRequest["selectedWindow"];
  cutRanges: DetectedSilenceSpan[];
  protectedRanges: MaulEditorialTimelinePayload["protectedRanges"];
}): TimestampMapSegment[] => {
  const ranges = [
    ...cutRanges.map((range) => ({...range, mode: "cut" as const})),
    ...protectedRanges.map((range) => ({...range, mode: "protected_pause" as const}))
  ].sort((left, right) => left.sourceStartMs - right.sourceStartMs);
  const map: TimestampMapSegment[] = [];
  let sourceCursorMs = selectedWindow.sourceStartMs;
  let outputCursorMs = 0;

  for (const range of ranges) {
    const startMs = Math.max(selectedWindow.sourceStartMs, range.sourceStartMs);
    const endMs = Math.min(selectedWindow.sourceEndMs, range.sourceEndMs);
    if (endMs <= startMs || startMs < sourceCursorMs) {
      continue;
    }
    if (startMs > sourceCursorMs) {
      const durationMs = startMs - sourceCursorMs;
      map.push({
        sourceStartMs: sourceCursorMs,
        sourceEndMs: startMs,
        outputStartMs: outputCursorMs,
        outputEndMs: outputCursorMs + durationMs,
        mode: "keep"
      });
      outputCursorMs += durationMs;
    }
    const rangeDurationMs = endMs - startMs;
    map.push({
      sourceStartMs: startMs,
      sourceEndMs: endMs,
      outputStartMs: outputCursorMs,
      outputEndMs: range.mode === "cut" ? outputCursorMs : outputCursorMs + rangeDurationMs,
      mode: range.mode
    });
    if (range.mode !== "cut") {
      outputCursorMs += rangeDurationMs;
    }
    sourceCursorMs = endMs;
  }

  if (sourceCursorMs < selectedWindow.sourceEndMs) {
    const durationMs = selectedWindow.sourceEndMs - sourceCursorMs;
    map.push({
      sourceStartMs: sourceCursorMs,
      sourceEndMs: selectedWindow.sourceEndMs,
      outputStartMs: outputCursorMs,
      outputEndMs: outputCursorMs + durationMs,
      mode: "keep"
    });
  }
  return map;
};

export const buildMaulAnalysisPayload = ({
  request,
  sourceAssetId,
  sourceDurationMs,
  silenceSpans,
  provider
}: {
  request: MaulEditorialTimelineRequest;
  sourceAssetId: string;
  sourceDurationMs: number;
  silenceSpans: DetectedSilenceSpan[];
  provider: string;
}) => ({
  sourceAssetId,
  transcript: request.transcript,
  voiceSpans: buildVoiceSpans(request, silenceSpans, provider),
  silenceSpans: silenceSpans.map((span) => ({
    ...span,
    detectionSource: provider,
    verified: true
  })),
  shots: request.shots,
  speakerTracks: [...new Set(request.speakerDetections.map((sample) => sample.speakerId))]
    .map((speakerId) => ({
      speakerId,
      samples: request.speakerDetections
        .filter((sample) => sample.speakerId === speakerId)
        .map(({speakerId: _speakerId, ...sample}) => sample)
    })),
  technicalFacts: {
    sourceDurationMs,
    vadProvider: provider,
    transcriptWordCount: request.transcript.words.length,
    principalSpeakerId: principalSpeaker(request.speakerDetections)?.speakerId ?? null
  }
});

export const buildMaulEditorialTimelinePayload = ({
  request,
  sourceAssetId,
  analysisArtifactId,
  sourceDurationMs,
  sourceWidth,
  sourceHeight,
  silenceSpans
}: {
  request: MaulEditorialTimelineRequest;
  sourceAssetId: string;
  analysisArtifactId: string;
  sourceDurationMs: number;
  sourceWidth: number;
  sourceHeight: number;
  silenceSpans: DetectedSilenceSpan[];
}): MaulEditorialTimelinePayload => {
  const inWindow = silenceSpans.filter(
    (span) =>
      span.sourceEndMs > request.selectedWindow.sourceStartMs
      && span.sourceStartMs < request.selectedWindow.sourceEndMs
  );
  const protectedRanges = inWindow
    .map((span) => classifyProtectedPause(span, request))
    .filter((range): range is NonNullable<typeof range> => range !== null);
  const protectedKeys = new Set(
    protectedRanges.map((range) => `${range.sourceStartMs}:${range.sourceEndMs}`)
  );
  const cutRanges = inWindow.filter(
    (span) => !protectedKeys.has(`${span.sourceStartMs}:${span.sourceEndMs}`)
      && span.sourceEndMs - span.sourceStartMs >= 250
  );
  const timestampMap = buildTimestampMap({
    selectedWindow: request.selectedWindow,
    cutRanges,
    protectedRanges
  });
  const outputDurationMs = timestampMap.at(-1)?.outputEndMs ?? 0;
  return {
    sourceAssetId,
    analysisArtifactId,
    sourceDurationMs,
    outputDurationMs,
    selectedClipWindows: [request.selectedWindow],
    cutCandidates: cutRanges.map((range) => ({
      sourceStartMs: range.sourceStartMs,
      sourceEndMs: range.sourceEndMs,
      sentenceSafe: true,
      reason: "verified_non_protected_silence",
      confidence: range.confidence
    })),
    protectedRanges,
    timestampMap,
    speakerCropTracks: buildSpeakerCropTracks({
      request,
      outputDurationMs,
      sourceWidth,
      sourceHeight
    }),
    editRationale: [
      `Removed ${cutRanges.length} verified dead air range${cutRanges.length === 1 ? "" : "s"}.`,
      `Protected ${protectedRanges.length} meaningful pause${protectedRanges.length === 1 ? "" : "s"}.`,
      "Every output timestamp is mapped back to the authoritative source."
    ],
    qualityWarnings: [
      ...(request.speakerDetections.length === 0
        ? ["Principal-speaker detection unavailable; centered vertical crop fallback used."]
        : []),
      ...(request.shots.length === 0
        ? ["Shot detection unavailable; treatment must avoid shot-dependent transitions."]
        : [])
    ]
  };
};

export const buildMaulEditorialFfmpegArgs = (
  sourcePath: string,
  outputPath: string,
  timestampMap: TimestampMapSegment[]
): string[] => {
  const kept = timestampMap.filter((segment) => segment.mode !== "cut");
  if (kept.length === 0) {
    throw new Error("MAUL Editorial Timeline has no renderable kept ranges.");
  }
  const filters = kept.flatMap((segment, index) => [
    `[0:v]trim=start=${seconds(segment.sourceStartMs)}:end=${seconds(segment.sourceEndMs)},setpts=PTS-STARTPTS[v${index}]`,
    `[0:a]atrim=start=${seconds(segment.sourceStartMs)}:end=${seconds(segment.sourceEndMs)},asetpts=PTS-STARTPTS[a${index}]`
  ]);
  const inputs = kept.map((_, index) => `[v${index}][a${index}]`).join("");
  filters.push(`${inputs}concat=n=${kept.length}:v=1:a=1[vout][aout]`);
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath
  ];
};

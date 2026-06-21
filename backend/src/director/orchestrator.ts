import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {createHash} from "node:crypto";
import {
  type CutEvent,
  type SFXEvent,
  type TextEvent,
  type TimelineEvent,
  type UnifiedRenderManifest,
  type Word,
} from "@prometheus/shared-types";
import {loadEnv, type BackendEnv} from "../config";
import {decideCognitiveStage} from "../cognitive-governor";
import {preserveEvidence, type EvidenceArtifactPaths, type EvidencePackage} from "../ledger/evidence-preservation";
import {ReplayLedger} from "../ledger/replay-ledger";
import {findCutPoints, type Phrase as BoundaryPhrase} from "./dynamic-boundaries";
import {computeSimilarityHash, JudgmentLayer} from "./judgment-layer";
import {
  generateCandidateGenomes,
  generateJosephManifest,
  type DirectorInput,
} from "./joseph-director";
import {PromptRegistry, type GovernedPrompt} from "./prompt-governance";
import {
  canUseEffect,
  createMemory,
  shouldBreathe,
  updateMemory,
  useEffect,
  type SequenceMemory,
} from "./sequence-memory";
import {generateVariationKey, type VariationKey} from "./variation-key";

export type JosephProfile = "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";

export interface OrchestratorInput {
  sourceVideoPath: string;
  transcriptPath: string;
  audioPath: string;
  musicPath?: string;
  promptText?: string;
  profile: JosephProfile;
  uploadInstanceId?: string;
  retryIndex?: number;
  evidenceDir?: string;
  env?: BackendEnv;
}

export interface PlannerAudit {
  cognitiveDecision: ReturnType<typeof decideCognitiveStage>;
  governedPrompt: GovernedPrompt;
  candidateScores: unknown[];
  expectedCuts: number[];
  sequenceMemory: SequenceMemorySummary[];
}

export interface OrchestratorResult {
  manifest: UnifiedRenderManifest;
  variationKey: VariationKey;
  evidence: EvidencePackage;
  evidencePaths: EvidenceArtifactPaths;
  candidateCount: number;
  rejectedCount: number;
  qualityScore: number;
  plannerAudit: PlannerAudit;
  renderPath?: string;
}

type TranscriptPayload = {
  phrases?: TranscriptPhrase[];
  words?: Word[];
  beats?: number[];
  onsets?: number[];
  energyCurve?: number[];
  durationMs?: number;
};

type TranscriptPhrase = {
  startMs: number;
  endMs: number;
  text: string;
  words: Word[];
};

type SequenceMemorySummary = {
  finalState: SequenceMemory["state"];
  intensityBudget: number;
  breatheFrames: number[];
  highEnergy20sWindows: number;
  blockedEffectFrames: number;
};

type CandidateWithSequenceMemory = UnifiedRenderManifest & {
  _sequenceMemory?: SequenceMemorySummary;
  _expectedCuts?: number[];
};

const MAX_INT_31 = 2147483647;
const DEFAULT_PROMPT = "default joseph aggressive cinematic minimal";

const PROFILE_CONFIG: Record<JosephProfile, {count: number; textCoverage: number; sfxDensity: number}> = {
  joseph_aggressive: {count: 6, textCoverage: 0.8, sfxDensity: 1},
  joseph_cinematic: {count: 4, textCoverage: 0.45, sfxDensity: 0.5},
  joseph_minimal: {count: 3, textCoverage: 0.2, sfxDensity: 0},
};

const stableHash = (value: string): string => createHash("sha256").update(value).digest("hex");

const seedFromVariationKey = (variationKey: VariationKey): number => {
  const hex = variationKey.key.slice(0, 12);
  const value = Number.parseInt(hex, 16);
  return Number.isFinite(value) ? (value % MAX_INT_31) || 1 : 1;
};

const uploadInstanceIdFor = (input: OrchestratorInput): string =>
  input.uploadInstanceId ?? `upload-${stableHash(`${input.sourceVideoPath}:${input.promptText ?? DEFAULT_PROMPT}:${input.profile}`).slice(0, 16)}`;

const readTranscriptPayload = (input: OrchestratorInput): TranscriptPayload => {
  if (input.transcriptPath && fs.existsSync(input.transcriptPath)) {
    return JSON.parse(fs.readFileSync(input.transcriptPath, "utf8")) as TranscriptPayload;
  }

  return {
    phrases: [
      {
        startMs: 0,
        endMs: 1200,
        text: "hook phrase",
        words: [
          {text: "Listen", startMs: 200, endMs: 420, confidence: 0.98},
          {text: "closely", startMs: 520, endMs: 820, confidence: 0.97},
        ],
      },
      {
        startMs: 3300,
        endMs: 3900,
        text: "body phrase",
        words: [{text: "Move", startMs: 3300, endMs: 3600, confidence: 0.97}],
      },
      {
        startMs: 7600,
        endMs: 8400,
        text: "cta phrase",
        words: [{text: "Now", startMs: 8000, endMs: 8300, confidence: 0.98}],
      },
    ],
    words: [
      {text: "Listen", startMs: 200, endMs: 420, confidence: 0.98},
      {text: "closely", startMs: 520, endMs: 820, confidence: 0.97},
      {text: "Move", startMs: 3300, endMs: 3600, confidence: 0.97},
      {text: "again", startMs: 4300, endMs: 4600, confidence: 0.96},
      {text: "Now", startMs: 8000, endMs: 8300, confidence: 0.98},
    ],
    beats: [500, 1500, 2500, 3500, 4300, 6100, 7000, 8000, 8800],
    onsets: [200, 800, 3300, 4300, 8000],
    energyCurve: [0.35, 0.78, 0.86, 0.48, 0.7, 0.82, 0.44, 0.76, 0.9],
    durationMs: 10_000,
  };
};

const wordsFromPayload = (payload: TranscriptPayload): Word[] => {
  if (payload.words && payload.words.length > 0) {
    return payload.words;
  }

  return (payload.phrases ?? []).flatMap((phrase) => phrase.words);
};

const phrasesFromPayload = (payload: TranscriptPayload): BoundaryPhrase[] => {
  if (payload.phrases && payload.phrases.length > 0) {
    return payload.phrases.map((phrase) => ({
      startMs: phrase.startMs,
      endMs: phrase.endMs,
      text: phrase.text,
      words: phrase.words.map((word) => ({startMs: word.startMs, endMs: word.endMs, text: word.text})),
    }));
  }

  return wordsFromPayload(payload).map((word) => ({
    startMs: word.startMs,
    endMs: word.endMs,
    text: word.text,
    words: [{startMs: word.startMs, endMs: word.endMs, text: word.text}],
  }));
};

const buildDirectorInput = (
  input: OrchestratorInput,
  variationKey: VariationKey,
  payload: TranscriptPayload,
): DirectorInput => ({
  videoUrl: input.sourceVideoPath,
  musicTrackUrl: input.musicPath ?? input.audioPath,
  transcript: wordsFromPayload(payload),
  beats: payload.beats ?? [],
  onsets: payload.onsets ?? [],
  energyCurve: payload.energyCurve ?? [0.5],
  durationMs: Math.min(payload.durationMs ?? 90_000, 90_000),
  seed: seedFromVariationKey(variationKey),
  profile: input.profile,
});

const eventTime = (event: TimelineEvent): number =>
  event.type === "cut" || event.type === "transition" ? event.atMs : event.startMs;

const sortedTimeline = (timeline: TimelineEvent[]): TimelineEvent[] =>
  [...timeline].sort((left, right) => eventTime(left) - eventTime(right));

const cutEvent = (atMs: number, style: CutEvent["style"] = "hard"): CutEvent => ({
  type: "cut",
  atMs,
  toMs: atMs,
  style,
  intensity: 1,
});

const sfxEvent = (id: string, cue: SFXEvent["cue"], triggerMs: number): SFXEvent => ({
  id,
  cue,
  triggerMs,
  durationMs: 250,
  volumeDb: -12,
  duckMusicDb: -6,
});

const ensureQualityScaffold = (
  candidate: UnifiedRenderManifest,
  expectedCuts: number[],
  profile: JosephProfile,
): UnifiedRenderManifest => {
  const config = PROFILE_CONFIG[profile];
  const durationMs = candidate.source.durationMs;
  const existingCuts = candidate.timeline.filter((event): event is CutEvent => event.type === "cut");
  const cutByMs = new Map(existingCuts.map((cut) => [Math.round(cut.atMs), cut]));

  for (const point of expectedCuts) {
    if (!cutByMs.has(Math.round(point))) {
      cutByMs.set(Math.round(point), cutEvent(point));
    }
  }

  const cuts = [...cutByMs.values()].sort((left, right) => left.atMs - right.atMs);
  const timelineWithoutCuts = candidate.timeline.filter((event) => event.type !== "cut");
  const sfx = profile === "joseph_minimal"
    ? []
    : [...candidate.audio.sfx];
  const existingSfx = new Set(sfx.map((event) => `${event.cue}:${Math.round(event.triggerMs)}`));

  if (config.sfxDensity > 0) {
    for (const [index, cut] of cuts.entries()) {
      if (cut.style === "hard" && !existingSfx.has(`whoosh_fast:${Math.round(cut.atMs)}`)) {
        sfx.push(sfxEvent(`orchestrator-cut-${index}`, "whoosh_fast", cut.atMs));
      }
    }

    const textEvents = timelineWithoutCuts.filter((event): event is TextEvent => event.type === "text");
    for (const [index, text] of textEvents.entries()) {
      if (text.style === "glitch" && !existingSfx.has(`glitch_digital:${Math.round(text.startMs)}`)) {
        sfx.push(sfxEvent(`orchestrator-glitch-${index}`, "glitch_digital", text.startMs));
      }
      if (text.style === "pop" && !existingSfx.has(`pop_text:${Math.round(text.startMs)}`)) {
        sfx.push(sfxEvent(`orchestrator-pop-${index}`, "pop_text", text.startMs));
      }
    }
  }

  return {
    ...candidate,
    source: {
      ...candidate.source,
      durationMs,
      width: 1080,
      height: 1920,
    },
    width: 1080,
    height: 1920,
    output: {
      ...candidate.output,
      width: 1080,
      height: 1920,
    },
    timeline: sortedTimeline([...timelineWithoutCuts, ...cuts]),
    audio: {
      ...candidate.audio,
      sfx: sfx.sort((left, right) => left.triggerMs - right.triggerMs),
    },
    creativeProfile: {
      ...candidate.creativeProfile,
      textDensity: config.textCoverage,
      sfxDensity: config.sfxDensity,
    },
  };
};

const energyAtFrame = (manifest: UnifiedRenderManifest, frame: number): number => {
  const energyCurve = manifest.audio.energyCurve ?? [];
  if (energyCurve.length === 0) {
    return 0.5;
  }

  const index = Math.min(energyCurve.length - 1, Math.floor((frame / manifest.durationFrames) * energyCurve.length));
  return energyCurve[index] ?? 0.5;
};

const annotateSequenceMemory = (manifest: UnifiedRenderManifest): CandidateWithSequenceMemory => {
  let memory = createMemory();
  const breatheFrames: number[] = [];
  let blockedEffectFrames = 0;

  for (let frame = 0; frame < manifest.durationFrames; frame += 1) {
    const energy = energyAtFrame(manifest, frame);
    const ms = (frame / manifest.fps) * 1000;
    const isCTA = ms > manifest.source.durationMs - 3000;
    const breathe = shouldBreathe(memory, frame);
    if (breathe) {
      breatheFrames.push(frame);
    }
    memory = updateMemory(memory, energy, frame, breathe || isCTA);

    for (const cut of manifest.timeline.filter((event): event is CutEvent => event.type === "cut")) {
      const cutFrame = Math.round((cut.atMs / 1000) * manifest.fps);
      if (cutFrame === frame) {
        if (!canUseEffect(memory, cut.style, frame)) {
          blockedEffectFrames += 1;
        }
        memory = useEffect(memory, cut.style, frame);
      }
    }
  }

  return {
    ...manifest,
    _sequenceMemory: {
      finalState: memory.state,
      intensityBudget: memory.intensityBudget,
      breatheFrames,
      highEnergy20sWindows: manifest.source.durationMs >= 20_000 && (manifest.audio.energyCurve ?? []).some((energy) => energy >= 0.7) ? 1 : 0,
      blockedEffectFrames,
    },
  };
};

const canonicalizeManifestForResult = (manifest: UnifiedRenderManifest, variationKey: VariationKey): UnifiedRenderManifest => ({
  ...manifest,
  jobId: `${variationKey.uploadInstanceId}:${variationKey.retryIndex}:${manifest.seed}`,
  createdAt: "1970-01-01T00:00:00.000Z",
});

const buildPlannerAudit = (
  env: BackendEnv,
  governedPrompt: GovernedPrompt,
  candidateScores: unknown[],
  expectedCuts: number[],
  candidates: CandidateWithSequenceMemory[],
): PlannerAudit => ({
  cognitiveDecision: decideCognitiveStage({env, stage: "planning"}),
  governedPrompt,
  candidateScores,
  expectedCuts,
  sequenceMemory: candidates.map((candidate) => candidate._sequenceMemory).filter((summary): summary is SequenceMemorySummary => Boolean(summary)),
});

export async function orchestrateRender(
  input: OrchestratorInput,
  ledger: ReplayLedger,
  promptRegistry: PromptRegistry,
  judgmentLayer = new JudgmentLayer(ledger),
): Promise<OrchestratorResult> {
  const env = input.env ?? loadEnv();
  const governedPrompt = promptRegistry.register(input.promptText ?? DEFAULT_PROMPT, {tone: input.profile.replace("joseph_", "") as "aggressive" | "cinematic" | "minimal"});
  const uploadInstanceId = uploadInstanceIdFor(input);
  const variationKey = generateVariationKey(
    input.sourceVideoPath,
    governedPrompt.text,
    uploadInstanceId,
    input.retryIndex ?? 0,
    input.profile,
  );
  const transcript = readTranscriptPayload(input);
  const directorInput = buildDirectorInput(input, variationKey, transcript);
  const expectedCuts = findCutPoints(
    phrasesFromPayload(transcript),
    directorInput.beats,
    directorInput.onsets,
    directorInput.durationMs,
    input.profile,
  );
  const candidates = generateCandidateGenomes(directorInput, PROFILE_CONFIG[input.profile].count)
    .map((candidate) => ensureQualityScaffold(candidate, expectedCuts, input.profile))
    .map(annotateSequenceMemory)
    .map((candidate) => ({
      ...canonicalizeManifestForResult(candidate, variationKey),
      _sequenceMemory: candidate._sequenceMemory,
      _expectedCuts: expectedCuts,
    }));

  // Keep the legacy manifest path loaded so future regressions surface if this export disappears.
  generateJosephManifest(directorInput);

  const judgment = await judgmentLayer.judgeCandidates(candidates, variationKey, governedPrompt);
  const selected = canonicalizeManifestForResult(judgment.selected, variationKey);
  const rejected = judgment.rejected.map((candidate) => canonicalizeManifestForResult(candidate, variationKey));
  const plannerAudit = buildPlannerAudit(env, governedPrompt, judgment.scores, expectedCuts, candidates);
  const evidence: EvidencePackage = {
    jobId: variationKey.uploadInstanceId,
    variationKey,
    candidates,
    selected,
    rejected,
    verdict: judgment.verdict,
    timestamp: new Date().toISOString(),
    plannerAudit,
  };
  const evidencePaths = preserveEvidence(evidence, input.evidenceDir ?? path.join(os.homedir(), ".prometheus", "evidence"));

  ledger.insert({
    id: `${variationKey.uploadInstanceId}:${variationKey.retryIndex}`,
    sourceFingerprint: variationKey.sourceFingerprint,
    promptFingerprint: variationKey.promptFingerprint,
    uploadInstanceId: variationKey.uploadInstanceId,
    retryIndex: variationKey.retryIndex,
    profile: input.profile,
    chosenGenome: JSON.stringify(selected),
    rejectedGenomes: JSON.stringify(rejected),
    plannerAudit: JSON.stringify(plannerAudit),
    similarityHash: computeSimilarityHash(selected),
    qualityScore: judgment.verdict.qualityScore,
    failureTags: judgment.verdict.failureTags.join(","),
    createdAt: new Date().toISOString(),
  });

  return {
    manifest: selected,
    variationKey,
    evidence,
    evidencePaths,
    candidateCount: candidates.length,
    rejectedCount: rejected.length,
    qualityScore: judgment.verdict.qualityScore,
    plannerAudit,
  };
}



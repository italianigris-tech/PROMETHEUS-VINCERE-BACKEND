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
import {computeSimilarityHash, JudgmentLayer, type CandidateScore} from "./judgment-layer";
import {
  generateCandidateGenomes,
  generateJosephManifest,
  type DirectorInput,
} from "./joseph-director";
import {compileJosephManifest, type JosephManifestCompilerAudit, type JosephSelectedPlannerCandidate} from "./joseph-manifest-compiler";
import type {JosephSequenceObjectiveRanking} from "./joseph-sequence-objective";
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
  sourceFingerprintPath?: string;
  matteUrl?: string;
  matteFilePath?: string;
  mattePremultipliedAlpha?: boolean;
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

export interface CandidateScoreSummary {
  cognitiveDecision: ReturnType<typeof decideCognitiveStage>;
  governedPrompt: GovernedPrompt;
  candidateScores: CandidateScore[];
  expectedCuts: number[];
  sequenceObjective: JosephSequenceObjectiveRanking;
  manifestCompilerAudit: JosephManifestCompilerAudit;
  sequenceDiscipline: SequenceDisciplineSummary[];
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
  candidateScoreSummary: CandidateScoreSummary;
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

type SequenceDisciplineSummary = {
  enabled: boolean;
  penalty: number;
  violationRuleIds: string[];
  metrics: CandidateScore["sequenceDiscipline"]["metrics"];
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

const deterministicUuid = (value: string): string => {
  const hex = stableHash(value);
  const chars = hex.slice(0, 32).split("");
  chars[12] = "4";
  const variantNibble = Number.parseInt(chars[16] ?? "8", 16);
  chars[16] = ((variantNibble & 0x3) | 0x8).toString(16);
  const canonical = chars.join("");
  return `${canonical.slice(0, 8)}-${canonical.slice(8, 12)}-${canonical.slice(12, 16)}-${canonical.slice(16, 20)}-${canonical.slice(20, 32)}`;
};

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
  ...(input.matteUrl ? {matteUrl: input.matteUrl} : {}),
  ...(input.matteFilePath ? {matteFilePath: input.matteFilePath} : {}),
  ...(input.mattePremultipliedAlpha === undefined ? {} : {mattePremultipliedAlpha: input.mattePremultipliedAlpha}),
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
  jobId: deterministicUuid(`${variationKey.key}:${manifest.seed}`),
  createdAt: "1970-01-01T00:00:00.000Z",
});

const buildCandidateScoreSummary = (
  env: BackendEnv,
  governedPrompt: GovernedPrompt,
  candidateScores: CandidateScore[],
  expectedCuts: number[],
  sequenceObjective: JosephSequenceObjectiveRanking,
  manifestCompilerAudit: JosephManifestCompilerAudit,
  candidates: CandidateWithSequenceMemory[],
): CandidateScoreSummary => ({
  cognitiveDecision: decideCognitiveStage({env, stage: "planning"}),
  governedPrompt,
  candidateScores,
  expectedCuts,
  sequenceObjective,
  manifestCompilerAudit,
  sequenceDiscipline: candidateScores.map((score) => ({
    enabled: score.sequenceDiscipline.enabled,
    penalty: score.sequenceDiscipline.penalty,
    violationRuleIds: score.sequenceDiscipline.violations.map((violation) => violation.ruleId),
    metrics: score.sequenceDiscipline.metrics,
  })),
  sequenceMemory: candidates.map((candidate) => candidate._sequenceMemory).filter((summary): summary is SequenceMemorySummary => Boolean(summary)),
});

const selectedSequenceCandidateFor = (
  sequenceObjective: JosephSequenceObjectiveRanking,
  selected: UnifiedRenderManifest,
): JosephSequenceObjectiveRanking["candidates"][number] | undefined => {
  const selectedJobId = typeof selected.jobId === "string" ? selected.jobId : undefined;
  return sequenceObjective.candidates.find((candidate) => candidate.selected) ??
    sequenceObjective.candidates.find((candidate) => candidate.candidateId === selectedJobId) ??
    sequenceObjective.candidates[0];
};

const buildSelectedPlannerCandidate = (
  sequenceObjective: JosephSequenceObjectiveRanking,
  selected: UnifiedRenderManifest,
): JosephSelectedPlannerCandidate => {
  const selectedSequenceCandidate = selectedSequenceCandidateFor(sequenceObjective, selected);
  const selectedJobId = typeof selected.jobId === "string"
    ? selected.jobId
    : sequenceObjective.selectedCandidateId ?? "unknown-selected-candidate";
  const doctrineBranchId = selectedSequenceCandidate?.doctrineBranchId ??
    sequenceObjective.selectedDoctrineBranchId ??
    selected.creativeProfile.name;
  const archiveCellKeys = selectedSequenceCandidate
    ? [selectedSequenceCandidate.archiveCell.key]
    : sequenceObjective.archiveEntries
      .filter((entry) => entry.candidateId === selectedJobId)
      .map((entry) => entry.archiveCell.key);

  return {
    plannerPathId: `${sequenceObjective.version}:${sequenceObjective.selectedPath.candidateIds.join(">") || selectedJobId}`,
    selectedCandidateId: selectedJobId,
    genomeIds: sequenceObjective.selectedPath.candidateIds.length > 0
      ? sequenceObjective.selectedPath.candidateIds
      : [selectedJobId],
    doctrineBranchIds: sequenceObjective.selectedPath.doctrineBranchIds.length > 0
      ? sequenceObjective.selectedPath.doctrineBranchIds
      : [doctrineBranchId],
    archiveCellKeys: archiveCellKeys.length > 0 ? archiveCellKeys : ["unclassified"],
    treatmentFamily: selectedSequenceCandidate
      ? `${selectedSequenceCandidate.archiveCell.intensity}-${selectedSequenceCandidate.archiveCell.visualDensity}-${selectedSequenceCandidate.archiveCell.motionEnergy}-${selectedSequenceCandidate.archiveCell.editorialRole}`
      : undefined,
    finalTreatment: doctrineBranchId,
    retrievalIntent: "reuse-existing",
    godEscalationIntent: "forbidden",
  };
};

const buildPlannerPointerArtifact = ({
  sequenceObjective,
  compilerArtifactHash,
}: {
  sequenceObjective: JosephSequenceObjectiveRanking;
  compilerArtifactHash: string | null;
}) => ({
  version: "planner-audit-pointer-v1" as const,
  source: "candidate-score-summary.sequenceObjective" as const,
  selectedCandidateId: sequenceObjective.selectedCandidateId,
  selectedDoctrineBranchId: sequenceObjective.selectedDoctrineBranchId,
  selectedPath: sequenceObjective.selectedPath,
  compilerArtifactHash,
  sequenceObjective,
});

const objectRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const compilerDiagnosticsForRejected = (manifest: UnifiedRenderManifest): Pick<NonNullable<EvidencePackage["rejectedCandidateEvidence"]>[number], "compilerWarnings" | "failureTags"> => {
  const handoff = objectRecord(manifest.plannerHandoff);
  const fallbackTags = (Array.isArray(handoff?.fallbacks) ? handoff.fallbacks : [])
    .map((fallback) => objectRecord(fallback)?.tag)
    .filter((tag): tag is string => typeof tag === "string");

  return {
    compilerWarnings: stringArray(handoff?.warnings),
    failureTags: [...new Set(fallbackTags)],
  };
};

const buildRejectedCandidateEvidence = (
  rejected: UnifiedRenderManifest[],
  scores: CandidateScore[],
): NonNullable<EvidencePackage["rejectedCandidateEvidence"]> => rejected.map((candidate) => {
  const score = scores.find((candidateScore) => candidateScore.manifest.jobId === candidate.jobId);
  const diagnostics = compilerDiagnosticsForRejected(candidate);
  return {
    jobId: typeof candidate.jobId === "string" ? candidate.jobId : undefined,
    compilerWarnings: diagnostics.compilerWarnings,
    failureTags: [...new Set([...(score?.floorFailures ?? []), ...diagnostics.failureTags])],
  };
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
    input.sourceFingerprintPath ?? input.sourceVideoPath,
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
  const selectedCandidate = canonicalizeManifestForResult(judgment.selected, variationKey);
  const selectedPlannerCandidate = buildSelectedPlannerCandidate(judgment.sequenceObjective, selectedCandidate);
  const compiledSelected = compileJosephManifest({
    manifest: selectedCandidate,
    selectedPlannerCandidate,
    auditReferences: {
      candidateScoreSummary: true,
      candidateScoreSummaryRef: "candidate-score-summary.json",
      compilerArtifactRef: "compiler-artifact.json",
      plannerAuditRef: "planner-audit.json",
      candidateScoreCount: judgment.scores.length,
      expectedCutCount: expectedCuts.length,
    },
  });
  const selected = compiledSelected.manifest;
  const rejected = judgment.rejected.map((candidate) => canonicalizeManifestForResult(candidate, variationKey));
  const candidateScoreSummary = buildCandidateScoreSummary(env, governedPrompt, judgment.scores, expectedCuts, judgment.sequenceObjective, compiledSelected.audit, candidates);
  const evidence: EvidencePackage = {
    jobId: variationKey.uploadInstanceId,
    variationKey,
    candidates,
    selected,
    rejected,
    verdict: judgment.verdict,
    timestamp: new Date().toISOString(),
    candidateScoreSummary,
    compilerArtifact: compiledSelected.artifact,
    plannerAuditArtifact: buildPlannerPointerArtifact({
      sequenceObjective: judgment.sequenceObjective,
      compilerArtifactHash: compiledSelected.artifact?.artifactHash ?? null,
    }),
    rejectedCandidateEvidence: buildRejectedCandidateEvidence(rejected, judgment.scores),
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
    candidateScoreSummary: JSON.stringify(candidateScoreSummary),
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
    candidateScoreSummary,
  };
}

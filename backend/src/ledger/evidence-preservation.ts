import {createHash} from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {preserveJosephOversightReview} from "./joseph-oversight-review";

export interface VariationKey {
  key?: string;
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile?: string;
  source_fingerprint?: string;
  prompt_fingerprint?: string;
  upload_instance_id?: string;
  retry_index?: number;
}

export type UnifiedRenderManifest = Record<string, unknown> & {
  jobId?: string;
};

export interface JudgmentVerdict {
  qualityScore: number;
  similarityScore: number;
  passedFloor: boolean;
  vetoReason?: string;
  failureTags: string[];
  negativeEvaluator?: {
    failures: string[];
    warnings: string[];
  };
  fixIntents?: string[];
}

export interface RenderFrameProof {
  compositionId: "JosephEdit";
  frame: number;
  manifestHash: string;
  signature: string;
  fallbackTags: string[];
}

export interface RenderProof {
  version: "joseph-render-proof-v1";
  renderer: {
    compositionId: "JosephEdit";
    entryPoint: string;
    contentType: "video/mp4";
    width: number;
    height: number;
    fps: number;
    durationFrames: number;
    outputFileName: string;
  };
  selectedCandidateId: string | null;
  manifestHash: string;
  visibleBehaviorSignature: string;
  frameProofs: RenderFrameProof[];
  fallbackTags: string[];
}

export interface RejectedCandidateEvidence {
  jobId?: string;
  compilerWarnings: string[];
  failureTags: string[];
  compilerArtifactHash?: string;
}

export interface EvidencePackage {
  jobId: string;
  variationKey: VariationKey;
  candidates: UnifiedRenderManifest[];
  selected: UnifiedRenderManifest;
  rejected: UnifiedRenderManifest[];
  verdict: JudgmentVerdict;
  timestamp: string;
  candidateScoreSummary?: unknown;
  compilerArtifact?: unknown;
  plannerAudit?: unknown;
  plannerAuditArtifact?: unknown;
  rejectedCandidateEvidence?: RejectedCandidateEvidence[];
  renderProof?: RenderProof;
  audit?: unknown;
}

export interface EvidenceArtifactPaths {
  jobDir: string;
  candidatesPath: string;
  selectedPath: string;
  verdictPath: string;
  auditPath: string;
  candidateScoreSummaryPath: string;
  compilerArtifactPath: string;
  plannerAuditPath: string;
  evidenceRecordPath: string;
  renderProofPath: string;
  reviewArtifactPath: string;
  reviewLedgerPath: string;
  regressionGalleryPath: string;
  logPath: string;
}

export interface EvidenceRecord {
  version: "prometheus-evidence-record-v1";
  jobId: string;
  createdAt: string;
  selectedJobId: string | null;
  candidateCount: number;
  rejectedCount: number;
  compilerArtifactHash: string | null;
  compilerArtifactPointer: string | null;
  plannerAuditPointer: string | null;
  candidateScoreSummaryPointer: string | null;
  rejectedCandidates: RejectedCandidateEvidence[];
  renderProofPointer: string | null;
  frameProofCount: number;
  fallbackTags: string[];
}

type LegacyLedger = {
  insert?: (entry: unknown) => unknown;
};

type LegacyEvidencePackage = Partial<EvidencePackage> & {
  plannerAudit?: unknown;
  variationKey: VariationKey;
  selected: UnifiedRenderManifest;
  rejected?: UnifiedRenderManifest[];
  verdict: Partial<JudgmentVerdict>;
};

let atomicCounter = 0;

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const isLegacyLedger = (value: unknown): value is LegacyLedger =>
  typeof value === "object" && value !== null && "insert" in value;

const safeSegment = (value: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "unknown-job";
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "undefined";
};

const sha256Json = (value: unknown): string => createHash("sha256").update(stableJson(value)).digest("hex");

const writeJsonAtomic = (targetPath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  atomicCounter += 1;
  const tmpPath = `${targetPath}.${process.pid}.${atomicCounter}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, targetPath);
};

const selectedJobId = (manifest: UnifiedRenderManifest): string | undefined =>
  typeof manifest.jobId === "string" ? manifest.jobId : undefined;

const pointerFor = (jobDir: string, targetPath: string, present: boolean): string | null =>
  present ? path.relative(jobDir, targetPath).replace(/\\/g, "/") : null;

const objectRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const compilerArtifactHashOf = (artifact: unknown): string | null => {
  if (artifact === undefined) {
    return null;
  }

  const artifactRecord = objectRecord(artifact);
  return typeof artifactRecord?.artifactHash === "string" ? artifactRecord.artifactHash : sha256Json(artifact);
};

const compilerDiagnosticsFor = (manifest: UnifiedRenderManifest): Pick<RejectedCandidateEvidence, "compilerWarnings" | "failureTags"> => {
  const handoff = objectRecord(manifest.plannerHandoff);
  const fallbacks = Array.isArray(handoff?.fallbacks) ? handoff.fallbacks : [];
  const fallbackTags = fallbacks
    .map((fallback) => objectRecord(fallback)?.tag)
    .filter((tag): tag is string => typeof tag === "string");

  return {
    compilerWarnings: stringArray(handoff?.warnings),
    failureTags: [...new Set(fallbackTags)],
  };
};

const rejectedCandidateEvidenceFor = (pkg: EvidencePackage): RejectedCandidateEvidence[] =>
  pkg.rejectedCandidateEvidence ?? pkg.rejected.map((candidate) => ({
    jobId: selectedJobId(candidate),
    ...compilerDiagnosticsFor(candidate),
  }));

const plannerAuditPayloadOf = (pkg: EvidencePackage): unknown =>
  pkg.plannerAuditArtifact ?? pkg.plannerAudit;

const buildAuditPayload = (pkg: EvidencePackage): unknown =>
  pkg.candidateScoreSummary ?? pkg.audit ?? {
    jobId: pkg.jobId,
    variationKey: pkg.variationKey,
    timestamp: pkg.timestamp,
    candidateCount: pkg.candidates.length,
    selectedJobId: selectedJobId(pkg.selected),
    rejectedJobIds: pkg.rejected.map(selectedJobId).filter((id): id is string => Boolean(id)),
  };

const buildEvidenceRecord = (pkg: EvidencePackage, paths: EvidenceArtifactPaths): EvidenceRecord => {
  const hasCandidateScoreSummary = pkg.candidateScoreSummary !== undefined;
  const hasCompilerArtifact = pkg.compilerArtifact !== undefined;
  const hasPlannerAudit = plannerAuditPayloadOf(pkg) !== undefined;
  const hasRenderProof = pkg.renderProof !== undefined;

  return {
    version: "prometheus-evidence-record-v1",
    jobId: pkg.jobId,
    createdAt: pkg.timestamp,
    selectedJobId: selectedJobId(pkg.selected) ?? null,
    candidateCount: pkg.candidates.length,
    rejectedCount: pkg.rejected.length,
    compilerArtifactHash: compilerArtifactHashOf(pkg.compilerArtifact),
    compilerArtifactPointer: pointerFor(paths.jobDir, paths.compilerArtifactPath, hasCompilerArtifact),
    plannerAuditPointer: pointerFor(paths.jobDir, paths.plannerAuditPath, hasPlannerAudit),
    candidateScoreSummaryPointer: pointerFor(paths.jobDir, paths.candidateScoreSummaryPath, hasCandidateScoreSummary),
    rejectedCandidates: rejectedCandidateEvidenceFor(pkg),
    renderProofPointer: pointerFor(paths.jobDir, paths.renderProofPath, hasRenderProof),
    frameProofCount: pkg.renderProof?.frameProofs.length ?? 0,
    fallbackTags: pkg.renderProof?.fallbackTags ?? [],
  };
};

const appendEvidenceLog = (logPath: string, pkg: EvidencePackage): void => {
  fs.mkdirSync(path.dirname(logPath), {recursive: true});
  fs.appendFileSync(logPath, `${JSON.stringify(pkg)}\n`, "utf8");
};

const preserveEvidencePackage = (
  pkg: EvidencePackage,
  baseDir = path.join(os.homedir(), ".prometheus", "evidence"),
): EvidenceArtifactPaths => {
  if (!pkg.jobId.trim()) {
    throw new Error("EvidencePackage.jobId is required");
  }

  if (!pkg.timestamp.trim()) {
    throw new Error("EvidencePackage.timestamp is required");
  }

  const jobDir = path.join(baseDir, safeSegment(pkg.jobId));
  const paths: EvidenceArtifactPaths = {
    jobDir,
    candidatesPath: path.join(jobDir, "candidates.json"),
    selectedPath: path.join(jobDir, "selected.json"),
    verdictPath: path.join(jobDir, "verdict.json"),
    auditPath: path.join(jobDir, "audit.json"),
    candidateScoreSummaryPath: path.join(jobDir, "candidate-score-summary.json"),
    compilerArtifactPath: path.join(jobDir, "compiler-artifact.json"),
    plannerAuditPath: path.join(jobDir, "planner-audit.json"),
    evidenceRecordPath: path.join(jobDir, "evidence-record.json"),
    renderProofPath: path.join(jobDir, "render-proof.json"),
    reviewArtifactPath: path.join(jobDir, "review-artifact.json"),
    reviewLedgerPath: path.join(baseDir, "review-ledger.ndjson"),
    regressionGalleryPath: path.join(baseDir, "regression-gallery.json"),
    logPath: path.join(baseDir, "evidence.log"),
  };

  fs.mkdirSync(jobDir, {recursive: true});
  writeJsonAtomic(paths.candidatesPath, pkg.candidates);
  writeJsonAtomic(paths.selectedPath, pkg.selected);
  writeJsonAtomic(paths.verdictPath, pkg.verdict);
  writeJsonAtomic(paths.auditPath, buildAuditPayload(pkg));
  if (pkg.candidateScoreSummary !== undefined) {
    writeJsonAtomic(paths.candidateScoreSummaryPath, pkg.candidateScoreSummary);
  }
  if (pkg.compilerArtifact !== undefined) {
    writeJsonAtomic(paths.compilerArtifactPath, pkg.compilerArtifact);
  }
  const plannerAuditPayload = plannerAuditPayloadOf(pkg);
  if (plannerAuditPayload !== undefined) {
    writeJsonAtomic(paths.plannerAuditPath, plannerAuditPayload);
  }
  if (pkg.renderProof !== undefined) {
    writeJsonAtomic(paths.renderProofPath, pkg.renderProof);
  }
  writeJsonAtomic(paths.evidenceRecordPath, buildEvidenceRecord(pkg, paths));
  const oversightPaths = preserveJosephOversightReview({
    pkg,
    baseDir,
    jobDir,
    candidatesPath: paths.candidatesPath,
    selectedPath: paths.selectedPath,
    verdictPath: paths.verdictPath,
    auditPath: paths.auditPath,
  });
  appendEvidenceLog(paths.logPath, pkg);

  return {...paths, ...oversightPaths};
};

const preserveLegacyEvidence = (ledger: LegacyLedger, pkg: LegacyEvidencePackage): unknown => {
  const entry = {
    jobId: pkg.jobId ?? selectedJobId(pkg.selected) ?? "legacy-evidence",
    variationKey: pkg.variationKey,
    candidates: pkg.candidates ?? [pkg.selected, ...(pkg.rejected ?? [])],
    selected: pkg.selected,
    rejected: pkg.rejected ?? [],
    verdict: pkg.verdict,
    timestamp: pkg.timestamp ?? DEFAULT_TIMESTAMP,
    candidateScoreSummary: pkg.candidateScoreSummary ?? pkg.plannerAudit,
  };

  return typeof ledger.insert === "function" ? ledger.insert(entry) : entry;
};

export function preserveEvidence(pkg: EvidencePackage, baseDir?: string): EvidenceArtifactPaths;
export function preserveEvidence(ledger: LegacyLedger, pkg: LegacyEvidencePackage): unknown;
export function preserveEvidence(
  first: EvidencePackage | LegacyLedger,
  second?: string | LegacyEvidencePackage,
): EvidenceArtifactPaths | unknown {
  if (isLegacyLedger(first)) {
    if (typeof second !== "object" || second === null) {
      throw new Error("Legacy preserveEvidence requires an evidence package argument");
    }

    return preserveLegacyEvidence(first, second);
  }

  return preserveEvidencePackage(first, typeof second === "string" ? second : undefined);
}
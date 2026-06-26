import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
  plannerAudit?: unknown;
  audit?: unknown;
}

export interface EvidenceArtifactPaths {
  jobDir: string;
  candidatesPath: string;
  selectedPath: string;
  verdictPath: string;
  auditPath: string;
  logPath: string;
}

type LegacyLedger = {
  insert?: (entry: unknown) => unknown;
};

type LegacyEvidencePackage = Partial<EvidencePackage> & {
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

const writeJsonAtomic = (targetPath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  atomicCounter += 1;
  const tmpPath = `${targetPath}.${process.pid}.${atomicCounter}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, targetPath);
};

const selectedJobId = (manifest: UnifiedRenderManifest): string | undefined =>
  typeof manifest.jobId === "string" ? manifest.jobId : undefined;

const buildAuditPayload = (pkg: EvidencePackage): unknown =>
  pkg.candidateScoreSummary ?? pkg.plannerAudit ?? pkg.audit ?? {
    jobId: pkg.jobId,
    variationKey: pkg.variationKey,
    timestamp: pkg.timestamp,
    candidateCount: pkg.candidates.length,
    selectedJobId: selectedJobId(pkg.selected),
    rejectedJobIds: pkg.rejected.map(selectedJobId).filter((id): id is string => Boolean(id)),
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
    logPath: path.join(baseDir, "evidence.log"),
  };

  fs.mkdirSync(jobDir, {recursive: true});
  writeJsonAtomic(paths.candidatesPath, pkg.candidates);
  writeJsonAtomic(paths.selectedPath, pkg.selected);
  writeJsonAtomic(paths.verdictPath, pkg.verdict);
  writeJsonAtomic(paths.auditPath, buildAuditPayload(pkg));
  appendEvidenceLog(paths.logPath, pkg);

  return paths;
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
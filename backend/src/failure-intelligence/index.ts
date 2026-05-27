import type {FallbackEvent} from "../schemas";

export type FailureSeverity = "info" | "warning" | "error";
export type RetryStatus = "not-attempted" | "retrying" | "repaired" | "failed" | "not-retryable";
export type PartialRecoveryState = "none" | "deterministic-recovery" | "partial-output" | "blocked";

export type FailureVisibilityRecord = {
  id: string;
  stage: string;
  code: string;
  severity: FailureSeverity;
  failureReason: string;
  schemaMismatch: string | null;
  confidenceCollapse: boolean;
  degradedStage: string | null;
  retryStatus: RetryStatus;
  fallbackCause: string | null;
  hallucinationProbability: number;
  repairAttempts: number;
  partialRecoveryState: PartialRecoveryState;
  visibleToFrontend: true;
  createdAt: string;
};

export type FailureVisibilitySummary = {
  total: number;
  degradedStageCount: number;
  maxHallucinationProbability: number;
  worstSeverity: FailureSeverity;
  visibleFailureCodes: string[];
};

const severityRank: Record<FailureSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const estimateHallucinationProbability = (reason: string, schemaMismatch?: string | null): number => {
  const normalized = reason.toLowerCase();
  const schemaRisk = schemaMismatch ? 0.42 : 0;
  const jsonRisk = /json|schema|parse|invalid|zod/.test(normalized) ? 0.32 : 0;
  const emptyRisk = /empty|null|undefined|missing/.test(normalized) ? 0.18 : 0;
  const timeoutRisk = /timeout|network|fetch|abort/.test(normalized) ? 0.12 : 0;
  return clamp01(0.08 + schemaRisk + jsonRisk + emptyRisk + timeoutRisk);
};

export const createFailureVisibilityRecord = ({
  stage,
  code,
  severity,
  failureReason,
  schemaMismatch = null,
  degradedStage = stage,
  retryStatus = "not-attempted",
  fallbackCause = null,
  repairAttempts = 0,
  partialRecoveryState = fallbackCause ? "deterministic-recovery" : "none",
  createdAt = new Date().toISOString()
}: {
  stage: string;
  code: string;
  severity: FailureSeverity;
  failureReason: string;
  schemaMismatch?: string | null;
  degradedStage?: string | null;
  retryStatus?: RetryStatus;
  fallbackCause?: string | null;
  repairAttempts?: number;
  partialRecoveryState?: PartialRecoveryState;
  createdAt?: string;
}): FailureVisibilityRecord => ({
  id: `${stage}:${code}:${createdAt}`,
  stage,
  code,
  severity,
  failureReason,
  schemaMismatch,
  confidenceCollapse: severity === "error" || Boolean(schemaMismatch),
  degradedStage,
  retryStatus,
  fallbackCause,
  hallucinationProbability: estimateHallucinationProbability(failureReason, schemaMismatch),
  repairAttempts,
  partialRecoveryState,
  visibleToFrontend: true,
  createdAt
});

export const summarizeFailureVisibility = (
  records: FailureVisibilityRecord[]
): FailureVisibilitySummary => {
  const worst = records.reduce<FailureSeverity>(
    (current, record) => severityRank[record.severity] > severityRank[current] ? record.severity : current,
    "info"
  );

  return {
    total: records.length,
    degradedStageCount: records.filter((record) => Boolean(record.degradedStage)).length,
    maxHallucinationProbability: records.reduce(
      (max, record) => Math.max(max, record.hallucinationProbability),
      0
    ),
    worstSeverity: worst,
    visibleFailureCodes: records.map((record) => record.code)
  };
};

export const failureRecordToFallbackEvent = (
  record: FailureVisibilityRecord
): FallbackEvent => ({
  code: record.code,
  stage: record.stage,
  severity: record.severity,
  message: `Visible degradation: ${record.failureReason}`,
  details: {
    failureVisibility: record
  },
  created_at: record.createdAt
});

export const fallbackEventsToFailureRecords = (
  events: FallbackEvent[]
): FailureVisibilityRecord[] => {
  return events.map((event) => {
    const visible = event.details["failureVisibility"];
    if (visible && typeof visible === "object") {
      return visible as FailureVisibilityRecord;
    }

    return createFailureVisibilityRecord({
      stage: event.stage,
      code: event.code,
      severity: event.severity,
      failureReason: event.message,
      fallbackCause: typeof event.details["reason"] === "string" ? event.details["reason"] : null,
      createdAt: event.created_at
    });
  });
};

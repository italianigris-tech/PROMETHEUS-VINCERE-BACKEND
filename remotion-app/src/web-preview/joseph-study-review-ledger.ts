export type JosephStudyReviewVerdict = "preferred" | "failed";

export const JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION = "joseph-failure-taxonomy-v1" as const;
export const JOSEPH_STUDY_FRAME_PROOF_VERSION = "joseph-study-frame-proof-v1" as const;
export const JOSEPH_STUDY_REVIEW_EXPORT_VERSION = "joseph-study-review-export-v1" as const;

export const JOSEPH_STUDY_FAILURE_TAGS = [
  {
    id: "boring-under-editing",
    label: "Boring Under Editing",
    description: "The candidate does not spend enough editorial energy to carry the hook, body, or CTA."
  },
  {
    id: "chaotic-over-editing",
    label: "Chaotic Over Editing",
    description: "The candidate stacks too many cuts, text hits, SFX, or motion accents for the moment."
  },
  {
    id: "cheap-template-motion",
    label: "Cheap Template Motion",
    description: "The candidate leans on obvious canned motion, cheap emphasis, or low-specificity animation."
  },
  {
    id: "premium-restraint",
    label: "Premium Restraint",
    description: "The candidate fails to preserve breath, hierarchy, or climax budget when restraint is needed."
  },
  {
    id: "repetition-fatigue",
    label: "Repetition Fatigue",
    description: "The candidate repeats a pattern, structure, or prior ledger result until it stops feeling fresh."
  },
  {
    id: "climax-overspend",
    label: "Climax Overspend",
    description: "The candidate spends peak intensity too early or too often before the decisive beat."
  },
  {
    id: "weak-concept-reduction",
    label: "Weak Concept Reduction",
    description: "The candidate does not reduce the source idea into a clear visual thesis or hero concept."
  },
  {
    id: "asset-treatment-mismatch",
    label: "Asset Treatment Mismatch",
    description: "The candidate pairs source footage, PiP, background, SFX, or assets in a way that fights the treatment."
  },
  {
    id: "sequence-rhythm-collapse",
    label: "Sequence Rhythm Collapse",
    description: "The candidate loses temporal continuity, music logic, or sequence discipline."
  },
  {
    id: "readability-sacrifice",
    label: "Readability Sacrifice",
    description: "The candidate sacrifices text comprehension, safe-zone discipline, or typographic clarity."
  }
] as const;

export type JosephStudyFailureTag = (typeof JOSEPH_STUDY_FAILURE_TAGS)[number]["id"];

export type JosephStudyFrameProof = {
  version: typeof JOSEPH_STUDY_FRAME_PROOF_VERSION;
  proofId: string;
  candidateId: string;
  frameNumber: number;
  manifestHash: string;
  activeDiagnosticIds: string[];
  failureTags: JosephStudyFailureTag[];
  screenshotDataUrl: string;
  capturedAt: string;
};

export type JosephStudyReviewRecord = {
  candidateId: string;
  candidateLabel: string;
  verdict: JosephStudyReviewVerdict;
  failureTaxonomyVersion: typeof JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION;
  failureTags: JosephStudyFailureTag[];
  frameProofs: JosephStudyFrameProof[];
  capturedAt: string;
};

export type JosephStudyReviewStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const REVIEW_STORAGE_KEY = "joseph-study.review-ledger.v1";
const VALID_FAILURE_TAGS = new Set<string>(JOSEPH_STUDY_FAILURE_TAGS.map((tag) => tag.id));

const getJosephStudyReviewStorage = (): JosephStudyReviewStorage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isReviewRecordShape = (entry: unknown): entry is Omit<JosephStudyReviewRecord, "failureTaxonomyVersion" | "failureTags" | "frameProofs"> & {
  failureTaxonomyVersion?: string;
  failureTags: unknown[];
  frameProofs?: unknown[];
} => {
  return Boolean(
    entry &&
      typeof entry === "object" &&
      typeof (entry as JosephStudyReviewRecord).candidateId === "string" &&
      typeof (entry as JosephStudyReviewRecord).candidateLabel === "string" &&
      ((entry as JosephStudyReviewRecord).verdict === "preferred" ||
        (entry as JosephStudyReviewRecord).verdict === "failed") &&
      Array.isArray((entry as JosephStudyReviewRecord).failureTags) &&
      typeof (entry as JosephStudyReviewRecord).capturedAt === "string"
  );
};

const normalizeFailureTags = (failureTags: readonly unknown[]): JosephStudyFailureTag[] => {
  return [...new Set(failureTags)]
    .filter((tag): tag is JosephStudyFailureTag => typeof tag === "string" && VALID_FAILURE_TAGS.has(tag));
};

const normalizeDiagnosticIds = (diagnosticIds: readonly unknown[]): string[] => {
  return [...new Set(diagnosticIds)]
    .filter((diagnosticId): diagnosticId is string => typeof diagnosticId === "string" && diagnosticId.trim().length > 0);
};

const isFrameProofShape = (entry: unknown): entry is Omit<JosephStudyFrameProof, "version" | "failureTags" | "activeDiagnosticIds"> & {
  version?: string;
  activeDiagnosticIds: unknown[];
  failureTags: unknown[];
} => {
  return Boolean(
    entry &&
      typeof entry === "object" &&
      typeof (entry as JosephStudyFrameProof).candidateId === "string" &&
      typeof (entry as JosephStudyFrameProof).proofId === "string" &&
      typeof (entry as JosephStudyFrameProof).frameNumber === "number" &&
      Number.isFinite((entry as JosephStudyFrameProof).frameNumber) &&
      typeof (entry as JosephStudyFrameProof).manifestHash === "string" &&
      Array.isArray((entry as JosephStudyFrameProof).activeDiagnosticIds) &&
      Array.isArray((entry as JosephStudyFrameProof).failureTags) &&
      typeof (entry as JosephStudyFrameProof).screenshotDataUrl === "string" &&
      typeof (entry as JosephStudyFrameProof).capturedAt === "string"
  );
};

const normalizeFrameProofs = (frameProofs: readonly unknown[]): JosephStudyFrameProof[] => {
  return frameProofs.flatMap((frameProof): JosephStudyFrameProof[] => {
    if (!isFrameProofShape(frameProof)) {
      return [];
    }

    return [{
      version: JOSEPH_STUDY_FRAME_PROOF_VERSION,
      proofId: frameProof.proofId,
      candidateId: frameProof.candidateId,
      frameNumber: Math.max(0, Math.round(frameProof.frameNumber)),
      manifestHash: frameProof.manifestHash,
      activeDiagnosticIds: normalizeDiagnosticIds(frameProof.activeDiagnosticIds),
      failureTags: normalizeFailureTags(frameProof.failureTags),
      screenshotDataUrl: frameProof.screenshotDataUrl,
      capturedAt: frameProof.capturedAt
    }];
  });
};

const parseLedger = (raw: string | null): JosephStudyReviewRecord[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry): JosephStudyReviewRecord[] => {
      if (!isReviewRecordShape(entry)) {
        return [];
      }

      return [{
        candidateId: entry.candidateId,
        candidateLabel: entry.candidateLabel,
        verdict: entry.verdict,
        failureTaxonomyVersion: JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
        failureTags: normalizeFailureTags(entry.failureTags),
        frameProofs: normalizeFrameProofs(entry.frameProofs ?? []),
        capturedAt: entry.capturedAt
      }];
    });
  } catch {
    return [];
  }
};

const writeLedger = (storage: JosephStudyReviewStorage | null, ledger: JosephStudyReviewRecord[]): JosephStudyReviewRecord[] => {
  if (!storage) {
    return ledger;
  }

  storage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(ledger));
  return ledger;
};

export const loadJosephStudyReviewLedger = (storage: JosephStudyReviewStorage | null = getJosephStudyReviewStorage()): JosephStudyReviewRecord[] => {
  if (!storage) {
    return [];
  }

  return parseLedger(storage.getItem(REVIEW_STORAGE_KEY));
};

export const captureJosephStudyReview = (
  storage: JosephStudyReviewStorage | null,
  review: Omit<JosephStudyReviewRecord, "capturedAt" | "failureTaxonomyVersion" | "frameProofs"> & {
    capturedAt?: string;
    failureTaxonomyVersion?: typeof JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION;
    frameProofs?: JosephStudyFrameProof[];
  }
): JosephStudyReviewRecord[] => {
  const currentLedger = loadJosephStudyReviewLedger(storage);
  const nextLedger: JosephStudyReviewRecord[] = [
    ...currentLedger,
    {
      ...review,
      failureTaxonomyVersion: review.failureTaxonomyVersion ?? JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
      failureTags: normalizeFailureTags(review.failureTags),
      frameProofs: normalizeFrameProofs(review.frameProofs ?? []),
      capturedAt: review.capturedAt ?? new Date().toISOString()
    }
  ];

  return writeLedger(storage, nextLedger);
};

export const toggleJosephStudyFailureTag = (
  currentTags: readonly JosephStudyFailureTag[],
  tag: JosephStudyFailureTag
): JosephStudyFailureTag[] => {
  return currentTags.includes(tag)
    ? currentTags.filter((currentTag) => currentTag !== tag)
    : [...currentTags, tag];
};

export const captureJosephStudyFrameProof = ({
  candidateId,
  frameNumber,
  manifestHash,
  activeDiagnosticIds,
  failureTags,
  screenshotDataUrl,
  capturedAt = new Date().toISOString()
}: {
  candidateId: string;
  frameNumber: number;
  manifestHash: string;
  activeDiagnosticIds: readonly unknown[];
  failureTags: readonly unknown[];
  screenshotDataUrl: string;
  capturedAt?: string;
}): JosephStudyFrameProof => {
  const normalizedFrame = Math.max(0, Math.round(frameNumber));
  const normalizedDiagnosticIds = normalizeDiagnosticIds(activeDiagnosticIds);
  const normalizedFailureTags = normalizeFailureTags(failureTags);
  const proofKey = [
    candidateId,
    normalizedFrame,
    manifestHash,
    normalizedDiagnosticIds.join(".") || "no-diagnostics",
    normalizedFailureTags.join(".") || "no-failure-tags",
    capturedAt
  ].join(":");

  return {
    version: JOSEPH_STUDY_FRAME_PROOF_VERSION,
    proofId: proofKey,
    candidateId,
    frameNumber: normalizedFrame,
    manifestHash,
    activeDiagnosticIds: normalizedDiagnosticIds,
    failureTags: normalizedFailureTags,
    screenshotDataUrl,
    capturedAt
  };
};
export type JosephStudyReviewExportVerdict = "winner" | "loser";

export type JosephStudyReviewExportSource = {
  sourceId: string;
  manifestUrls: string[];
};

export type JosephStudyReviewExportCandidate = {
  candidateId: string;
  candidateLabel: string;
  verdict: JosephStudyReviewExportVerdict;
  reviewedAt: string;
  failureTags: JosephStudyFailureTag[];
  frameProofIds: string[];
};

export type JosephStudyPairwisePreference = {
  winnerCandidateId: string;
  loserCandidateId: string;
  failureTags: JosephStudyFailureTag[];
  frameProofIds: string[];
  capturedAt: string;
};

export type JosephStudyRegressionGallery = {
  source: JosephStudyReviewExportSource;
  candidates: JosephStudyReviewExportCandidate[];
  pairwisePreferences: JosephStudyPairwisePreference[];
};

export type JosephStudyReviewLedgerExport = {
  version: typeof JOSEPH_STUDY_REVIEW_EXPORT_VERSION;
  generatedAt: string;
  schema: {
    reviewLedgerVersion: "joseph-study.review-ledger.v1";
    failureTaxonomyVersion: typeof JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION;
    frameProofVersion: typeof JOSEPH_STUDY_FRAME_PROOF_VERSION;
  };
  ledger: JosephStudyReviewRecord[];
  gallery: JosephStudyRegressionGallery;
};

type JosephStudyReviewExportRecordInput = Omit<JosephStudyReviewRecord, "failureTags" | "frameProofs"> & {
  failureTags: readonly unknown[];
  frameProofs: readonly unknown[];
};

const sortReviewRecords = (records: readonly JosephStudyReviewRecord[]): JosephStudyReviewRecord[] => {
  return [...records].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt) || left.candidateId.localeCompare(right.candidateId)
  );
};

const normalizeReviewRecordForExport = (record: JosephStudyReviewExportRecordInput): JosephStudyReviewRecord => ({
  candidateId: record.candidateId,
  candidateLabel: record.candidateLabel,
  verdict: record.verdict,
  failureTaxonomyVersion: JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
  failureTags: normalizeFailureTags(record.failureTags),
  frameProofs: normalizeFrameProofs(record.frameProofs),
  capturedAt: record.capturedAt
});

const exportVerdictFor = (verdict: JosephStudyReviewVerdict): JosephStudyReviewExportVerdict =>
  verdict === "preferred" ? "winner" : "loser";

const frameProofIdsFor = (record: JosephStudyReviewRecord): string[] =>
  record.frameProofs.map((proof) => proof.proofId).sort();

export const buildJosephStudyReviewExport = ({
  records,
  source = {sourceId: "joseph-study", manifestUrls: []},
  generatedAt = "1970-01-01T00:00:00.000Z"
}: {
  records: readonly JosephStudyReviewExportRecordInput[];
  source?: {sourceId?: string; manifestUrls?: readonly string[]};
  generatedAt?: string;
}): JosephStudyReviewLedgerExport => {
  const ledger = sortReviewRecords(records.map(normalizeReviewRecordForExport));
  const winners = ledger.filter((entry) => entry.verdict === "preferred");
  const losers = ledger.filter((entry) => entry.verdict === "failed");
  const pairwisePreferences = winners.flatMap((winner) =>
    losers.map((loser): JosephStudyPairwisePreference => ({
      winnerCandidateId: winner.candidateId,
      loserCandidateId: loser.candidateId,
      failureTags: loser.failureTags,
      frameProofIds: frameProofIdsFor(loser),
      capturedAt: loser.capturedAt
    }))
  ).sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt) ||
    left.winnerCandidateId.localeCompare(right.winnerCandidateId) ||
    left.loserCandidateId.localeCompare(right.loserCandidateId)
  );

  return {
    version: JOSEPH_STUDY_REVIEW_EXPORT_VERSION,
    generatedAt,
    schema: {
      reviewLedgerVersion: REVIEW_STORAGE_KEY,
      failureTaxonomyVersion: JOSEPH_STUDY_FAILURE_TAXONOMY_VERSION,
      frameProofVersion: JOSEPH_STUDY_FRAME_PROOF_VERSION
    },
    ledger,
    gallery: {
      source: {
        sourceId: source.sourceId ?? "joseph-study",
        manifestUrls: [...(source.manifestUrls ?? [])].sort()
      },
      candidates: ledger.map((record) => ({
        candidateId: record.candidateId,
        candidateLabel: record.candidateLabel,
        verdict: exportVerdictFor(record.verdict),
        reviewedAt: record.capturedAt,
        failureTags: record.failureTags,
        frameProofIds: frameProofIdsFor(record)
      })),
      pairwisePreferences
    }
  };
};

export type JosephStudyReviewVerdict = "preferred" | "failed";

export type JosephStudyFailureTag = "typography" | "pacing" | "source-visibility" | "sfx-mismatch" | "clutter";

export type JosephStudyReviewRecord = {
  candidateId: string;
  candidateLabel: string;
  verdict: JosephStudyReviewVerdict;
  failureTags: JosephStudyFailureTag[];
  capturedAt: string;
};

export type JosephStudyReviewStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const REVIEW_STORAGE_KEY = "joseph-study.review-ledger.v1";

export const JOSEPH_STUDY_FAILURE_TAGS: Array<{id: JosephStudyFailureTag; label: string}> = [
  {id: "typography", label: "Typography"},
  {id: "pacing", label: "Pacing"},
  {id: "source-visibility", label: "Source visibility"},
  {id: "sfx-mismatch", label: "SFX mismatch"},
  {id: "clutter", label: "Clutter"}
];

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

const parseLedger = (raw: string | null): JosephStudyReviewRecord[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is JosephStudyReviewRecord => {
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
  review: Omit<JosephStudyReviewRecord, "capturedAt"> & {capturedAt?: string}
): JosephStudyReviewRecord[] => {
  const currentLedger = loadJosephStudyReviewLedger(storage);
  const nextLedger: JosephStudyReviewRecord[] = [
    ...currentLedger,
    {
      ...review,
      failureTags: [...review.failureTags],
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

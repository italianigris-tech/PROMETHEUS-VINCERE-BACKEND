import * as fs from "node:fs";
import * as path from "node:path";

export const JOSEPH_OVERSIGHT_VERSION = "joseph-oversight-review-v1" as const;

export const JOSEPH_FAILURE_TAXONOMY = [
  {
    id: "boring-under-editing",
    label: "Boring Under Editing",
    description: "The candidate does not spend enough editorial energy to carry the hook, body, or CTA.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "candidate-score-summary", "review-surface"],
    fixIntent: "Increase purposeful cuts, emphasis, or motion in the under-served hook, body, or CTA window.",
    indicators: ["hook_cuts", "cta_cuts", "body_cut_density_low", "under_animation", "flat_pacing"],
  },
  {
    id: "chaotic-over-editing",
    label: "Chaotic Over Editing",
    description: "The candidate stacks too many cuts, text hits, SFX, or motion accents for the moment.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "render-preview", "review-surface"],
    fixIntent: "Reduce competing cuts, text hits, SFX, or motion accents until the moment has readable hierarchy.",
    indicators: ["overcutting", "text_overlap", "text_spacing", "sfx_density", "too_dense"],
  },
  {
    id: "cheap-template-motion",
    label: "Cheap Template Motion",
    description: "The candidate leans on obvious canned motion, cheap emphasis, or low-specificity animation.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "pattern-memory", "review-surface"],
    fixIntent: "Replace generic motion with a treatment-specific primitive or mark the pattern for downgrade pressure.",
    indicators: ["cheap", "template", "cheap_emphasis", "semantic_mismatch", "generic_motion"],
  },
  {
    id: "premium-restraint",
    label: "Premium Restraint",
    description: "The candidate fails to preserve breath, hierarchy, or climax budget when restraint is needed.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "candidate-score-summary", "review-surface"],
    fixIntent: "Add breathe space or lower intensity where the doctrine calls for premium restraint.",
    indicators: ["missing_breathe_beat", "climax_overspend", "overuse", "no_restraint", "overspend"],
  },
  {
    id: "repetition-fatigue",
    label: "Repetition Fatigue",
    description: "The candidate repeats a pattern, structure, or prior ledger result until it stops feeling fresh.",
    severity: "editorial",
    affectedArtifacts: ["replay-ledger", "pattern-memory", "review-surface"],
    fixIntent: "Select a fresher approved primitive, layout, or pacing signature and preserve the fatigue reason in replay evidence.",
    indicators: ["repetition", "monotony", "fatigue", "replay_similarity_veto", "same_pattern"],
  },
  {
    id: "climax-overspend",
    label: "Climax Overspend",
    description: "The candidate spends peak intensity too early or too often before the decisive beat.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "candidate-score-summary", "planner-audit"],
    fixIntent: "Reserve peak energy for the strongest beat or CTA by reducing earlier high-intensity treatments.",
    indicators: ["climax_overspend", "early_peak", "detonation_overuse"],
  },
  {
    id: "weak-concept-reduction",
    label: "Weak Concept Reduction",
    description: "The candidate does not reduce the source idea into a clear visual thesis or hero concept.",
    severity: "editorial",
    affectedArtifacts: ["planner-audit", "manifest", "review-surface"],
    fixIntent: "Rebuild the treatment around a clearer visual thesis, hero line, or doctrine branch rationale.",
    indicators: ["weak_concept", "weak_hierarchy", "typography_no_hero_line", "semantic_mismatch", "no_hero"],
  },
  {
    id: "asset-treatment-mismatch",
    label: "Asset Treatment Mismatch",
    description: "The candidate pairs source footage, PiP, background, SFX, or assets in a way that fights the treatment.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "asset-catalog", "review-surface"],
    fixIntent: "Change the asset, PiP, background, or SFX choice so it supports the selected treatment rather than fighting it.",
    indicators: ["asset", "pip", "background", "sfx_animation_desync", "mismatch", "coexistence"],
  },
  {
    id: "sequence-rhythm-collapse",
    label: "Sequence Rhythm Collapse",
    description: "The candidate loses temporal continuity, music logic, or sequence discipline.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "candidate-score-summary", "review-surface"],
    fixIntent: "Rebalance timing, recovery, and transition choices so locally valid moments read as one sequence.",
    indicators: ["sequence", "rhythm", "dead_zone", "non_musical_emphasis", "shake_zoom_blur_collision"],
  },
  {
    id: "readability-sacrifice",
    label: "Readability Sacrifice",
    description: "The candidate sacrifices text comprehension, safe-zone discipline, or typographic clarity.",
    severity: "editorial",
    affectedArtifacts: ["manifest", "render-preview", "review-surface"],
    fixIntent: "Move, simplify, or restyle text so the candidate remains readable without fighting subject focus.",
    indicators: ["readability", "text_below_safe_zone", "typography_clutter", "broken_line", "insufficient_contrast"],
  },
] as const;

export type JosephFailureClassId = (typeof JOSEPH_FAILURE_TAXONOMY)[number]["id"];
export type JosephFailureSeverity = (typeof JOSEPH_FAILURE_TAXONOMY)[number]["severity"];
export type JosephAffectedArtifact = (typeof JOSEPH_FAILURE_TAXONOMY)[number]["affectedArtifacts"][number];
export type JosephReviewClassification = "strong-example" | "weak-example" | "corrected-example" | "needs-review";

export type JosephReviewManifest = Record<string, unknown> & {
  jobId?: string;
  microAnimationAudit?: {failures?: string[]; warnings?: string[]; score?: number};
  josephTypography?: {qualityAudit?: {failures?: string[]; warnings?: string[]; score?: number}};
  josephChoreography?: {qualityAudit?: {failures?: string[]; warnings?: string[]; score?: number}};
};

export type JosephReviewVariationKey = {
  key?: string;
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile?: string;
};

export type JosephReviewEvidencePackage = {
  jobId: string;
  variationKey: JosephReviewVariationKey;
  candidates: JosephReviewManifest[];
  selected: JosephReviewManifest;
  rejected: JosephReviewManifest[];
  verdict: {
    qualityScore: number;
    similarityScore: number;
    passedFloor: boolean;
    vetoReason?: string;
    failureTags: string[];
  };
  timestamp: string;
  candidateScoreSummary?: unknown;
};

export type JosephFailureTaxonomyMatch = {
  failureClass: JosephFailureClassId;
  label: string;
  severity: JosephFailureSeverity;
  affectedArtifacts: JosephAffectedArtifact[];
  fixIntent: string;
  sourceTags: string[];
};

export type JosephReviewArtifact = {
  version: typeof JOSEPH_OVERSIGHT_VERSION;
  jobId: string;
  createdAt: string;
  variationKey: JosephReviewVariationKey;
  selectedJobId: string | null;
  candidateJobIds: string[];
  rejectedJobIds: string[];
  reviewVerdict: {
    classification: JosephReviewClassification;
    qualityScore: number;
    similarityScore: number;
    passedFloor: boolean;
    failureTags: string[];
    failureTaxonomy: JosephFailureTaxonomyMatch[];
    fixIntents: string[];
    notes: string[];
  };
  artifactRefs: {
    candidatesPath: string;
    selectedPath: string;
    verdictPath: string;
    auditPath: string;
  };
  completionEvidence: {
    candidateManifestCount: number;
    rejectedManifestCount: number;
    hasCandidateScoreSummary: boolean;
    hasExplicitFailureTags: boolean;
    hasReviewNotes: boolean;
  };
};

export type JosephReviewLedgerEntry = {
  version: typeof JOSEPH_OVERSIGHT_VERSION;
  jobId: string;
  createdAt: string;
  selectedJobId: string | null;
  classification: JosephReviewClassification;
  failureClasses: JosephFailureClassId[];
  failureTags: string[];
  qualityScore: number;
  reviewArtifactPath: string;
  evidenceRecordPath: string | null;
  renderProofPath: string | null;
};

export type JosephRegressionGalleryExample = {
  jobId: string;
  selectedJobId: string | null;
  createdAt: string;
  qualityScore: number;
  failureClasses: JosephFailureClassId[];
  reviewArtifactPath: string;
  evidenceRecordPath: string | null;
  renderProofPath: string | null;
  note: string;
};

export type JosephRegressionGallery = {
  version: typeof JOSEPH_OVERSIGHT_VERSION;
  generatedAt: string;
  strongExamples: JosephRegressionGalleryExample[];
  weakExamples: JosephRegressionGalleryExample[];
  correctedExamples: JosephRegressionGalleryExample[];
  index: {
    byFailureClass: Partial<Record<JosephFailureClassId, string[]>>;
  };
};

export type JosephOversightArtifactPaths = {
  reviewArtifactPath: string;
  reviewLedgerPath: string;
  regressionGalleryPath: string;
};

type PreserveJosephOversightInput = {
  pkg: JosephReviewEvidencePackage;
  baseDir: string;
  jobDir: string;
  candidatesPath: string;
  selectedPath: string;
  verdictPath: string;
  auditPath: string;
  evidenceRecordPath?: string;
  renderProofPath?: string;
};

const selectedJobId = (manifest: JosephReviewManifest): string | null =>
  typeof manifest.jobId === "string" ? manifest.jobId : null;

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const normalizedTag = (tag: string): string =>
  tag.trim().toLowerCase().replace(/[\s-]+/g, "_");

const auditFailuresOf = (manifest: JosephReviewManifest): string[] => [
  ...(manifest.microAnimationAudit?.failures ?? []),
  ...(manifest.josephTypography?.qualityAudit?.failures ?? []),
  ...(manifest.josephChoreography?.qualityAudit?.failures ?? []),
];

export const collectJosephFailureTags = (pkg: JosephReviewEvidencePackage): string[] =>
  unique([
    ...pkg.verdict.failureTags,
    ...auditFailuresOf(pkg.selected),
  ].map(normalizedTag).filter(Boolean)).sort();

export const matchJosephFailureTaxonomy = (failureTags: readonly string[]): JosephFailureTaxonomyMatch[] => {
  const normalizedTags = failureTags.map(normalizedTag);
  const matches: JosephFailureTaxonomyMatch[] = [];

  for (const entry of JOSEPH_FAILURE_TAXONOMY) {
    const sourceTags = normalizedTags.filter((tag) =>
      entry.indicators.some((indicator) => tag.includes(indicator)),
    );
    if (sourceTags.length === 0) {
      continue;
    }
    matches.push({
      failureClass: entry.id,
      label: entry.label,
      severity: entry.severity,
      affectedArtifacts: [...entry.affectedArtifacts],
      fixIntent: entry.fixIntent,
      sourceTags: unique(sourceTags).sort(),
    });
  }

  if (matches.length === 0 && normalizedTags.length > 0) {
    return [{
      failureClass: "weak-concept-reduction",
      label: "Weak Concept Reduction",
      severity: "editorial",
      affectedArtifacts: ["planner-audit", "manifest", "review-surface"],
      fixIntent: "Rebuild the treatment around a clearer visual thesis, hero line, or doctrine branch rationale.",
      sourceTags: unique(normalizedTags).sort(),
    }];
  }

  return matches;
};

const classifyReview = (
  pkg: JosephReviewEvidencePackage,
  failureTags: readonly string[],
): JosephReviewClassification => {
  if (failureTags.some((tag) => tag === "corrected_example" || tag === "corrected-example")) {
    return "corrected-example";
  }

  if (!pkg.verdict.passedFloor || pkg.verdict.qualityScore < 0.68 || failureTags.length > 0) {
    return "weak-example";
  }

  if (pkg.verdict.qualityScore >= 0.84 && pkg.verdict.similarityScore <= 0.35) {
    return "strong-example";
  }

  return "needs-review";
};

const reviewNotesFor = (
  classification: JosephReviewClassification,
  taxonomyMatches: readonly JosephFailureTaxonomyMatch[],
): string[] => {
  if (classification === "strong-example") {
    return ["Candidate is a strong reference because it passed floor checks with high quality and low replay similarity."];
  }

  if (classification === "corrected-example") {
    return ["Candidate is preserved as a corrected reference for future regression comparison."];
  }

  if (taxonomyMatches.length > 0) {
    return taxonomyMatches.map((match) =>
      `${match.label}: ${match.sourceTags.join(", ")}`,
    );
  }

  return ["Candidate needs human review because automated evidence is inconclusive."];
};

export const buildJosephReviewArtifact = (
  pkg: JosephReviewEvidencePackage,
  refs: JosephReviewArtifact["artifactRefs"],
): JosephReviewArtifact => {
  const failureTags = collectJosephFailureTags(pkg);
  const failureTaxonomy = matchJosephFailureTaxonomy(failureTags);
  const classification = classifyReview(pkg, failureTags);
  const fixIntents = unique(failureTaxonomy.map((match) => match.fixIntent)).sort();
  const notes = reviewNotesFor(classification, failureTaxonomy);

  return {
    version: JOSEPH_OVERSIGHT_VERSION,
    jobId: pkg.jobId,
    createdAt: pkg.timestamp,
    variationKey: pkg.variationKey,
    selectedJobId: selectedJobId(pkg.selected),
    candidateJobIds: pkg.candidates.map(selectedJobId).filter((id): id is string => Boolean(id)),
    rejectedJobIds: pkg.rejected.map(selectedJobId).filter((id): id is string => Boolean(id)),
    reviewVerdict: {
      classification,
      qualityScore: pkg.verdict.qualityScore,
      similarityScore: pkg.verdict.similarityScore,
      passedFloor: pkg.verdict.passedFloor,
      failureTags,
      failureTaxonomy,
      fixIntents,
      notes,
    },
    artifactRefs: refs,
    completionEvidence: {
      candidateManifestCount: pkg.candidates.length,
      rejectedManifestCount: pkg.rejected.length,
      hasCandidateScoreSummary: Boolean(pkg.candidateScoreSummary),
      hasExplicitFailureTags: failureTags.length > 0,
      hasReviewNotes: notes.length > 0,
    },
  };
};

const buildLedgerEntry = (
  artifact: JosephReviewArtifact,
  reviewArtifactPath: string,
  evidenceRecordPath?: string,
  renderProofPath?: string,
): JosephReviewLedgerEntry => ({
  version: JOSEPH_OVERSIGHT_VERSION,
  jobId: artifact.jobId,
  createdAt: artifact.createdAt,
  selectedJobId: artifact.selectedJobId,
  classification: artifact.reviewVerdict.classification,
  failureClasses: artifact.reviewVerdict.failureTaxonomy.map((match) => match.failureClass),
  failureTags: artifact.reviewVerdict.failureTags,
  qualityScore: artifact.reviewVerdict.qualityScore,
  reviewArtifactPath,
  evidenceRecordPath: evidenceRecordPath ?? null,
  renderProofPath: renderProofPath ?? null,
});

const emptyGallery = (generatedAt: string): JosephRegressionGallery => ({
  version: JOSEPH_OVERSIGHT_VERSION,
  generatedAt,
  strongExamples: [],
  weakExamples: [],
  correctedExamples: [],
  index: {byFailureClass: {}},
});

export const readJosephRegressionGallery = (
  galleryPath: string,
  generatedAt = "1970-01-01T00:00:00.000Z",
): JosephRegressionGallery => {
  if (!fs.existsSync(galleryPath)) {
    return emptyGallery(generatedAt);
  }

  const parsed = JSON.parse(fs.readFileSync(galleryPath, "utf8")) as JosephRegressionGallery;
  return {
    ...emptyGallery(generatedAt),
    ...parsed,
    index: {
      byFailureClass: parsed.index?.byFailureClass ?? {},
    },
  };
};

const removeExistingExample = (
  examples: readonly JosephRegressionGalleryExample[],
  jobId: string,
): JosephRegressionGalleryExample[] => examples.filter((example) => example.jobId !== jobId);

const upsertGalleryExample = (
  gallery: JosephRegressionGallery,
  entry: JosephReviewLedgerEntry,
): JosephRegressionGallery => {
  const example: JosephRegressionGalleryExample = {
    jobId: entry.jobId,
    selectedJobId: entry.selectedJobId,
    createdAt: entry.createdAt,
    qualityScore: entry.qualityScore,
    failureClasses: entry.failureClasses,
    reviewArtifactPath: entry.reviewArtifactPath,
    evidenceRecordPath: entry.evidenceRecordPath,
    renderProofPath: entry.renderProofPath,
    note:
      entry.classification === "strong-example"
        ? "Strong reference preserved for future comparison."
        : entry.classification === "corrected-example"
          ? "Corrected reference preserved for regression checks."
          : "Weak reference preserved with explicit failure classes.",
  };

  const next: JosephRegressionGallery = {
    ...gallery,
    strongExamples: removeExistingExample(gallery.strongExamples, entry.jobId),
    weakExamples: removeExistingExample(gallery.weakExamples, entry.jobId),
    correctedExamples: removeExistingExample(gallery.correctedExamples, entry.jobId),
    index: {byFailureClass: {...gallery.index.byFailureClass}},
  };

  if (entry.classification === "strong-example") {
    next.strongExamples.push(example);
  } else if (entry.classification === "corrected-example") {
    next.correctedExamples.push(example);
  } else {
    next.weakExamples.push(example);
  }

  for (const failureClass of entry.failureClasses) {
    next.index.byFailureClass[failureClass] = unique([
      ...(next.index.byFailureClass[failureClass] ?? []).filter((jobId) => jobId !== entry.jobId),
      entry.jobId,
    ]).sort();
  }

  next.strongExamples.sort((left, right) => right.qualityScore - left.qualityScore || left.jobId.localeCompare(right.jobId));
  next.weakExamples.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId));
  next.correctedExamples.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.jobId.localeCompare(right.jobId));
  return next;
};

const writeJsonAtomic = (targetPath: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, targetPath);
};

export const preserveJosephOversightReview = ({
  pkg,
  baseDir,
  jobDir,
  candidatesPath,
  selectedPath,
  verdictPath,
  auditPath,
  evidenceRecordPath,
  renderProofPath,
}: PreserveJosephOversightInput): JosephOversightArtifactPaths => {
  const reviewArtifactPath = path.join(jobDir, "review-artifact.json");
  const reviewLedgerPath = path.join(baseDir, "review-ledger.ndjson");
  const regressionGalleryPath = path.join(baseDir, "regression-gallery.json");
  const artifact = buildJosephReviewArtifact(pkg, {
    candidatesPath,
    selectedPath,
    verdictPath,
    auditPath,
  });
  const ledgerEntry = buildLedgerEntry(artifact, reviewArtifactPath, evidenceRecordPath, renderProofPath);
  const gallery = upsertGalleryExample(
    readJosephRegressionGallery(regressionGalleryPath, pkg.timestamp),
    ledgerEntry,
  );

  writeJsonAtomic(reviewArtifactPath, artifact);
  fs.mkdirSync(path.dirname(reviewLedgerPath), {recursive: true});
  fs.appendFileSync(reviewLedgerPath, `${JSON.stringify(ledgerEntry)}\n`, "utf8");
  writeJsonAtomic(regressionGalleryPath, {
    ...gallery,
    generatedAt: pkg.timestamp,
  });

  return {
    reviewArtifactPath,
    reviewLedgerPath,
    regressionGalleryPath,
  };
};
import {evaluateAnnotationQa, type GoldenCorpusAnnotation} from "./annotation";
import {type GoldenCorpusRegistry, type ReferenceEditRegistryEntry} from "./registry";

export type Golden100DashboardStatus = "ready" | "below_threshold" | "blocked";

export type Golden100Dashboard = {
  counts: {
    totalReferences: number;
    byStyle: Record<string, number>;
    byVehicle: Record<string, number>;
    byCurationTier: Record<string, number>;
    byExtractionStatus: Record<string, number>;
    byAnnotationStatus: Record<string, number>;
  };
  golden100: {
    threshold: number;
    validatedCandidateCount: number;
    thresholdMet: boolean;
    status: Golden100DashboardStatus;
    inflatedReferenceIds: string[];
  };
  warnings: string[];
};

export type BuildGolden100DashboardInput = {
  registry: GoldenCorpusRegistry;
  annotations: GoldenCorpusAnnotation[];
  threshold?: number;
};

const increment = (record: Record<string, number>, key: string): void => {
  record[key] = (record[key] ?? 0) + 1;
};

const hasGoldenCandidateShape = (entry: ReferenceEditRegistryEntry): boolean => {
  return (
    entry.corpusEligibility.productionCorpus &&
    entry.quality.tier === "elite" &&
    entry.quality.sourceQuality === "high" &&
    entry.quality.compressionRisk !== "high" &&
    entry.curation.status === "approved_golden_candidate" &&
    entry.curation.annotationStatus === "complete" &&
    entry.curation.trajectoryStatus === "validated"
  );
};

const couldInflateThreshold = (entry: ReferenceEditRegistryEntry): boolean => {
  return (
    entry.corpusEligibility.productionCorpus &&
    entry.curation.status === "approved_golden_candidate" &&
    entry.curation.annotationStatus === "complete" &&
    entry.curation.trajectoryStatus === "validated"
  );
};

export function buildGolden100Dashboard(input: BuildGolden100DashboardInput): Golden100Dashboard {
  const threshold = input.threshold ?? 100;
  const annotationsByRegistryId = new Map(input.annotations.map((annotation) => [annotation.registryId, annotation]));
  const counts: Golden100Dashboard["counts"] = {
    totalReferences: input.registry.entries.length,
    byStyle: {},
    byVehicle: {},
    byCurationTier: {},
    byExtractionStatus: {},
    byAnnotationStatus: {}
  };
  const warnings: string[] = [];
  const inflatedReferenceIds: string[] = [];
  let validatedCandidateCount = 0;

  for (const entry of input.registry.entries) {
    increment(counts.byStyle, entry.creatorStyle.styleLabel);
    increment(counts.byVehicle, entry.creatorStyle.vehicle);
    increment(counts.byCurationTier, entry.quality.tier);
    increment(counts.byExtractionStatus, entry.curation.trajectoryStatus);
    increment(counts.byAnnotationStatus, entry.curation.annotationStatus);

    const annotation = annotationsByRegistryId.get(entry.registryId);
    const qaResult = annotation ? evaluateAnnotationQa(annotation) : {approved: false, rejectionReasons: []};

    if (couldInflateThreshold(entry) && annotation && !qaResult.approved) {
      inflatedReferenceIds.push(entry.registryId);
      warnings.push(`${entry.registryId} rejected from Golden 100 count: ${qaResult.rejectionReasons.join(", ")}`);
    }

    if (hasGoldenCandidateShape(entry) && annotation && qaResult.approved) {
      validatedCandidateCount += 1;
    }
  }

  const thresholdMet = validatedCandidateCount >= threshold;
  const status: Golden100DashboardStatus = inflatedReferenceIds.length > 0
    ? "blocked"
    : thresholdMet
      ? "ready"
      : "below_threshold";

  return {
    counts,
    golden100: {
      threshold,
      validatedCandidateCount,
      thresholdMet,
      status,
      inflatedReferenceIds
    },
    warnings
  };
}

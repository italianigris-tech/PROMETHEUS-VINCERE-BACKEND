export type FeatureVersionTriple = {
  featureVersion: string;
  extractorVersion: string;
  schemaVersion: string;
};

export type FeatureVersionCorpusEntry = FeatureVersionTriple & {
  registryId: string;
  trajectoryPath: string;
};

export type FeatureMigrationPlan = {
  planId: string;
  fromFeatureVersion: string;
  toFeatureVersion: string;
  owner: string;
  changedFeatures: string[];
};

export type FeatureReExtractionPlan = {
  planId: string;
  registryId: string;
  owner: string;
  reason: string;
};

export type FeatureVersionResolution =
  | {
      kind: "migration";
      planId: string;
      owner: string;
    }
  | {
      kind: "re_extraction";
      planId: string;
      owner: string;
      reason: string;
    };

export type AffectedFeatureVersionEntry = {
  registryId: string;
  trajectoryPath: string;
  observed: FeatureVersionTriple;
  expected: FeatureVersionTriple;
  mismatchReasons: string[];
  resolution: FeatureVersionResolution | null;
};

export type FeatureVersionCompatibilityInput = {
  current: FeatureVersionTriple;
  corpusEntries: FeatureVersionCorpusEntry[];
  changedFeatures: string[];
  migrationPlans?: FeatureMigrationPlan[];
  reExtractionPlans?: FeatureReExtractionPlan[];
};

export type FeatureVersionCompatibilityReport = {
  reportVersion: "feature-version-compatibility-v1";
  current: FeatureVersionTriple;
  changedFeatures: string[];
  satisfied: boolean;
  blockReasons: string[];
  affectedCorpusEntries: AffectedFeatureVersionEntry[];
};

const mismatchReasonsFor = (
  entry: FeatureVersionCorpusEntry,
  current: FeatureVersionTriple
): string[] => {
  const reasons: string[] = [];
  if (entry.featureVersion !== current.featureVersion) {
    reasons.push("feature_version_mismatch");
  }
  if (entry.extractorVersion !== current.extractorVersion) {
    reasons.push("extractor_version_mismatch");
  }
  if (entry.schemaVersion !== current.schemaVersion) {
    reasons.push("schema_version_mismatch");
  }
  return reasons;
};

const resolveMismatch = (
  entry: FeatureVersionCorpusEntry,
  current: FeatureVersionTriple,
  input: FeatureVersionCompatibilityInput
): FeatureVersionResolution | null => {
  const reExtractionPlan = input.reExtractionPlans?.find((plan) => plan.registryId === entry.registryId);
  if (reExtractionPlan) {
    return {
      kind: "re_extraction",
      planId: reExtractionPlan.planId,
      owner: reExtractionPlan.owner,
      reason: reExtractionPlan.reason
    };
  }

  const migrationPlan = input.migrationPlans?.find((plan) => {
    return (
      plan.fromFeatureVersion === entry.featureVersion &&
      plan.toFeatureVersion === current.featureVersion &&
      input.changedFeatures.every((feature) => plan.changedFeatures.includes(feature))
    );
  });
  if (migrationPlan) {
    return {
      kind: "migration",
      planId: migrationPlan.planId,
      owner: migrationPlan.owner
    };
  }

  return null;
};

export function evaluateFeatureVersionCompatibility(
  input: FeatureVersionCompatibilityInput
): FeatureVersionCompatibilityReport {
  const affectedCorpusEntries = input.corpusEntries
    .map((entry) => {
      const mismatchReasons = mismatchReasonsFor(entry, input.current);
      if (mismatchReasons.length === 0) {
        return null;
      }

      return {
        registryId: entry.registryId,
        trajectoryPath: entry.trajectoryPath,
        observed: {
          featureVersion: entry.featureVersion,
          extractorVersion: entry.extractorVersion,
          schemaVersion: entry.schemaVersion
        },
        expected: input.current,
        mismatchReasons,
        resolution: resolveMismatch(entry, input.current, input)
      };
    })
    .filter((entry): entry is AffectedFeatureVersionEntry => entry !== null);

  const unresolvedEntries = affectedCorpusEntries.filter((entry) => entry.resolution === null);
  const blockReasons = unresolvedEntries.length > 0
    ? ["unresolved_feature_version_mismatch"]
    : [];

  return {
    reportVersion: "feature-version-compatibility-v1",
    current: input.current,
    changedFeatures: input.changedFeatures,
    satisfied: blockReasons.length === 0,
    blockReasons,
    affectedCorpusEntries
  };
}

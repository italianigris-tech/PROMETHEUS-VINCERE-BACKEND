export type FeatureScalar = number | boolean | string | null | undefined;

export type FeatureVectorQualityTier = "elite" | "generic";

export type FeatureVector = {
  referenceId: string;
  qualityTier: FeatureVectorQualityTier;
  features: Record<string, FeatureScalar>;
};

export type FailingFeatureAction = {
  action: "removed" | "revised";
  reason: string;
};

export type FeatureValidationInput = {
  vectors: FeatureVector[];
  minPerClass?: number;
  minNumericSeparationScore?: number;
  minCategoricalPurity?: number;
  featureActions?: Record<string, FailingFeatureAction>;
};

export type ComparedFeature = {
  featureName: string;
  valueKind: "numeric" | "categorical";
  separationScore: number;
  eliteSummary: string;
  genericSummary: string;
  verdict: "separates_craft" | "noise";
};

export type ResolvedFailingFeature = {
  featureName: string;
  action: FailingFeatureAction["action"];
  reason: string;
};

export type EliteGenericFeatureValidationReport = {
  reportVersion: "elite-generic-feature-validation-v1";
  counts: {
    elite: number;
    generic: number;
  };
  thresholds: {
    minPerClass: number;
    minNumericSeparationScore: number;
    minCategoricalPurity: number;
  };
  satisfied: boolean;
  blockReasons: string[];
  comparedFeatures: ComparedFeature[];
  separatingFeatures: ComparedFeature[];
  noisyFeatures: ComparedFeature[];
  unresolvedFailingFeatures: string[];
  resolvedFailingFeatures: ResolvedFailingFeature[];
};

const round = (value: number): number => Number(value.toFixed(6));

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const variance = (values: number[], center: number): number =>
  values.length <= 1
    ? 0
    : values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);

const scalarToNumeric = (value: FeatureScalar): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return null;
};

const dominantValue = (values: FeatureScalar[]): {value: string; purity: number} => {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const [value, count] = sorted[0] ?? ["none", 0];
  return {
    value,
    purity: values.length === 0 ? 0 : count / values.length
  };
};

const compareNumericFeature = (
  featureName: string,
  eliteValues: number[],
  genericValues: number[],
  minNumericSeparationScore: number
): ComparedFeature => {
  const eliteMean = mean(eliteValues);
  const genericMean = mean(genericValues);
  const pooledStd = Math.sqrt((variance(eliteValues, eliteMean) + variance(genericValues, genericMean)) / 2);
  const separationScore =
    pooledStd === 0
      ? eliteMean === genericMean
        ? 0
        : Number.POSITIVE_INFINITY
      : Math.abs(eliteMean - genericMean) / pooledStd;

  return {
    featureName,
    valueKind: "numeric",
    separationScore: round(separationScore === Number.POSITIVE_INFINITY ? 999 : separationScore),
    eliteSummary: `mean=${round(eliteMean)}`,
    genericSummary: `mean=${round(genericMean)}`,
    verdict: separationScore >= minNumericSeparationScore ? "separates_craft" : "noise"
  };
};

const compareCategoricalFeature = (
  featureName: string,
  eliteValues: FeatureScalar[],
  genericValues: FeatureScalar[],
  minCategoricalPurity: number
): ComparedFeature => {
  const eliteDominant = dominantValue(eliteValues);
  const genericDominant = dominantValue(genericValues);
  const separates =
    eliteDominant.value !== genericDominant.value &&
    eliteDominant.purity >= minCategoricalPurity &&
    genericDominant.purity >= minCategoricalPurity;
  const separationScore = separates ? Math.min(eliteDominant.purity, genericDominant.purity) : 0;

  return {
    featureName,
    valueKind: "categorical",
    separationScore: round(separationScore),
    eliteSummary: `dominant=${eliteDominant.value};purity=${round(eliteDominant.purity)}`,
    genericSummary: `dominant=${genericDominant.value};purity=${round(genericDominant.purity)}`,
    verdict: separates ? "separates_craft" : "noise"
  };
};

const hasOnlyNumericValues = (values: FeatureScalar[]): boolean =>
  values.every((value) => value === null || value === undefined || scalarToNumeric(value) !== null);

export function evaluateEliteGenericFeatureValidation(input: FeatureValidationInput): EliteGenericFeatureValidationReport {
  const minPerClass = input.minPerClass ?? 5;
  const minNumericSeparationScore = input.minNumericSeparationScore ?? 1;
  const minCategoricalPurity = input.minCategoricalPurity ?? 0.8;
  const eliteVectors = input.vectors.filter((vector) => vector.qualityTier === "elite");
  const genericVectors = input.vectors.filter((vector) => vector.qualityTier === "generic");
  const blockReasons: string[] = [];

  if (eliteVectors.length < minPerClass) {
    blockReasons.push(`requires_at_least_${minPerClass}_elite_vectors`);
  }
  if (genericVectors.length < minPerClass) {
    blockReasons.push(`requires_at_least_${minPerClass}_generic_vectors`);
  }

  const featureNames = [...new Set(input.vectors.flatMap((vector) => Object.keys(vector.features)))].sort();
  const comparedFeatures = featureNames.map((featureName) => {
    const eliteValues = eliteVectors.map((vector) => vector.features[featureName]);
    const genericValues = genericVectors.map((vector) => vector.features[featureName]);
    const allValues = [...eliteValues, ...genericValues];

    if (hasOnlyNumericValues(allValues)) {
      return compareNumericFeature(
        featureName,
        eliteValues.map(scalarToNumeric).filter((value): value is number => value !== null),
        genericValues.map(scalarToNumeric).filter((value): value is number => value !== null),
        minNumericSeparationScore
      );
    }

    return compareCategoricalFeature(featureName, eliteValues, genericValues, minCategoricalPurity);
  });

  const separatingFeatures = comparedFeatures.filter((feature) => feature.verdict === "separates_craft");
  const noisyFeatures = comparedFeatures.filter((feature) => feature.verdict === "noise");
  const resolvedFailingFeatures = noisyFeatures
    .map((feature) => {
      const action = input.featureActions?.[feature.featureName];
      return action
        ? {
            featureName: feature.featureName,
            action: action.action,
            reason: action.reason
          }
        : null;
    })
    .filter((feature): feature is ResolvedFailingFeature => feature !== null);
  const unresolvedFailingFeatures = noisyFeatures
    .map((feature) => feature.featureName)
    .filter((featureName) => input.featureActions?.[featureName] === undefined);

  if (separatingFeatures.length === 0) {
    blockReasons.push("no_separating_features_found");
  }
  if (unresolvedFailingFeatures.length > 0) {
    blockReasons.push("unresolved_noisy_features");
  }

  return {
    reportVersion: "elite-generic-feature-validation-v1",
    counts: {
      elite: eliteVectors.length,
      generic: genericVectors.length
    },
    thresholds: {
      minPerClass,
      minNumericSeparationScore,
      minCategoricalPurity
    },
    satisfied: blockReasons.length === 0,
    blockReasons,
    comparedFeatures,
    separatingFeatures,
    noisyFeatures,
    unresolvedFailingFeatures,
    resolvedFailingFeatures
  };
}

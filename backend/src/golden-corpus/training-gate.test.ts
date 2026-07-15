import {describe, expect, it} from "vitest";

import {evaluateEliteGenericFeatureValidation} from "./feature-validation";
import {evaluateFeatureVersionCompatibility} from "./feature-versioning";
import {evaluateMaxEntIrlTrainingGate, maxEntIrlOverrideSchema} from "./training-gate";
const readyDashboard = {
  counts: {
    totalReferences: 100,
    byStyle: {joseph: 100},
    byVehicle: {talking_head: 100},
    byCurationTier: {elite: 100},
    byExtractionStatus: {validated: 100},
    byAnnotationStatus: {complete: 100}
  },
  golden100: {
    threshold: 100,
    validatedCandidateCount: 100,
    thresholdMet: true,
    status: "ready" as const,
    inflatedReferenceIds: []
  },
  warnings: []
};

describe("MaxEnt IRL training gate", () => {
  it("refuses training when the Golden 100 dashboard is below threshold", () => {
    const result = evaluateMaxEntIrlTrainingGate({
      dashboard: {
        counts: {
          totalReferences: 12,
          byStyle: {joseph: 12},
          byVehicle: {talking_head: 12},
          byCurationTier: {elite: 12},
          byExtractionStatus: {validated: 12},
          byAnnotationStatus: {complete: 12}
        },
        golden100: {
          threshold: 100,
          validatedCandidateCount: 12,
          thresholdMet: false,
          status: "below_threshold",
          inflatedReferenceIds: []
        },
        warnings: []
      },
      featureValidationSatisfied: true
    });

    expect(result.allowed).toBe(false);
    expect(result.blockReasons).toEqual(["golden_100_threshold_not_met"]);
    expect(result.referencedIssues).toEqual([55, 56, 82, 84]);
  });

  it("refuses training when feature validation is not satisfied even after Golden 100 passes", () => {
    const result = evaluateMaxEntIrlTrainingGate({
      dashboard: {
        counts: {
          totalReferences: 100,
          byStyle: {joseph: 100},
          byVehicle: {talking_head: 100},
          byCurationTier: {elite: 100},
          byExtractionStatus: {validated: 100},
          byAnnotationStatus: {complete: 100}
        },
        golden100: {
          threshold: 100,
          validatedCandidateCount: 100,
          thresholdMet: true,
          status: "ready",
          inflatedReferenceIds: []
        },
        warnings: []
      },
      featureValidationSatisfied: false
    });

    expect(result.allowed).toBe(false);
    expect(result.blockReasons).toEqual(["feature_validation_not_satisfied"]);
  });

  it("allows a human override only with reason, owner, date, and expected risk", () => {
    const override = maxEntIrlOverrideSchema.parse({
      reason: "Run a tiny smoke test without publishing weights.",
      owner: "josh",
      date: "2026-07-03",
      expectedRisk: "False confidence if anyone treats smoke weights as production-ready."
    });

    const result = evaluateMaxEntIrlTrainingGate({
      dashboard: {
        counts: {
          totalReferences: 10,
          byStyle: {joseph: 10},
          byVehicle: {talking_head: 10},
          byCurationTier: {elite: 10},
          byExtractionStatus: {validated: 10},
          byAnnotationStatus: {complete: 10}
        },
        golden100: {
          threshold: 100,
          validatedCandidateCount: 10,
          thresholdMet: false,
          status: "below_threshold",
          inflatedReferenceIds: []
        },
        warnings: []
      },
      featureValidationSatisfied: false,
      override
    });

    expect(result.allowed).toBe(true);
    expect(result.overrideApplied).toBe(true);
    expect(result.blockReasons).toEqual([]);
    expect(result.audit).toContain("human_override:josh:2026-07-03");
  });

  it("rejects incomplete overrides", () => {
    expect(
      maxEntIrlOverrideSchema.safeParse({
        reason: "Smoke test",
        owner: "josh",
        date: "2026-07-03"
      }).success
    ).toBe(false);
  });
  it("uses the elite/generic feature validation report as gate evidence", () => {
    const report = evaluateEliteGenericFeatureValidation({
      vectors: [
        ...Array.from({length: 5}, (_, index) => ({
          referenceId: `elite_${index}`,
          qualityTier: "elite" as const,
          features: {
            "camera.shot_change_count": 3,
            "temporal.position_in_video": "body"
          }
        })),
        ...Array.from({length: 5}, (_, index) => ({
          referenceId: `generic_${index}`,
          qualityTier: "generic" as const,
          features: {
            "camera.shot_change_count": 0,
            "temporal.position_in_video": "body"
          }
        }))
      ],
      featureActions: {
        "temporal.position_in_video": {
          action: "revised",
          reason: "Use narrative role labels instead of raw timeline position."
        }
      }
    });

    const result = evaluateMaxEntIrlTrainingGate({
      dashboard: readyDashboard,
      featureValidationReport: report
    });

    expect(report.satisfied).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.audit).toContain("feature_validation_report=elite-generic-feature-validation-v1");
  });
  it("blocks training when feature version compatibility has unresolved mismatches", () => {
    const versionReport = evaluateFeatureVersionCompatibility({
      current: {
        featureVersion: "trajectory-features-v2",
        extractorVersion: "0.3.0",
        schemaVersion: "0.3.0"
      },
      changedFeatures: ["audio.beat_proximity"],
      corpusEntries: [
        {
          registryId: "elite_legacy",
          trajectoryPath: "artifacts/golden/elite_legacy/trajectory.json",
          featureVersion: "trajectory-features-v1",
          extractorVersion: "0.2.0",
          schemaVersion: "0.2.0"
        }
      ]
    });

    const result = evaluateMaxEntIrlTrainingGate({
      dashboard: readyDashboard,
      featureValidationSatisfied: true,
      featureVersionReport: versionReport
    });

    expect(versionReport.satisfied).toBe(false);
    expect(result.allowed).toBe(false);
    expect(result.blockReasons).toEqual(["feature_version_compatibility_not_satisfied"]);
    expect(result.audit).toContain("feature_version_report=feature-version-compatibility-v1");
  });
});

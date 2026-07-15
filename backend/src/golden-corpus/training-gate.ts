import {z} from "zod";

import {type Golden100Dashboard} from "./dashboard";
import {type EliteGenericFeatureValidationReport} from "./feature-validation";
import {type FeatureVersionCompatibilityReport} from "./feature-versioning";

export const MAX_ENT_IRL_GATE_REFERENCED_ISSUES = [55, 56, 82, 84] as const;

export const maxEntIrlOverrideSchema = z.object({
  reason: z.string().min(1),
  owner: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  expectedRisk: z.string().min(1)
});

export type MaxEntIrlOverride = z.infer<typeof maxEntIrlOverrideSchema>;

export type MaxEntIrlTrainingGateInput = {
  dashboard: Golden100Dashboard;
  featureValidationSatisfied?: boolean;
  featureValidationReport?: EliteGenericFeatureValidationReport;
  featureVersionReport?: FeatureVersionCompatibilityReport;
  override?: MaxEntIrlOverride;
};

export type MaxEntIrlTrainingGateResult = {
  allowed: boolean;
  overrideApplied: boolean;
  blockReasons: string[];
  referencedIssues: number[];
  audit: string;
};

export function evaluateMaxEntIrlTrainingGate(input: MaxEntIrlTrainingGateInput): MaxEntIrlTrainingGateResult {
  if (input.override) {
    return {
      allowed: true,
      overrideApplied: true,
      blockReasons: [],
      referencedIssues: [...MAX_ENT_IRL_GATE_REFERENCED_ISSUES],
      audit: `human_override:${input.override.owner}:${input.override.date}:${input.override.reason}:risk=${input.override.expectedRisk}`
    };
  }

  const blockReasons: string[] = [];
  if (!input.dashboard.golden100.thresholdMet || input.dashboard.golden100.status !== "ready") {
    blockReasons.push("golden_100_threshold_not_met");
  }
  const featureValidationSatisfied = input.featureValidationReport?.satisfied ?? input.featureValidationSatisfied ?? false;
  if (!featureValidationSatisfied) {
    blockReasons.push("feature_validation_not_satisfied");
  }
  if (input.featureVersionReport && !input.featureVersionReport.satisfied) {
    blockReasons.push("feature_version_compatibility_not_satisfied");
  }

  const evidenceAudit = `${input.featureValidationReport ? `:feature_validation_report=${input.featureValidationReport.reportVersion}` : ""}${input.featureVersionReport ? `:feature_version_report=${input.featureVersionReport.reportVersion}` : ""}`;

  return {
    allowed: blockReasons.length === 0,
    overrideApplied: false,
    blockReasons,
    referencedIssues: [...MAX_ENT_IRL_GATE_REFERENCED_ISSUES],
    audit: blockReasons.length === 0
      ? `maxent_irl_gate:allowed${evidenceAudit}`
      : `maxent_irl_gate:blocked:${blockReasons.join(",")}${evidenceAudit}`
  };
}

import {createHash} from "node:crypto";

import type {DeclaredComposition} from "./composition-experiment-contracts.js";
import type {ObservedComposition} from "./composition-observer.js";

type FieldResult = {
  status: "match" | "mismatch" | "inferred" | "unobserved";
  declared: unknown;
  observed: unknown;
  delta: unknown;
  evidenceIds: string[];
};

export type CompositionFidelityReport = {
  schemaVersion: "maul-composition-fidelity-report/v1";
  reportId: string;
  reportSha256: string;
  status: "pass" | "partial" | "fail";
  declarationId: string;
  declarationSha256: string;
  observationId: string;
  observationSha256: string;
  manifestSha256: string;
  rendererReceipt: {renderer: string; compositionId: string};
  hardFailures: Array<{code: string; message: string; evidenceIds: string[]}>;
  fields: Record<"font" | "lineBreaks" | "placement" | "depth" | "treatment" | "motion" | "subjectIntersection", FieldResult>;
};

const measurementValue = (measurement: {status: string; value?: unknown}): unknown =>
  "value" in measurement ? measurement.value : null;

export const buildCompositionFidelityReport = ({
  reportId,
  declaration,
  observed,
  manifestSha256,
  rendererReceipt,
}: {
  reportId: string;
  declaration: DeclaredComposition;
  observed: ObservedComposition;
  manifestSha256: string;
  rendererReceipt: {renderer: string; compositionId: string};
}): CompositionFidelityReport => {
  const hardFailures: CompositionFidelityReport["hardFailures"] = [];
  if (observed.status === "blocked") {
    hardFailures.push({
      code: "observation_blocked",
      message: observed.failures.join("; "),
      evidenceIds: [],
    });
  }
  const critical = observed.measurements.criticalIntersectionRatio;
  if (critical.status !== "unobserved" && critical.value > 0) {
    hardFailures.push({
      code: "critical_region_occlusion",
      message: `Rendered text intersects ${critical.value} of measured critical pixels.`,
      evidenceIds: critical.evidenceIds,
    });
  }
  const treatment = observed.measurements.treatmentVisibility;
  if (treatment.status !== "unobserved" && treatment.value === false) {
    hardFailures.push({
      code: "treatment_not_visible",
      message: "No declared treatment pixels were measurable against the source control.",
      evidenceIds: treatment.evidenceIds,
    });
  }

  const textBounds = observed.measurements.textBounds;
  const placementDeclaredBounds = {
    leftPx: declaration.placement.box.x * declaration.output.width,
    topPx: declaration.placement.box.y * declaration.output.height,
    rightPx: (declaration.placement.box.x + declaration.placement.box.width) * declaration.output.width,
    bottomPx: (declaration.placement.box.y + declaration.placement.box.height) * declaration.output.height,
  };
  const placementComparisonMode = declaration.placement.comparisonMode;
  const observedTextBounds = textBounds.status === "unobserved" ? null : textBounds.value;
  const placementDelta = observedTextBounds === null
    ? null
    : {
        leftPx: observedTextBounds.leftPx - placementDeclaredBounds.leftPx,
        topPx: observedTextBounds.topPx - placementDeclaredBounds.topPx,
        rightPx: observedTextBounds.rightPx - placementDeclaredBounds.rightPx,
        bottomPx: observedTextBounds.bottomPx - placementDeclaredBounds.bottomPx,
      };
  const placementMatches = placementDelta !== null &&
    (placementComparisonMode === "containment"
      ? observedTextBounds!.leftPx >= placementDeclaredBounds.leftPx - 4 &&
        observedTextBounds!.topPx >= placementDeclaredBounds.topPx - 4 &&
        observedTextBounds!.rightPx <= placementDeclaredBounds.rightPx + 4 &&
        observedTextBounds!.bottomPx <= placementDeclaredBounds.bottomPx + 4
      : Object.values(placementDelta).every(
          (delta) => Math.abs(delta) <= Math.max(4, declaration.output.width * 0.02),
        ));
  const lineCount = observed.measurements.lineCount;
  const lineMatches = lineCount.status !== "unobserved" &&
    lineCount.value === declaration.typography.lineBreaks.length;

  const fields: CompositionFidelityReport["fields"] = {
    font: {
      status: observed.measurements.fontIdentity.status === "inferred"
        ? "inferred"
        : observed.measurements.fontIdentity.status === "observed"
          ? "match"
          : "unobserved",
      declared: declaration.typography.roles.map((role) => role.font),
      observed: measurementValue(observed.measurements.fontIdentity),
      delta: null,
      evidenceIds: observed.measurements.fontIdentity.evidenceIds,
    },
    lineBreaks: {
      status: lineCount.status === "unobserved" ? "unobserved" : lineMatches ? "match" : "mismatch",
      declared: declaration.typography.lineBreaks,
      observed: measurementValue(lineCount),
      delta: lineCount.status === "unobserved" ? null : lineCount.value - declaration.typography.lineBreaks.length,
      evidenceIds: lineCount.evidenceIds,
    },
    placement: {
      status: textBounds.status === "unobserved" ? "unobserved" : placementMatches ? "match" : "mismatch",
      declared: {...placementDeclaredBounds, comparisonMode: placementComparisonMode},
      observed: measurementValue(textBounds),
      delta: placementDelta,
      evidenceIds: textBounds.evidenceIds,
    },
    depth: {
      status: observed.measurements.depthMode.status === "unobserved" ? "unobserved" : "match",
      declared: declaration.placement.depthMode,
      observed: measurementValue(observed.measurements.depthMode),
      delta: null,
      evidenceIds: observed.measurements.depthMode.evidenceIds,
    },
    treatment: {
      status: treatment.status === "unobserved" ? "unobserved" : treatment.value ? "match" : "mismatch",
      declared: declaration.treatment.primitives,
      observed: measurementValue(treatment),
      delta: null,
      evidenceIds: treatment.evidenceIds,
    },
    motion: {
      status: observed.measurements.temporalStability.status === "unobserved" ? "unobserved" : "match",
      declared: declaration.motion.trajectorySamples,
      observed: measurementValue(observed.measurements.temporalStability),
      delta: null,
      evidenceIds: observed.measurements.temporalStability.evidenceIds,
    },
    subjectIntersection: {
      status: observed.measurements.subjectIntersectionRatio.status === "unobserved" ? "unobserved" : "match",
      declared: declaration.placement.depthMode,
      observed: measurementValue(observed.measurements.subjectIntersectionRatio),
      delta: null,
      evidenceIds: observed.measurements.subjectIntersectionRatio.evidenceIds,
    },
  };
  const hasIncompleteField = Object.values(fields).some(
    (field) => field.status === "inferred" || field.status === "unobserved" || field.status === "mismatch",
  );
  const body = {
    schemaVersion: "maul-composition-fidelity-report/v1" as const,
    reportId,
    status: hardFailures.length > 0 ? "fail" as const : hasIncompleteField ? "partial" as const : "pass" as const,
    declarationId: declaration.declarationId,
    declarationSha256: declaration.declarationSha256,
    observationId: observed.observationId,
    observationSha256: observed.observationSha256,
    manifestSha256,
    rendererReceipt,
    hardFailures,
    fields,
  };
  return {
    ...body,
    reportSha256: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };
};

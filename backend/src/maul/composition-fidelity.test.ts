import {describe, expect, it} from "vitest";

import {buildCompositionFidelityReport} from "./composition-fidelity.js";
import type {DeclaredComposition} from "./composition-experiment-contracts.js";
import type {ObservedComposition} from "./composition-observer.js";

const declaration = {
  declarationId: "declared_a",
  declarationSha256: "a".repeat(64),
  output: {width: 100, height: 200, fps: 30, durationMs: 4000},
  typography: {
    roles: [{
      role: "hero",
      tokenIds: ["token_matter"],
      font: {assetId: "font_hero", family: "Almera", sha256: "d".repeat(64), status: "verified"},
    }],
    lineBreaks: [["MAKE"], ["IDEAS", "MATTER"]],
    shapedBoundsPx: {left: 60, top: 20, width: 35, height: 80},
  },
  placement: {box: {x: 0.6, y: 0.1, width: 0.35, height: 0.4}, depthMode: "integrated"},
  treatment: {primitives: ["solid_fill", "editorial_lockup"]},
  motion: {trajectorySamples: [{outputMs: 1000, x: 0.6, y: 0.1}]},
  requiredObservations: ["font_geometry", "line_breaks", "text_bounds", "placement", "subject_intersection", "treatment_visibility", "motion_trajectory"],
} as unknown as DeclaredComposition;

const observed = {
  observationId: "observed_a",
  observationSha256: "b".repeat(64),
  declarationId: "declared_a",
  status: "observed",
  failures: [],
  frameEvidenceIds: ["frame_1", "frame_2"],
  measurements: {
    textBounds: {status: "observed", value: {leftPx: 61, topPx: 21, rightPx: 94, bottomPx: 99}, evidenceIds: ["frame_1"]},
    lineCount: {status: "observed", value: 2, evidenceIds: ["frame_1"]},
    hierarchyAreaRatio: {status: "observed", value: 3.4, evidenceIds: ["frame_1"]},
    subjectIntersectionRatio: {status: "observed", value: 0.12, evidenceIds: ["frame_1"]},
    criticalIntersectionRatio: {status: "observed", value: 0, evidenceIds: ["frame_1"]},
    treatmentVisibility: {status: "observed", value: true, evidenceIds: ["frame_1"]},
    temporalStability: {status: "observed", value: 0.99, evidenceIds: ["frame_1", "frame_2"]},
    fontIdentity: {status: "inferred", value: {assetId: "font_hero", family: "Almera"}, evidenceIds: ["font_probe"]},
    depthMode: {status: "unobserved", reason: "z-order cannot be proven", evidenceIds: []},
  },
} as unknown as ObservedComposition;

describe("Composition Fidelity Report", () => {
  it("keeps inferred and unobserved fields visible without inventing a pass", () => {
    const report = buildCompositionFidelityReport({
      reportId: "fidelity_a",
      declaration,
      observed,
      manifestSha256: "c".repeat(64),
      rendererReceipt: {renderer: "remotion", compositionId: "MaulShort"},
    });

    expect(report.status).toBe("partial");
    expect(report.hardFailures).toEqual([]);
    expect(report.fields.font).toMatchObject({status: "inferred"});
    expect(report.fields.depth).toMatchObject({status: "unobserved"});
    expect(report.fields.placement).toMatchObject({status: "match"});
    expect(report.fields.lineBreaks).toMatchObject({status: "match"});
  });

  it("reports categorical pixel failures ahead of aggregate deltas", () => {
    const failedObserved = structuredClone(observed) as unknown as ObservedComposition;
    (failedObserved.measurements.criticalIntersectionRatio as any).value = 0.2;
    (failedObserved.measurements.treatmentVisibility as any).value = false;

    const report = buildCompositionFidelityReport({
      reportId: "fidelity_failed",
      declaration,
      observed: failedObserved,
      manifestSha256: "c".repeat(64),
      rendererReceipt: {renderer: "remotion", compositionId: "MaulShort"},
    });

    expect(report.status).toBe("fail");
    expect(report.hardFailures.map((failure) => failure.code)).toEqual([
      "critical_region_occlusion",
      "treatment_not_visible",
    ]);
  });

  it("accepts glyph bounds contained by a declared planned-text container", () => {
    const containmentDeclaration = structuredClone(declaration) as any;
    containmentDeclaration.placement.comparisonMode = "containment";
    const containmentObserved = structuredClone(observed) as any;
    containmentObserved.measurements.textBounds.value = {
      leftPx: 66,
      topPx: 70,
      rightPx: 84,
      bottomPx: 88,
    };

    const report = buildCompositionFidelityReport({
      reportId: "fidelity_containment",
      declaration: containmentDeclaration,
      observed: containmentObserved,
      manifestSha256: "c".repeat(64),
      rendererReceipt: {renderer: "remotion", compositionId: "MaulShort"},
    });

    expect(report.fields.placement).toMatchObject({status: "match"});
  });
});

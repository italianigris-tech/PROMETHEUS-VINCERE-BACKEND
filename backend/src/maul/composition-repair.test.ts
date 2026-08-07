import {describe, expect, it} from "vitest";

import {
  COMPOSITION_REPAIR_DEPENDENCY_GRAPH,
  computeRepairDependencyClosure,
  createCompositionRepairLedgerEntry,
} from "./composition-repair.js";

const baselineState = {
  semanticHierarchy: {hypothesisId: "scene_a.compound_anchor"},
  fontRoleAssignment: {hero: "font_display", support: "font_sans"},
  shaping: {runHash: "shape_before"},
  lineBreaks: [["MAKE"], ["IDEAS", "MATTER"]],
  glyphBounds: {width: 620, height: 210},
  collision: {criticalIntersection: 0},
  balance: {horizontalCenter: 0.72},
  declaration: {id: "declared_before"},
  sourceTransform: {fit: "bottom_center", scale: 2.88},
  sceneEvidence: {id: "alpha_440b5718"},
  treatmentFamily: "premium_direct_response",
  palette: {primary: "#ffffff", accent: "#f6c453"},
  motionFamily: "static_editorial_hold",
  renderer: {id: "MaulShort", version: "1"},
  seed: 4812,
  budget: {candidates: 2, renders: 2},
};

const repairedState = {
  ...baselineState,
  semanticHierarchy: {hypothesisId: "scene_a.semantic_anchor"},
  fontRoleAssignment: {...baselineState.fontRoleAssignment},
  shaping: {runHash: "shape_after"},
  lineBreaks: [["MAKE", "IDEAS"], ["MATTER"]],
  glyphBounds: {width: 590, height: 248},
  collision: {criticalIntersection: 0},
  balance: {horizontalCenter: 0.7},
  declaration: {id: "declared_after"},
};

describe("composition repair dependency closure", () => {
  it("computes every downstream dimension invalidated by hierarchy", () => {
    expect(COMPOSITION_REPAIR_DEPENDENCY_GRAPH.version).toBe(
      "maul-composition-repair-dependencies/v1",
    );
    expect(computeRepairDependencyClosure("semanticHierarchy")).toEqual([
      "semanticHierarchy",
      "fontRoleAssignment",
      "shaping",
      "lineBreaks",
      "glyphBounds",
      "collision",
      "balance",
      "declaration",
    ]);
  });

  it("records a dependency-closed hierarchy repair and frozen dimensions", () => {
    const repair = createCompositionRepairLedgerEntry({
      repairId: "repair_scene_a_hierarchy_1",
      parentDeclarationId: "declared_before",
      childDeclarationId: "declared_after",
      targetDimension: "semanticHierarchy",
      before: baselineState,
      after: repairedState,
      diagnosis: "hierarchy_weak",
    });

    expect(repair.recomputedDimensions).toEqual([
      "semanticHierarchy",
      "fontRoleAssignment",
      "shaping",
      "lineBreaks",
      "glyphBounds",
      "collision",
      "balance",
      "declaration",
    ]);
    expect(repair.changedDimensions).toEqual([
      "semanticHierarchy",
      "shaping",
      "lineBreaks",
      "glyphBounds",
      "balance",
      "declaration",
    ]);
    expect(repair.frozenDimensions).toEqual([
      "sourceTransform",
      "sceneEvidence",
      "treatmentFamily",
      "palette",
      "motionFamily",
      "renderer",
      "seed",
      "budget",
    ]);
    expect(repair.beforeFingerprint).not.toBe(repair.afterFingerprint);
  });

  it("blocks unrelated mutations rather than hiding them in a repair", () => {
    expect(() => createCompositionRepairLedgerEntry({
      repairId: "repair_invalid",
      parentDeclarationId: "declared_before",
      childDeclarationId: "declared_after",
      targetDimension: "semanticHierarchy",
      before: baselineState,
      after: {
        ...repairedState,
        treatmentFamily: "luxury_editorial",
      },
      diagnosis: "hierarchy_weak",
    })).toThrow(/frozen dimension treatmentFamily changed/i);
  });
});

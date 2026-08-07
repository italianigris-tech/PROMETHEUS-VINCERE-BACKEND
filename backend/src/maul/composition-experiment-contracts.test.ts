import {describe, expect, it} from "vitest";

import {
  freezeDeclaredComposition,
  type DeclaredCompositionInput,
} from "./composition-experiment-contracts.js";

const validInput = (): DeclaredCompositionInput => ({
  declarationId: "declared_scene_a_baseline",
  parentDeclarationId: null,
  fixtureId: "scene_a_matted_lady_hierarchy_v1",
  sourceGroup: "matted_lady_static_5951e646",
  sourceSha256: "a".repeat(64),
  output: {width: 1080, height: 1920, fps: 30, durationMs: 4000},
  causalLineage: {
    fixtureEvidenceIds: ["alpha:440b5718"],
    referenceObservationIds: ["yuan_123923", "yuan_123954", "yuan_124054"],
    semanticTreeId: "scene_a.make_ideas_matter.v1",
    semanticHypothesisId: "scene_a.compound_anchor",
    treatmentGenomeArtifactId: "treatment_a",
    planningBundleArtifactId: "planning_a",
    visualRealizationId: "realization_a",
  },
  typography: {
    roles: [
      {
        role: "hero",
        tokenIds: ["token_1_ideas", "token_2_matter"],
        font: {
          assetId: "font_hero",
          family: "Almera",
          sha256: "b".repeat(64),
          status: "verified",
        },
      },
      {
        role: "support",
        tokenIds: ["token_0_make"],
        font: {
          assetId: "font_support",
          family: "Almera",
          sha256: "b".repeat(64),
          status: "verified",
        },
      },
    ],
    lineBreaks: [["MAKE"], ["IDEAS", "MATTER"]],
    shapedBoundsPx: {left: 720, top: 270, width: 280, height: 420},
  },
  placement: {
    box: {x: 0.66, y: 0.14, width: 0.29, height: 0.3},
    depthMode: "integrated",
    sceneEvidenceIds: ["alpha:440b5718"],
  },
  treatment: {
    family: "premium_direct_response",
    primitives: ["solid_fill", "editorial_lockup"],
    colors: ["#ffffff", "#f6c453"],
  },
  motion: {
    family: "static_editorial_hold",
    trajectorySamples: [
      {outputMs: 1000, x: 0.66, y: 0.14},
      {outputMs: 3000, x: 0.66, y: 0.14},
    ],
  },
  sourceTransform: {mode: "bottom_center_fit", x: 0, y: 0.001, scale: 2.88},
  requiredObservations: [
    "font_geometry",
    "line_breaks",
    "text_bounds",
    "placement",
    "subject_intersection",
    "treatment_visibility",
    "motion_trajectory",
  ],
  presentationFields: [
    "typography.hero.font",
    "typography.support.font",
    "typography.lineBreaks",
    "placement.box",
    "placement.depthMode",
    "treatment.primitives",
    "motion.trajectory",
  ],
  capabilityVerification: [
    {
      capabilityId: "maul_font_registry",
      status: "verified",
      supports: ["typography.hero.font", "typography.support.font"],
      evidenceIds: ["font_asset_hashes"],
    },
    {
      capabilityId: "maul_planned_text_layer",
      status: "verified",
      supports: ["typography.lineBreaks", "placement.box", "placement.depthMode"],
      evidenceIds: ["planned_text_contract_test"],
    },
    {
      capabilityId: "maul_treatment_adapter",
      status: "verified",
      supports: ["treatment.primitives"],
      evidenceIds: ["treatment_contract_test"],
    },
    {
      capabilityId: "maul_text_animation",
      status: "verified",
      supports: ["motion.trajectory"],
      evidenceIds: ["animation_contract_test"],
    },
  ],
  fallbacks: [],
  versions: {
    declaration: "maul-declared-composition/v1",
    renderer: "MaulShort/v1",
    observer: "maul-composition-observer/v1",
    policy: "maul-composition-experiment/v1",
  },
});

describe("Declared Composition contracts", () => {
  it("freezes complete causal intent with a deterministic hash", () => {
    const first = freezeDeclaredComposition(validInput());
    const second = freezeDeclaredComposition(validInput());

    expect(first.declarationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.declarationSha256).toBe(second.declarationSha256);
    expect(first.causalLineage).toMatchObject({
      semanticTreeId: "scene_a.make_ideas_matter.v1",
      semanticHypothesisId: "scene_a.compound_anchor",
      treatmentGenomeArtifactId: "treatment_a",
      planningBundleArtifactId: "planning_a",
      visualRealizationId: "realization_a",
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.typography)).toBe(true);
  });

  it("rejects unverified fonts, unsupported adapters, and silent fallbacks", () => {
    const unverifiedFont = validInput();
    unverifiedFont.typography.roles[0]!.font.status = "unverified";
    expect(() => freezeDeclaredComposition(unverifiedFont)).toThrow(/font.*verified/i);

    const unsupported = validInput();
    unsupported.capabilityVerification[1]!.status = "blocked";
    expect(() => freezeDeclaredComposition(unsupported)).toThrow(/capability.*blocked/i);

    const fallback = validInput();
    fallback.fallbacks.push({
      trigger: "missing_adapter",
      substitutedBehavior: "generic_bottom_caption",
      affectedField: "placement.box",
      verified: false,
    });
    expect(() => freezeDeclaredComposition(fallback)).toThrow(/unverified fallback/i);
  });

  it("rejects missing scene evidence and presentation fields with no capability mapping", () => {
    const missingSceneEvidence = validInput();
    missingSceneEvidence.placement.sceneEvidenceIds = [];
    expect(() => freezeDeclaredComposition(missingSceneEvidence)).toThrow(/scene evidence/i);

    const unmapped = validInput();
    unmapped.presentationFields.push("treatment.gradientStops");
    expect(() => freezeDeclaredComposition(unmapped)).toThrow(/no verified capability maps.*gradientStops/i);
  });
});

import {describe, expect, it} from "vitest";

import {
  buildSceneAOutputSubjectMask,
  buildSceneADeclaredComposition,
  buildSceneAExperimentDefinition,
  buildSceneAPlanningReceipt,
  buildSceneARepairLedger,
  selectSceneAExperimentFontPair,
} from "./composition-experiment-scene-a.js";
import {loadHydratedMaulFontAssets} from "./zilliz-font-assets.js";

const planningReceipt = (condition: "baseline" | "repair") => ({
  planningBundleArtifactId: `planning_${condition}`,
  treatmentGenomeArtifactId: "treatment_scene_a",
  visualRealizationId: `planning_${condition}:variant_1:script_tag_overlap:animation_1`,
  placement: {
    box: {x: 0.66, y: 0.14, width: 0.29, height: 0.3},
    depthMode: "front" as const,
    sceneEvidenceIds: ["alpha:440b5718"],
  },
  materializedTokens: [
    {tokenId: "token_make", text: "MAKE"},
    {tokenId: "token_ideas", text: "IDEAS"},
    {tokenId: "token_matter", text: "MATTER"},
  ],
  lines: [{tokenIds: ["token_make", "token_ideas", "token_matter"]}],
  tokenStyles: condition === "baseline"
    ? [
        {tokenId: "token_make", role: "primary" as const, fontAssetId: "font_almera_baa51ed42a1d"},
        {tokenId: "token_ideas", role: "accent" as const, fontAssetId: "font_leviathan-italic_ac864336242c"},
        {tokenId: "token_matter", role: "primary" as const, fontAssetId: "font_almera_baa51ed42a1d"},
      ]
    : [
        {tokenId: "token_make", role: "primary" as const, fontAssetId: "font_almera_baa51ed42a1d"},
        {tokenId: "token_ideas", role: "primary" as const, fontAssetId: "font_almera_baa51ed42a1d"},
        {tokenId: "token_matter", role: "accent" as const, fontAssetId: "font_leviathan-italic_ac864336242c"},
      ],
  animationTreatment: "three_word_ref_script_tag",
});

describe("Scene A Composition Experiment adapter", () => {
  it("adapts persisted planning artifacts without inventing realization fields", () => {
    const receipt = buildSceneAPlanningReceipt({
      planningBundleArtifactId: "planning_baseline",
      treatmentGenomeArtifactId: "treatment_scene_a",
      sceneEvidenceIds: ["alpha:440b5718"],
      textChunkPlan: {
        tokens: [
          {tokenId: "token_make", text: "MAKE"},
          {tokenId: "token_ideas", text: "IDEAS"},
          {tokenId: "token_matter", text: "MATTER"},
        ],
      },
      textPlacementPlan: {
        segments: [{
          segmentId: "segment_1",
          variantId: "variant_1",
          box: {x: 0.66, y: 0.14, width: 0.29, height: 0.3},
          depth: {resolved: "front"},
          lines: [{tokenIds: ["token_make", "token_ideas", "token_matter"]}],
          editorialLockup: {
            mode: "script_tag_overlap",
            tokenStyles: planningReceipt("baseline").tokenStyles,
          },
        }],
      },
      textAnimationPlan: {
        programs: [{
          animationId: "animation_1",
          treatment: "three_word_ref_script_tag",
          target: {placementSegmentId: "segment_1"},
        }],
      },
    });

    expect(receipt).toEqual(planningReceipt("baseline"));
  });

  it("derives the output subject mask from immutable source alpha pixels", async () => {
    const mask = await buildSceneAOutputSubjectMask({
      repoRoot: new URL("../../..", import.meta.url).pathname,
    });

    expect(mask).toMatchObject({
      width: 1080,
      height: 1920,
      sourceAlphaSha256: "440b5718f9d14c6ccbaca39ba4053215bd1ce771427bfd5bbb7e22a83acec796",
      sourceOccupancyRatio: 0.721325,
    });
    expect(mask.alpha).toHaveLength(1080 * 1920);
    expect(mask.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds competing semantic hypotheses and exact hydrated editorial fonts", () => {
    const definition = buildSceneAExperimentDefinition();
    const fonts = selectSceneAExperimentFontPair(loadHydratedMaulFontAssets());

    expect(definition.fixture.fixtureId).toBe("scene_a_matted_lady_hierarchy_v1");
    expect(definition.baseline.hypothesisId).toBe("scene_a.compound_anchor");
    expect(definition.baseline.chunk.proposal.chunks[0]?.emphasisWordIndices).toEqual([1, 2]);
    expect(definition.baseline.chunk.planBinding.rolesByWordIndex).toEqual({
      0: "support",
      1: "hero",
      2: "hero",
    });
    expect(definition.repair.hypothesisId).toBe("scene_a.semantic_anchor");
    expect(definition.repair.chunk.proposal.chunks[0]?.emphasisWordIndices).toEqual([2]);
    expect(fonts.primary).toMatchObject({
      assetId: "font_almera_baa51ed42a1d",
      family: "Almera",
      localFileSha256: "baa51ed42a1dce413bf70f5364d1e9929eacdb6cf1e0a61b487d0212d61c1656",
    });
    expect(fonts.accent).toMatchObject({
      assetId: "font_leviathan-italic_ac864336242c",
      family: "Leviathan Italic",
      style: "italic",
      localFileSha256: "ac864336242cfb3e6bff05ff166d72c9ccbe5a6da6bef208f4a16ab47ef8274d",
    });
  });

  it("freezes declarations and a dependency-closed repair from planning receipts", () => {
    const definition = buildSceneAExperimentDefinition();
    const fonts = selectSceneAExperimentFontPair(loadHydratedMaulFontAssets());
    const baseline = buildSceneADeclaredComposition({
      condition: "baseline",
      definition,
      selection: definition.baseline.selection,
      planning: planningReceipt("baseline"),
      fonts,
    });
    const repair = buildSceneADeclaredComposition({
      condition: "repair",
      definition,
      selection: definition.repair.selection,
      planning: planningReceipt("repair"),
      fonts,
      parentDeclarationId: baseline.declarationId,
    });
    const ledger = buildSceneARepairLedger({baseline, repair, seed: definition.seed});

    expect(baseline.causalLineage.semanticHypothesisId).toBe("scene_a.compound_anchor");
    expect(repair.causalLineage.semanticHypothesisId).toBe("scene_a.semantic_anchor");
    expect(baseline.causalLineage.treatmentGenomeArtifactId).toBe(
      repair.causalLineage.treatmentGenomeArtifactId,
    );
    expect(baseline.typography.roles.find((role) => role.tokenIds.includes("token_ideas"))?.font.assetId).toBe(
      "font_leviathan-italic_ac864336242c",
    );
    expect(repair.typography.roles.find((role) => role.tokenIds.includes("token_matter"))?.font.assetId).toBe(
      "font_leviathan-italic_ac864336242c",
    );
    expect(ledger.targetDimension).toBe("semanticHierarchy");
    expect(ledger.changedDimensions).toEqual(expect.arrayContaining([
      "semanticHierarchy",
      "fontRoleAssignment",
      "declaration",
    ]));
    expect(ledger.frozenDimensions).toEqual(expect.arrayContaining([
      "sourceTransform",
      "sceneEvidence",
      "treatmentFamily",
      "palette",
      "motionFamily",
      "renderer",
      "seed",
      "budget",
    ]));
  });
});

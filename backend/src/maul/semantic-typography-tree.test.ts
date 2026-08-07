import {describe, expect, it} from "vitest";

import {
  buildCompositionExperimentSemanticTypographyTree,
  buildSemanticTypographyTree,
  selectSemanticTypographyHypothesis,
  semanticTypographySelectionToChunkProposal,
} from "./semantic-typography-tree.js";

describe("Semantic Typography Tree", () => {
  it("preserves competing narrow and compound anchors for Scene A", () => {
    const tree = buildCompositionExperimentSemanticTypographyTree(
      "scene_a_matted_lady_hierarchy_v1",
    );

    expect(tree.phrase).toBe("MAKE IDEAS MATTER");
    expect(tree.hypotheses.length).toBeGreaterThanOrEqual(2);
    expect(tree.selectedHypothesisId).toBeNull();
    expect(tree.hypotheses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        hypothesisId: "scene_a.semantic_anchor",
        confidence: expect.any(Number),
        groups: [expect.objectContaining({role: "hero", tokenIds: ["token_2_matter"]})],
      }),
      expect.objectContaining({
        hypothesisId: "scene_a.compound_anchor",
        groups: [expect.objectContaining({
          role: "hero",
          tokenIds: ["token_1_ideas", "token_2_matter"],
        })],
      }),
    ]));
    expect(tree.tokens.every((token) => token.evidence.length > 0)).toBe(true);
  });

  it("preserves AUTHORITY and LASTING AUTHORITY alternatives for held-out Scene B", () => {
    const tree = buildCompositionExperimentSemanticTypographyTree(
      "scene_b_joseph_open_field_v1",
    );

    expect(tree.phrase).toBe("BUILD LASTING AUTHORITY");
    expect(tree.hypotheses.map((hypothesis) => hypothesis.groups)).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({role: "hero", tokenIds: ["token_2_authority"]})],
        [expect.objectContaining({
          role: "hero",
          tokenIds: ["token_1_lasting", "token_2_authority"],
        })],
      ]),
    );
  });

  it("selects hierarchy from explicit semantic evidence, not final-token position", () => {
    const tree = buildSemanticTypographyTree({
      treeId: "middle_anchor",
      phrase: "MOVE NOW GENTLY",
      tokenEvidence: [
        {tokenIndex: 0, rhetoricalRole: "action", semanticImportance: 0.4},
        {tokenIndex: 1, rhetoricalRole: "urgency_anchor", semanticImportance: 0.95},
        {tokenIndex: 2, rhetoricalRole: "delivery_modifier", semanticImportance: 0.2},
      ],
      hypotheses: [
        {
          hypothesisId: "middle_anchor.now",
          confidence: 0.92,
          rationale: "NOW carries the source-provided urgency anchor.",
          groups: [{role: "hero", tokenIndices: [1]}],
        },
      ],
      provenance: ["test_explicit_semantic_evidence"],
    });
    const selection = selectSemanticTypographyHypothesis({
      tree,
      hypothesisId: "middle_anchor.now",
      selectedBy: "fixture_test",
    });

    expect(selection.rolesByTokenId).toMatchObject({
      token_0_move: "support",
      token_1_now: "hero",
      token_2_gently: "support",
    });
    expect(selection.rolesByTokenId.token_2_gently).not.toBe("hero");
  });

  it("adapts a selected hypothesis to the governed chunk proposal with causal IDs", () => {
    const tree = buildCompositionExperimentSemanticTypographyTree(
      "scene_a_matted_lady_hierarchy_v1",
    );
    const selection = selectSemanticTypographyHypothesis({
      tree,
      hypothesisId: "scene_a.semantic_anchor",
      selectedBy: "composition_experiment_runner/v1",
    });
    const adapter = semanticTypographySelectionToChunkProposal({selection});

    expect(adapter.proposal).toEqual({
      schemaVersion: "maul-shorts-text-chunk-proposal/v1",
      chunks: [{
        startWordIndex: 0,
        endWordIndex: 2,
        semanticRole: "hook",
        emphasisWordIndices: [2],
        emphasisLevel: "hero",
      }],
    });
    expect(adapter.causalMetadata).toMatchObject({
      treeId: tree.treeId,
      hypothesisId: "scene_a.semantic_anchor",
      heroTokenIds: ["token_2_matter"],
    });
  });
});

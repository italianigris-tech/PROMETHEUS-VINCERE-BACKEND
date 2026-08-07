import {createHash} from "node:crypto";

import {z} from "zod";

import {
  shortsTextChunkProposalSchema,
  type ShortsTextChunkProposal,
} from "./shorts-text-chunking.js";

const roleSchema = z.enum(["hero", "support", "accent", "tail"]);
export type SemanticTypographyRole = z.infer<typeof roleSchema>;

const semanticTypographyTreeSchema = z.object({
  schemaVersion: z.literal("maul-semantic-typography-tree/v1"),
  treeId: z.string().min(1),
  phrase: z.string().min(1),
  phraseSha256: z.string().regex(/^[a-f0-9]{64}$/),
  selectedHypothesisId: z.null(),
  provenance: z.array(z.string().min(1)).min(1),
  tokens: z.array(z.object({
    tokenId: z.string().min(1),
    index: z.number().int().nonnegative(),
    text: z.string().min(1),
    sourceSpan: z.object({start: z.number().int().nonnegative(), end: z.number().int().positive()}),
    evidence: z.array(z.object({
      kind: z.literal("semantic_salience"),
      rhetoricalRole: z.string().min(1),
      semanticImportance: z.number().min(0).max(1),
      sourceId: z.string().min(1),
    })).min(1),
  })).min(1),
  hypotheses: z.array(z.object({
    hypothesisId: z.string().min(1),
    confidence: z.number().min(0).max(1),
    rationale: z.string().min(1),
    groups: z.array(z.object({
      role: roleSchema,
      tokenIds: z.array(z.string().min(1)).min(1),
    })).min(1),
  })).min(1),
}).strict().superRefine((tree, context) => {
  const tokenIds = new Set(tree.tokens.map((token) => token.tokenId));
  const hypothesisIds = tree.hypotheses.map((hypothesis) => hypothesis.hypothesisId);
  if (new Set(hypothesisIds).size !== hypothesisIds.length) {
    context.addIssue({code: "custom", path: ["hypotheses"], message: "Hypothesis IDs must be unique."});
  }
  tree.hypotheses.forEach((hypothesis, hypothesisIndex) => {
    hypothesis.groups.forEach((group, groupIndex) => {
      if (group.tokenIds.some((tokenId) => !tokenIds.has(tokenId))) {
        context.addIssue({
          code: "custom",
          path: ["hypotheses", hypothesisIndex, "groups", groupIndex, "tokenIds"],
          message: "Semantic hierarchy group references an unknown token.",
        });
      }
    });
  });
});

export type SemanticTypographyTree = z.infer<typeof semanticTypographyTreeSchema>;

export type SemanticTypographySelection = {
  schemaVersion: "maul-semantic-typography-selection/v1";
  tree: SemanticTypographyTree;
  hypothesisId: string;
  selectedBy: string;
  rolesByTokenId: Record<string, SemanticTypographyRole>;
};

type BuildTreeInput = {
  treeId: string;
  phrase: string;
  tokenEvidence: Array<{
    tokenIndex: number;
    rhetoricalRole: string;
    semanticImportance: number;
    sourceId?: string;
  }>;
  hypotheses: Array<{
    hypothesisId: string;
    confidence: number;
    rationale: string;
    groups: Array<{role: SemanticTypographyRole; tokenIndices: number[]}>;
  }>;
  provenance: string[];
};

const tokenIdFor = (text: string, index: number): string => {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "token";
  return `token_${index}_${slug}`;
};

export const buildSemanticTypographyTree = ({
  treeId,
  phrase,
  tokenEvidence,
  hypotheses,
  provenance,
}: BuildTreeInput): SemanticTypographyTree => {
  const matches = [...phrase.matchAll(/\S+/g)];
  if (matches.length !== tokenEvidence.length) {
    throw new Error(
      `Semantic Typography Tree received ${tokenEvidence.length} evidence records for ${matches.length} tokens.`,
    );
  }
  const evidenceByIndex = new Map(tokenEvidence.map((evidence) => [evidence.tokenIndex, evidence]));
  const tokens = matches.map((match, index) => {
    const evidence = evidenceByIndex.get(index);
    if (!evidence) {
      throw new Error(`Semantic Typography Tree lacks evidence for token ${index}.`);
    }
    const text = match[0];
    const start = match.index;
    return {
      tokenId: tokenIdFor(text, index),
      index,
      text,
      sourceSpan: {start, end: start + text.length},
      evidence: [{
        kind: "semantic_salience" as const,
        rhetoricalRole: evidence.rhetoricalRole,
        semanticImportance: evidence.semanticImportance,
        sourceId: evidence.sourceId ?? provenance[0]!,
      }],
    };
  });
  const tokenIds = tokens.map((token) => token.tokenId);
  return semanticTypographyTreeSchema.parse({
    schemaVersion: "maul-semantic-typography-tree/v1",
    treeId,
    phrase,
    phraseSha256: createHash("sha256").update(phrase).digest("hex"),
    selectedHypothesisId: null,
    provenance,
    tokens,
    hypotheses: hypotheses.map((hypothesis) => ({
      hypothesisId: hypothesis.hypothesisId,
      confidence: hypothesis.confidence,
      rationale: hypothesis.rationale,
      groups: hypothesis.groups.map((group) => ({
        role: group.role,
        tokenIds: group.tokenIndices.map((tokenIndex) => {
          const tokenId = tokenIds[tokenIndex];
          if (!tokenId) {
            throw new Error(
              `Semantic hierarchy hypothesis ${hypothesis.hypothesisId} references token ${tokenIndex}.`,
            );
          }
          return tokenId;
        }),
      })),
    })),
  });
};

const experimentTrees = {
  scene_a_matted_lady_hierarchy_v1: (): SemanticTypographyTree =>
    buildSemanticTypographyTree({
      treeId: "scene_a.make_ideas_matter.v1",
      phrase: "MAKE IDEAS MATTER",
      tokenEvidence: [
        {tokenIndex: 0, rhetoricalRole: "action_support", semanticImportance: 0.42},
        {tokenIndex: 1, rhetoricalRole: "concept_object", semanticImportance: 0.68},
        {tokenIndex: 2, rhetoricalRole: "abstract_result_anchor", semanticImportance: 0.94},
      ],
      hypotheses: [
        {
          hypothesisId: "scene_a.semantic_anchor",
          confidence: 0.88,
          rationale: "MATTER carries the result and strongest semantic consequence.",
          groups: [{role: "hero", tokenIndices: [2]}],
        },
        {
          hypothesisId: "scene_a.compound_anchor",
          confidence: 0.67,
          rationale: "IDEAS MATTER can act as a compound conceptual anchor.",
          groups: [{role: "hero", tokenIndices: [1, 2]}],
        },
      ],
      provenance: ["reference_observations_123923_123954_124054", "fixture_phrase_analysis/v1"],
    }),
  scene_b_joseph_open_field_v1: (): SemanticTypographyTree =>
    buildSemanticTypographyTree({
      treeId: "scene_b.build_lasting_authority.v1",
      phrase: "BUILD LASTING AUTHORITY",
      tokenEvidence: [
        {tokenIndex: 0, rhetoricalRole: "action_support", semanticImportance: 0.4},
        {tokenIndex: 1, rhetoricalRole: "duration_modifier", semanticImportance: 0.62},
        {tokenIndex: 2, rhetoricalRole: "abstract_result_anchor", semanticImportance: 0.95},
      ],
      hypotheses: [
        {
          hypothesisId: "scene_b.semantic_anchor",
          confidence: 0.9,
          rationale: "AUTHORITY carries the result and strongest semantic consequence.",
          groups: [{role: "hero", tokenIndices: [2]}],
        },
        {
          hypothesisId: "scene_b.compound_anchor",
          confidence: 0.7,
          rationale: "LASTING AUTHORITY can act as a compound outcome anchor.",
          groups: [{role: "hero", tokenIndices: [1, 2]}],
        },
      ],
      provenance: ["held_out_fixture_phrase_analysis/v1"],
    }),
} as const;

export const buildCompositionExperimentSemanticTypographyTree = (
  fixtureId: keyof typeof experimentTrees,
): SemanticTypographyTree => experimentTrees[fixtureId]();

const rolePriority: Record<SemanticTypographyRole, number> = {
  support: 0,
  tail: 1,
  accent: 2,
  hero: 3,
};

export const selectSemanticTypographyHypothesis = ({
  tree: inputTree,
  hypothesisId,
  selectedBy,
}: {
  tree: SemanticTypographyTree;
  hypothesisId: string;
  selectedBy: string;
}): SemanticTypographySelection => {
  const tree = semanticTypographyTreeSchema.parse(inputTree);
  const hypothesis = tree.hypotheses.find((candidate) => candidate.hypothesisId === hypothesisId);
  if (!hypothesis) {
    throw new Error(`Semantic Typography Tree ${tree.treeId} has no hypothesis ${hypothesisId}.`);
  }
  const rolesByTokenId = Object.fromEntries(
    tree.tokens.map((token) => [token.tokenId, "support" as SemanticTypographyRole]),
  );
  for (const group of hypothesis.groups) {
    for (const tokenId of group.tokenIds) {
      if (rolePriority[group.role] >= rolePriority[rolesByTokenId[tokenId] ?? "support"]) {
        rolesByTokenId[tokenId] = group.role;
      }
    }
  }
  return {
    schemaVersion: "maul-semantic-typography-selection/v1",
    tree,
    hypothesisId,
    selectedBy,
    rolesByTokenId,
  };
};

export const semanticTypographySelectionToChunkProposal = ({
  selection,
}: {
  selection: SemanticTypographySelection;
}): {
  proposal: ShortsTextChunkProposal;
  causalMetadata: {
    treeId: string;
    hypothesisId: string;
    heroTokenIds: string[];
    selectedBy: string;
  };
} => {
  const emphasizedTokens = selection.tree.tokens.filter((token) => {
    const role = selection.rolesByTokenId[token.tokenId];
    return role === "hero" || role === "accent";
  });
  if (emphasizedTokens.length === 0) {
    throw new Error(`Semantic hypothesis ${selection.hypothesisId} has no hero or accent tokens.`);
  }
  return {
    proposal: shortsTextChunkProposalSchema.parse({
      schemaVersion: "maul-shorts-text-chunk-proposal/v1",
      chunks: [{
        startWordIndex: 0,
        endWordIndex: selection.tree.tokens.length - 1,
        semanticRole: "hook",
        emphasisWordIndices: emphasizedTokens.map((token) => token.index),
        emphasisLevel: "hero",
      }],
    }),
    causalMetadata: {
      treeId: selection.tree.treeId,
      hypothesisId: selection.hypothesisId,
      heroTokenIds: emphasizedTokens.map((token) => token.tokenId),
      selectedBy: selection.selectedBy,
    },
  };
};

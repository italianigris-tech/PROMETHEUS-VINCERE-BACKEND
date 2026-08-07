import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import * as path from "node:path";

import type {MaulResolvedFontAsset} from "@prometheus/shared-types";

import {
  COMPOSITION_EXPERIMENT_FIXTURES,
} from "./composition-experiment-fixtures.js";
import {
  freezeDeclaredComposition,
  type DeclaredComposition,
} from "./composition-experiment-contracts.js";
import {
  buildCompositionExperimentSemanticTypographyTree,
  selectSemanticTypographyHypothesis,
  semanticTypographySelectionToChunkProposal,
  type SemanticTypographySelection,
} from "./semantic-typography-tree.js";
import {
  createCompositionRepairLedgerEntry,
  type CompositionRepairLedgerEntry,
} from "./composition-repair.js";
import {decodeRgbaPng} from "./png-rgba.js";

const SCENE_A_ALPHA_SHA256 = "440b5718f9d14c6ccbaca39ba4053215bd1ce771427bfd5bbb7e22a83acec796";
const PRIMARY_FONT_ASSET_ID = "font_almera_baa51ed42a1d";
const ACCENT_FONT_ASSET_ID = "font_leviathan-italic_ac864336242c";

export const buildSceneAOutputSubjectMask = async ({
  repoRoot,
}: {
  repoRoot: string;
}) => {
  const fixture = COMPOSITION_EXPERIMENT_FIXTURES.sceneA;
  const decoded = decodeRgbaPng(
    await readFile(path.join(repoRoot, fixture.sourceRelativePath)),
  );
  if (
    decoded.width !== fixture.sourceGeometry.width ||
    decoded.height !== fixture.sourceGeometry.height
  ) {
    throw new Error("Scene A source geometry changed before alpha-mask scaling.");
  }
  const sourceAlpha = Buffer.alloc(decoded.width * decoded.height);
  let occupied = 0;
  for (let index = 0; index < sourceAlpha.length; index += 1) {
    const alpha = decoded.pixels[index * 4 + 3]!;
    sourceAlpha[index] = alpha;
    if (alpha > 8) occupied += 1;
  }
  const sourceAlphaSha256 = createHash("sha256").update(sourceAlpha).digest("hex");
  if (sourceAlphaSha256 !== SCENE_A_ALPHA_SHA256) {
    throw new Error("Scene A source alpha hash changed before observer preparation.");
  }
  const {width, height} = fixture.output;
  const alpha = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(decoded.height - 1, Math.floor(y * decoded.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(decoded.width - 1, Math.floor(x * decoded.width / width));
      alpha[y * width + x] = sourceAlpha[sourceY * decoded.width + sourceX]!;
    }
  }
  return {
    width,
    height,
    alpha,
    sha256: createHash("sha256").update(alpha).digest("hex"),
    sourceAlphaSha256,
    sourceOccupancyRatio: Number((occupied / sourceAlpha.length).toFixed(6)),
  };
};

export type SceneAExperimentFontPair = {
  primary: MaulResolvedFontAsset;
  accent: MaulResolvedFontAsset;
};

export type SceneAPlanningReceipt = {
  planningBundleArtifactId: string;
  treatmentGenomeArtifactId: string;
  visualRealizationId: string;
  placement: {
    box: {x: number; y: number; width: number; height: number};
    depthMode: "front" | "behind_subject" | "integrated" | "avoid_subject";
    sceneEvidenceIds: string[];
  };
  materializedTokens: Array<{tokenId: string; text: string}>;
  lines: Array<{tokenIds: string[]}>;
  tokenStyles: Array<{
    tokenId: string;
    role: "primary" | "accent";
    fontAssetId: string;
  }>;
  animationTreatment: string;
};

export const buildSceneAPlanningReceipt = ({
  planningBundleArtifactId,
  treatmentGenomeArtifactId,
  sceneEvidenceIds,
  textChunkPlan,
  textPlacementPlan,
  textAnimationPlan,
}: {
  planningBundleArtifactId: string;
  treatmentGenomeArtifactId: string;
  sceneEvidenceIds: string[];
  textChunkPlan: {
    tokens: Array<{tokenId: string; text: string}>;
  };
  textPlacementPlan: {
    segments: Array<{
      segmentId: string;
      variantId: string;
      box: {x: number; y: number; width: number; height: number};
      depth: {resolved: "front" | "front_fallback" | "behind_subject"};
      lines: Array<{tokenIds: string[]}>;
      editorialLockup?: {
        mode: string;
        tokenStyles: Array<{
          tokenId: string;
          role: "primary" | "accent";
          fontAssetId: string;
        }>;
      };
    }>;
  };
  textAnimationPlan: {
    programs: Array<{
      animationId: string;
      treatment: string;
      target: {placementSegmentId: string};
    }>;
  };
}): SceneAPlanningReceipt => {
  if (textPlacementPlan.segments.length !== 1) {
    throw new Error("Scene A requires exactly one renderer-facing placement segment.");
  }
  const segment = textPlacementPlan.segments[0]!;
  const lockup = segment.editorialLockup;
  if (!lockup) throw new Error("Scene A placement segment lacks its editorial lockup.");
  const animation = textAnimationPlan.programs.find(
    (program) => program.target.placementSegmentId === segment.segmentId,
  );
  if (!animation) throw new Error("Scene A placement segment lacks its text animation program.");
  return {
    planningBundleArtifactId,
    treatmentGenomeArtifactId,
    visualRealizationId: [
      planningBundleArtifactId,
      segment.variantId,
      lockup.mode,
      animation.animationId,
    ].join(":"),
    placement: {
      box: segment.box,
      depthMode: segment.depth.resolved === "behind_subject" ? "behind_subject" : "front",
      sceneEvidenceIds,
    },
    materializedTokens: textChunkPlan.tokens,
    lines: segment.lines,
    tokenStyles: lockup.tokenStyles,
    animationTreatment: animation.treatment,
  };
};

export const buildSceneAExperimentDefinition = () => {
  const fixture = COMPOSITION_EXPERIMENT_FIXTURES.sceneA;
  const tree = buildCompositionExperimentSemanticTypographyTree(fixture.fixtureId);
  const baselineSelection = selectSemanticTypographyHypothesis({
    tree,
    hypothesisId: "scene_a.compound_anchor",
    selectedBy: "maul-composition-experiment/baseline",
  });
  const repairSelection = selectSemanticTypographyHypothesis({
    tree,
    hypothesisId: "scene_a.semantic_anchor",
    selectedBy: "maul-composition-experiment/dependency-closed-repair",
  });
  return {
    fixture,
    tree,
    seed: "scene_a_causal_hierarchy_seed_v1",
    baseline: {
      hypothesisId: baselineSelection.hypothesisId,
      selection: baselineSelection,
      chunk: semanticTypographySelectionToChunkProposal({selection: baselineSelection}),
    },
    repair: {
      hypothesisId: repairSelection.hypothesisId,
      selection: repairSelection,
      chunk: semanticTypographySelectionToChunkProposal({selection: repairSelection}),
    },
  };
};

export type SceneAExperimentDefinition = ReturnType<typeof buildSceneAExperimentDefinition>;

export const selectSceneAExperimentFontPair = (
  assets: readonly MaulResolvedFontAsset[],
): SceneAExperimentFontPair => {
  const primary = assets.find((asset) => asset.assetId === PRIMARY_FONT_ASSET_ID);
  const accent = assets.find((asset) => asset.assetId === ACCENT_FONT_ASSET_ID);
  if (!primary || !accent) {
    throw new Error(
      "Scene A requires exact license-cleared Almera and Leviathan Italic renderer assets.",
    );
  }
  if (primary.license.status !== "cleared" || accent.license.status !== "cleared") {
    throw new Error("Scene A font assets must carry cleared license evidence.");
  }
  return {primary, accent};
};

const fontReceipt = (asset: MaulResolvedFontAsset) => ({
  assetId: asset.assetId,
  family: asset.family,
  sha256: asset.localFileSha256,
  status: "verified" as const,
});

const semanticRoleForMaterializedToken = ({
  selection,
  planning,
  tokenId,
}: {
  selection: SemanticTypographySelection;
  planning: SceneAPlanningReceipt;
  tokenId: string;
}) => {
  const wordIndex = planning.materializedTokens.findIndex((token) => token.tokenId === tokenId);
  const semanticToken = selection.tree.tokens[wordIndex];
  if (wordIndex < 0 || !semanticToken) {
    throw new Error(`Scene A planning receipt contains unknown materialized token ${tokenId}.`);
  }
  return selection.rolesByTokenId[semanticToken.tokenId] ?? "support";
};

export const buildSceneADeclaredComposition = ({
  condition,
  definition,
  selection,
  planning,
  fonts,
  parentDeclarationId = null,
}: {
  condition: "baseline" | "repair";
  definition: SceneAExperimentDefinition;
  selection: SemanticTypographySelection;
  planning: SceneAPlanningReceipt;
  fonts: SceneAExperimentFontPair;
  parentDeclarationId?: string | null;
}): DeclaredComposition => {
  if (planning.materializedTokens.length !== selection.tree.tokens.length) {
    throw new Error("Scene A materialized token count does not match the Semantic Typography Tree.");
  }
  const fontByAssetId = new Map([
    [fonts.primary.assetId, fonts.primary],
    [fonts.accent.assetId, fonts.accent],
  ]);
  const typographyRoles = planning.tokenStyles.map((style) => {
    const asset = fontByAssetId.get(style.fontAssetId);
    if (!asset) {
      throw new Error(`Scene A lockup references unverified font asset ${style.fontAssetId}.`);
    }
    return {
      role: semanticRoleForMaterializedToken({selection, planning, tokenId: style.tokenId}),
      tokenIds: [style.tokenId],
      font: fontReceipt(asset),
    };
  });
  const {box} = planning.placement;
  const output = definition.fixture.output;
  const textByTokenId = new Map(
    planning.materializedTokens.map((token) => [token.tokenId, token.text]),
  );
  const lineBreaks = planning.lines.map((line) => line.tokenIds.map((tokenId) => {
    const text = textByTokenId.get(tokenId);
    if (!text) throw new Error(`Scene A line break references unknown token ${tokenId}.`);
    return text;
  }));
  return freezeDeclaredComposition({
    declarationId: `declared_scene_a_${condition}`,
    parentDeclarationId,
    fixtureId: definition.fixture.fixtureId,
    sourceGroup: definition.fixture.sourceGroup,
    sourceSha256: definition.fixture.sourceSha256,
    output,
    causalLineage: {
      fixtureEvidenceIds: [
        `source:${definition.fixture.sourceSha256}`,
        `alpha:${SCENE_A_ALPHA_SHA256}`,
      ],
      referenceObservationIds: [
        "yuan_reference_123923",
        "yuan_reference_123954",
        "yuan_reference_124054",
      ],
      semanticTreeId: selection.tree.treeId,
      semanticHypothesisId: selection.hypothesisId,
      treatmentGenomeArtifactId: planning.treatmentGenomeArtifactId,
      planningBundleArtifactId: planning.planningBundleArtifactId,
      visualRealizationId: planning.visualRealizationId,
    },
    typography: {
      roles: typographyRoles,
      lineBreaks,
      shapedBoundsPx: {
        left: box.x * output.width,
        top: box.y * output.height,
        width: box.width * output.width,
        height: box.height * output.height,
      },
    },
    placement: planning.placement,
    treatment: {
      family: "premium_direct_response",
      primitives: [
        "editorial_lockup",
        "controlled_overlap",
        planning.animationTreatment,
      ],
      colors: ["#ffffff", "#f6c453"],
    },
    motion: {
      family: planning.animationTreatment,
      trajectorySamples: [1000, 2000, 3000].map((outputMs) => ({
        outputMs,
        x: box.x,
        y: box.y,
      })),
    },
    sourceTransform: {
      mode: "immutable_rgba_matte_to_9x16_carrier",
      background: definition.fixture.carrierBackground,
      fit: "exact_1080x1920",
      alphaEvidenceSha256: SCENE_A_ALPHA_SHA256,
    },
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
        evidenceIds: [fonts.primary.localFileSha256, fonts.accent.localFileSha256],
      },
      {
        capabilityId: "maul_text_placement_plan",
        status: "verified",
        supports: ["placement.box", "placement.depthMode"],
        evidenceIds: [planning.planningBundleArtifactId],
      },
      {
        capabilityId: "maul_editorial_lockup",
        status: "verified",
        supports: ["treatment.primitives"],
        evidenceIds: [planning.visualRealizationId],
      },
      {
        capabilityId: "maul_text_animation",
        status: "verified",
        supports: ["motion.trajectory"],
        evidenceIds: [planning.animationTreatment],
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
};

const roleAssignment = (declaration: DeclaredComposition) =>
  declaration.typography.roles.map((role) => ({
    role: role.role,
    tokenIds: role.tokenIds,
    fontAssetId: role.font.assetId,
  }));

export const buildSceneARepairLedger = ({
  baseline,
  repair,
  seed,
}: {
  baseline: DeclaredComposition;
  repair: DeclaredComposition;
  seed: string;
}): CompositionRepairLedgerEntry => createCompositionRepairLedgerEntry({
  repairId: "scene_a_semantic_hierarchy_repair_v1",
  parentDeclarationId: baseline.declarationId,
  childDeclarationId: repair.declarationId,
  targetDimension: "semanticHierarchy",
  diagnosis: "The compound-anchor hypothesis weakens the intended result word; repair isolates MATTER as the semantic hero.",
  before: {
    semanticHierarchy: baseline.causalLineage.semanticHypothesisId,
    fontRoleAssignment: roleAssignment(baseline),
    shaping: baseline.typography.roles,
    lineBreaks: baseline.typography.lineBreaks,
    glyphBounds: baseline.typography.shapedBoundsPx,
    collision: baseline.placement.box,
    balance: baseline.placement.box,
    declaration: baseline.declarationSha256,
    sourceTransform: baseline.sourceTransform,
    sceneEvidence: baseline.placement.sceneEvidenceIds,
    treatmentFamily: baseline.treatment.family,
    palette: baseline.treatment.colors,
    motionFamily: baseline.motion.family,
    renderer: baseline.versions.renderer,
    seed,
    budget: {candidateCount: 2, renderCount: 2},
  },
  after: {
    semanticHierarchy: repair.causalLineage.semanticHypothesisId,
    fontRoleAssignment: roleAssignment(repair),
    shaping: repair.typography.roles,
    lineBreaks: repair.typography.lineBreaks,
    glyphBounds: repair.typography.shapedBoundsPx,
    collision: repair.placement.box,
    balance: repair.placement.box,
    declaration: repair.declarationSha256,
    sourceTransform: repair.sourceTransform,
    sceneEvidence: repair.placement.sceneEvidenceIds,
    treatmentFamily: repair.treatment.family,
    palette: repair.treatment.colors,
    motionFamily: repair.motion.family,
    renderer: repair.versions.renderer,
    seed,
    budget: {candidateCount: 2, renderCount: 2},
  },
});

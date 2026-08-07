import {createHash} from "node:crypto";

const categories = [
  "typography",
  "svg_treatment",
  "animation",
  "placement",
  "joseph_transfer",
  "scene",
  "font",
  "renderer",
  "policy",
  "prompt",
  "dataset",
  "reference",
  "fixture",
  "test",
] as const;

type CapabilityCategory = typeof categories[number];
type CapabilityDisposition = "selected" | "adapted" | "rejected" | "unavailable";

export type CompositionCapabilityCoverage = {
  schemaVersion: "maul-composition-capability-coverage/v1";
  fixtureId: string;
  generatedAt: string;
  entries: Array<{
    capabilityId: string;
    category: CapabilityCategory;
    owner: string;
    disposition: CapabilityDisposition;
    reason: string;
    evidence: string[];
  }>;
  duplicateAuthorities: string[];
  coverageSha256: string;
};

const entry = (
  capabilityId: string,
  category: CapabilityCategory,
  owner: string,
  disposition: CapabilityDisposition,
  reason: string,
  evidence: string[],
) => ({capabilityId, category, owner, disposition, reason, evidence});

export const buildCompositionExperimentCapabilityCoverage = ({
  fixtureId,
  generatedAt,
}: {
  fixtureId: string;
  generatedAt: string;
}): CompositionCapabilityCoverage => {
  const entries = [
    entry("semantic_typography_tree", "typography", "backend/src/maul/semantic-typography-tree.ts", "selected", "Preserves competing evidence-backed hierarchy hypotheses before layout.", ["semantic-typography-tree.test.ts"]),
    entry("svg_typography_programs", "svg_treatment", "remotion-app/src/lib/stylebooks/svg-typography-v1.ts", "adapted", "Existing SVG programs remain realization adapters behind the governed text layer.", ["MaulCinematicLaunchContract.test.tsx"]),
    entry("maul_text_animation", "animation", "remotion-app/src/compositions/MaulPlannedTextLayer.tsx", "selected", "Canonical planned text animation is retained for the selected manifest.", ["MaulPlannedTextLayer.test.tsx"]),
    entry("scene_evidence_provider", "placement", "backend/src/maul/scene-evidence.ts", "adapted", "Fixture evidence enters through the existing scene-to-placement seam.", ["scene-evidence.test.ts"]),
    entry("joseph_editorial_director", "joseph_transfer", "backend/src/maul/editorial-director.ts", "selected", "Joseph's existing direction and planning contracts are reused for the vertical slice.", ["maul-short-render-path.test.ts"]),
    entry("fixture_scene_evidence", "scene", "backend/src/maul/composition-experiment-fixtures.ts", "selected", "Immutable alpha and reviewed crop-map evidence are the scene authority for this experiment.", ["composition-experiment-fixtures.test.ts"]),
    entry("maul_font_registry", "font", "backend/src/maul/zilliz-font-assets.ts", "selected", "Font asset identity and local hashes remain governed by the existing registry.", ["zilliz-font-assets.test.ts"]),
    entry("canonical_maul_short_renderer", "renderer", "remotion-app/src/compositions/MaulShort.tsx", "selected", "All experiment pixels use the canonical MaulShort Remotion composition.", ["maul-short-render-path.test.ts"]),
    entry("composition_experiment_policy", "policy", "docs/superpowers/specs/2026-08-07-maul-reference-derived-composition-design.md", "selected", "The approved experiment spec governs fixtures, claims, and exclusions.", ["spec_definition_of_done"]),
    entry("llm_creative_planner", "prompt", "backend/src/maul/creative-treatment-planner.ts", "rejected", "Deterministic fixture hypotheses are required so the repair changes one dimension under a fixed seed.", ["composition-experiment-runner" ]),
    entry("yuan_reference_observations", "dataset", "docs/superpowers/specs/2026-08-07-maul-reference-derived-composition-design.md", "selected", "Three immutable reference observations seed hierarchy only; they are not outcome labels.", ["reference_hashes_in_spec"]),
    entry("reference_grammar_observations", "reference", "Yuan Prometheus Screenshots", "adapted", "Reference traits are abstracted into support/hero hypotheses without copying exact designs.", ["reference_hashes_in_spec"]),
    entry("scene_a_and_scene_b_fixtures", "fixture", "backend/src/maul/composition-experiment-fixtures.ts", "selected", "Exact source groups, hashes, transforms, and sidecar status are validated before planning.", ["composition-experiment-fixtures.test.ts"]),
    entry("test_matte_mp4", "fixture", "remotion-app/public/test-matte.mp4", "rejected", "Known static false matte has a quarantined hash and cannot provide moving scene evidence.", ["composition-experiment-fixtures.test.ts"]),
    entry("legacy_static_image_demo_proof", "test", "scripts/maul-static-image-placement-demo.ts", "rejected", "Legacy demo self-authors proof, flattens alpha, and fails when global FFmpeg is absent.", ["baseline_diagnosis_2026_08_07"]),
    entry("repository_media_tools", "test", "backend/src/maul/repository-media-tools.ts", "selected", "Render and fixture tools resolve from the repository before PATH.", ["repository-media-tools.test.ts"]),
  ];
  const duplicateAuthorities: string[] = [];
  for (const category of categories) {
    if (!entries.some((candidate) => candidate.category === category)) {
      throw new Error(`Capability coverage has no entry for category ${category}.`);
    }
  }
  const body = {schemaVersion: "maul-composition-capability-coverage/v1" as const, fixtureId, generatedAt, entries, duplicateAuthorities};
  return {
    ...body,
    coverageSha256: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };
};

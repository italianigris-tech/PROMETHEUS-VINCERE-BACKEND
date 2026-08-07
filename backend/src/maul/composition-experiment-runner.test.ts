import {createHash} from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type {MaulUnifiedShortRenderManifest} from "@prometheus/shared-types";
import {afterEach, describe, expect, it, vi} from "vitest";

import {buildCompositionExperimentCapabilityCoverage} from "./composition-capability-coverage.js";
import {
  freezeDeclaredComposition,
  type DeclaredCompositionInput,
} from "./composition-experiment-contracts.js";
import {runCompositionExperiment} from "./composition-experiment-runner.js";
import {createCompositionRepairLedgerEntry} from "./composition-repair.js";
import type {ObservedComposition} from "./composition-observer.js";
import type {
  MaulShortRenderEngineInput,
  MaulShortRenderEngineResult,
} from "./render-engine.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, {recursive: true, force: true}),
  ));
});

const sha256 = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const declarationInput = (
  kind: "baseline" | "repair",
): DeclaredCompositionInput => ({
  declarationId: `declared_scene_a_${kind}`,
  parentDeclarationId: kind === "baseline" ? null : "declared_scene_a_baseline",
  fixtureId: "scene_a_matted_lady_hierarchy_v1",
  sourceGroup: "matted_lady_static_5951e646",
  sourceSha256: "a".repeat(64),
  output: {width: 1080, height: 1920, fps: 30, durationMs: 4000},
  causalLineage: {
    fixtureEvidenceIds: ["alpha:440b5718"],
    referenceObservationIds: ["yuan_123923", "yuan_123954", "yuan_124054"],
    semanticTreeId: "scene_a.make_ideas_matter.v1",
    semanticHypothesisId: kind === "baseline"
      ? "scene_a.compound_anchor"
      : "scene_a.semantic_anchor",
    treatmentGenomeArtifactId: "treatment_a",
    planningBundleArtifactId: `planning_${kind}`,
    visualRealizationId: `realization_${kind}`,
  },
  typography: {
    roles: kind === "baseline"
      ? [
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
              family: "Almera Text",
              sha256: "c".repeat(64),
              status: "verified",
            },
          },
        ]
      : [
          {
            role: "hero",
            tokenIds: ["token_2_matter"],
            font: {
              assetId: "font_hero",
              family: "Almera",
              sha256: "b".repeat(64),
              status: "verified",
            },
          },
          {
            role: "support",
            tokenIds: ["token_0_make", "token_1_ideas"],
            font: {
              assetId: "font_support",
              family: "Almera Text",
              sha256: "c".repeat(64),
              status: "verified",
            },
          },
        ],
    lineBreaks: kind === "baseline"
      ? [["MAKE"], ["IDEAS", "MATTER"]]
      : [["MAKE", "IDEAS"], ["MATTER"]],
    shapedBoundsPx: kind === "baseline"
      ? {left: 712, top: 272, width: 286, height: 416}
      : {left: 704, top: 260, width: 298, height: 432},
  },
  placement: {
    box: {x: 0.65, y: 0.135, width: 0.3, height: 0.305},
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
      {outputMs: 1000, x: 0.65, y: 0.135},
      {outputMs: 3000, x: 0.65, y: 0.135},
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

const repairState = (kind: "before" | "after") => ({
  semanticHierarchy: kind === "before" ? "compound_anchor" : "semantic_anchor",
  fontRoleAssignment: kind === "before" ? "ideas_matter_hero" : "matter_hero",
  shaping: kind === "before" ? "shape_a" : "shape_b",
  lineBreaks: kind === "before" ? [["MAKE"], ["IDEAS", "MATTER"]] : [["MAKE", "IDEAS"], ["MATTER"]],
  glyphBounds: kind === "before" ? [712, 272, 286, 416] : [704, 260, 298, 432],
  collision: kind === "before" ? "collision_a" : "collision_b",
  balance: kind === "before" ? "balance_a" : "balance_b",
  declaration: kind === "before" ? "declared_scene_a_baseline" : "declared_scene_a_repair",
  sourceTransform: "bottom_center_fit",
  sceneEvidence: "alpha:440b5718",
  treatmentFamily: "premium_direct_response",
  palette: ["#ffffff", "#f6c453"],
  motionFamily: "static_editorial_hold",
  renderer: "MaulShort/v1",
  seed: "experiment-seed-1",
  budget: {candidates: 2, renders: 2},
});

const observedFor = (
  declaration: ReturnType<typeof freezeDeclaredComposition>,
): ObservedComposition => ({
  schemaVersion: "maul-observed-composition/v1",
  observationId: `observed_${declaration.declarationId}`,
  observationSha256: sha256(`observed_${declaration.declarationId}`),
  declarationId: declaration.declarationId,
  status: "observed",
  failures: [],
  frameEvidenceIds: ["frame:1000", "frame:2000", "frame:3000"],
  measurements: {
    textBounds: {
      status: "observed",
      value: {
        leftPx: declaration.placement.box.x * declaration.output.width,
        topPx: declaration.placement.box.y * declaration.output.height,
        rightPx: (declaration.placement.box.x + declaration.placement.box.width) * declaration.output.width,
        bottomPx: (declaration.placement.box.y + declaration.placement.box.height) * declaration.output.height,
      },
      evidenceIds: ["frame:1000"],
    },
    lineCount: {status: "observed", value: 2, evidenceIds: ["frame:1000"]},
    hierarchyAreaRatio: {status: "observed", value: 2.1, evidenceIds: ["frame:1000"]},
    subjectIntersectionRatio: {status: "observed", value: 0.12, evidenceIds: ["frame:1000"]},
    criticalIntersectionRatio: {status: "observed", value: 0, evidenceIds: ["frame:1000"]},
    treatmentVisibility: {status: "observed", value: true, evidenceIds: ["frame:1000"]},
    temporalStability: {status: "observed", value: 0.99, evidenceIds: ["frame:1000", "frame:2000", "frame:3000"]},
    fontIdentity: {
      status: "inferred",
      value: {assetId: "font_hero", family: "Almera", sha256: "b".repeat(64)},
      evidenceIds: ["font-probe", "frame:1000"],
    },
    depthMode: {status: "unobserved", reason: "RGB pixels do not prove z-order.", evidenceIds: []},
  },
});

describe("Composition Experiment Runner", () => {
  it("coordinates the causal baseline and repair path through one compiler, renderer, and observer", async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "maul-composition-runner-"));
    temporaryDirectories.push(outputDirectory);
    const baseline = freezeDeclaredComposition(declarationInput("baseline"));
    const repair = freezeDeclaredComposition(declarationInput("repair"));
    const repairLedger = createCompositionRepairLedgerEntry({
      repairId: "repair_hierarchy_1",
      parentDeclarationId: baseline.declarationId,
      childDeclarationId: repair.declarationId,
      targetDimension: "semanticHierarchy",
      before: repairState("before"),
      after: repairState("after"),
      diagnosis: "Hierarchy is weak while placement and treatment remain viable.",
    });
    const callOrder: string[] = [];
    const compile = vi.fn(async ({condition}: {condition: "baseline" | "repair"}) => {
      callOrder.push(`compile:${condition}`);
      return {
        artifactId: `manifest_artifact_${condition}`,
        candidateArtifactId: "candidate_scene_a",
        treatmentGenomeArtifactId: "treatment_a",
        planningBundleArtifactId: `planning_${condition}`,
        manifest: {
          schemaVersion: "maul-unified-short-render-manifest/v3",
          output: {width: 1080, height: 1920, fps: 30},
          timeline: {outputDurationMs: 4000},
        } as unknown as MaulUnifiedShortRenderManifest,
      };
    });
    const render = vi.fn(async (input: MaulShortRenderEngineInput) => {
      const condition = callOrder.filter((entry) => entry.startsWith("compile:")).at(-1)!.split(":")[1]!;
      const observationMode = input.observationMode ?? "creative";
      callOrder.push(`render:${condition}:${observationMode}`);
      const bytes = Buffer.from(`render:${condition}:${observationMode}`);
      return {
        bytes,
        sha256: sha256(bytes),
        durationMs: 4000,
        width: 1080,
        height: 1920,
        evidence: {
          compositionId: "MaulShort" as const,
          renderer: "remotion" as const,
          sourceMappingPreserved: true,
          audioMixed: true,
          observationMode,
        },
        frameSamples: (input.previewFrameTimesMs ?? []).map((outputMs) => {
          const frameBytes = Buffer.from(`frame:${condition}:${observationMode}:${outputMs}`);
          return {
            outputMs,
            bytes: frameBytes,
            sha256: sha256(frameBytes),
            contentType: "image/png" as const,
          };
        }),
      };
    });
    const observe = vi.fn(async ({condition, declaration, render, observationControl}: {
      condition: "baseline" | "repair";
      declaration: typeof baseline;
      render: MaulShortRenderEngineResult;
      observationControl: MaulShortRenderEngineResult;
    }) => {
      callOrder.push(`observe:${condition}`);
      expect(render.evidence.observationMode).toBe("creative");
      expect(observationControl.evidence.observationMode).toBe("typography_suppressed");
      expect(observationControl.frameSamples.map((sample) => sample.outputMs)).toEqual([1000, 2000, 3000]);
      return observedFor(declaration);
    });

    const result = await runCompositionExperiment({
      experimentId: "scene_a_causal_hierarchy_v1",
      outputDirectory,
      workRoot: path.join(outputDirectory, "work"),
      reviewSeed: "hidden_review_seed",
      baselineDeclaration: baseline,
      repairDeclaration: repair,
      repairLedger,
      capabilityCoverage: buildCompositionExperimentCapabilityCoverage({
        fixtureId: baseline.fixtureId,
        generatedAt: "2026-08-07T09:00:00.000Z",
      }),
      compiler: {version: "maul-manifest-compiler/v1", compile},
      renderer: {version: "MaulShort/v1", render},
      observer: {version: "maul-composition-observer/v1", observe},
    });

    expect(callOrder).toEqual([
      "compile:baseline",
      "render:baseline:creative",
      "render:baseline:typography_suppressed",
      "observe:baseline",
      "compile:repair",
      "render:repair:creative",
      "render:repair:typography_suppressed",
      "observe:repair",
    ]);
    expect(render).toHaveBeenCalledTimes(4);
    expect(render.mock.calls.every(([input]) =>
      input.renderMode === "final" &&
      JSON.stringify(input.previewFrameTimesMs) === JSON.stringify([1000, 2000, 3000])
    )).toBe(true);
    expect(render.mock.calls.map(([input]) => input.observationMode)).toEqual([
      "creative",
      "typography_suppressed",
      "creative",
      "typography_suppressed",
    ]);
    expect(result.runs.baseline.manifest.compilerVersion).toBe("maul-manifest-compiler/v1");
    expect(result.runs.repair.manifest.planningBundleArtifactId).toBe("planning_repair");
    expect(result.runs.baseline.manifest.candidateArtifactId).toBe("candidate_scene_a");
    expect(result.runs.repair.manifest.candidateArtifactId).toBe("candidate_scene_a");
    expect(result.runs.baseline.manifest.treatmentGenomeArtifactId).toBe("treatment_a");
    expect(result.runs.repair.manifest.treatmentGenomeArtifactId).toBe("treatment_a");
    expect(result.repairLedger.recomputedDimensions).toEqual([
      "semanticHierarchy",
      "fontRoleAssignment",
      "shaping",
      "lineBreaks",
      "glyphBounds",
      "collision",
      "balance",
      "declaration",
    ]);
    expect(result.review.publicPackage.candidates.map((candidate) => candidate.label)).toEqual(["a", "b"]);
    expect(JSON.stringify(result.review.publicPackage)).not.toMatch(/baseline|repair|hidden_review_seed/);
    expect(result.decisionLedger.map((entry) => entry.decisionType)).toEqual([
      "declaration_accepted",
      "manifest_compiled",
      "render_completed",
      "observation_control_rendered",
      "observation_completed",
      "fidelity_reported",
      "repair_validated",
      "declaration_accepted",
      "manifest_compiled",
      "render_completed",
      "observation_control_rendered",
      "observation_completed",
      "fidelity_reported",
      "review_package_blinded",
    ]);
    expect(result.capabilityCoverage.duplicateAuthorities).toEqual([]);
    await expect(fs.readFile(path.join(outputDirectory, "trace.json"), "utf8")).resolves.toContain(
      "scene_a_causal_hierarchy_v1",
    );
    await expect(fs.readFile(path.join(outputDirectory, "baseline", "render.mp4"))).resolves.toEqual(
      Buffer.from("render:baseline:creative"),
    );
    await expect(fs.readFile(path.join(outputDirectory, "baseline", "observation-control.mp4"))).resolves.toEqual(
      Buffer.from("render:baseline:typography_suppressed"),
    );
    await expect(fs.readFile(path.join(outputDirectory, "repair", "render.mp4"))).resolves.toEqual(
      Buffer.from("render:repair:creative"),
    );
    await expect(fs.readFile(path.join(outputDirectory, "repair", "observation-control.mp4"))).resolves.toEqual(
      Buffer.from("render:repair:typography_suppressed"),
    );
    const trace = JSON.parse(await fs.readFile(path.join(outputDirectory, "trace.json"), "utf8"));
    expect(trace.runs.baseline.observationControlSha256).toBe(
      sha256("render:baseline:typography_suppressed"),
    );
    expect(trace.runs.baseline.artifactPaths.observationControl).toBe(
      "baseline/observation-control.mp4",
    );
    expect(trace.runs.baseline.artifactPaths.observationControlFrames).toEqual([
      "baseline/observation-control-frames/frame-1000.png",
      "baseline/observation-control-frames/frame-2000.png",
      "baseline/observation-control-frames/frame-3000.png",
    ]);
    await expect(fs.readFile(path.join(outputDirectory, "review", "public-package.json"), "utf8")).resolves.not.toMatch(
      /candidate_scene_a|declared_scene_a|hidden_review_seed/,
    );
  });
});

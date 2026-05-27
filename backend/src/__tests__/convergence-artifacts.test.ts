import {describe, expect, it} from "vitest";

import {
  createArtifactStageResult,
  runArtifactPipeline,
  type ArtifactStage
} from "../artifact-pipeline";
import {buildMapElitesArchive, selectControlledVariations} from "../creative-variation";
import {createUnavailableOcularAdapter} from "../ocular";
import {
  buildUnifiedMotionAssetCatalog,
  rankMotionAssetCatalog,
  type MotionAssetCatalogAdapter
} from "../motion-asset-catalog";

describe("Prometheus convergence artifacts", () => {
  it("runs explicit artifact stages and preserves degraded diagnostics", async () => {
    const stages: Array<ArtifactStage<{prompt: string}, unknown>> = [
      {
        id: "source",
        artifactKeys: ["input_manifest"],
        run: async (_input) => createArtifactStageResult({
          stageId: "source",
          status: "completed",
          artifact: {source: "ok"},
          confidence: 0.98,
          message: "Source artifact ready.",
          artifactKeys: ["input_manifest"],
          startedAt: new Date().toISOString()
        })
      },
      {
        id: "temporal-synthesis",
        artifactKeys: ["temporal_governor"],
        run: async (_input) => createArtifactStageResult({
          stageId: "temporal-synthesis",
          status: "degraded",
          artifact: {temporalHealthScore: 0.66},
          confidence: 0.66,
          message: "Temporal repetition pressure detected.",
          artifactKeys: ["temporal_governor"],
          startedAt: new Date().toISOString()
        })
      }
    ];

    const result = await runArtifactPipeline({
      jobId: "job-artifacts",
      input: {prompt: "make it cinematic"},
      stages
    });

    expect(result.status).toBe("degraded");
    expect(result.completedStageIds).toEqual(["source", "temporal-synthesis"]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.stageId)).toEqual(["source", "temporal-synthesis"]);
  });

  it("consolidates motion assets through one catalog ranking path", async () => {
    const adapter: MotionAssetCatalogAdapter = {
      id: "test-adapter",
      read: async () => [
        {
          id: "god-proof-card",
          source: "god",
          label: "Proof Card",
          semanticTags: ["proof", "stat"],
          aestheticTags: ["premium"],
          timingCompatibilityMs: {min: 500, max: 4000},
          freshnessScore: 0.9,
          antiRepetitionKey: "proof-card",
          gpuCost: "low"
        },
        {
          id: "old-proof-card",
          source: "showcase",
          label: "Old Proof Card",
          semanticTags: ["proof"],
          aestheticTags: ["legacy"],
          timingCompatibilityMs: {min: 500, max: 4000},
          freshnessScore: 0.5,
          antiRepetitionKey: "proof-card",
          gpuCost: "medium"
        }
      ]
    };

    const catalog = await buildUnifiedMotionAssetCatalog([adapter]);
    const ranked = rankMotionAssetCatalog({
      catalog,
      query: {
        text: "proof",
        semanticTags: ["proof"],
        durationMs: 1400,
        recentAntiRepetitionKeys: [],
        limit: 1
      }
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.asset.id).toBe("god-proof-card");
    expect(ranked[0]?.reasons).toContain("timing compatible");
  });

  it("keeps creative variation controlled through MAP-Elites selection", () => {
    const archive = buildMapElitesArchive([
      {id: "calm", intensity: 0.2, visualDensity: 0.2, motionEnergy: 0.2, editorialNovelty: 0.3, fitness: 0.7},
      {id: "chaos", intensity: 1, visualDensity: 1, motionEnergy: 1, editorialNovelty: 0.95, fitness: 0.99},
      {id: "premium", intensity: 0.65, visualDensity: 0.55, motionEnergy: 0.5, editorialNovelty: 0.62, fitness: 0.92}
    ]);

    const selected = selectControlledVariations({archive, limit: 3, maxChaos: 0.72});

    expect(selected.map((genome) => genome.id)).toEqual(["premium", "calm"]);
  });

  it("provides an ocular seam without pretending visual cognition is implemented", async () => {
    const adapter = createUnavailableOcularAdapter();
    const result = await adapter.analyzeFrame({
      frameId: "frame-1",
      atMs: 1000,
      imageRef: "/frames/1.png",
      width: 1920,
      height: 1080
    });

    expect(result.detectedRisks).toContain("ocular_adapter_unavailable");
    expect(result.evidence[0]).toContain("Ocular seam is present");
  });
});

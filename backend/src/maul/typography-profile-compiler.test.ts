import {describe, expect, it} from "vitest";

import {
  loadTypographyProfileCorpus,
} from "./typography-profile-corpus.js";
import {
  createTypographyProfileCompiler,
} from "./typography-profile-compiler.js";

const chunk = ({
  chunkId,
  text,
  semanticRole = "hook",
  emphasisLevel = "hero",
}: {
  chunkId: string;
  text: string;
  semanticRole?: string;
  emphasisLevel?: "support" | "key" | "hero";
}) => ({
  chunkId,
  text,
  wordCount: text.trim().split(/\s+/u).length,
  semanticRole,
  emphasisLevel,
});

describe("MAUL typography profile compiler", () => {
  it("compiles independent authoritative bindings with real measured fonts", async () => {
    const corpus = loadTypographyProfileCorpus();
    const profiles = corpus.filter((profile) =>
      [
        "For_You_Calligraphic_Roman_Pairing",
        "2X_Revenue_Growth_Extended_Black",
      ].includes(profile.profileName),
    );
    const compiler = createTypographyProfileCompiler({profiles});
    const input = {
      chunks: [
        chunk({chunkId: "chunk_for_you", text: "For you"}),
        chunk({chunkId: "chunk_revenue", text: "2X revenue growth"}),
      ],
      targetAspectRatio: "9:16" as const,
      maximumLineWidthPx: 410,
    };

    const first = await compiler.compile(input);
    const replay = await compiler.compile(input);

    expect(first.status).toBe("available");
    expect(replay.status).toBe("available");
    if (first.status !== "available" || replay.status !== "available") return;
    expect(first.bindings).toHaveLength(2);
    expect(first.bindings.map((binding) => binding.profile.name)).toEqual([
      "For_You_Calligraphic_Roman_Pairing",
      "2X_Revenue_Growth_Extended_Black",
    ]);
    expect(first.bindings.map((binding) => binding.layout.fontSizePx)).toEqual([
      62, 65,
    ]);
    expect(
      new Set(
        first.bindings.map(
          (binding) =>
            binding.layers.find(
              (layer) => layer.layerName === binding.primaryLayerName,
            )!.selectedAsset.assetId,
        ),
      ).size,
    ).toBe(2);
    expect(first.fontResolution).toMatchObject({
      selectedFamily: "Mixed chunk typography",
      selectedAssetId: null,
      selectedAsset: null,
      accentAsset: null,
      status: "eligible_loaded",
    });
    for (const binding of first.bindings) {
      expect(binding.layout.chunkId).toBe(binding.chunkId);
      expect(binding.layout.measurementIds.length).toBeGreaterThan(0);
      expect(binding.bindingHash).toMatch(/^[a-f0-9]{64}$/);
      expect(binding.timingMs).toEqual({
        selection: expect.any(Number),
        fontResolution: expect.any(Number),
        measurement: expect.any(Number),
      });
    }
    expect(replay.bindings.map((binding) => binding.bindingHash)).toEqual(
      first.bindings.map((binding) => binding.bindingHash),
    );
  });

  it("retains the selected profile when its requested families require substitution", async () => {
    const profile = loadTypographyProfileCorpus().find(
      (candidate) =>
        candidate.profileName ===
        "Marketing_You_Cant_Ignore_Forest_Green_Grid",
    );
    expect(profile).toBeDefined();
    const compiler = createTypographyProfileCompiler({profiles: [profile!]});

    const result = await compiler.compile({
      chunks: [
        chunk({
          chunkId: "chunk_marketing",
          text: "Marketing You can't Ignore.",
        }),
      ],
      targetAspectRatio: "9:16",
      maximumLineWidthPx: 410,
    });

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.bindings[0]).toMatchObject({
      profile: {
        name: "Marketing_You_Cant_Ignore_Forest_Green_Grid",
      },
    });
    expect(
      result.bindings[0]!.layers.some(
        (layer) => layer.resolution === "closest_catalog",
      ),
    ).toBe(true);
    expect(result.bindings[0]!.layers[0]!.requestedFamilies).toContain("Inter");
  });

  it("returns a governed unavailable result when no font can execute", async () => {
    const compiler = createTypographyProfileCompiler({
      profiles: loadTypographyProfileCorpus().slice(0, 1),
      executableAssets: [],
    });

    const result = await compiler.compile({
      chunks: [chunk({chunkId: "chunk_unresolved", text: "No font here"})],
      targetAspectRatio: "9:16",
      maximumLineWidthPx: 410,
    });

    expect(result).toMatchObject({
      status: "unavailable",
      reason: expect.stringMatching(/no deployed font candidates/i),
    });
  });
});

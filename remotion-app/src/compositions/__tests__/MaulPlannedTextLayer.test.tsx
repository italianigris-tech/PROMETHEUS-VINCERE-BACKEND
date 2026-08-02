import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {MaulPlannedTextCard} from "../MaulPlannedTextLayer";
import {
  adaptMaulShortManifest,
  buildMaulPlannedSourceSequences,
  buildMaulPlannedRenderModel,
  buildMaulPlannedTextRecords,
  compileMaulLegibilityPrimitive,
  toMaulPixelBox,
} from "../maul-short-manifest-adapter";

const sha = (character: string) => character.repeat(64);

const textChunkPlan = {
  tokens: [
    {
      tokenId: "token_make",
      text: "Make",
      outputSpans: [{outputStartMs: 0, outputEndMs: 300}],
    },
    {
      tokenId: "token_it",
      text: "it",
      outputSpans: [{outputStartMs: 300, outputEndMs: 800}],
    },
  ],
  chunks: [
    {
      chunkId: "chunk_make_it",
      tokenIds: ["token_make", "token_it"],
      outputStartMs: 0,
      outputEndMs: 800,
    },
  ],
};

const textPlacementPlan = {
  status: "planned",
  textChunkPlanArtifactId: "text_chunk_a",
  textChunkPlanHash: sha("d"),
  compatibilityProfiles: [
    {
      profileId: "maul-compat-dm-sans-v1",
      family: "DM Sans",
      loadedFallback: {
        assetId: "font_google_dm_sans_700",
        family: "DM Sans",
        weight: 700,
      },
      metrics: {fingerprint: sha("a")},
    },
  ],
  compositionIntervals: [
    {
      intervalId: "composition_a",
      sceneId: "scene_a",
      discontinuityId: "discontinuity_a",
      variantId: "composition_left",
      outputStartMs: 0,
      outputEndMs: 1000,
      transformHash: sha("b"),
      sourceViewport: {x: 0, y: 0, width: 1, height: 1},
      sourceOccupancy: [{x: 0, y: 0, width: 1, height: 1}],
      paddedNonSourceRegions: [],
      crop: {x: 0, y: 0, width: 0.4, height: 1},
      scale: {x: 1, y: 1},
    },
  ],
  segments: [
    {
      segmentId: "placement_a",
      chunkId: "chunk_make_it",
      sceneId: "scene_a",
      discontinuityId: "discontinuity_a",
      outputStartMs: 0,
      outputEndMs: 800,
      selectedCompositionVariantId: "composition_left",
      selectedTransformHash: sha("b"),
      tokenIds: ["token_make", "token_it"],
      lines: [
        {lineId: "line_make", tokenIds: ["token_make"], text: "Make"},
        {lineId: "line_it", tokenIds: ["token_it"], text: "it"},
      ],
      family: "editorial",
      variantId: "editorial.subject_opposite_v1",
      box: {x: 0.1, y: 0.2, width: 0.6, height: 0.15},
      maximumEnvelope: {x: 0.08, y: 0.18, width: 0.64, height: 0.19},
      alignment: "left",
      compatibility: {
        profileId: "maul-compat-dm-sans-v1",
        metricsFingerprint: sha("a"),
        nominalFontSizePx: 72,
        lineHeight: 1.1,
        hierarchyScale: 1,
      },
      minimumLegibilityPrimitive: {
        kind: "solid_plate",
        paddingXPx: 20,
        paddingYPx: 12,
        cornerRadiusPx: 4,
        backgroundColor: "#000000",
        minimumOpacity: 0.72,
      },
      hardGates: [{gateId: "exact", status: "pass"}],
      fallbackCode: "fallback_known",
      fallbackReason: "Known governed fallback.",
    },
  ],
};

const typographyMotion = {
  textChunkPlanArtifactId: "text_chunk_a",
  textChunkPlanHash: sha("d"),
  fontResolution: {
    selectedFamily: "DM Sans",
    selectedAssetId: "font_google_dm_sans_700",
    status: "eligible_loaded",
  },
};

const buildRecords = () =>
  buildMaulPlannedTextRecords({
    textChunkPlan: textChunkPlan as never,
    textPlacementPlan: textPlacementPlan as never,
    typographyMotion: typographyMotion as never,
    output: {width: 1080, height: 1920},
  });

describe("MAUL planned text renderer contract", () => {
  it("converts normalized placement geometry to output pixels", () => {
    expect(
      toMaulPixelBox(
        {x: 0.1, y: 0.2, width: 0.6, height: 0.15},
        {width: 1080, height: 1920},
      ),
    ).toEqual({leftPx: 108, topPx: 384, widthPx: 648, heightPx: 288});
  });

  it("keeps exact planned line and token order", () => {
    expect(
      buildRecords()[0]?.lines.map((line) => ({
        lineId: line.lineId,
        text: line.text,
        tokens: line.tokens.map((token) => [token.tokenId, token.text]),
      })),
    ).toEqual([
      {lineId: "line_make", text: "Make", tokens: [["token_make", "Make"]]},
      {lineId: "line_it", text: "it", tokens: [["token_it", "it"]]},
    ]);
  });

  it("carries governed family, variant, fallback, and font metadata", () => {
    expect(buildRecords()[0]).toMatchObject({
      family: "editorial",
      variantId: "editorial.subject_opposite_v1",
      fallbackCode: "fallback_known",
      fallbackReason: "Known governed fallback.",
      alignment: "left",
      font: {
        profileId: "maul-compat-dm-sans-v1",
        metricsFingerprint: sha("a"),
        family: "DM Sans",
        assetId: "font_google_dm_sans_700",
        weight: 700,
        fontSizePx: 72,
        lineHeight: 1.1,
        hierarchyScale: 1,
      },
    });
  });

  it("compiles the selected minimum-legibility primitive", () => {
    expect(
      compileMaulLegibilityPrimitive(
        textPlacementPlan.segments[0]!.minimumLegibilityPrimitive as never,
      ),
    ).toEqual({
      kind: "solid_plate",
      containerStyle: {
        padding: "12px 20px",
        borderRadius: 4,
        backgroundColor: "color-mix(in srgb, #000000 72%, transparent)",
      },
      textStyle: {},
    });
  });

  it("compiles none, outline, and shadow primitives", () => {
    expect(compileMaulLegibilityPrimitive({kind: "none"})).toEqual({
      kind: "none",
      containerStyle: {},
      textStyle: {},
    });
    expect(
      compileMaulLegibilityPrimitive({
        kind: "outline",
        widthPx: 2,
        color: "#ffffff",
      }),
    ).toEqual({
      kind: "outline",
      containerStyle: {},
      textStyle: {
        WebkitTextStroke: "2px #ffffff",
        paintOrder: "stroke fill",
      },
    });
    expect(
      compileMaulLegibilityPrimitive({
        kind: "shadow",
        blurPx: 5,
        offsetXPx: 3,
        offsetYPx: 4,
        color: "#000000",
        minimumOpacity: 0.6,
      }),
    ).toEqual({
      kind: "shadow",
      containerStyle: {},
      textStyle: {
        textShadow:
          "3px 4px 5px color-mix(in srgb, #000000 60%, transparent)",
      },
    });
  });

  it("switches governed crop at the composition boundary", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.compositionIntervals[0]!.outputEndMs = 500;
    placement.segments[0]!.outputEndMs = 500;
    placement.compositionIntervals.push({
      ...placement.compositionIntervals[0]!,
      intervalId: "composition_b",
      variantId: "composition_right",
      outputStartMs: 500,
      outputEndMs: 1000,
      transformHash: sha("c"),
      crop: {x: 0.6, y: 0, width: 0.4, height: 1},
    });
    placement.segments.push({
      ...placement.segments[0]!,
      segmentId: "placement_b",
      outputStartMs: 500,
      outputEndMs: 800,
      selectedCompositionVariantId: "composition_right",
      selectedTransformHash: sha("c"),
    });

    const sequences = buildMaulPlannedSourceSequences({
      timeline: {
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 1000,
            mode: "keep",
          },
        ],
      } as never,
      textPlacementPlan: placement as never,
      fps: 30,
    });

    expect(
      sequences.map((sequence) => ({
        from: sequence.from,
        durationInFrames: sequence.durationInFrames,
        cropCenterXPercent: sequence.cropCenterXPercent,
      })),
    ).toEqual([
      {from: 0, durationInFrames: 15, cropCenterXPercent: 20},
      {from: 15, durationInFrames: 15, cropCenterXPercent: 80},
    ]);
  });

  it("normalizes V1 manifests only onto the explicit legacy path", () => {
    const manifest = {
      schemaVersion: "maul-unified-short-render-manifest/v1",
    } as never;

    expect(adaptMaulShortManifest(manifest)).toEqual({
      mode: "legacy",
      manifest,
    });
  });

  it("rejects malformed V2 instead of falling back to legacy rendering", () => {
    expect(() =>
      adaptMaulShortManifest({
        schemaVersion: "maul-unified-short-render-manifest/v2",
      } as never),
    ).toThrow(/invalid or stale MAUL V2 render manifest/i);
  });

  it("rejects blocked, stale, or internally inconsistent planned text", () => {
    const expectRejected = (
      mutate: (fixture: {
        textChunkPlan: typeof textChunkPlan;
        textPlacementPlan: typeof textPlacementPlan;
        typographyMotion: typeof typographyMotion;
      }) => void,
      message: RegExp,
    ) => {
      const fixture = {
        textChunkPlan: structuredClone(textChunkPlan),
        textPlacementPlan: structuredClone(textPlacementPlan),
        typographyMotion: structuredClone(typographyMotion),
      };
      mutate(fixture);
      expect(() =>
        buildMaulPlannedTextRecords({
          ...fixture,
          output: {width: 1080, height: 1920},
        } as never),
      ).toThrow(message);
    };

    expectRejected(
      (fixture) => {
        fixture.textPlacementPlan.status = "blocked";
      },
      /blocked placement/i,
    );
    expectRejected(
      (fixture) => {
        fixture.typographyMotion.textChunkPlanHash = sha("e");
      },
      /chunk plan hash/i,
    );
    expectRejected(
      (fixture) => {
        fixture.textPlacementPlan.segments[0]!.lines.reverse();
      },
      /line.*token.*order/i,
    );
    expectRejected(
      (fixture) => {
        fixture.textPlacementPlan.segments[0]!.hardGates[0]!.status = "fail";
      },
      /hard gate/i,
    );
    expectRejected(
      (fixture) => {
        fixture.textPlacementPlan.segments[0]!.selectedTransformHash = sha("f");
      },
      /composition transform/i,
    );
    expectRejected(
      (fixture) => {
        fixture.typographyMotion.fontResolution.selectedFamily = "Arial";
      },
      /DM Sans/i,
    );
  });

  it("renders governed geometry, metadata, primitive, and timed tokens", () => {
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        absoluteTimeMs={350}
        record={buildRecords()[0]!}
        textColor="#ffffff"
        accentColor="#ffcc00"
      />,
    );

    expect(markup).toContain('data-maul-placement-segment="placement_a"');
    expect(markup).toContain('data-placement-family="editorial"');
    expect(markup).toContain(
      'data-placement-variant="editorial.subject_opposite_v1"',
    );
    expect(markup).toContain('data-placement-fallback="fallback_known"');
    expect(markup).toContain('data-legibility-primitive="solid_plate"');
    expect(markup).toContain('data-font-family="DM Sans"');
    expect(markup).toContain("left:108px");
    expect(markup).toContain("top:384px");
    expect(markup).toContain("width:648px");
    expect(markup).toContain("height:288px");
    expect(markup.indexOf(">Make<")).toBeLessThan(markup.indexOf(">it<"));
    expect(markup).toContain(
      'data-maul-token-id="token_make" data-active="false"',
    );
    expect(markup).toContain(
      'data-maul-token-id="token_it" data-active="true"',
    );
  });

  it("assembles a parsed V2 manifest into one planned render model", () => {
    const model = buildMaulPlannedRenderModel({
      timeline: {
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 1000,
            mode: "keep",
          },
        ],
      },
      output: {width: 1080, height: 1920, fps: 30},
      plans: {
        textChunk: textChunkPlan,
        textPlacement: textPlacementPlan,
        typographyMotion,
      },
    } as never);

    expect(model.textRecords).toHaveLength(1);
    expect(model.sourceSequences).toHaveLength(1);
    expect(model.textRecords[0]?.segmentId).toBe("placement_a");
    expect(model.sourceSequences[0]?.compositionIntervalId).toBe(
      "composition_a",
    );
  });

  it("reuses one stable token object across adjacent placement segments", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.segments[0]!.outputEndMs = 400;
    placement.segments.push({
      ...placement.segments[0]!,
      segmentId: "placement_b",
      outputStartMs: 400,
      outputEndMs: 800,
    });
    const records = buildMaulPlannedTextRecords({
      textChunkPlan: textChunkPlan as never,
      textPlacementPlan: placement as never,
      typographyMotion: typographyMotion as never,
      output: {width: 1080, height: 1920},
    });

    expect(records[0]!.lines[0]!.tokens[0]).toBe(
      records[1]!.lines[0]!.tokens[0],
    );
    expect(records[0]!.lines[0]!.tokens[0]).toBe(textChunkPlan.tokens[0]);
  });

  it("switches overlapping selected compositions at the placement boundary", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.segments[0]!.outputEndMs = 500;
    placement.compositionIntervals.push({
      ...placement.compositionIntervals[0]!,
      intervalId: "composition_b",
      variantId: "composition_right",
      transformHash: sha("c"),
      crop: {x: 0.6, y: 0, width: 0.4, height: 1},
    });
    placement.segments.push({
      ...placement.segments[0]!,
      segmentId: "placement_b",
      outputStartMs: 500,
      outputEndMs: 800,
      selectedCompositionVariantId: "composition_right",
      selectedTransformHash: sha("c"),
    });

    const sequences = buildMaulPlannedSourceSequences({
      timeline: {
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 1000,
            outputStartMs: 0,
            outputEndMs: 1000,
            mode: "keep",
          },
        ],
      } as never,
      textPlacementPlan: placement as never,
      fps: 30,
    });

    expect(
      sequences.map((sequence) => [
        sequence.from,
        sequence.durationInFrames,
        sequence.cropCenterXPercent,
      ]),
    ).toEqual([
      [0, 15, 20],
      [15, 15, 80],
    ]);
  });
});

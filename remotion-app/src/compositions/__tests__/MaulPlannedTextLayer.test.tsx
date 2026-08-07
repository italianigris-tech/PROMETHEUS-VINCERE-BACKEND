import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {
  MaulPlannedTextCard,
  composeMaulTextTransforms,
  resolveMaulEditorialWordTransform,
  resolveMaulFontBrowserUrl,
  resolveMaulTextAnimationTransform,
} from "../MaulPlannedTextLayer";
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
      approvedFontAssets: [
        {
          assetId: "font_google_dm_sans_700",
          family: "DM Sans",
          weights: [500, 700, 800],
        },
      ],
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
      editorialLockup: {
        schemaVersion: "maul-editorial-lockup/v1",
        mode: "script_tag_overlap",
        primaryTokenIds: ["token_make"],
        accentTokenIds: ["token_it"],
        tokenStyles: [
          {
            tokenId: "token_make",
            role: "primary",
            fontAssetId: "font_google_dm_sans_700",
            fontFamily: "DM Sans",
            fontStyle: "normal",
            fontWeight: 700,
            offsetXPx: 0,
            offsetYPx: 0,
            fontSizeScale: 1,
            rotationDeg: 0,
            zIndex: 1,
            opacity: 1,
          },
          {
            tokenId: "token_it",
            role: "accent",
            fontAssetId: "font_google_playfair_display_italic_700",
            fontFamily: "Playfair Display",
            fontStyle: "italic",
            fontWeight: 700,
            offsetXPx: -18,
            offsetYPx: 5,
            fontSizeScale: 0.82,
            rotationDeg: -3,
            zIndex: 2,
            opacity: 1,
          },
        ],
        overlap: {
          enabled: true,
          ratio: 0.22,
          direction: "accent_over_primary",
          rationale: "The accent hinge crosses the primary word.",
        },
        choreography: {
          mode: "forward_word_reveal",
          tokenOrder: ["token_make", "token_it"],
          staggerMs: 72,
          entryDurationMs: 150,
        },
        rationale: "Editorial lockup fixture.",
      },
    },
  ],
};

const typographyMotion = {
  textChunkPlanArtifactId: "text_chunk_a",
  textChunkPlanHash: sha("d"),
  fontResolution: {
    selectedFamily: "DM Sans",
    selectedAssetId: "font_google_dm_sans_700",
    accentAsset: {
      assetId: "font_google_playfair_display_italic_700",
      family: "Playfair Display",
      cssFamily: "Playfair Display",
      weight: 700,
      style: "italic",
      browserUrl: "/fonts/maul/playfair-display-italic-700.woff2",
      localFilePath: "/fonts/maul/playfair-display-italic-700.woff2",
      localFileSha256: sha("i"),
      format: "woff2",
      source: "bundled",
      license: {status: "bundled", evidence: ["Bundled MAUL font"]},
    },
    status: "eligible_loaded",
    reason: "The governed renderer asset was selected and loaded.",
  },
};

const baseTransform = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
} as const;

const animationProgram = (
  treatment: "fade_rise" | "keyword_pop" | "continuous_push",
) => ({
  animationId: `animation_${treatment}`,
  treatment,
  target: {
    scope: treatment === "keyword_pop" ? "tokens" : "segment",
    placementSegmentId: "placement_a",
    tokenIds: treatment === "keyword_pop" ? ["token_it"] : ["token_make", "token_it"],
  },
  phases: {
    entry: {
      outputStartMs: treatment === "fade_rise" ? 100 : 0,
      outputEndMs: 200,
      easing: {type: "linear"},
      from:
        treatment === "fade_rise"
          ? {...baseTransform, opacity: 0, translateYPx: 28}
          : treatment === "keyword_pop"
            ? {...baseTransform, opacity: 0, scale: 0.9}
            : {...baseTransform, translateXPx: 0},
      to:
        treatment === "keyword_pop"
          ? {...baseTransform, scale: 1.2}
          : treatment === "continuous_push"
            ? {...baseTransform, translateXPx: 10}
            : baseTransform,
    },
    hold: {
      outputStartMs: 200,
      outputEndMs: 600,
      easing: {type: "linear"},
      from:
        treatment === "keyword_pop"
          ? {...baseTransform, scale: 1.2}
          : treatment === "continuous_push"
            ? {...baseTransform, translateXPx: 10}
            : baseTransform,
      to:
        treatment === "continuous_push"
          ? {...baseTransform, translateXPx: 30}
          : baseTransform,
    },
    exit: {
      outputStartMs: 600,
      outputEndMs: 800,
      easing: {type: "linear"},
      from:
        treatment === "continuous_push"
          ? {...baseTransform, translateXPx: 30}
          : baseTransform,
      to:
        treatment === "continuous_push"
          ? {...baseTransform, opacity: 0, translateXPx: 40}
          : {...baseTransform, opacity: 0, translateYPx: -16},
    },
  },
  rationale: "Frame-sampling fixture.",
}) as const;

const buildRecords = () =>
  buildMaulPlannedTextRecords({
    textChunkPlan: textChunkPlan as never,
    textPlacementPlan: textPlacementPlan as never,
    typographyMotion: typographyMotion as never,
    output: {width: 1080, height: 1920},
  });

describe("MAUL planned text renderer contract", () => {
  it("routes root-relative font receipts through the Remotion public asset resolver", () => {
    const resolveStaticAsset = (assetPath: string) => `remotion-static://${assetPath}`;

    expect(resolveMaulFontBrowserUrl(
      "/fonts/library/aesthetic/aesthetic.woff2",
      resolveStaticAsset,
    )).toBe("remotion-static://fonts/library/aesthetic/aesthetic.woff2");
    expect(resolveMaulFontBrowserUrl(
      "https://cdn.example.com/aesthetic.woff2",
      resolveStaticAsset,
    )).toBe("https://cdn.example.com/aesthetic.woff2");
  });

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
      editorialLockup: expect.objectContaining({
        mode: "script_tag_overlap",
        overlap: expect.objectContaining({enabled: true}),
        choreography: expect.objectContaining({mode: "forward_word_reveal"}),
      }),
    });
  });

  it("preserves a measured governed non-DM font selection", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.compatibilityProfiles[0] = {
      profileId: "maul-compat-playfair-editorial-v1",
      family: "Playfair Display",
      approvedFontAssets: [
        {
          assetId: "font_google_playfair_display_700",
          family: "Playfair Display",
          weights: [400, 700, 900],
        },
      ],
      loadedFallback: {
        assetId: "font_google_playfair_display_700",
        family: "Playfair Display",
        weight: 700,
      },
      metrics: {fingerprint: sha("p")},
    } as never;
    placement.segments[0]!.compatibility.profileId =
      "maul-compat-playfair-editorial-v1" as never;
    placement.segments[0]!.compatibility.metricsFingerprint = sha("p");
    Object.assign(placement.segments[0]!.editorialLockup!.tokenStyles[0]!, {
      fontAssetId: "font_google_playfair_display_700",
      fontFamily: "Playfair Display",
      fontStyle: "normal",
      fontWeight: 700,
    });
    const motion = structuredClone(typographyMotion);
    motion.fontResolution.selectedFamily = "Playfair Display";
    motion.fontResolution.selectedAssetId = "font_google_playfair_display_700";

    expect(
      buildMaulPlannedTextRecords({
        textChunkPlan: textChunkPlan as never,
        textPlacementPlan: placement as never,
        typographyMotion: motion as never,
        output: {width: 1080, height: 1920},
      })[0]?.font,
    ).toMatchObject({
      family: "Playfair Display",
      assetId: "font_google_playfair_display_700",
      weight: 700,
    });
  });

  it("carries a planned hydrated font descriptor through to the renderer record", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.compatibilityProfiles[0] = {
      profileId: "maul-compat-fraunces-v1",
      family: "Fraunces",
      approvedFontAssets: [{
        assetId: "font_fraunces_regular_test",
        family: "Fraunces",
        weights: [400],
      }],
      loadedFallback: {
        assetId: "font_fraunces_regular_test",
        family: "Fraunces",
        weight: 400,
      },
      metrics: {fingerprint: sha("r")},
    } as never;
    placement.segments[0]!.compatibility.profileId = "maul-compat-fraunces-v1" as never;
    placement.segments[0]!.compatibility.metricsFingerprint = sha("r");
    const motion = structuredClone(typographyMotion) as any;
    motion.fontResolution.selectedFamily = "Fraunces";
    motion.fontResolution.selectedAssetId = "font_fraunces_regular_test";
    motion.fontResolution.selectedAsset = {
      assetId: "font_fraunces_regular_test",
      family: "Fraunces",
      cssFamily: "PrometheusFraunces",
      weight: 400,
      style: "normal",
      browserUrl: "/fonts/library/fraunces/fraunces-regular.ttf",
      localFilePath: "/render/fonts/library/fraunces/fraunces-regular.ttf",
      localFileSha256: sha("f"),
      format: "ttf",
      source: "hydrated_library",
      license: {status: "cleared", evidence: ["font license record"]},
    };
    Object.assign(placement.segments[0]!.editorialLockup!.tokenStyles[0]!, {
      fontAssetId: "font_fraunces_regular_test",
      fontFamily: "Fraunces",
      fontStyle: "normal",
      fontWeight: 400,
    });

    expect(buildMaulPlannedTextRecords({
      textChunkPlan: textChunkPlan as never,
      textPlacementPlan: placement as never,
      typographyMotion: motion,
      output: {width: 1080, height: 1920},
    })[0]?.font).toMatchObject({
      assetId: "font_fraunces_regular_test",
      family: "Fraunces",
      browserUrl: "/fonts/library/fraunces/fraunces-regular.ttf",
      cssFamily: "PrometheusFraunces",
      localFileSha256: sha("f"),
    });
  });

  it("renders an explicit safe-caption fallback without promoting its font status", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.segments[0]!.fallbackCode = "caption_safe_fallback";
    placement.segments[0]!.fallbackReason =
      "Source-pixel typography measurement is unavailable.";
    const motion = structuredClone(typographyMotion);
    motion.fontResolution.status = "governed_fallback";
    motion.fontResolution.reason =
      "Measured typography is unavailable; render the disclosed safe caption only.";

    expect(
      buildMaulPlannedTextRecords({
        textChunkPlan: textChunkPlan as never,
        textPlacementPlan: placement as never,
        typographyMotion: motion as never,
        output: {width: 1080, height: 1920},
      })[0]?.fallbackCode,
    ).toBe("caption_safe_fallback");
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

  it("executes the planned lockup mode, accent pairing, and forward word reveal", () => {
    const record = buildRecords()[0]!;
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        record={record}
        absoluteTimeMs={0}
        outputFrame={0}
        fps={30}
        textColor="#ffffff"
        accentColor="#f06424"
      />,
    );

    expect(markup).toContain('data-editorial-lockup-mode="script_tag_overlap"');
    expect(markup).toContain('data-editorial-overlap-ratio="0.22"');
    expect(markup).toContain('data-editorial-choreography="forward_word_reveal"');
    expect(markup).toContain('font-family:Playfair Display');
    expect(markup).toContain('font-style:italic');
    expect(markup).toContain('white-space:nowrap');
    expect(markup).toContain('opacity:0');
  });

  it("composes editorial offsets with planned animation instead of overwriting either transform", () => {
    const composed = composeMaulTextTransforms({
      editorial: {
        opacity: 0.8,
        translateXPx: -18,
        translateYPx: 5,
        scale: 0.82,
        rotationDeg: -3,
      },
      animation: {
        opacity: 0.5,
        translateXPx: 12,
        translateYPx: -4,
        scale: 1.2,
      },
    });
    expect(composed).toMatchObject({
      opacity: 0.4,
      translateXPx: -6,
      translateYPx: 1,
      rotationDeg: -3,
    });
    expect(composed?.scale).toBeCloseTo(0.984, 12);
  });

  it("uses the lockup overlap ratio in responsive geometry and keeps accent color by layer", () => {
    const record = buildRecords()[0]!;
    const transform = resolveMaulEditorialWordTransform({
      lockup: record.editorialLockup!,
      tokenId: "token_it",
      absoluteTimeMs: 350,
      segmentStartMs: record.outputStartMs,
      fontSizePx: record.font.fontSizePx,
    });
    const separatedLockup = structuredClone(record.editorialLockup!);
    separatedLockup.overlap.ratio = 0;
    const separatedTransform = resolveMaulEditorialWordTransform({
      lockup: separatedLockup,
      tokenId: "token_it",
      absoluteTimeMs: 350,
      segmentStartMs: record.outputStartMs,
      fontSizePx: record.font.fontSizePx,
    });
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        record={record}
        absoluteTimeMs={0}
        textColor="#ffffff"
        accentColor="#00e5ff"
      />,
    );

    expect(transform?.translateXPx).toBeLessThan(separatedTransform?.translateXPx ?? 0);
    const accentTokenStart = markup.indexOf('data-maul-token-id="token_it"');
    expect(markup.slice(accentTokenStart, accentTokenStart + 500)).toContain("color:#00e5ff");
  });

  it("keeps each word anchor fixed while the local reveal changes opacity", () => {
    const lockup = buildRecords()[0]!.editorialLockup!;
    const entry = resolveMaulEditorialWordTransform({
      lockup,
      tokenId: "token_it",
      absoluteTimeMs: 80,
      segmentStartMs: 0,
      fontSizePx: 72,
    });
    const hold = resolveMaulEditorialWordTransform({
      lockup,
      tokenId: "token_it",
      absoluteTimeMs: 600,
      segmentStartMs: 0,
      fontSizePx: 72,
    });

    expect(entry?.opacity).toBeLessThan(hold?.opacity ?? 0);
    expect(entry?.translateXPx).toBe(hold?.translateXPx);
    expect(entry?.translateYPx).toBe(hold?.translateYPx);
  });

  it("reserves final token geometry while revealing letters locally", () => {
    const record = buildRecords()[0]!;
    record.animationPrograms = [{
      ...animationProgram("fade_rise"),
      treatment: "position_locked_letter_reveal",
      target: {
        scope: "tokens",
        placementSegmentId: record.segmentId,
        tokenIds: ["token_make", "token_it"],
      },
      localReveal: {
        unit: "letter",
        primitive: "blur_tracking",
        sourceTreatment: "tracking-collapse",
        tokenStaggerMs: 48,
        letterStaggerMs: 18,
        durationMs: 180,
        blurPx: 8,
        trackingEm: 0.08,
        startScale: 0.96,
      },
    } as never];

    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        record={record}
        absoluteTimeMs={80}
        outputFrame={2}
        fps={30}
        textColor="#ffffff"
        accentColor="#d8c7a1"
      />,
    );

    expect(markup).toContain('data-maul-reveal-unit="letter"');
    expect(markup).toContain('data-maul-reserved-token-geometry="true"');
    expect(markup).toContain('data-maul-letter-index="0"');
  });

  it("renders an annotation inside its attached token span", () => {
    const record = buildRecords()[0]!;
    record.editorialLockup = {
      ...record.editorialLockup!,
      annotations: [{
        annotationId: "annotation_it",
        kind: "circle",
        tokenIds: ["token_it"],
        paddingPx: 6,
      }],
    } as never;
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        record={record}
        absoluteTimeMs={600}
        textColor="#ffffff"
        accentColor="#d8c7a1"
      />,
    );

    expect(markup).toContain('data-maul-annotation-kind="circle"');
    expect(markup).toContain('data-maul-annotation-token-id="token_it"');
  });

  it("rejects a lockup whose primary or accent asset is not the resolved receipt", () => {
    const expectRejected = (mutate: (fixture: any) => void) => {
      const fixture = {
        textChunkPlan: structuredClone(textChunkPlan),
        textPlacementPlan: structuredClone(textPlacementPlan),
        typographyMotion: structuredClone(typographyMotion),
      };
      mutate(fixture);
      expect(() => buildMaulPlannedTextRecords({
        ...fixture,
        output: {width: 1080, height: 1920},
      } as never)).toThrow(/editorial lockup.*font receipt|font receipt.*lockup/i);
    };

    expectRejected((fixture) => {
      fixture.textPlacementPlan.segments[0].editorialLockup.tokenStyles[0].fontAssetId =
        "font_wrong_primary";
    });
    expectRejected((fixture) => {
      fixture.textPlacementPlan.segments[0].editorialLockup.tokenStyles[1].fontAssetId =
        "font_wrong_accent";
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

  it("maps off-grid half-open intervals without gaps or cut bleed", () => {
    const placement = structuredClone(textPlacementPlan);
    placement.compositionIntervals[0]!.outputStartMs = 1016;
    placement.compositionIntervals[0]!.outputEndMs = 1050;
    placement.segments[0]!.outputStartMs = 1016;
    placement.segments[0]!.outputEndMs = 1050;

    const [sequence] = buildMaulPlannedSourceSequences({
      timeline: {
        timestampMap: [
          {
            sourceStartMs: 0,
            sourceEndMs: 34,
            outputStartMs: 1016,
            outputEndMs: 1050,
            mode: "keep",
          },
        ],
      } as never,
      textPlacementPlan: placement as never,
      fps: 30,
    });

    expect(sequence).toMatchObject({
      from: 31,
      durationInFrames: 1,
      trimBefore: 0,
      trimAfter: 2,
    });
    expect(sequence!.from + sequence!.durationInFrames).toBe(32);
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
      /governed measured font/i,
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
    expect(markup).toContain(
      `data-font-metrics-fingerprint="${sha("a")}"`,
    );
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

  it("withholds planned text during a declared editorial-graphic interval", () => {
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        {...({
          absoluteTimeMs: 350,
          record: buildRecords()[0]!,
          textColor: "#ffffff",
          accentColor: "#ffcc00",
          suppressedOutputRanges: [{outputStartMs: 300, outputEndMs: 500}],
        } as any)}
      />,
    );

    expect(markup).toBe("");
  });

  it("renders the planned font system instead of forcing an editorial-display fallback", () => {
    const record = structuredClone(buildRecords()[0]!) as any;
    record.font = {
      ...record.font,
      profileId: "maul-measured-bebas-neue-local-v1",
      family: "Bebas Neue",
      assetId: "font_google_bebas_neue_400",
      weight: 400,
    };

    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        absoluteTimeMs={350}
        record={record}
        textColor="#ffffff"
        accentColor="#ffcc00"
        creativeTreatment={{
          schemaVersion: "maul-creative-treatment-proposal/v1",
          profileId: "aspire_visual_hook",
          compositionDirection: "subject_integrated",
          primaryTypeRole: "editorial_display",
          accentTypeRole: "editorial_italic",
          palette: {
            primary: "#ffffff",
            accent: "#ffcc00",
            sourceTreatment: "source_neutral",
          },
          textDensity: "medium",
          emphasisMode: "editorial_italic_hinge",
          motionMode: "restrained_phrase_lockup",
          rationale: ["Renderer fixture."],
        }}
        referenceEditorialRhythm={{
          schemaVersion: "maul-reference-editorial-rhythm/v1",
          fontSystemId: "condensed_kinetic_hinge",
          traitReceipt: ["phrase_hierarchy", "editorial_serif_hinge"],
        }}
      />,
    );

    expect(markup).toContain(
      'data-primary-font-asset-id="font_google_bebas_neue_400"',
    );
    expect(markup).toContain(
      'data-accent-font-asset-id="font_google_playfair_display_italic_700"',
    );
    expect(markup).toContain("font-family:Bebas Neue");
    expect(markup).toContain("font-family:Playfair Display");
  });

  it("renders a planned dynamic font URL instead of a static catalog fallback", () => {
    const record = structuredClone(buildRecords()[0]!) as any;
    record.font = {
      ...record.font,
      family: "Fraunces",
      assetId: "font_fraunces_regular_test",
      weight: 400,
      cssFamily: "PrometheusFraunces",
      browserUrl: "/fonts/library/fraunces/fraunces-regular.ttf",
      localFileSha256: sha("f"),
      format: "ttf",
      source: "hydrated_library",
      license: {status: "cleared", evidence: ["font license record"]},
    };

    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        absoluteTimeMs={350}
        record={record}
        textColor="#ffffff"
        accentColor="#ffcc00"
      />,
    );

    expect(markup).toContain('data-primary-font-asset-id="font_fraunces_regular_test"');
    expect(markup).toContain('data-primary-font-url="/fonts/library/fraunces/fraunces-regular.ttf"');
    expect(markup).toContain("font-family:PrometheusFraunces");
  });

  it("samples fade-rise before entry and during its governed hold", () => {
    const program = animationProgram("fade_rise");
    const before = resolveMaulTextAnimationTransform({
      program,
      outputFrame: 0,
      fps: 30,
    });
    const hold = resolveMaulTextAnimationTransform({
      program,
      outputFrame: 9,
      fps: 30,
    });

    expect(before.opacity).toBe(0);
    expect(before.translateYPx).toBe(28);
    expect(hold.opacity).toBe(1);
    expect(hold.translateYPx).toBe(0);
  });

  it("samples keyword scale at its peak and after it settles", () => {
    const program = animationProgram("keyword_pop");
    const peak = resolveMaulTextAnimationTransform({
      program,
      outputFrame: 6,
      fps: 30,
    });
    const settled = resolveMaulTextAnimationTransform({
      program,
      outputFrame: 18,
      fps: 30,
    });

    expect(peak.scale).toBeCloseTo(1.2, 5);
    expect(settled.scale).toBeCloseTo(1, 5);
  });

  it("keeps continuous push monotonic across a Sequence boundary", () => {
    const program = animationProgram("continuous_push");
    const priorSequenceLastFrame = resolveMaulTextAnimationTransform({
      program,
      outputFrame: 14,
      fps: 30,
    });
    const nextSequenceFirstFrame = resolveMaulTextAnimationTransform({
      program,
      outputFrame: 15 + 0,
      fps: 30,
    });

    expect(nextSequenceFirstFrame.translateXPx).toBeGreaterThan(
      priorSequenceLastFrame.translateXPx,
    );
  });

  it("attaches the governed plan to its record and renders its transform", () => {
    const program = animationProgram("fade_rise");
    const record = buildMaulPlannedTextRecords({
      textChunkPlan: textChunkPlan as never,
      textPlacementPlan: textPlacementPlan as never,
      typographyMotion: typographyMotion as never,
      textAnimationPlan: {programs: [program]} as never,
      output: {width: 1080, height: 1920},
    })[0]!;
    expect(record.animationProgram?.animationId).toBe("animation_fade_rise");

    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        absoluteTimeMs={0}
        outputFrame={0}
        fps={30}
        record={record}
        textColor="#ffffff"
        accentColor="#ffcc00"
      />,
    );
    expect(markup).toContain('data-text-animation-treatment="fade_rise"');
    expect(markup).toContain("opacity:0");
    expect(markup).toContain("translate3d(0px, 28px, 0)");
  });

  it("rejects malformed V3 instead of adapting it as V2 or legacy", () => {
    expect(() =>
      adaptMaulShortManifest({
        schemaVersion: "maul-unified-short-render-manifest/v3",
      } as never),
    ).toThrow(/invalid or stale MAUL V3 render manifest/i);
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

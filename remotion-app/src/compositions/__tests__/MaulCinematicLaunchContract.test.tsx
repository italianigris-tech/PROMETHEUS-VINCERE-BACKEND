import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {MaulPlannedTextCard} from "../MaulPlannedTextLayer";
import type {MaulPlannedTextRecord} from "../maul-short-manifest-adapter";

const identityTransform = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
} as const;

const cinematicProgram = {
  animationId: "animation_make_it_happen",
  treatment: "cinematic_text_preset_7",
  target: {
    scope: "segment",
    placementSegmentId: "placement_make_it_happen",
    tokenIds: ["token_make", "token_it", "token_happen"],
  },
  phases: {
    entry: {
      outputStartMs: 0,
      outputEndMs: 300,
      easing: {type: "linear"},
      from: {...identityTransform, opacity: 0, translateYPx: 28},
      to: identityTransform,
    },
    hold: {
      outputStartMs: 300,
      outputEndMs: 900,
      easing: {type: "linear"},
      from: identityTransform,
      to: identityTransform,
    },
    exit: {
      outputStartMs: 900,
      outputEndMs: 1200,
      easing: {type: "linear"},
      from: identityTransform,
      to: {...identityTransform, opacity: 0, translateYPx: -16},
    },
  },
  rationale: "A named cinematic three-word lockup requested by the MAUL plan.",
} as const;

const threeWordCinematicRecord: MaulPlannedTextRecord = {
  segmentId: "placement_make_it_happen",
  outputStartMs: 0,
  outputEndMs: 1200,
  boxPx: {leftPx: 108, topPx: 576, widthPx: 864, heightPx: 480},
  family: "editorial",
  variantId: "editorial.cinematic_lockup_v1",
  fallbackCode: "caption_safe_fallback",
  fallbackReason: "The conservative planner requested its legacy plate.",
  alignment: "center",
  minimumLegibilityPrimitive: {
    kind: "solid_plate",
    paddingXPx: 18,
    paddingYPx: 10,
    cornerRadiusPx: 6,
    backgroundColor: "#000000",
    minimumOpacity: 0.78,
  },
  animationProgram: cinematicProgram,
  animationPrograms: [cinematicProgram],
  font: {
    profileId: "maul-compat-dm-sans-v1",
    metricsFingerprint: "a".repeat(64),
    family: "DM Sans",
    assetId: "font_google_dm_sans_700",
    weight: 700,
    fontSizePx: 96,
    lineHeight: 0.94,
    hierarchyScale: 1,
  },
  lines: [
    {
      lineId: "line_make_it_happen",
      text: "Make it happen",
      tokens: [
        {
          tokenId: "token_make",
          text: "Make",
          outputSpans: [{outputStartMs: 0, outputEndMs: 400}],
        },
        {
          tokenId: "token_it",
          text: "it",
          outputSpans: [{outputStartMs: 400, outputEndMs: 700}],
        },
        {
          tokenId: "token_happen",
          text: "happen",
          outputSpans: [{outputStartMs: 700, outputEndMs: 1200}],
        },
      ],
    },
  ],
};

const valuesFor = (markup: string, patterns: RegExp[]): string[] =>
  patterns.flatMap((pattern) =>
    [...markup.matchAll(pattern)]
      .map((match) => match[1]?.trim())
      .filter((value): value is string => Boolean(value)),
  );

describe("MAUL cinematic launch contract", () => {
  it("renders a three-word cinematic treatment as a paired, hierarchical lockup without a black fallback plate", () => {
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        absoluteTimeMs={100}
        outputFrame={3}
        fps={30}
        record={threeWordCinematicRecord}
        textColor="#ffffff"
        accentColor="#f4d18a"
      />,
    );

    const fontRoles = valuesFor(markup, [/data-font-role="([^"]+)"/gi]);
    const fontFamilies = valuesFor(markup, [
      /data-font-family="([^"]+)"/gi,
      /font-family="([^"]+)"/gi,
      /font-family:([^;"]+)/gi,
    ]);
    const hierarchySignals = valuesFor(markup, [
      /data-hierarchy-scale="([^"]+)"/gi,
      /font-size="([^"]+)"/gi,
      /font-size:([^;"]+)/gi,
    ]);
    const exposesCinematicSemantics =
      /<svg\b[^>]*data-cinematic-treatment="cinematic_text_preset_7"/i.test(
        markup,
      ) ||
      /<mask\b|clip-path[:=]|filter:[^;"]*blur|rotate\(/i.test(markup);

    expect(markup).toContain(
      'data-text-animation-treatment="cinematic_text_preset_7"',
    );
    expect.soft(new Set(fontRoles).size, "distinct governed font roles").toBeGreaterThanOrEqual(2);
    expect.soft(new Set(fontFamilies).size, "distinct rendered font families").toBeGreaterThanOrEqual(2);
    expect.soft(new Set(hierarchySignals).size, "distinct per-word hierarchy").toBeGreaterThanOrEqual(2);
    expect.soft(exposesCinematicSemantics, "mask, blur, rotation, or an SVG cinematic treatment marker").toBe(true);
    expect.soft(markup, "cinematic mode must refuse the conservative black plate").not.toMatch(
      /data-legibility-primitive="solid_plate"|background-color:[^;"]*(?:#000(?:000)?\b|rgb\(0\s*,\s*0\s*,\s*0\)|color-mix\([^;"]*#000000)/i,
    );
  });
});

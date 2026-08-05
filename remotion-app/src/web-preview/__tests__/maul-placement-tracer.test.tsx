import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

const playerSnapshots: Array<{
  probeId: string;
  frame: number;
  width: number;
  height: number;
}> = [];

vi.mock("@remotion/player", () => ({
  Player: ({
    inputProps,
    initialFrame,
    compositionWidth,
    compositionHeight,
  }: {
    inputProps: {fixture: {probeId: string}};
    initialFrame: number;
    compositionWidth: number;
    compositionHeight: number;
  }) => {
    playerSnapshots.push({
      probeId: inputProps.fixture.probeId,
      frame: initialFrame,
      width: compositionWidth,
      height: compositionHeight,
    });
    return <div data-maul-tracer-player={inputProps.fixture.probeId} />;
  },
}));

import {
  buildMaulPlacementTracerRecord,
  MaulPlacementTracer,
} from "../MaulPlacementTracer";
import {
  MAUL_PLACEMENT_TRACER_FIXTURES,
  resolveMaulPlacementTracerCropCenterX,
  resolveWebPreviewRootRoute,
  shouldPreloadWebPreviewFonts,
} from "../sandbox-data";

describe("MAUL placement tracer", () => {
  it("routes to an isolated surface without global font preloading", () => {
    expect(resolveWebPreviewRootRoute("/maul/placement-tracer")).toBe(
      "maul-placement-tracer",
    );
    expect(resolveWebPreviewRootRoute("/maul/placement-tracer/")).toBe(
      "maul-placement-tracer",
    );
    expect(shouldPreloadWebPreviewFonts("maul-placement-tracer")).toBe(false);
  });

  it("defines all three families and exact before/after crop probes", () => {
    expect(
      MAUL_PLACEMENT_TRACER_FIXTURES.map((fixture) => fixture.probeId),
    ).toEqual([
      "measured",
      "editorial",
      "personal",
      "crop-before",
      "crop-after",
    ]);
    expect(
      new Set(
        MAUL_PLACEMENT_TRACER_FIXTURES.slice(0, 3).map(
          (fixture) => fixture.family,
        ),
      ),
    ).toEqual(new Set(["measured", "editorial", "personal"]));
    expect(resolveMaulPlacementTracerCropCenterX(14)).toBe(0.25);
    expect(resolveMaulPlacementTracerCropCenterX(15)).toBe(0.75);
    expect(
      [14, 15].map(resolveMaulPlacementTracerCropCenterX),
    ).not.toContain(0.5);
    expect(
      MAUL_PLACEMENT_TRACER_FIXTURES.map(
        (fixture) => buildMaulPlacementTracerRecord(fixture).font,
      ),
    ).toEqual(
      MAUL_PLACEMENT_TRACER_FIXTURES.map(() => ({
        profileId: "maul-compat-dm-sans-v1",
        metricsFingerprint:
          "ea9a1595e1927b2412901fad354e56a9f6eba61e9a98e7bc8769d2004fc52ee3",
        family: "DM Sans",
        assetId: "font_google_dm_sans_700",
        weight: 700,
        fontSizePx: expect.any(Number),
        lineHeight: 1.1,
        hierarchyScale: 1,
      })),
    );
  });

  it("mounts one scaled 1080x1920 Player for every proof probe", () => {
    playerSnapshots.length = 0;
    const markup = renderToStaticMarkup(<MaulPlacementTracer />);

    expect(markup).toContain('data-maul-placement-tracer="true"');
    expect(playerSnapshots).toEqual(
      MAUL_PLACEMENT_TRACER_FIXTURES.map((fixture) => ({
        probeId: fixture.probeId,
        frame: fixture.frame,
        width: 1080,
        height: 1920,
      })),
    );
    for (const fixture of MAUL_PLACEMENT_TRACER_FIXTURES) {
      expect(markup).toContain(
        `data-maul-placement-probe="${fixture.probeId}"`,
      );
      expect(markup).toContain(`data-expected-family="${fixture.family}"`);
      expect(markup).toContain(
        `data-expected-fallback="${fixture.fallbackCode ?? "none"}"`,
      );
      expect(markup).toContain('data-maul-tracer-outcome="FIXTURE_ONLY"');
      expect(markup).toContain(
        `data-maul-tracer-simulated-outcome="${fixture.fallbackCode ? "SAFE_CAPTION_FALLBACK" : "SUBJECT_AWARE_LAYOUT"}"`,
      );
      expect(markup).toContain('data-maul-tracer-hold-ms="1000"');
      expect(markup).toContain('data-maul-tracer-font-asset="font_google_dm_sans_700"');
      expect(markup).toContain('data-maul-tracer-evidence="fixture_only"');
    }
    expect(markup).not.toContain('data-maul-tracer-outcome="ART_DIRECTED"');
  });
});

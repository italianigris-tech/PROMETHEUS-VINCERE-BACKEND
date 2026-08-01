import {describe, expect, it} from "vitest";

import {resolveRenderConfigFromEnv} from "../config/render-flags";
import type {BackendEnv} from "../config";
import {
  buildJosephTypographyIntelligencePlan,
} from "../director/joseph-typography-intelligence";
import {generateTypographyDecision} from "../typography/typography-decision-engine";
import {TYPOGRAPHY_SEMANTICS_KERNEL_VERSION} from "./typography-semantics";

const words = [
  {text: "the", startMs: 0, endMs: 120, confidence: 0.98},
  {text: "critical", startMs: 140, endMs: 420, confidence: 0.96},
  {text: "system", startMs: 440, endMs: 700, confidence: 0.95},
  {text: "must", startMs: 720, endMs: 860, confidence: 0.96},
  {text: "change", startMs: 880, endMs: 1120, confidence: 0.97},
  {text: "now", startMs: 1140, endMs: 1340, confidence: 0.98},
] as const;

const sourceText = words.map((word) => word.text).join(" ");
const renderConfig = resolveRenderConfigFromEnv({
  ENABLE_FONT_GRAPH: true,
} as BackendEnv);

describe("Shared Creative Kernel typography semantics", () => {
  it("preserves semantic intent across landscape and Joseph adapters", () => {
    const landscape = generateTypographyDecision({
      text: sourceText,
      rhetoricalIntent: "authority",
      availableFonts: [
        {family: "Satoshi", source: "custom_ingested"},
        {family: "Canela", source: "custom_ingested"},
      ],
      renderConfig,
      maxLines: 3,
      maxCharsPerLine: 24,
    });
    const joseph = buildJosephTypographyIntelligencePlan({
      words,
      energyCurve: [0.5],
      durationMs: 1400,
      profile: "joseph_aggressive",
      doctrineId: "kinetic-pulse",
    });

    expect(landscape.semanticsTrace.version).toBe(
      TYPOGRAPHY_SEMANTICS_KERNEL_VERSION,
    );
    expect(joseph.semanticsTrace?.version).toBe(
      TYPOGRAPHY_SEMANTICS_KERNEL_VERSION,
    );
    expect(landscape.semanticsTrace.ruleIds).toEqual(
      joseph.semanticsTrace?.ruleIds,
    );

    const landscapeTokens = landscape.semanticsTrace.tokens;
    const josephTokens = joseph.semanticsTrace?.tokens ?? [];
    expect(landscapeTokens.map((token) => token.sourceIndex)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(josephTokens.map((token) => token.sourceIndex)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(landscapeTokens.find((token) => token.normalized === "the")?.role).toBe(
      "filler",
    );
    expect(josephTokens.find((token) => token.normalized === "the")?.role).toBe(
      "filler",
    );

    const rank = (tokens: typeof landscapeTokens) =>
      tokens
        .filter((token) =>
          ["critical", "system", "change", "now"].includes(token.normalized),
        )
        .sort(
          (left, right) =>
            right.score - left.score || left.sourceIndex - right.sourceIndex,
        )
        .map((token) => token.normalized);
    expect(rank(landscapeTokens)).toEqual(rank(josephTokens));
    expect(
      landscape.semanticsTrace.lines.every(
        (line) => line.text.length <= line.maxCharacters,
      ),
    ).toBe(true);
    expect(
      (joseph.semanticsTrace?.lines ?? []).every(
        (line) => line.tokenIndexes.length <= 3,
      ),
    ).toBe(true);

    const landscapeHero = landscape.roleStyles.find(
      (style) => style.role === "hero",
    );
    const landscapeSupport = landscape.roleStyles.find(
      (style) => style.role === "support",
    );
    const josephHero = joseph.roleStyles.find((style) => style.role === "hero");
    const josephSupport = joseph.roleStyles.find(
      (style) => style.role === "support",
    );
    expect(landscapeHero!.hierarchyScale).toBeGreaterThan(
      landscapeSupport!.hierarchyScale,
    );
    expect(josephHero!.hierarchyScale).toBeGreaterThan(
      josephSupport!.hierarchyScale,
    );
  });
});

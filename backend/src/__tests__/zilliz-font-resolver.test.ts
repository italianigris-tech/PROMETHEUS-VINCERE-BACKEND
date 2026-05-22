import {describe, expect, it, vi} from "vitest";

import {resolveFontsByVibe} from "../typography/zilliz-font-resolver";

describe("zilliz-font-resolver", () => {
  it("materializes primary and secondary fonts into served browser URLs", async () => {
    const search = vi.fn(async () => ({
      results: [
        {
          asset_id: "font_1",
          score: 0.98,
          vector_score: 0.98,
          rerank_score: 0.98,
          asset_type: "font",
          path: "C:\\Users\\HomePC\\Fonts\\Canela-Regular.otf",
          public_path: "",
          tags: ["luxury", "editorial"],
          labels: ["primary"],
          retrieval_caption: "Luxury serif",
          semantic_description: "Elegant luxury serif for restraint.",
          why_it_matched: "Luxury calm tone",
          recommended_usage: "headline",
          confidence: 0.95
        },
        {
          asset_id: "font_2",
          score: 0.92,
          vector_score: 0.92,
          rerank_score: 0.92,
          asset_type: "font",
          path: "C:\\Users\\HomePC\\Fonts\\Satoshi-Medium.woff2",
          public_path: "",
          tags: ["clean", "support"],
          labels: ["secondary"],
          retrieval_caption: "Clean support sans",
          semantic_description: "Support sans for contextual empathy.",
          why_it_matched: "Balance and restraint",
          recommended_usage: "support",
          confidence: 0.91
        }
      ],
      warnings: []
    }));
    const materialize = vi.fn(async ({family}: {family: string}) => [{
      fileName: `${family}.woff2`,
      filePath: `C:\\tmp\\retrieved\\${family}\\${family}.woff2`,
      browserUrl: `/fonts/retrieved/${family}/${family}.woff2`,
      format: "woff2" as const
    }]);

    const resolved = await resolveFontsByVibe("luxury restraint with contextual empathy", 2, {
      retrieve: search,
      materialize
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledTimes(2);
    expect(resolved.primary.family).toBe("Canela-Regular");
    expect(resolved.primary.filePath).toBe("C:\\tmp\\retrieved\\Canela-Regular\\Canela-Regular.woff2");
    expect(resolved.primary.browserUrl).toBe("/fonts/retrieved/Canela-Regular/Canela-Regular.woff2");
    expect(resolved.primary.browserUrl).not.toMatch(/^file:\/\//);
    expect(resolved.secondary?.browserUrl).toBe("/fonts/retrieved/Satoshi-Medium/Satoshi-Medium.woff2");
    expect(resolved.fallbackReasons).toEqual([]);
  });

  it("records a fallback reason when retrieval returns too few fonts", async () => {
    const resolved = await resolveFontsByVibe("controlled authority", 2, {
      retrieve: async () => ({
        results: [
          {
            asset_id: "font_1",
            score: 0.88,
            vector_score: 0.88,
            rerank_score: 0.88,
            asset_type: "font",
            path: "C:\\Users\\HomePC\\Fonts\\Single.otf",
            public_path: "",
            tags: ["authority"],
            labels: ["primary"],
            retrieval_caption: "Single option",
            semantic_description: "Only one option available.",
            why_it_matched: "Authority",
            recommended_usage: "headline",
          confidence: 0.8
        }
      ],
      warnings: []
      }),
      materialize: async ({family}: {family: string}) => [{
        fileName: `${family}.woff2`,
        filePath: `C:\\tmp\\retrieved\\${family}\\${family}.woff2`,
        browserUrl: `/fonts/retrieved/${family}/${family}.woff2`,
        format: "woff2" as const
      }]
    });

    expect(resolved.secondary).toBeUndefined();
    expect(resolved.fallbackReasons).toContain("Typography retrieval returned fewer than 2 compatible fonts.");
  });
});

import {describe, expect, it} from "vitest";

import {selectForegroundTypographyChunkIds} from "./typography-event-policy.js";

describe("MAUL foreground typography event policy", () => {
  it("reserves foreground typography for semantic state changes", () => {
    const chunks = [
      {chunkId: "hook", semanticRole: "hook", emphasis: {level: "hero" as const}, outputStartMs: 320},
      {chunkId: "context_a", semanticRole: "context", emphasis: {level: "key" as const}, outputStartMs: 2_320},
      {chunkId: "context_b", semanticRole: "context", emphasis: {level: "key" as const}, outputStartMs: 5_440},
      {chunkId: "payoff", semanticRole: "payoff", emphasis: {level: "hero" as const}, outputStartMs: 8_880},
    ];

    expect(selectForegroundTypographyChunkIds(chunks)).toEqual([
      "hook",
      "payoff",
    ]);
  });

  it("keeps the strongest chunk when no semantic state change is labeled", () => {
    expect(selectForegroundTypographyChunkIds([
      {chunkId: "context_a", semanticRole: "context", emphasis: {level: "support" as const}, outputStartMs: 0},
      {chunkId: "context_b", semanticRole: "context", emphasis: {level: "key" as const}, outputStartMs: 1_000},
    ])).toEqual(["context_b"]);
  });

  it("can compile full spoken coverage for launch renders", () => {
    const chunks = [
      {chunkId: "hook", semanticRole: "hook", emphasis: {level: "hero" as const}, outputStartMs: 0},
      {chunkId: "context", semanticRole: "context", emphasis: {level: "support" as const}, outputStartMs: 1_000},
      {chunkId: "payoff", semanticRole: "payoff", emphasis: {level: "hero" as const}, outputStartMs: 2_000},
    ];

    expect(selectForegroundTypographyChunkIds(chunks, "full")).toEqual([
      "hook",
      "context",
      "payoff",
    ]);
  });
});

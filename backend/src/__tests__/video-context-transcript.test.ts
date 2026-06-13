import {describe, expect, it} from "vitest";

import {
  mergeTranscriptChunkResults,
  planTranscriptChunks
} from "../video-context/transcript";
import {AssemblyAIChunkedBatchTranscriptAdapter} from "../video-context/worker";

describe("progressive video transcript chunking", () => {
  it("plans 10 minute chunks with 5 second overlap and bounded parallelism", () => {
    const chunks = planTranscriptChunks({
      durationMs: 60 * 60 * 1000,
      chunkSizeMs: 10 * 60 * 1000,
      overlapMs: 5000,
      maxParallel: 5
    });

    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toMatchObject({
      id: "chunk_0000",
      index: 0,
      startMs: 0,
      endMs: 10 * 60 * 1000,
      parallelGroup: 0
    });
    expect(chunks[1]).toMatchObject({
      id: "chunk_0001",
      index: 1,
      startMs: 10 * 60 * 1000 - 5000,
      parallelGroup: 1
    });
    expect(chunks[5].parallelGroup).toBe(0);
  });

  it("merges out-of-order chunk results with timestamp offsets and overlap dedupe", () => {
    const merged = mergeTranscriptChunkResults([
      {
        chunkId: "chunk_0001",
        index: 1,
        offsetMs: 595000,
        words: [
          {text: "overlap", start_ms: 0, end_ms: 100, confidence: 0.5},
          {text: "second", start_ms: 5000, end_ms: 5300, confidence: 0.9}
        ]
      },
      {
        chunkId: "chunk_0000",
        index: 0,
        offsetMs: 0,
        words: [
          {text: "first", start_ms: 1000, end_ms: 1300, confidence: 0.95},
          {text: "overlap", start_ms: 595000, end_ms: 595100, confidence: 0.6}
        ]
      }
    ]);

    expect(merged.map((word) => word.text)).toEqual(["first", "overlap", "second"]);
    expect(merged.map((word) => word.start_ms)).toEqual([1000, 595000, 600000]);
  });

  it("uses extracted audio chunk paths for the AssemblyAI batch adapter", async () => {
    const calls: Array<{filePath: string; apiKey: string}> = [];
    const adapter = new AssemblyAIChunkedBatchTranscriptAdapter(async ({filePath, apiKey}) => {
      calls.push({filePath, apiKey});
      return [
        {
          text: "chunked",
          start_ms: 0,
          end_ms: 250,
          confidence: 0.95
        }
      ];
    });

    const result = await adapter.transcribeChunk({
      videoId: "video_1",
      sourcePath: "whole-video.mp4",
      audioChunkPath: "chunk_0001.wav",
      chunk: {
        id: "chunk_0001",
        index: 1,
        startMs: 595000,
        endMs: 1200000,
        offsetMs: 595000,
        parallelGroup: 1
      },
      apiKey: "assembly-key"
    });

    expect(result.provider).toBe("assemblyai");
    expect(calls).toEqual([{filePath: "chunk_0001.wav", apiKey: "assembly-key"}]);
  });
});

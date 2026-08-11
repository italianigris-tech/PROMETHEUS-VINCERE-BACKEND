import {describe, expect, it, vi} from "vitest";

import {createHttpMattingDispatcher} from "./render-dispatch.js";

describe("Modal matting dispatcher", () => {
  it("submits all Martin windows in one batch call", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({callId: "fc-matte-1"}), {status: 202}));
    const dispatcher = createHttpMattingDispatcher({baseUrl: "http://127.0.0.1:8001/", fetchImpl: fetchImpl as typeof fetch});
    const request = {
      requestKind: "martin_matte_batch" as const,
      schemaVersion: "maul-martin-matte-request/v1" as const,
      jobId: "job-1",
      source: {inputUrl: "https://example.com/source.mp4", sha256: "a".repeat(64), durationMs: 20_000},
      selections: [],
      windows: [
        {windowId: "w1", sourceStartMs: 1000, sourceEndMs: 3000, outputStartMs: 1000, outputEndMs: 3000},
        {windowId: "w2", sourceStartMs: 8000, sourceEndMs: 10_000, outputStartMs: 8000, outputEndMs: 10_000},
      ],
    };

    await expect(dispatcher.spawn(request)).resolves.toEqual({callId: "fc-matte-1"});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:8001/matte/spawn", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({request}),
    }));
  });
});

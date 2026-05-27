import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";
import type {BackendAppContext} from "../app";

const waitFor = async (predicate: () => Promise<boolean>, attempts = 160, delayMs = 50): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Timed out waiting for diagnostics route state.");
};

describe("convergence diagnostics route", () => {
  let tempDir: string;
  let context: BackendAppContext | null = null;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    if (context) {
      await context.app.close();
      context = null;
    }
    await cleanupTempDir(tempDir);
  });

  it("exposes visible model degradation instead of hiding deterministic recovery", async () => {
    context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        GROQ_API_KEY: "test-groq-key",
        PRIMARY_GENERATION_MODEL: "gpt-5",
        CRITIC_MODEL: "gpt-5.5"
      },
      deps: {
        fetchImpl: async () => new Response("forced model failure", {status: 500})
      }
    });

    const submit = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Find the most cinematic proof moment.",
        provided_transcript: [
          {text: "This", start_ms: 0, end_ms: 120, confidence: 0.99},
          {text: "proof", start_ms: 120, end_ms: 360, confidence: 0.99},
          {text: "matters", start_ms: 360, end_ms: 720, confidence: 0.99}
        ]
      }
    });

    expect(submit.statusCode).toBe(202);
    const body = submit.json() as {job_id: string};

    await waitFor(async () => {
      const status = await context!.app.inject({
        method: "GET",
        url: `/api/jobs/${body.job_id}`
      });
      const statusBody = status.json() as {current_stage?: string; artifact_availability?: {fallback_log?: boolean}};
      return statusBody.current_stage === "completed" && statusBody.artifact_availability?.fallback_log === true;
    });

    const diagnostics = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${body.job_id}/diagnostics`
    });
    expect(diagnostics.statusCode).toBe(200);
    const diagnosticsBody = diagnostics.json() as {
      diagnostics: {
        visibleFailures: Array<{code: string; fallbackCause: string | null; visibleToFrontend: boolean}>;
        degradedStages: string[];
        hallucinationProbability: number;
      };
    };

    expect(diagnosticsBody.diagnostics.visibleFailures.length).toBeGreaterThan(0);
    expect(diagnosticsBody.diagnostics.visibleFailures[0]?.visibleToFrontend).toBe(true);
    expect(diagnosticsBody.diagnostics.visibleFailures[0]?.fallbackCause).toBe("deterministic_recovery");
    expect(diagnosticsBody.diagnostics.degradedStages.length).toBeGreaterThan(0);
    expect(diagnosticsBody.diagnostics.hallucinationProbability).toBeGreaterThan(0);
  }, 20000);
});

import {describe, expect, it} from "vitest";

import {
  createExecutionRouter,
  determineExecutionCapability
} from "../execution-router";
import {MainVideoExecutor} from "../executors/main-video-executor";
import type {PipelineExecutor} from "../executors/executor-contract";
import type {PipelineExecutionContext} from "../execution-context";
import type {NormalizedJobRequest} from "../schemas";

const buildRequest = (overrides: Partial<NormalizedJobRequest> = {}): NormalizedJobRequest => ({
  job_id: "job-router-contract",
  prompt: "Build a normal edit.",
  source_media_ref: undefined,
  input_source_video: null,
  input_assets: [],
  descriptor_assets: [],
  creator_niche: undefined,
  target_platform: undefined,
  min_clip_count: undefined,
  max_clip_count: undefined,
  metadata_overrides: {},
  provided_transcript: undefined,
  sound_design_manifest: undefined,
  ...overrides
});

const buildExecutor = (
  capability: PipelineExecutor["capability"] extends () => infer T ? T : never,
  calls: string[]
): PipelineExecutor => ({
  capability: () => capability,
  execute: async () => {
    calls.push(capability);
    return {
      capability,
      state: "RENDER_READY",
      warnings: [],
      fallbackEvents: []
    };
  }
});

const buildContext = (request: NormalizedJobRequest): PipelineExecutionContext => ({
  request,
  repository: {} as PipelineExecutionContext["repository"],
  env: {} as PipelineExecutionContext["env"],
  deps: {},
  telemetry: null,
  assetRegistry: null,
  metadata: null,
  transcript: null,
  logger: console,
  storage: null,
  sourceMediaProfile: null,
  motionTrace: null
});

describe("execution router contract", () => {
  it("routes short-form platform jobs to the short-form executor", () => {
    const decision = determineExecutionCapability(buildRequest({
      target_platform: "shorts"
    }));

    expect(decision.capability).toBe("short_form");
    expect(decision.routing_reason).toMatch(/target platform/i);
  });

  it("keeps standard jobs on the main video executor", () => {
    const decision = determineExecutionCapability(buildRequest({
      target_platform: "youtube",
      prompt: "Build a polished long-form edit."
    }));

    expect(decision.capability).toBe("main_video");
  });

  it("routes generate-viral-clips request shape to short form without relying on prompt wording", () => {
    const decision = determineExecutionCapability(buildRequest({
      project_id: "project-origin",
      video_id: "video-origin",
      target_platform: "youtube",
      prompt: "Use this source."
    }));

    expect(decision.capability).toBe("short_form");
    expect(decision.routing_reason).toMatch(/viral clip request shape/i);
  });

  it("falls back to main video when the selected executor is unavailable", async () => {
    const calls: string[] = [];
    const router = createExecutionRouter({
      executors: [buildExecutor("main_video", calls)]
    });

    const result = await router.execute(buildContext(buildRequest({
      target_platform: "tiktok"
    })));

    expect(result.capability).toBe("main_video");
    expect(calls).toEqual(["main_video"]);
    expect(result.fallbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: "execution_routing",
        code: "executor_fallback_to_main"
      })
    ]));
  });

  it("supports executor swapping without changing caller code", async () => {
    const calls: string[] = [];
    const router = createExecutionRouter({
      executors: [
        buildExecutor("main_video", calls),
        buildExecutor("short_form", calls)
      ]
    });

    const result = await router.execute(buildContext(buildRequest({
      metadata_overrides: {
        short_form_intent: true
      }
    })));

    expect(result.capability).toBe("short_form");
    expect(calls).toEqual(["short_form"]);
  });

  it("keeps MainVideoExecutor independent from the concrete short-form executor", async () => {
    const calls: string[] = [];
    const executor = new MainVideoExecutor({
      runSharedPipeline: async () => {
        calls.push("shared-runner");
        return {
          capability: "main_video",
          state: "RENDER_READY",
          warnings: [],
          fallbackEvents: []
        };
      }
    });

    const result = await executor.execute(buildContext(buildRequest()));

    expect(result.capability).toBe("main_video");
    expect(calls).toEqual(["shared-runner"]);
  });
});

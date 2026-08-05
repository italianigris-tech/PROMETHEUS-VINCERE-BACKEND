import {describe, expect, it, vi} from "vitest";

import {createCreativeTreatmentPlanner} from "./creative-treatment-planner.js";

const request = {
  sourceProfile: "single_speaker_talking_head" as const,
  platform: "instagram_reels" as const,
  transcript: "Wait. These, my friends, are designed to capture attention instantly.",
  treatmentId: "premium_direct_response" as const,
  referenceTraits: [
    "bold neutral grotesk",
    "selective amber emphasis",
    "contrasting editorial italic accent",
    "stable phrase-level lockups",
  ],
  sceneEvidenceStatus: "available" as const,
};

const providerTreatment = {
  schemaVersion: "maul-creative-treatment-proposal/v1",
  profileId: "aspire_visual_hook",
  compositionDirection: "subject_integrated",
  primaryTypeRole: "neutral_grotesk",
  accentTypeRole: "editorial_italic",
  palette: {
    primary: "#F7F3EA",
    accent: "#F06424",
    sourceTreatment: "dark_warm_cool_contrast",
  },
  textDensity: "medium",
  emphasisMode: "selective_accent_phrase",
  motionMode: "restrained_phrase_lockup",
  rationale: [
    "Keep the speaker dominant.",
    "Use the accent only on the semantic hinge.",
  ],
};

const config = {
  baseUrl: "https://provider.example",
  path: "/v1/chat/completions",
  apiKey: "test-key",
  model: "gpt-5.6-terra",
  reasoningEffort: "high" as const,
  temperature: 0.2,
  maxOutputTokens: 1800,
  timeoutMs: 10_000,
};

describe("MAUL creative treatment planner", () => {
  it("invokes Terra with high reasoning and returns a validated visual-hook treatment", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: "gpt-5.6-terra",
        reasoning_effort: "high",
        temperature: 0.2,
        response_format: {type: "json_object"},
      });
      expect(body.messages[0].content).toContain("must not emit coordinates");
      expect(body.messages[0].content).toContain("must not rewrite dialogue");
      return new Response(JSON.stringify({
        choices: [{message: {content: JSON.stringify(providerTreatment)}}],
      }), {status: 200, headers: {"content-type": "application/json"}});
    });
    const planner = createCreativeTreatmentPlanner({config, fetchImpl});

    const result = await planner.plan(request);

    expect(result).toMatchObject({
      status: "invoked",
      treatment: providerTreatment,
      receipt: {
        provider: "openai_compatible",
        model: "gpt-5.6-terra",
        reasoningEffort: "high",
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        responseHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        fallbackReason: null,
      },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses an explicit Aspire fallback when credentials are absent", async () => {
    const fetchImpl = vi.fn();
    const planner = createCreativeTreatmentPlanner({
      config: {...config, apiKey: ""},
      fetchImpl,
    });

    const result = await planner.plan(request);

    expect(result).toMatchObject({
      status: "skipped_missing_credentials",
      treatment: {profileId: "aspire_visual_hook"},
      receipt: {
        model: "gpt-5.6-terra",
        fallbackReason: expect.stringMatching(/credential/i),
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid provider output and preserves a governed fallback", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{message: {content: JSON.stringify({
        ...providerTreatment,
        compositionDirection: "pixel_coordinates_from_model",
      })}}],
    }), {status: 200}));
    const planner = createCreativeTreatmentPlanner({config, fetchImpl});

    const result = await planner.plan(request);

    expect(result).toMatchObject({
      status: "failed_invalid_response",
      treatment: {profileId: "aspire_visual_hook"},
      receipt: {fallbackReason: expect.stringMatching(/invalid/i)},
    });
  });
});

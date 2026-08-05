import {createHash} from "node:crypto";

import {z} from "zod";

type FetchLike = typeof fetch;

const MAX_RESPONSE_BYTES = 256_000;

export const creativeTreatmentProposalSchema = z.object({
  schemaVersion: z.literal("maul-creative-treatment-proposal/v1"),
  profileId: z.literal("aspire_visual_hook"),
  compositionDirection: z.enum([
    "editorial_asymmetry",
    "poster_hero",
    "subject_integrated",
    "restrained_minimal",
  ]),
  primaryTypeRole: z.enum(["neutral_grotesk", "editorial_display"]),
  accentTypeRole: z.enum(["editorial_italic", "neutral_grotesk"]),
  palette: z.object({
    primary: z.string().regex(/^#[a-f0-9]{6}$/i),
    accent: z.string().regex(/^#[a-f0-9]{6}$/i),
    sourceTreatment: z.enum([
      "dark_warm_cool_contrast",
      "source_neutral",
      "high_contrast_monochrome",
    ]),
  }),
  textDensity: z.enum(["low", "medium", "high"]),
  emphasisMode: z.enum([
    "selective_accent_phrase",
    "scale_contrast",
    "editorial_italic_hinge",
  ]),
  motionMode: z.enum([
    "restrained_phrase_lockup",
    "soft_scale_settle",
    "static_editorial_hold",
  ]),
  rationale: z.array(z.string().trim().min(1)).min(1).max(6),
}).strict();

export type CreativeTreatmentProposal = z.infer<
  typeof creativeTreatmentProposalSchema
>;

export type CreativeTreatmentPlannerRequest = {
  sourceProfile: "single_speaker_talking_head" | "single_speaker_podcast";
  platform: "instagram_reels" | "youtube_shorts" | "tiktok" | "linkedin" | "other";
  transcript: string;
  treatmentId: "founder_podcast" | "premium_direct_response" | "minimal_expert";
  referenceTraits: string[];
  sceneEvidenceStatus: "available" | "unavailable";
};

export type CreativeTreatmentPlannerStatus =
  | "invoked"
  | "skipped_missing_credentials"
  | "failed_request"
  | "failed_invalid_response";

export type CreativeTreatmentPlannerResult = {
  status: CreativeTreatmentPlannerStatus;
  treatment: CreativeTreatmentProposal;
  receipt: {
    provider: "openai_compatible";
    model: string;
    reasoningEffort: "medium" | "high";
    requestHash: string | null;
    responseHash: string | null;
    inferenceReceiptId: string | null;
    fallbackReason: string | null;
  };
};

export interface CreativeTreatmentPlanner {
  plan(request: CreativeTreatmentPlannerRequest): Promise<CreativeTreatmentPlannerResult>;
}

export type CreativeTreatmentPlannerConfig = {
  baseUrl: string;
  path: string;
  apiKey: string;
  model: string;
  reasoningEffort: "medium" | "high";
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

const fallbackTreatment: CreativeTreatmentProposal = {
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
    "Use the governed Aspire visual-hook fallback until model authority is available.",
  ],
};

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const endpointFor = (config: CreativeTreatmentPlannerConfig): string => {
  const endpoint = new URL(config.baseUrl);
  const base = endpoint.pathname.split("/").filter(Boolean);
  const route = config.path.split("/").filter(Boolean);
  let overlap = Math.min(base.length, route.length);
  while (
    overlap > 0 &&
    base.slice(-overlap).join("/") !== route.slice(0, overlap).join("/")
  ) {
    overlap -= 1;
  }
  endpoint.pathname = `/${[...base, ...route.slice(overlap)].join("/")}`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
};

const systemPrompt = `
You are MAUL's bounded creative treatment planner for one-principal-speaker 9:16 shorts.

Produce one treatment proposal in the required JSON shape. Use only supplied transcript meaning, source profile, scene-evidence availability, approved abstract reference traits, and treatment identity.

Reference target: a visual-hook edit with a dominant speaker, dark warm/cool source treatment, bold neutral grotesk phrase lockups, selective ivory and amber hierarchy, a contrasting editorial italic accent, stable centered or subject-safe composition, and restrained readable phrase-level motion.

Authority rules:
- You must not emit coordinates, crop boxes, masks, timestamps, font asset IDs, render commands, review outcomes, or release status.
- You must not rewrite dialogue, invent source facts, or quote reference identity.
- Select only enum values present in the required JSON shape.
- Prefer one coherent treatment grammar with beat-to-beat variation over generic bottom captions or every-word novelty motion.
- Return one JSON object only, without Markdown.

Required JSON shape:
{
  "schemaVersion": "maul-creative-treatment-proposal/v1",
  "profileId": "aspire_visual_hook",
  "compositionDirection": "editorial_asymmetry|poster_hero|subject_integrated|restrained_minimal",
  "primaryTypeRole": "neutral_grotesk|editorial_display",
  "accentTypeRole": "editorial_italic|neutral_grotesk",
  "palette": {
    "primary": "#RRGGBB",
    "accent": "#RRGGBB",
    "sourceTreatment": "dark_warm_cool_contrast|source_neutral|high_contrast_monochrome"
  },
  "textDensity": "low|medium|high",
  "emphasisMode": "selective_accent_phrase|scale_contrast|editorial_italic_hinge",
  "motionMode": "restrained_phrase_lockup|soft_scale_settle|static_editorial_hold",
  "rationale": ["source-grounded reason"]
}`.trim();

const responseEnvelopeSchema = z.object({
  choices: z.array(z.object({
    message: z.object({content: z.string()}),
  })).min(1),
});

const boundedResponse = async (response: Response): Promise<string> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Creative treatment response exceeded its size limit.");
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
    throw new Error("Creative treatment response exceeded its size limit.");
  }
  return text;
};

const fallback = ({
  status,
  config,
  requestHash,
  responseHash,
  reason,
}: {
  status: Exclude<CreativeTreatmentPlannerStatus, "invoked">;
  config: CreativeTreatmentPlannerConfig;
  requestHash: string | null;
  responseHash: string | null;
  reason: string;
}): CreativeTreatmentPlannerResult => ({
  status,
  treatment: fallbackTreatment,
  receipt: {
    provider: "openai_compatible",
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    requestHash,
    responseHash,
    inferenceReceiptId: null,
    fallbackReason: reason,
  },
});

export const createCreativeTreatmentPlanner = ({
  config: inputConfig,
  fetchImpl = fetch,
}: {
  config: CreativeTreatmentPlannerConfig;
  fetchImpl?: FetchLike;
}): CreativeTreatmentPlanner => {
  const config = {
    ...inputConfig,
    baseUrl: inputConfig.baseUrl.trim().replace(/\/+$/, ""),
    path: inputConfig.path.trim(),
    apiKey: inputConfig.apiKey.trim(),
    model: inputConfig.model.trim(),
  };
  new URL(config.baseUrl);

  return {
    async plan(request) {
      if (!config.apiKey) {
        return fallback({
          status: "skipped_missing_credentials",
          config,
          requestHash: null,
          responseHash: null,
          reason: "MAUL creative-planner credentials are not configured.",
        });
      }

      const body = JSON.stringify({
        model: config.model,
        reasoning_effort: config.reasoningEffort,
        temperature: config.temperature,
        max_completion_tokens: config.maxOutputTokens,
        response_format: {type: "json_object"},
        messages: [
          {role: "system", content: systemPrompt},
          {role: "user", content: JSON.stringify(request)},
        ],
      });
      const requestHash = hash(body);
      let responseHash: string | null = null;
      try {
        const response = await fetchImpl(endpointFor(config), {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(config.timeoutMs),
        });
        const responseText = await boundedResponse(response);
        if (!response.ok) {
          throw new Error(`Creative treatment provider returned HTTP ${response.status}.`);
        }
        responseHash = hash(responseText);
        try {
          const envelope = responseEnvelopeSchema.parse(JSON.parse(responseText));
          const treatment = creativeTreatmentProposalSchema.parse(
            JSON.parse(envelope.choices[0]!.message.content.trim()),
          );
          return {
            status: "invoked",
            treatment,
            receipt: {
              provider: "openai_compatible",
              model: config.model,
              reasoningEffort: config.reasoningEffort,
              requestHash,
              responseHash,
              inferenceReceiptId: `maul_creative_${responseHash.slice(0, 24)}`,
              fallbackReason: null,
            },
          };
        } catch {
          return fallback({
            status: "failed_invalid_response",
            config,
            requestHash,
            responseHash,
            reason: "MAUL creative-planner provider returned an invalid treatment proposal.",
          });
        }
      } catch {
        return fallback({
          status: "failed_request",
          config,
          requestHash,
          responseHash,
          reason: "MAUL creative-planner provider request failed.",
        });
      }
    },
  };
};

export const createUnavailableCreativeTreatmentPlanner = (
  reason = 'No MAUL creative-treatment planner is configured.',
): CreativeTreatmentPlanner => ({
  async plan() {
    return {
      status: 'skipped_missing_credentials',
      treatment: fallbackTreatment,
      receipt: {
        provider: 'openai_compatible',
        model: 'unavailable',
        reasoningEffort: 'high',
        requestHash: null,
        responseHash: null,
        inferenceReceiptId: null,
        fallbackReason: reason,
      },
    };
  },
});

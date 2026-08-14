import {z} from "zod";
import {maybeCallGroqJson} from "../groq";
import type {BackendEnv} from "../config";

const thumbnailPromptSchema = z.object({
  keywords: z.string().describe("Punchy 2-3 word visual text hook (NEVER repeat title)"),
  visualPrompt: z.string().describe("8K cinematic visual background & prop prompt for image generation"),
  colorTheme: z.enum(["electric_yellow", "vibrant_lime", "warning_red", "electric_cyan"]).default("electric_yellow"),
  subjectExpression: z.enum(["intense_curiosity", "shock_surprise", "unshakeable_authority", "skeptical_glare"]).default("intense_curiosity"),
  layoutZones: z.object({
    zone1_left_subject: z.string().describe("Description of left 50% subject cutout"),
    zone2_top_right_text: z.string().describe("Description of top right text lockup and container"),
    zone3_bottom_right_prop: z.string().describe("Description of bottom right visual proof element")
  })
});

export type ThumbnailPromptContext = {
  transcriptSnippet: string;
  speakerName?: string;
  styleReferenceName?: string;
};

export type ThumbnailPromptOutput = z.infer<typeof thumbnailPromptSchema>;

export const generateThumbnailPrompt = async (
  env: BackendEnv,
  context: ThumbnailPromptContext
): Promise<ThumbnailPromptOutput | null> => {
  const systemPrompt = `You are a world-class YouTube thumbnail strategist and art director behind top-performing channels (My First Million, Codie Sanchez, MrBeast).

Your objective is to generate an A/B test winning thumbnail blueprint based on the 5 LAWS OF HIGH-CTR THUMBNAILS:

1. LAW OF INTRIGUE GAP (TEXT HOOK):
   - Text hook MUST be MAX 2 to 3 words. Short, loud, and punchy.
   - NEVER repeat the video title. The thumbnail text MUST complete the thought or raise an unanswered question.
   - Example: Title "How To Build A 100 Year Old Company" -> Thumbnail Text: "THE $1B BLUEPRINT"

2. LAW OF THE 3-ZONE LAYOUT GRID:
   - Zone 1 (Left 50%): Tight facial crop of speaker with intense emotion (Curiosity, Shock, Authority, or Skepticism). Cleanly isolated background cutout.
   - Zone 2 (Right Top): Bold 2-3 word text hook in high-contrast neon yellow/lime text on a dark backplate/pill.
   - Zone 3 (Right Bottom/Center): Single high-impact visual proof prop (spiking chart, money stack, before/after split arrow, mystery box).

3. LAW OF COLOR & CONTRAST:
   - Dark obsidian/slate background with soft radial light flare behind the speaker's head.
   - High contrast text accent: Electric Yellow (#FED101), Lime Green (#A3E635), Warning Red (#EF4444), or Cyan (#06B6D4).

Respond ONLY in strict JSON matching the schema:
{
  "keywords": "2-3 WORDS MAX",
  "visualPrompt": "Detailed 8K prompt describing cinematic background, lighting, and props",
  "colorTheme": "electric_yellow | vibrant_lime | warning_red | electric_cyan",
  "subjectExpression": "intense_curiosity | shock_surprise | unshakeable_authority | skeptical_glare",
  "layoutZones": {
    "zone1_left_subject": "Description for left subject cutout",
    "zone2_top_right_text": "Description for top right text lockup",
    "zone3_bottom_right_prop": "Description for visual proof prop"
  }
}`;

  const userPrompt = `
Video Transcript Snippet:
"""
${context.transcriptSnippet}
"""

Requested Style Reference: ${context.styleReferenceName ?? "High-CTR SaaS & Creator Benchmark"}
Speaker: ${context.speakerName ?? "Creator"}

Generate the high-CTR thumbnail strategy blueprint.
  `.trim();

  return await maybeCallGroqJson({
    env,
    schema: thumbnailPromptSchema,
    systemPrompt,
    userPrompt
  });
};


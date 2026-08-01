import {spawn} from "node:child_process";

import type {MaulThumbnailDirectionPayload} from "@prometheus/shared-types";

export type MaulThumbnailGeneratorInput = {
  sourcePath: string;
  sourceMs: number;
  copy: string;
  prompt: string;
  variationIndex: number;
  brandKit: MaulThumbnailDirectionPayload["brandKit"];
};

export type MaulThumbnailGeneratorResult = {
  bytes: Buffer;
  mediaType: "image/png" | "image/jpeg" | "image/svg+xml";
  provider: "nano_banana" | "deterministic_source_frame_svg";
  model: string;
  generationId: string;
  width?: number;
  height?: number;
};

export type MaulThumbnailGenerator = (
  input: MaulThumbnailGeneratorInput
) => Promise<MaulThumbnailGeneratorResult>;

const extractSourceFrame = async (
  sourcePath: string,
  sourceMs: number,
  ffmpegBinary = "ffmpeg"
): Promise<Buffer> => new Promise((resolve, reject) => {
  const child = spawn(ffmpegBinary, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    (sourceMs / 1000).toFixed(3),
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "pipe:1"
  ], {windowsHide: true});
  const chunks: Buffer[] = [];
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  child.on("error", reject);
  child.on("close", (code) => {
    const bytes = Buffer.concat(chunks);
    if (code !== 0 || bytes.length === 0) {
      reject(new Error(`MAUL thumbnail frame extraction failed: ${stderr.trim() || `FFmpeg exited ${code}`}`));
      return;
    }
    resolve(bytes);
  });
});

const escapeXml = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const deterministicFallback = ({
  frame,
  input,
  reason
}: {
  frame: Buffer;
  input: MaulThumbnailGeneratorInput;
  reason: string;
}): MaulThumbnailGeneratorResult => {
  const copy = escapeXml(input.copy.toUpperCase());
  const fontSize = copy.length > 32 ? 62 : copy.length > 20 ? 76 : 92;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <image width="1280" height="720" href="data:image/jpeg;base64,${frame.toString("base64")}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#shade)"/>
  <defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${input.brandKit.primaryColor}" stop-opacity="0.96"/><stop offset="0.58" stop-color="${input.brandKit.primaryColor}" stop-opacity="0.36"/><stop offset="1" stop-color="#000" stop-opacity="0.08"/></linearGradient></defs>
  <rect x="72" y="92" width="12" height="486" rx="6" fill="${input.brandKit.accentColor}"/>
  <text x="122" y="260" fill="#fff" font-family="${escapeXml(input.brandKit.fontFamily)}, Arial, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-2">
    <tspan x="122" dy="0">${copy.slice(0, 24)}</tspan>
    ${copy.length > 24 ? `<tspan x="122" dy="100">${copy.slice(24, 48)}</tspan>` : ""}
  </text>
  <metadata>${escapeXml(reason)}</metadata>
</svg>`;
  return {
    bytes: Buffer.from(svg, "utf8"),
    mediaType: "image/svg+xml",
    provider: "deterministic_source_frame_svg",
    model: "maul-source-frame-svg/v1",
    generationId: `fallback-${input.variationIndex}`,
    width: 1280,
    height: 720
  };
};

export const createNanoBananaThumbnailGenerator = ({
  apiKey = process.env.GEMINI_API_KEY ?? "",
  model = process.env.MAUL_NANO_BANANA_MODEL ?? "gemini-3.1-flash-image",
  fetchImpl = fetch,
  ffmpegBinary = process.env.FFMPEG_PATH ?? "ffmpeg"
}: {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  ffmpegBinary?: string;
} = {}): MaulThumbnailGenerator => async (input) => {
  const frame = await extractSourceFrame(input.sourcePath, input.sourceMs, ffmpegBinary);
  if (!apiKey.trim()) {
    return deterministicFallback({frame, input, reason: "GEMINI_API_KEY was not configured."});
  }
  try {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {"Content-Type": "application/json", "x-goog-api-key": apiKey},
        body: JSON.stringify({
          contents: [{
            parts: [
              {text: input.prompt},
              {inlineData: {mimeType: "image/jpeg", data: frame.toString("base64")}}
            ]
          }],
          generationConfig: {
            responseModalities: ["Image"],
            responseFormat: {image: {aspectRatio: "16:9", imageSize: "1K"}}
          }
        })
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const payload = await response.json() as {
      candidates?: Array<{content?: {parts?: Array<{inlineData?: {mimeType?: string; data?: string}}>}}>;
      responseId?: string;
    };
    const image = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.inlineData)
      .find((part) => typeof part?.data === "string");
    if (!image?.data) {
      throw new Error("Nano Banana returned no inline image data.");
    }
    const mediaType = image.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
    return {
      bytes: Buffer.from(image.data, "base64"),
      mediaType,
      provider: "nano_banana",
      model,
      generationId: payload.responseId ?? `nano-${input.variationIndex}`,
      width: 1376,
      height: 768
    };
  } catch (error) {
    return deterministicFallback({
      frame,
      input,
      reason: `Nano Banana fallback: ${error instanceof Error ? error.message : String(error)}`
    });
  }
};

export const defaultMaulThumbnailGenerator = createNanoBananaThumbnailGenerator();

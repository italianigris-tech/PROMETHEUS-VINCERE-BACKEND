import path from "node:path";
import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";
import {bundle} from "@remotion/bundler";
import {getCompositions, renderMedia} from "@remotion/renderer";
import {renderManifestSchema, type RenderManifest} from "@prometheus/shared-types";

import {PROMETHEUS_SAMPLE_COMPOSITION_ID} from "./Root.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(dirname, "..", "src");
const defaultEntryPoint = path.join(sourceRoot, "remotion-entry.tsx");

export type RenderJobInput = {
  manifest: RenderManifest;
  compositionId?: string;
  outputLocation?: string;
};

export type RenderJobOutput = {
  jobId: string;
  compositionId: string;
  outputLocation: string;
};

export const renderPrometheusJob = async (input: RenderJobInput): Promise<RenderJobOutput> => {
  const manifest = renderManifestSchema.parse(input.manifest);
  const compositionId = input.compositionId ?? PROMETHEUS_SAMPLE_COMPOSITION_ID;
  const outputLocation = input.outputLocation ?? path.join("/tmp", `${manifest.jobId}.mp4`);
  const serveUrl = await bundle({
    entryPoint: defaultEntryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          ...config.resolve?.extensionAlias,
          ".js": [".ts", ".tsx", ".js"]
        }
      }
    })
  });
  const compositions = await getCompositions(serveUrl, {
    inputProps: {manifest}
  });
  const composition = compositions.find((candidate) => candidate.id === compositionId);

  if (!composition) {
    throw new Error(`Composition not found: ${compositionId}`);
  }

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    imageFormat: "jpeg",
    outputLocation,
    inputProps: {manifest},
    chromiumOptions: {
      gl: "angle"
    }
  });

  return {
    jobId: manifest.jobId,
    compositionId,
    outputLocation
  };
};

export const renderFromManifest = async (manifest: RenderManifest): Promise<string> => {
  const result = await renderPrometheusJob({manifest});
  return result.outputLocation;
};

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const readPayload = async (): Promise<RenderJobInput> => {
  const payloadPath = process.argv[2];
  const raw = payloadPath ? await readFile(payloadPath, "utf8") : await readStdin();
  const payload = JSON.parse(raw) as RenderJobInput | {input: RenderJobInput};
  return "input" in payload ? payload.input : payload;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const payload = await readPayload();
  const result = await renderPrometheusJob(payload);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

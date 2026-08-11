import {performance} from "node:perf_hooks";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {maulUnifiedShortRenderManifestSchema} from "@prometheus/shared-types";

import {renderMaulShortLocally} from "../render-engine.js";

const manifestPath = path.resolve(process.argv[2] ?? "");
const outputDirectory = path.resolve(process.argv[3] ?? "");
const concurrency = Number(process.argv[4] ?? 6);
const martinReceiptPath = process.argv[5] ? path.resolve(process.argv[5]) : null;
if (!manifestPath || !outputDirectory || !Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error("Usage: render-frame-animation-manifest <manifest.json> <output-dir> [concurrency]");
}

const started = performance.now();
const loadStarted = performance.now();
const wrapper = JSON.parse(await readFile(manifestPath, "utf8")) as {manifest?: unknown};
const rawManifest = wrapper.manifest ?? wrapper;
const martinReceipt = martinReceiptPath
  ? JSON.parse(await readFile(martinReceiptPath, "utf8")) as {martinDepth?: unknown}
  : null;
const manifest = maulUnifiedShortRenderManifestSchema.parse({
  ...(rawManifest as Record<string, unknown>),
  ...(martinReceipt?.martinDepth ? {martinDepth: martinReceipt.martinDepth} : {}),
});
const manifestLoadMs = performance.now() - loadStarted;
await mkdir(outputDirectory, {recursive: true});

const sampleTimesMs = manifest.schemaVersion !== "maul-unified-short-render-manifest/v1"
  ? manifest.plans.textPlacement.segments.slice(0, 4)
    .map((segment) => Math.round((segment.outputStartMs + segment.outputEndMs) / 2))
  : [];
const renderStarted = performance.now();
const rendered = await renderMaulShortLocally({
  workRoot: path.join(outputDirectory, "render-work"),
  manifest,
  renderMode: "final",
  previewFrameTimesMs: sampleTimesMs,
  observationMode: "creative",
  renderConcurrency: concurrency,
});
const renderMs = performance.now() - renderStarted;

const writeStarted = performance.now();
const videoPath = path.join(outputDirectory, "maul-frame-animation-proof.mp4");
await writeFile(videoPath, rendered.bytes);
const artifactWriteMs = performance.now() - writeStarted;
const receipt = {
  schemaVersion: "maul-frame-animation-render-receipt/v1",
  videoPath,
  sha256: rendered.sha256,
  width: rendered.width,
  height: rendered.height,
  durationMs: rendered.durationMs,
  concurrency,
  martinDepthAttached: Boolean(martinReceipt?.martinDepth),
  timingsMs: {
    manifestLoad: Number(manifestLoadMs.toFixed(3)),
    remotionRender: Number(renderMs.toFixed(3)),
    artifactWrite: Number(artifactWriteMs.toFixed(3)),
    total: Number((performance.now() - started).toFixed(3)),
  },
};
await writeFile(
  path.join(outputDirectory, "render-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);

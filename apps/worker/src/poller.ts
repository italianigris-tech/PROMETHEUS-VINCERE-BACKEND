import {UnifiedRenderManifestSchema, type UnifiedRenderManifest} from "@prometheus/shared-types";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {mkdir} from "node:fs/promises";
import type {z} from "zod";

import {renderFailureTagsForError, renderFromManifest} from "./index.js";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = Number.parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(REPO_ROOT, "data", "media"));
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, "../../../remotion-app/public/dev-fixtures/test-video.mp4");
const SAMPLE_VIDEO_BROWSER_URL = "/dev-fixtures/test-video.mp4";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export type PollOnceResult = "idle" | "rendered" | "failed";

type PollOnceOptions = {
  apiBase?: string;
};

const issueSummary = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");

const postJobFailure = async ({
  apiBase,
  jobId,
  errorMessage,
  failureTags,
}: {
  apiBase: string;
  jobId: string;
  errorMessage: string;
  failureTags: string[];
}): Promise<void> => {
  await fetch(`${apiBase}/api/v1/render/jobs/${jobId}/failed`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({errorMessage, failureTags}),
  });
};

const leasedJobId = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as {jobId?: unknown}).jobId;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
};

const buildSampleJosephManifest = (): UnifiedRenderManifest => UnifiedRenderManifestSchema.parse({
  version: "2.0",
  jobId: "123e4567-e89b-12d3-a456-426614174999",
  seed: 424242,
  createdAt: "2026-01-01T00:00:00.000Z",
  durationFrames: 90,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: SAMPLE_VIDEO_BROWSER_URL, startFrame: 0, endFrame: 89}],
  cameraMoves: [{type: "push_in", startFrame: 0, endFrame: 45}],
  textOverlays: [{text: "PROMETHEUS", startFrame: 8, endFrame: 42, animation: "pop", color: "#FF0040"}],
  transitions: [{startFrame: 55, endFrame: 66}],
  source: {
    videoUrl: SAMPLE_VIDEO_BROWSER_URL,
    audioUrl: SAMPLE_VIDEO_PATH,
    transcript: [{text: "Prometheus", startMs: 0, endMs: 1200}],
    durationMs: 3000,
    width: 1920,
    height: 1080,
    fps: 30,
  },
  audio: {
    beats: [400, 900, 1500],
    onsets: [0, 900],
    sfx: [],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [],
  creativeProfile: {
    name: "joseph_cinematic",
    cutDensity: 0.5,
    textDensity: 0.6,
    sfxDensity: 0.2,
    cameraAggression: 0.5,
    colorIntensity: 0.5,
  },
  output: {
    width: 1080,
    height: 1920,
    fps: 30,
    codec: "h264",
    crf: 18,
  },
});

export const pollAndRender = async (): Promise<void> => {
  while (true) {
    try {
      await pollOnce();
    } catch (error) {
      console.error("[Poller] Error:", error);
    }
    await sleep(POLL_INTERVAL_MS);
  }
};

export const pollOnce = async ({apiBase = API_BASE}: PollOnceOptions = {}): Promise<PollOnceResult> => {
  const res = await fetch(`${apiBase}/api/v1/render/jobs/next`);
  if (res.status === 204) {
    return "idle";
  }
  if (!res.ok) {
    throw new Error(`Poll failed: ${res.status}`);
  }

  const rawManifest = await res.json();
  const parseResult = UnifiedRenderManifestSchema.safeParse(rawManifest);
  if (!parseResult.success) {
    const jobId = leasedJobId(rawManifest);
    if (!jobId) {
      throw new Error(`Leased render job failed UnifiedRenderManifest validation without a jobId: ${issueSummary(parseResult.error)}`);
    }

    await postJobFailure({
      apiBase,
      jobId,
      errorMessage: `UnifiedRenderManifest validation failed in worker: ${issueSummary(parseResult.error)}`,
      failureTags: ["manifest_schema", "worker_validation"],
    });
    return "failed";
  }

  const manifest = parseResult.data;
  try {
    await mkdir(MEDIA_DIR, {recursive: true});
    const outputPath = await renderFromManifest(manifest, {tempDir: MEDIA_DIR});
    const outputUrl = `${apiBase.replace(/\/+$/, "")}/media/${encodeURIComponent(path.basename(outputPath))}`;

    await fetch(`${apiBase}/api/v1/render/jobs/${manifest.jobId}/complete`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({outputUrl}),
    });
    console.log(`[Poller] Job ${manifest.jobId} rendered to ${outputUrl}`);
    return "rendered";
  } catch (error) {
    await postJobFailure({
      apiBase,
      jobId: manifest.jobId,
      errorMessage: error instanceof Error ? error.message : String(error),
      failureTags: renderFailureTagsForError(error),
    });
    return "failed";
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (process.env.USE_SAMPLE_MANIFEST === "1") {
  renderFromManifest(buildSampleJosephManifest()).then(() => process.exit(0)).catch((error) => {
    console.error("[Poller] Sample render failed:", error);
    process.exit(1);
  });
} else if (isDirectRun) {
  void pollAndRender();
}

import {UnifiedRenderManifestSchema, type UnifiedRenderManifest} from "@prometheus/shared-types";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {renderFromManifest} from "./index.js";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = Number.parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, "../../../remotion-app/public/dev-fixtures/test-video.mp4");
const SAMPLE_VIDEO_BROWSER_URL = "/dev-fixtures/test-video.mp4";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const buildSampleJosephManifest = (): UnifiedRenderManifest => UnifiedRenderManifestSchema.parse({
  version: "2.0",
  jobId: "123e4567-e89b-12d3-a456-426614174999",
  seed: 424242,
  createdAt: "2026-01-01T00:00:00.000Z",
  durationFrames: 90,
  fps: 30,
  width: 1920,
  height: 1080,
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
    width: 1920,
    height: 1080,
    fps: 30,
    codec: "h264",
    crf: 18,
  },
});

export const pollAndRender = async (): Promise<void> => {
  while (true) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/render/jobs/next`);
      if (res.status === 204) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Poll failed: ${res.status}`);
      }

      const manifest = UnifiedRenderManifestSchema.parse(await res.json());
      const outputPath = await renderFromManifest(manifest);

      await fetch(`${API_BASE}/api/v1/render/jobs/${manifest.jobId}/complete`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({outputUrl: outputPath})
      });
      console.log(`[Poller] Job ${manifest.jobId} rendered to ${outputPath}`);
    } catch (error) {
      console.error("[Poller] Error:", error);
      await sleep(POLL_INTERVAL_MS);
    }
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

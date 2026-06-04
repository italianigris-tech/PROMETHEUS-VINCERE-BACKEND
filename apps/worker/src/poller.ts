import {renderManifestSchema} from "@prometheus/shared-types";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {renderFromManifest} from "./index.js";
import {regenerateSampleManifest} from "./sample-manifest.js";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = Number.parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

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

      const manifest = renderManifestSchema.parse(await res.json());
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
  renderFromManifest(regenerateSampleManifest).then(() => process.exit(0)).catch((error) => {
    console.error("[Poller] Sample render failed:", error);
    process.exit(1);
  });
} else if (isDirectRun) {
  void pollAndRender();
}

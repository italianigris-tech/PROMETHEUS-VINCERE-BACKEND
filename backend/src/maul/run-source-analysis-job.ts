import {loadEnv} from "../config.js";
import {createR2TransferService} from "../integrations/r2.js";
import {InProcessQueue} from "../queue.js";
import {FileJobRepository} from "../repository.js";
import {VideoContextService} from "../video-context/service.js";
import {VideoContextStore} from "../video-context/store.js";
import {SupabaseSourceJobBridge} from "./supabase-source-job-bridge.js";

const flagIndex = process.argv.indexOf("--job-id");
const jobId = flagIndex >= 0 ? process.argv[flagIndex + 1]?.trim() : "";
if (!jobId) throw new Error("--job-id is required.");

const env = loadEnv({
  MAUL_SUPABASE_BRIDGE_ENABLED: "true",
  STORAGE_DIR: process.env.STORAGE_DIR || "/tmp/prometheus-source-analysis",
});
const repository = new FileJobRepository(env.STORAGE_DIR);
await repository.initialize();
const queue = new InProcessQueue(1, 1, Math.max(env.JOB_QUEUE_TIMEOUT_MS, 55 * 60 * 1000));
const contexts = new VideoContextService(
  env,
  repository,
  queue,
  new VideoContextStore(env.STORAGE_DIR),
);
await contexts.initialize();
const bridge = new SupabaseSourceJobBridge(
  env,
  createR2TransferService(env),
  contexts,
);

try {
  const result = await bridge.runJobToCompletion(jobId);
  await queue.onIdle();
  console.log(JSON.stringify(result));
} finally {
  bridge.stop();
  await queue.close(5_000);
}

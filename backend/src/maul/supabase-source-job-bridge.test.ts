import {createHash} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";

import {afterEach, describe, expect, it, vi} from "vitest";

import {SupabaseSourceJobBridge} from "./supabase-source-job-bridge.js";

const sourceBytes = Buffer.from("committed MAUL source bytes");
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");

const makeLease = (overrides: Record<string, unknown> = {}) => ({
  ingestion: {
    id: "ingestion_1",
    durable_job_id: "job_1",
    status: "leased",
    stage: "leased",
    progress: 0,
    source_revision_id: "revision_1"
  },
  sourceRevision: {},
  asset: {
    id: "asset_1",
    storage_bucket: "maul-sources",
    storage_path: "sources/revision_1.mp4",
    original_filename: "source.mp4",
    mime_type: "video/mp4",
    size_bytes: sourceBytes.byteLength,
    sha256: sourceSha256
  },
  leaseToken: "lease_1",
  ...overrides
});

const makeEnv = () => ({
  MAUL_SUPABASE_BRIDGE_ENABLED: true,
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  MAUL_SUPABASE_LEASE_SECONDS: 60,
  STORAGE_DIR: "/tmp/maul-bridge-tests"
});

describe("SupabaseSourceJobBridge source materialization", () => {
  afterEach(() => vi.restoreAllMocks());

  const materialize = async (input: {
    lease?: Record<string, unknown>;
    bytes?: Buffer;
  } = {}) => {
    const requests: Array<{name: string; body: Record<string, unknown>}> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const name = new URL(url).pathname.split("/").at(-1)!;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({name, body});
      return new Response(JSON.stringify({
        id: "ingestion_1",
        durable_job_id: "job_1",
        status: "processing",
        stage: body.p_stage,
        progress: body.p_progress,
        source_revision_id: "revision_1"
      }), {status: 200});
    });
    const createVideoFromSource = vi.fn(async () => ({
      videoId: "video_1",
      urls: {snapshot: "/videos/video_1"}
    }));
    const r2 = {
      isConfigured: true,
      createUploadUrl: vi.fn(),
      downloadObject: vi.fn(async ({bucket, key, destinationPath}) => {
        const bytes = input.bytes ?? sourceBytes;
        await mkdir(new URL(".", `file://${destinationPath}`).pathname, {recursive: true});
        await writeFile(destinationPath, bytes);
        return {bucket, key, destinationPath, sizeBytes: bytes.byteLength};
      })
    };
    const bridge = new SupabaseSourceJobBridge(
      makeEnv() as any,
      r2 as any,
      {createVideoFromSource} as any,
      fetchImpl as typeof fetch
    );

    await (bridge as any).materializeLease(makeLease(input.lease));
    return {createVideoFromSource, requests};
  };

  it("heartbeats a verified source revision before and after creating its video context", async () => {
    const {createVideoFromSource, requests} = await materialize();

    expect(createVideoFromSource).toHaveBeenCalledOnce();
    expect(requests).toEqual([
      expect.objectContaining({
        name: "maul_heartbeat_source_ingestion",
        body: expect.objectContaining({p_stage: "analyzing", p_result_patch: {}})
      }),
      expect.objectContaining({
        name: "maul_heartbeat_source_ingestion",
        body: expect.objectContaining({
          p_stage: "analyzing",
          p_result_patch: {
            video_context_id: "video_1",
            video_context_urls: {snapshot: "/videos/video_1"},
            source_revision_id: "revision_1"
          }
        })
      })
    ]);
  });

  it("reports a retryable failure without creating a context when downloaded bytes differ from the committed size", async () => {
    const {createVideoFromSource, requests} = await materialize({bytes: Buffer.from("short")});

    expect(createVideoFromSource).not.toHaveBeenCalled();
    expect(requests).toEqual([
      expect.objectContaining({
        name: "maul_fail_source_ingestion",
        body: expect.objectContaining({p_error_code: "SOURCE_SIZE_MISMATCH", p_retryable: true})
      })
    ]);
  });

  it("reports a retryable failure without creating a context when downloaded bytes differ from the committed SHA-256", async () => {
    const {createVideoFromSource, requests} = await materialize({
      lease: {asset: {...makeLease().asset, sha256: "f".repeat(64)}}
    });

    expect(createVideoFromSource).not.toHaveBeenCalled();
    expect(requests).toEqual([
      expect.objectContaining({
        name: "maul_fail_source_ingestion",
        body: expect.objectContaining({p_error_code: "SOURCE_SHA256_MISMATCH", p_retryable: true})
      })
    ]);
  });
});

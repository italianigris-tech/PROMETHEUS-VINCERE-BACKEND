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

  it("leases one requested durable job and runs it to a durable observation snapshot", async () => {
    const requests: Array<{name: string; body: Record<string, unknown>}> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const name = new URL(url).pathname.split("/").at(-1)!;
      const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      requests.push({name, body});
      if (name === "maul_lease_source_ingestion_by_job") {
        return Response.json(makeLease());
      }
      return Response.json({
        id: "ingestion_1",
        durable_job_id: "job_1",
        status: "processing",
        stage: body.p_stage,
        progress: body.p_progress,
        source_revision_id: "revision_1"
      });
    });
    const r2 = {
      isConfigured: true,
      downloadObject: vi.fn(async ({bucket, key, destinationPath}) => {
        await mkdir(new URL(".", `file://${destinationPath}`).pathname, {recursive: true});
        await writeFile(destinationPath, sourceBytes);
        return {bucket, key, destinationPath, sizeBytes: sourceBytes.byteLength};
      })
    };
    const videoContexts = {
      createVideoFromSource: vi.fn(async () => ({videoId: "video_1", urls: {snapshot: "/videos/video_1"}})),
      getSnapshot: vi.fn(async () => ({
        status: "handoff_ready",
        contextLevel: 4,
        warnings: [],
        sourcePath: "/private/source.mp4",
        transcript: {mergedWords: []}
      })),
      urlsFor: vi.fn(() => ({snapshot: "/videos/video_1"}))
    };
    const bridge = new SupabaseSourceJobBridge(
      makeEnv() as any,
      r2 as any,
      videoContexts as any,
      fetchImpl as typeof fetch
    );

    const result = await bridge.runJobToCompletion("job_1", {pollIntervalMs: 0});

    expect(result).toEqual({jobId: "job_1", claimed: true, status: "finished"});
    expect(requests).toContainEqual({
      name: "maul_lease_source_ingestion_by_job",
      body: expect.objectContaining({p_durable_job_id: "job_1"})
    });
    expect(requests.some((entry) => entry.name === "maul_complete_source_ingestion")).toBe(true);
  });

  it("falls back to the existing queue lease while the targeted RPC migration is pending", async () => {
    const bridge = new SupabaseSourceJobBridge(
      makeEnv() as any,
      {isConfigured: true} as any,
      {} as any,
    );
    const rpc = vi.fn(async (name: string) => {
      if (name === "maul_lease_source_ingestion_by_job") {
        throw new Error("SUPABASE_RPC_MAUL_LEASE_SOURCE_INGESTION_BY_JOB_404: PGRST202");
      }
      if (name === "maul_lease_source_ingestion") return makeLease();
      throw new Error(`Unexpected RPC ${name}`);
    });
    (bridge as any).rpc = rpc;
    (bridge as any).materializeLease = vi.fn(async (lease: ReturnType<typeof makeLease>) => {
      (bridge as any).active.delete(lease.ingestion.id);
    });

    const result = await bridge.runJobToCompletion("job_1", {pollIntervalMs: 0});

    expect(result).toEqual({jobId: "job_1", claimed: true, status: "finished"});
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "maul_lease_source_ingestion_by_job",
      "maul_lease_source_ingestion"
    ]);
  });
});

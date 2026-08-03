import os from "node:os";
import path from "node:path";

import type {BackendEnv} from "../config.js";
import type {R2TransferService} from "../integrations/r2.js";
import type {VideoContextService} from "../video-context/service.js";

type JsonObject = Record<string, unknown>;

type SourceIngestion = {
  id: string;
  durable_job_id: string;
  status: string;
  stage: string;
  progress: number;
  source_revision_id: string;
};

type SourceAsset = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
  size_bytes: number | string;
};

type Lease = {
  ingestion: SourceIngestion;
  sourceRevision: JsonObject;
  asset: SourceAsset;
  leaseToken: string;
};

type ActiveLease = Lease & {
  videoContextId?: string;
  videoContextUrls?: Record<string, string>;
};

type ExpiredUpload = {
  id: string;
  bucket: string;
  object_key: string;
  multipart_upload_id: string | null;
};

const progressForStatus = (status: string): number => {
  switch (status) {
    case "metadata_ready": return 15;
    case "transcribing": return 35;
    case "motion_analyzing": return 60;
    case "planning": return 82;
    case "handoff_ready": return 100;
    case "failed": return 100;
    default: return 3;
  }
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errorCode = (error: unknown): string => {
  const match = errorMessage(error).match(/\b([A-Z][A-Z0-9_]{2,})\b/);
  return match?.[1] ?? "SOURCE_PROCESSING_FAILED";
};

export class SupabaseSourceJobBridge {
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopped = true;
  private readonly active = new Map<string, ActiveLease>();
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly workerId = `${os.hostname()}:${process.pid}`;

  public constructor(
    private readonly env: BackendEnv,
    private readonly r2: R2TransferService,
    private readonly videoContexts: VideoContextService,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.baseUrl = `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1`;
    const credential = env.SUPABASE_SERVICE_ROLE_KEY.trim();
    this.headers = {
      apikey: credential,
      ...(credential.startsWith("sb_secret_") ? {} : {Authorization: `Bearer ${credential}`}),
      "Content-Type": "application/json"
    };
  }

  public get configured(): boolean {
    return Boolean(
      this.env.MAUL_SUPABASE_BRIDGE_ENABLED &&
      this.env.SUPABASE_URL.trim() &&
      this.env.SUPABASE_SERVICE_ROLE_KEY.trim() &&
      this.r2.isConfigured
    );
  }

  public start(): void {
    if (!this.configured || this.timer) return;
    this.stopped = false;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.env.MAUL_SUPABASE_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async rpc<T>(name: string, body: JsonObject = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/rpc/${name}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`SUPABASE_RPC_${name.toUpperCase()}_${response.status}: ${text.slice(0, 1000)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.stopped) return;
    this.ticking = true;
    try {
      await this.cleanupExpiredUploads();
      await this.rpc("maul_reconcile_source_ingestions");
      for (const lease of [...this.active.values()]) await this.refreshActiveLease(lease);
      if (this.active.size === 0) {
        const lease = await this.rpc<Lease | null>("maul_lease_source_ingestion", {
          p_worker_id: this.workerId,
          p_lease_seconds: this.env.MAUL_SUPABASE_LEASE_SECONDS
        });
        if (lease) {
          this.active.set(lease.ingestion.id, lease);
          void this.materializeLease(lease);
        }
      }
    } catch (error) {
      console.error("[maul-supabase-bridge] tick failed", error);
    } finally {
      this.ticking = false;
    }
  }

  private async cleanupExpiredUploads(): Promise<void> {
    if (!this.r2.cleanupSourceUpload) return;
    const sessions = await this.rpc<ExpiredUpload[]>("maul_claim_expired_source_upload_cleanup", {p_limit: 10});
    for (const session of sessions) {
      let cleanupError: string | null = null;
      try {
        await this.r2.cleanupSourceUpload({
          bucket: session.bucket,
          key: session.object_key,
          uploadId: session.multipart_upload_id
        });
      } catch (error) {
        cleanupError = errorMessage(error);
      }
      await this.rpc("maul_ack_source_upload_cleanup", {
        p_session_id: session.id,
        p_error: cleanupError
      });
    }
  }

  private async heartbeat(lease: ActiveLease, progress: number, stage: string, patch: JsonObject = {}): Promise<SourceIngestion> {
    return this.rpc<SourceIngestion>("maul_heartbeat_source_ingestion", {
      p_ingestion_id: lease.ingestion.id,
      p_lease_token: lease.leaseToken,
      p_progress: progress,
      p_stage: stage,
      p_lease_seconds: this.env.MAUL_SUPABASE_LEASE_SECONDS,
      p_result_patch: patch
    });
  }

  private async materializeLease(lease: ActiveLease): Promise<void> {
    try {
      if (!lease.asset.storage_bucket || !lease.asset.storage_path) {
        throw new Error("SOURCE_ASSET_MISSING: canonical source metadata is unavailable.");
      }
      if (!lease.asset.mime_type.toLowerCase().startsWith("video/")) {
        throw new Error("SOURCE_NOT_VIDEO: MAUL only leases video source revisions.");
      }
      const extension = path.extname(lease.asset.original_filename ?? lease.asset.storage_path) || ".bin";
      const destinationPath = path.join(
        this.env.STORAGE_DIR,
        "maul",
        "source-ingestions",
        lease.ingestion.source_revision_id,
        `source${extension.replace(/[^a-zA-Z0-9.]/g, "")}`
      );
      const downloaded = await this.r2.downloadObject({
        bucket: lease.asset.storage_bucket,
        key: lease.asset.storage_path,
        destinationPath
      });
      const expectedSize = Number(lease.asset.size_bytes);
      if (!Number.isSafeInteger(expectedSize) || downloaded.sizeBytes !== expectedSize) {
        throw new Error("SOURCE_SIZE_MISMATCH: downloaded R2 bytes differ from the committed revision.");
      }

      await this.heartbeat(lease, 3, "analyzing");
      const video = await this.videoContexts.createVideoFromSource(downloaded.destinationPath);
      lease.videoContextId = video.videoId;
      lease.videoContextUrls = video.urls;
      await this.heartbeat(lease, 3, "analyzing", {
        video_context_id: video.videoId,
        video_context_urls: video.urls,
        source_revision_id: lease.ingestion.source_revision_id
      });
    } catch (error) {
      await this.failLease(lease, error, true);
    }
  }

  private async refreshActiveLease(lease: ActiveLease): Promise<void> {
    try {
      if (!lease.videoContextId) {
        lease.ingestion = await this.heartbeat(lease, Math.max(1, lease.ingestion.progress), "materializing_source");
        if (!["leased", "processing"].includes(lease.ingestion.status)) this.active.delete(lease.ingestion.id);
        return;
      }

      const snapshot = await this.videoContexts.getSnapshot(lease.videoContextId);
      if (snapshot.status === "failed") {
        await this.failLease(lease, new Error(snapshot.warnings.at(-1) ?? "Video analysis failed."), false);
        return;
      }
      if (snapshot.status === "handoff_ready") {
        const {sourcePath: _sourcePath, ...portableSnapshot} = snapshot;
        await this.rpc("maul_complete_source_ingestion", {
          p_ingestion_id: lease.ingestion.id,
          p_lease_token: lease.leaseToken,
          p_result: {
            video_context_id: lease.videoContextId,
            video_context_urls: lease.videoContextUrls ?? this.videoContexts.urlsFor(lease.videoContextId),
            analysis_status: snapshot.status,
            context_level: snapshot.contextLevel,
            source_revision_id: lease.ingestion.source_revision_id,
            observation_snapshot: portableSnapshot
          }
        });
        this.active.delete(lease.ingestion.id);
        return;
      }

      const progress = progressForStatus(snapshot.status);
      lease.ingestion = await this.heartbeat(lease, progress, snapshot.status, {
        video_context_id: lease.videoContextId,
        analysis_status: snapshot.status,
        context_level: snapshot.contextLevel
      });
      if (!["leased", "processing"].includes(lease.ingestion.status)) this.active.delete(lease.ingestion.id);
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes("INVALID_INGESTION_LEASE") || message.includes("INGESTION_LEASE_EXPIRED")) {
        this.active.delete(lease.ingestion.id);
        return;
      }
      await this.failLease(lease, error, true);
    }
  }

  private async failLease(lease: ActiveLease, error: unknown, retryable: boolean): Promise<void> {
    try {
      await this.rpc("maul_fail_source_ingestion", {
        p_ingestion_id: lease.ingestion.id,
        p_lease_token: lease.leaseToken,
        p_error_code: errorCode(error),
        p_error_message: errorMessage(error).slice(0, 2000),
        p_retryable: retryable
      });
    } catch (reportError) {
      console.error("[maul-supabase-bridge] failed to report ingestion failure", reportError);
    } finally {
      this.active.delete(lease.ingestion.id);
    }
  }
}

import {HttpClient, MilvusClient} from "@zilliz/milvus2-sdk-node";

import type {BackendEnv} from "../config";

export type ZillizHealthSnapshot = {
  status: "healthy" | "suspended";
  latencyMs?: number;
};

const KEEPALIVE_INTERVAL_MS = 1000 * 60 * 25;

const isHttpMilvusAddress = (address: string): boolean => /^https?:\/\//i.test(address.trim());

const resolveHttpMilvusEndpoint = (address: string): string => {
  const parsed = new URL(address);
  return parsed.origin;
};

export class ZillizHealthMonitor {
  private readonly useHttpMilvus: boolean;
  private client: MilvusClient | HttpClient | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private snapshot: ZillizHealthSnapshot = {
    status: "suspended"
  };

  public constructor(private readonly env: BackendEnv) {
    this.useHttpMilvus = env.ASSET_MILVUS_ENABLED && isHttpMilvusAddress(env.MILVUS_ADDRESS);
  }

  private getClient(): MilvusClient | HttpClient {
    if (this.client) {
      return this.client;
    }

    this.client = this.useHttpMilvus
      ? new HttpClient({
          endpoint: resolveHttpMilvusEndpoint(this.env.MILVUS_ADDRESS),
          token: this.env.MILVUS_TOKEN || undefined,
          database: this.env.MILVUS_DATABASE || undefined,
          timeout: 10000
        })
      : new MilvusClient({
          address: this.env.MILVUS_ADDRESS,
          token: this.env.MILVUS_TOKEN || undefined,
          database: this.env.MILVUS_DATABASE || undefined,
          ssl: isHttpMilvusAddress(this.env.MILVUS_ADDRESS)
        });

    return this.client;
  }

  public async checkNow({logFailure = false}: {logFailure?: boolean} = {}): Promise<ZillizHealthSnapshot> {
    if (!this.env.ASSET_MILVUS_ENABLED) {
      this.snapshot = {
        status: "suspended"
      };
      return this.snapshot;
    }

    const startedAt = Date.now();

    try {
      const client = this.getClient();
      if (this.useHttpMilvus) {
        await (client as HttpClient).hasCollection({
          collectionName: this.env.MILVUS_COLLECTION_FONTS,
          dbName: this.env.MILVUS_DATABASE
        });
      } else {
        await (client as MilvusClient).hasCollection({
          collection_name: this.env.MILVUS_COLLECTION_FONTS
        });
      }

      this.snapshot = {
        status: "healthy",
        latencyMs: Date.now() - startedAt
      };
      return this.snapshot;
    } catch (error) {
      this.snapshot = {
        status: "suspended"
      };

      if (logFailure) {
        console.error("[ZILLIZ KEEPALIVE] Cluster appears suspended:", error);
      }

      return this.snapshot;
    }
  }

  public start(): void {
    if (this.intervalHandle) {
      return;
    }

    void this.checkNow({logFailure: true});
    this.intervalHandle = setInterval(() => {
      void this.checkNow({logFailure: true});
    }, KEEPALIVE_INTERVAL_MS);
    this.intervalHandle.unref?.();
  }

  public stop(): void {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  public getSnapshot(): ZillizHealthSnapshot {
    return this.snapshot;
  }
}

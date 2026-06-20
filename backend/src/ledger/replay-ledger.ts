import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {createRequire} from "node:module";

export interface ReplayLedgerEntry {
  id: string;
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile: string;
  chosenGenome: string;
  rejectedGenomes: string;
  plannerAudit?: string;
  similarityHash: string;
  qualityScore: number;
  failureTags: string;
  createdAt: string;
}

type SqliteStatement = {
  run: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
  get: (...args: unknown[]) => unknown;
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

type BetterSqliteConstructor = new (filePath: string) => SqliteDatabase;

type ReplayLedgerRow = {
  id: string;
  source_fingerprint: string;
  prompt_fingerprint: string;
  upload_instance_id: string;
  retry_index: number;
  profile: string;
  chosen_genome: string;
  rejected_genomes: string;
  planner_audit: string | null;
  similarity_hash: string;
  quality_score: number;
  failure_tags: string;
  created_at: string;
};

const require = createRequire(import.meta.url);
const DEFAULT_SQLITE_PATH = path.join(os.homedir(), ".prometheus", "replay-ledger.sqlite");

const normalizeEntry = (entry: ReplayLedgerEntry): ReplayLedgerEntry => ({
  ...entry,
  retryIndex: Number(entry.retryIndex),
  qualityScore: Number(entry.qualityScore),
});

const toRow = (entry: ReplayLedgerEntry): ReplayLedgerRow => ({
  id: entry.id,
  source_fingerprint: entry.sourceFingerprint,
  prompt_fingerprint: entry.promptFingerprint,
  upload_instance_id: entry.uploadInstanceId,
  retry_index: entry.retryIndex,
  profile: entry.profile,
  chosen_genome: entry.chosenGenome,
  rejected_genomes: entry.rejectedGenomes,
  planner_audit: entry.plannerAudit ?? null,
  similarity_hash: entry.similarityHash,
  quality_score: entry.qualityScore,
  failure_tags: entry.failureTags,
  created_at: entry.createdAt,
});

const fromRow = (row: ReplayLedgerRow): ReplayLedgerEntry => ({
  id: row.id,
  sourceFingerprint: row.source_fingerprint,
  promptFingerprint: row.prompt_fingerprint,
  uploadInstanceId: row.upload_instance_id,
  retryIndex: Number(row.retry_index),
  profile: row.profile,
  chosenGenome: row.chosen_genome,
  rejectedGenomes: row.rejected_genomes,
  plannerAudit: row.planner_audit ?? "",
  similarityHash: row.similarity_hash,
  qualityScore: Number(row.quality_score),
  failureTags: row.failure_tags,
  createdAt: row.created_at,
});

const loadBetterSqlite = (): BetterSqliteConstructor | null => {
  try {
    return require("better-sqlite3") as BetterSqliteConstructor;
  } catch {
    return null;
  }
};

const isSqlitePath = (filePath: string): boolean => /\.(sqlite|sqlite3|db)$/i.test(filePath);
const fallbackJsonlPath = (filePath: string): string => filePath.replace(/\.(sqlite|sqlite3|db)$/i, ".jsonl");

export class ReplayLedger {
  private readonly fallbackPath: string | null;
  private readonly entries: ReplayLedgerEntry[] = [];
  private readonly db: SqliteDatabase | null = null;

  constructor(filePath = DEFAULT_SQLITE_PATH) {
    if (filePath === ":memory:") {
      this.fallbackPath = null;
      return;
    }

    const sqlite = isSqlitePath(filePath) ? loadBetterSqlite() : null;
    if (sqlite) {
      fs.mkdirSync(path.dirname(filePath), {recursive: true});
      this.db = new sqlite(filePath);
      this.initializeSqlite();
      this.fallbackPath = null;
      return;
    }

    this.fallbackPath = isSqlitePath(filePath) ? fallbackJsonlPath(filePath) : filePath;
    this.entries = this.readEntriesFromDisk();
  }

  insert(entry: ReplayLedgerEntry): ReplayLedgerEntry {
    const normalized = normalizeEntry(entry);

    if (this.db) {
      const row = toRow(normalized);
      this.db.prepare(`
        INSERT OR REPLACE INTO replay_ledger (
          id,
          source_fingerprint,
          prompt_fingerprint,
          upload_instance_id,
          retry_index,
          profile,
          chosen_genome,
          rejected_genomes,
          planner_audit,
          similarity_hash,
          quality_score,
          failure_tags,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.id,
        row.source_fingerprint,
        row.prompt_fingerprint,
        row.upload_instance_id,
        row.retry_index,
        row.profile,
        row.chosen_genome,
        row.rejected_genomes,
        row.planner_audit,
        row.similarity_hash,
        row.quality_score,
        row.failure_tags,
        row.created_at,
      );
      return normalized;
    }

    const existingIndex = this.entries.findIndex((candidate) => candidate.id === normalized.id);
    if (existingIndex >= 0) {
      this.entries[existingIndex] = normalized;
      this.flush();
      return normalized;
    }

    this.entries.push(normalized);
    this.append(normalized);
    return normalized;
  }

  getBySource(sourceFingerprint: string): ReplayLedgerEntry[] {
    if (this.db) {
      return this.db.prepare(`
        SELECT * FROM replay_ledger
        WHERE source_fingerprint = ?
        ORDER BY created_at ASC, id ASC
      `).all(sourceFingerprint).map((row) => fromRow(row as ReplayLedgerRow));
    }

    return this.entries
      .filter((entry) => entry.sourceFingerprint === sourceFingerprint)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  getByUploadInstance(uploadInstanceId: string): ReplayLedgerEntry | null {
    if (this.db) {
      const row = this.db.prepare(`
        SELECT * FROM replay_ledger
        WHERE upload_instance_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `).get(uploadInstanceId) as ReplayLedgerRow | undefined;
      return row ? fromRow(row) : null;
    }

    return this.entries.find((entry) => entry.uploadInstanceId === uploadInstanceId) ?? null;
  }

  getSimilarityHash(sourceFingerprint: string): string | null {
    return this.getBySource(sourceFingerprint).at(-1)?.similarityHash ?? null;
  }

  private initializeSqlite(): void {
    if (!this.db) {
      return;
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS replay_ledger (
        id TEXT PRIMARY KEY,
        source_fingerprint TEXT NOT NULL,
        prompt_fingerprint TEXT NOT NULL,
        upload_instance_id TEXT NOT NULL,
        retry_index INTEGER NOT NULL,
        profile TEXT NOT NULL,
        chosen_genome TEXT NOT NULL,
        rejected_genomes TEXT NOT NULL,
        planner_audit TEXT,
        similarity_hash TEXT NOT NULL,
        quality_score REAL NOT NULL,
        failure_tags TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS replay_ledger_source_idx ON replay_ledger(source_fingerprint);
      CREATE INDEX IF NOT EXISTS replay_ledger_upload_idx ON replay_ledger(upload_instance_id);
    `);
  }

  private readEntriesFromDisk(): ReplayLedgerEntry[] {
    if (!this.fallbackPath || !fs.existsSync(this.fallbackPath)) {
      return [];
    }

    return fs.readFileSync(this.fallbackPath, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeEntry(JSON.parse(line) as ReplayLedgerEntry);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is ReplayLedgerEntry => Boolean(entry));
  }

  private append(entry: ReplayLedgerEntry): void {
    if (!this.fallbackPath) {
      return;
    }

    fs.mkdirSync(path.dirname(this.fallbackPath), {recursive: true});
    fs.appendFileSync(this.fallbackPath, `${JSON.stringify(entry)}\n`, "utf-8");
  }

  private flush(): void {
    if (!this.fallbackPath) {
      return;
    }

    fs.mkdirSync(path.dirname(this.fallbackPath), {recursive: true});
    fs.writeFileSync(this.fallbackPath, this.entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf-8");
  }
}

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {createRequire} from "module";

export interface LedgerEntry {
  id: string;
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile: string;
  chosenGenome: string;
  rejectedGenomes: string;
  plannerAudit: string;
  similarityHash: string;
  qualityScore: number;
  failureTags: string;
  createdAt: string;
}

type SqliteDatabase = {
  pragma: (statement: string) => unknown;
  exec: (statement: string) => unknown;
  prepare: (statement: string) => {
    run: (...values: unknown[]) => unknown;
    all: (...values: unknown[]) => unknown[];
    get: (...values: unknown[]) => unknown;
  };
};

type StorageMode = "sqlite" | "fallback";

const require = createRequire(import.meta.url);

const DEFAULT_DIR = path.join(os.homedir(), ".prometheus");
const DEFAULT_SQLITE_PATH = path.join(DEFAULT_DIR, "replay-ledger.sqlite");
const DEFAULT_JSONL_PATH = path.join(DEFAULT_DIR, "replay-ledger.jsonl");

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS replay_ledger (
  id TEXT PRIMARY KEY,
  source_fingerprint TEXT NOT NULL,
  prompt_fingerprint TEXT,
  upload_instance_id TEXT NOT NULL,
  retry_index INTEGER DEFAULT 0,
  profile TEXT NOT NULL,
  chosen_genome TEXT NOT NULL,
  rejected_genomes TEXT,
  planner_audit TEXT,
  similarity_hash TEXT,
  quality_score REAL,
  failure_tags TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_source ON replay_ledger(source_fingerprint);
CREATE INDEX IF NOT EXISTS idx_prompt ON replay_ledger(prompt_fingerprint);
CREATE INDEX IF NOT EXISTS idx_created ON replay_ledger(created_at);
`;

const entryToValues = (entry: LedgerEntry) => [
  entry.id,
  entry.sourceFingerprint,
  entry.promptFingerprint,
  entry.uploadInstanceId,
  entry.retryIndex,
  entry.profile,
  entry.chosenGenome,
  entry.rejectedGenomes,
  entry.plannerAudit,
  entry.similarityHash,
  entry.qualityScore,
  entry.failureTags,
  entry.createdAt,
];

const rowToEntry = (row: any): LedgerEntry => ({
  id: row.id,
  sourceFingerprint: row.source_fingerprint,
  promptFingerprint: row.prompt_fingerprint,
  uploadInstanceId: row.upload_instance_id,
  retryIndex: row.retry_index,
  profile: row.profile,
  chosenGenome: row.chosen_genome,
  rejectedGenomes: row.rejected_genomes,
  plannerAudit: row.planner_audit,
  similarityHash: row.similarity_hash,
  qualityScore: row.quality_score,
  failureTags: row.failure_tags,
  createdAt: row.created_at,
});

const ensureParentDir = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
};

export class ReplayLedger {
  private readonly mode: StorageMode;
  private readonly db?: SqliteDatabase;
  private readonly entries = new Map<string, LedgerEntry>();
  private readonly jsonlPath?: string;

  constructor(dbPath: string = DEFAULT_SQLITE_PATH) {
    const sqlite = this.openSqlite(dbPath);

    if (sqlite) {
      this.mode = "sqlite";
      this.db = sqlite;
      return;
    }

    this.mode = "fallback";
    this.jsonlPath = dbPath === ":memory:" ? undefined : DEFAULT_JSONL_PATH;
    this.loadFallbackEntries();
  }

  insert(entry: LedgerEntry): void {
    if (this.mode === "sqlite" && this.db) {
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
      `).run(...entryToValues(entry));
      return;
    }

    this.entries.set(entry.id, entry);
    this.appendFallbackEntry(entry);
  }

  getBySource(sourceFingerprint: string): LedgerEntry[] {
    if (this.mode === "sqlite" && this.db) {
      return this.db
        .prepare("SELECT * FROM replay_ledger WHERE source_fingerprint = ? ORDER BY created_at ASC")
        .all(sourceFingerprint)
        .map(rowToEntry);
    }

    return [...this.entries.values()].filter((entry) => entry.sourceFingerprint === sourceFingerprint);
  }

  getByPrompt(sourceFingerprint: string, promptFingerprint: string): LedgerEntry[] {
    if (this.mode === "sqlite" && this.db) {
      return this.db
        .prepare("SELECT * FROM replay_ledger WHERE source_fingerprint = ? AND prompt_fingerprint = ? ORDER BY created_at ASC")
        .all(sourceFingerprint, promptFingerprint)
        .map(rowToEntry);
    }

    return [...this.entries.values()].filter((entry) =>
      entry.sourceFingerprint === sourceFingerprint && entry.promptFingerprint === promptFingerprint
    );
  }

  getByUploadInstance(uploadInstanceId: string): LedgerEntry | undefined {
    if (this.mode === "sqlite" && this.db) {
      const row = this.db
        .prepare("SELECT * FROM replay_ledger WHERE upload_instance_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(uploadInstanceId);

      return row ? rowToEntry(row) : undefined;
    }

    return [...this.entries.values()].reverse().find((entry) => entry.uploadInstanceId === uploadInstanceId);
  }

  getSimilarityHash(sourceFingerprint: string): string[] {
    if (this.mode === "sqlite" && this.db) {
      return this.db
        .prepare("SELECT similarity_hash FROM replay_ledger WHERE source_fingerprint = ? AND similarity_hash IS NOT NULL ORDER BY created_at ASC")
        .all(sourceFingerprint)
        .map((row: any) => row.similarity_hash)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);
    }

    return this.getBySource(sourceFingerprint)
      .map((entry) => entry.similarityHash)
      .filter((value) => value.length > 0);
  }

  private openSqlite(dbPath: string): SqliteDatabase | undefined {
    try {
      const Database = require("better-sqlite3");

      if (dbPath !== ":memory:") {
        ensureParentDir(dbPath);
      }

      const db = new Database(dbPath) as SqliteDatabase;
      db.pragma("journal_mode = WAL");
      db.exec(CREATE_TABLE_SQL);
      return db;
    } catch {
      return undefined;
    }
  }

  private loadFallbackEntries() {
    if (!this.jsonlPath || !fs.existsSync(this.jsonlPath)) {
      return;
    }

    for (const line of fs.readFileSync(this.jsonlPath, "utf8").split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      try {
        const entry = JSON.parse(line) as LedgerEntry;
        this.entries.set(entry.id, entry);
      } catch {
        continue;
      }
    }
  }

  private appendFallbackEntry(entry: LedgerEntry) {
    if (!this.jsonlPath) {
      return;
    }

    try {
      ensureParentDir(this.jsonlPath);
      fs.appendFileSync(this.jsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      return;
    }
  }
}

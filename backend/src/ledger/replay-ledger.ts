import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {createRequire} from "node:module";

export interface ReplayLedgerSimilarityQuery {
  sourceFingerprint?: string;
  similarityHash: string;
  threshold?: number;
}

export interface ReplayLedgerSimilarityMatch {
  entry: ReplayLedgerEntry;
  similarityScore: number;
}

export interface ReplayLedgerFatigueQuery {
  sourceFingerprint?: string;
  primitiveFamily?: string;
  layoutSignature?: string;
  failureTag?: string;
}

export interface ReplayLedgerFatigueSignals {
  totalMatches: number;
  primitiveFamilyCount: number;
  layoutSignatureCount: number;
  failureTagCounts: Record<string, number>;
  latestEntryId: string | null;
}
export interface ReplayLedgerEntry {
  id: string;
  sourceFingerprint: string;
  promptFingerprint: string;
  uploadInstanceId: string;
  retryIndex: number;
  profile: string;
  chosenGenome: string;
  rejectedGenomes: string;
  candidateScoreSummary: string;
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

type ReplayLedgerEntryInput = Omit<ReplayLedgerEntry, "candidateScoreSummary"> & {
  candidateScoreSummary?: string;
  plannerAudit?: string;
};

const require = createRequire(import.meta.url);
const DEFAULT_SQLITE_PATH = path.join(os.homedir(), ".prometheus", "replay-ledger.sqlite");

const normalizeEntry = (entry: ReplayLedgerEntryInput): ReplayLedgerEntry => ({
  id: entry.id,
  sourceFingerprint: entry.sourceFingerprint,
  promptFingerprint: entry.promptFingerprint,
  uploadInstanceId: entry.uploadInstanceId,
  retryIndex: Number(entry.retryIndex),
  profile: entry.profile,
  chosenGenome: entry.chosenGenome,
  rejectedGenomes: entry.rejectedGenomes,
  candidateScoreSummary: entry.candidateScoreSummary ?? entry.plannerAudit ?? "",
  similarityHash: entry.similarityHash,
  qualityScore: Number(entry.qualityScore),
  failureTags: entry.failureTags,
  createdAt: entry.createdAt,
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
  planner_audit: entry.candidateScoreSummary || null,
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
  candidateScoreSummary: row.planner_audit ?? "",
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
const parseJsonRecord = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const normalizeToken = (value: string): string => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

const failureTagsOf = (entry: ReplayLedgerEntry): string[] => {
  const raw = entry.failureTags.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.filter((tag): tag is string => typeof tag === "string").map(normalizeToken).filter(Boolean))].sort();
    }
  } catch {
    // Fall back to comma/space-separated legacy tags.
  }

  return [...new Set(raw.split(/[ ,]+/).map(normalizeToken).filter(Boolean))].sort();
};

const stringValue = (record: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const collectManifestFacts = (value: unknown, facts: {primitiveFamilies: Set<string>; layoutSignatures: Set<string>}): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectManifestFacts(item, facts);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const primitiveFamily = stringValue(record, ["primitiveFamily", "primitive_family", "family"]);
  if (primitiveFamily) {
    facts.primitiveFamilies.add(primitiveFamily);
  }

  const primitiveId = stringValue(record, ["primitiveId", "primitive_id"]);
  const derivedFamily = primitiveId?.split(/[.:/]/)[0];
  if (derivedFamily) {
    facts.primitiveFamilies.add(derivedFamily);
  }

  const layoutSignature = stringValue(record, ["layoutSignature", "layout_signature", "layoutId", "layout_id"]);
  if (layoutSignature) {
    facts.layoutSignatures.add(layoutSignature);
  }

  for (const child of Object.values(record)) {
    collectManifestFacts(child, facts);
  }
};

const manifestFactsOf = (entry: ReplayLedgerEntry): {primitiveFamilies: string[]; layoutSignatures: string[]} => {
  const facts = {primitiveFamilies: new Set<string>(), layoutSignatures: new Set<string>()};
  collectManifestFacts(parseJsonRecord(entry.chosenGenome), facts);
  collectManifestFacts(parseJsonRecord(entry.candidateScoreSummary), facts);
  return {
    primitiveFamilies: [...facts.primitiveFamilies].sort(),
    layoutSignatures: [...facts.layoutSignatures].sort(),
  };
};

const hashSimilarity = (left: string, right: string): number => {
  if (!left || !right) {
    return 0;
  }

  const length = Math.max(left.length, right.length);
  let matches = 0;
  for (let index = 0; index < length; index += 1) {
    if (left[index] && left[index] === right[index]) {
      matches += 1;
    }
  }
  return matches / length;
};

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

  insert(entry: ReplayLedgerEntryInput): ReplayLedgerEntry {
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
  getByPrimitiveFamily(primitiveFamily: string): ReplayLedgerEntry[] {
    const expected = primitiveFamily.trim();
    return this.allEntries().filter((entry) => manifestFactsOf(entry).primitiveFamilies.includes(expected));
  }

  getByLayoutSignature(layoutSignature: string): ReplayLedgerEntry[] {
    const expected = layoutSignature.trim();
    return this.allEntries().filter((entry) => manifestFactsOf(entry).layoutSignatures.includes(expected));
  }

  getByFailureTag(failureTag: string): ReplayLedgerEntry[] {
    const expected = normalizeToken(failureTag);
    return this.allEntries().filter((entry) => failureTagsOf(entry).includes(expected));
  }

  querySimilarity(query: ReplayLedgerSimilarityQuery): ReplayLedgerSimilarityMatch[] {
    const threshold = query.threshold ?? 0;
    return this.allEntries()
      .filter((entry) => query.sourceFingerprint === undefined || entry.sourceFingerprint === query.sourceFingerprint)
      .map((entry) => ({entry, similarityScore: hashSimilarity(query.similarityHash, entry.similarityHash)}))
      .filter((match) => match.similarityScore >= threshold)
      .sort((left, right) =>
        right.similarityScore - left.similarityScore ||
        right.entry.createdAt.localeCompare(left.entry.createdAt) ||
        left.entry.id.localeCompare(right.entry.id),
      );
  }

  getFatigueSignals(query: ReplayLedgerFatigueQuery = {}): ReplayLedgerFatigueSignals {
    const primitiveFamily = query.primitiveFamily?.trim();
    const layoutSignature = query.layoutSignature?.trim();
    const failureTag = query.failureTag ? normalizeToken(query.failureTag) : undefined;
    const matches = this.allEntries().filter((entry) => {
      const facts = manifestFactsOf(entry);
      const tags = failureTagsOf(entry);
      return (query.sourceFingerprint === undefined || entry.sourceFingerprint === query.sourceFingerprint) &&
        (primitiveFamily === undefined || facts.primitiveFamilies.includes(primitiveFamily)) &&
        (layoutSignature === undefined || facts.layoutSignatures.includes(layoutSignature)) &&
        (failureTag === undefined || tags.includes(failureTag));
    });
    const failureTagCounts: Record<string, number> = {};
    let primitiveFamilyCount = 0;
    let layoutSignatureCount = 0;

    for (const entry of matches) {
      const facts = manifestFactsOf(entry);
      const tags = failureTagsOf(entry);
      if (primitiveFamily && facts.primitiveFamilies.includes(primitiveFamily)) {
        primitiveFamilyCount += 1;
      }
      if (layoutSignature && facts.layoutSignatures.includes(layoutSignature)) {
        layoutSignatureCount += 1;
      }
      for (const tag of tags) {
        failureTagCounts[tag] = (failureTagCounts[tag] ?? 0) + 1;
      }
    }

    const latest = [...matches].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))[0];
    return {
      totalMatches: matches.length,
      primitiveFamilyCount,
      layoutSignatureCount,
      failureTagCounts,
      latestEntryId: latest?.id ?? null,
    };
  }


  private allEntries(): ReplayLedgerEntry[] {
    if (this.db) {
      return this.db.prepare(`
        SELECT * FROM replay_ledger
        ORDER BY created_at ASC, id ASC
      `).all().map((row) => fromRow(row as ReplayLedgerRow));
    }

    return [...this.entries].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
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
          return normalizeEntry(JSON.parse(line) as ReplayLedgerEntryInput);
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

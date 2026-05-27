export type MotionAssetCatalogRecord = {
  id: string;
  source: "god" | "remote" | "showcase" | "authoring" | "pattern-memory" | "local";
  label: string;
  semanticTags: string[];
  aestheticTags: string[];
  timingCompatibilityMs: {
    min: number;
    max: number;
  };
  freshnessScore: number;
  antiRepetitionKey: string;
  gpuCost: "low" | "medium" | "high";
};

export type MotionAssetCatalogAdapter = {
  id: string;
  read: () => Promise<MotionAssetCatalogRecord[]>;
};

export type MotionAssetQuery = {
  text: string;
  semanticTags?: string[];
  durationMs?: number;
  recentAntiRepetitionKeys?: string[];
  limit?: number;
};

export type MotionAssetCatalogMatch = {
  asset: MotionAssetCatalogRecord;
  score: number;
  reasons: string[];
};

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const uniqueById = (records: MotionAssetCatalogRecord[]): MotionAssetCatalogRecord[] => {
  const seen = new Set<string>();
  const unique: MotionAssetCatalogRecord[] = [];
  for (const record of records) {
    if (seen.has(record.id)) {
      continue;
    }
    seen.add(record.id);
    unique.push(record);
  }
  return unique;
};

const durationFits = (record: MotionAssetCatalogRecord, durationMs?: number): boolean => {
  if (!durationMs) {
    return true;
  }
  return durationMs >= record.timingCompatibilityMs.min && durationMs <= record.timingCompatibilityMs.max;
};

export const buildUnifiedMotionAssetCatalog = async (
  adapters: MotionAssetCatalogAdapter[]
): Promise<MotionAssetCatalogRecord[]> => {
  const records = (await Promise.all(adapters.map((adapter) => adapter.read()))).flat();
  return uniqueById(records).sort((left, right) => right.freshnessScore - left.freshnessScore || left.id.localeCompare(right.id));
};

export const rankMotionAssetCatalog = ({
  catalog,
  query
}: {
  catalog: MotionAssetCatalogRecord[];
  query: MotionAssetQuery;
}): MotionAssetCatalogMatch[] => {
  const queryText = normalize(query.text);
  const queryTags = new Set((query.semanticTags ?? []).map(normalize));
  const recentKeys = new Set(query.recentAntiRepetitionKeys ?? []);

  return catalog
    .map((asset) => {
      const reasons: string[] = [];
      let score = asset.freshnessScore * 18;
      const haystack = normalize([
        asset.id,
        asset.label,
        ...asset.semanticTags,
        ...asset.aestheticTags
      ].join(" "));

      if (queryText && haystack.includes(queryText)) {
        score += 18;
        reasons.push("text match");
      }

      const tagHits = asset.semanticTags.filter((tag) => queryTags.has(normalize(tag))).length;
      if (tagHits > 0) {
        score += tagHits * 8;
        reasons.push(`${tagHits} semantic tag match(es)`);
      }

      if (durationFits(asset, query.durationMs)) {
        score += 5;
        reasons.push("timing compatible");
      } else {
        score -= 12;
        reasons.push("timing mismatch");
      }

      if (recentKeys.has(asset.antiRepetitionKey)) {
        score -= 20;
        reasons.push("anti-repetition penalty");
      }

      if (asset.gpuCost === "low") {
        score += 2;
      } else if (asset.gpuCost === "high") {
        score -= 3;
      }

      return {
        asset,
        score: Number(score.toFixed(3)),
        reasons
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id))
    .slice(0, query.limit ?? 12);
};

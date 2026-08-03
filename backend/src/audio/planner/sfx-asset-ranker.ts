import type {SfxCatalogAsset} from "../catalog/sfx-catalog.schema.js";
import type {JosephSfxIntent} from "./joseph-sfx-intent.js";

export type RankedSfx = {asset: SfxCatalogAsset; score: number; reasons: string[]};

export const rankSfxAssets = ({intent, assets, priorAssetIds = []}: {intent: JosephSfxIntent; assets: SfxCatalogAsset[]; priorAssetIds?: string[]}): RankedSfx[] =>
  assets
    .filter((asset) =>
      asset.rights.state === "release_allowed" &&
      asset.rights.usage === "release" &&
      asset.lifecycleRoles.includes(intent.lifecycleRole) &&
      asset.material === intent.material,
    )
    .map((asset) => {
      const reasons: string[] = [];
      let score = 0;
      if (asset.lifecycleRoles.includes(intent.lifecycleRole)) { score += 5; reasons.push("lifecycle"); }
      if (asset.material === intent.material) { score += 3; reasons.push("material"); }
      if (asset.direction === intent.direction) { score += 2; reasons.push("direction"); }
      if (asset.intensity === intent.intensity) { score += 1; reasons.push("intensity"); }
      score += asset.semanticTags.filter((tag) => intent.semanticTags.includes(tag)).length * 2;
      if (priorAssetIds.includes(asset.assetId)) { score -= 4; reasons.push("variation_penalty"); }
      return {asset, score, reasons};
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.asset.assetId.localeCompare(right.asset.assetId));

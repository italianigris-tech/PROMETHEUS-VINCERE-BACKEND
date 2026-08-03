import type {SfxCatalogAsset} from "../catalog/sfx-catalog.schema.js";
import {planJosephSfxIntents, type JosephSfxSourceEvent} from "./joseph-sfx-intent.js";
import {rankSfxAssets} from "./sfx-asset-ranker.js";

export type JosephSfxTreatment = {
  selected: Array<{eventId: string; assetId: string; outputMs: number; reason: string; score: number}>;
  rejected: Array<{eventId: string; reason: string}>;
  omissions: Array<{eventId: string; outputMs: number; reason: string}>;
};

export const planJosephSfxTreatment = ({events, assets, maxCues = 3, minimumGapMs = 1250}: {events: JosephSfxSourceEvent[]; assets: SfxCatalogAsset[]; maxCues?: number; minimumGapMs?: number}): JosephSfxTreatment => {
  const {intents, omissions} = planJosephSfxIntents(events);
  const selected: JosephSfxTreatment["selected"] = [];
  const rejected: JosephSfxTreatment["rejected"] = [];
  for (const intent of intents) {
    if (selected.length >= maxCues) { omissions.push({eventId: intent.eventId, outputMs: intent.outputMs, reason: "fatigue_relief"}); continue; }
    if (selected.some((cue) => Math.abs(cue.outputMs - intent.outputMs) < minimumGapMs)) { omissions.push({eventId: intent.eventId, outputMs: intent.outputMs, reason: "fatigue_relief"}); continue; }
    const ranked = rankSfxAssets({intent, assets, priorAssetIds: selected.map((cue) => cue.assetId)});
    const winner = ranked[0];
    if (!winner) { rejected.push({eventId: intent.eventId, reason: "no_suitable_asset"}); omissions.push({eventId: intent.eventId, outputMs: intent.outputMs, reason: "no_suitable_asset"}); continue; }
    selected.push({eventId: intent.eventId, assetId: winner.asset.assetId, outputMs: intent.outputMs, score: winner.score, reason: `${intent.reason} Ranked by ${winner.reasons.join(", ")}.`});
  }
  return {selected, rejected, omissions};
};

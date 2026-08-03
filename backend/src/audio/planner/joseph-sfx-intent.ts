import type {SfxCatalogAsset} from "../catalog/sfx-catalog.schema.js";

export type JosephSfxSourceEvent = {
  eventId: string;
  kind: "text" | "transition" | "payoff" | "camera";
  outputMs: number;
  text?: string;
  durationMs?: number;
  direction?: SfxCatalogAsset["direction"];
};

export type JosephSfxIntent = {
  eventId: string;
  lifecycleRole: SfxCatalogAsset["lifecycleRoles"][number];
  timingRelation: "before_visual" | "on_visual" | "after_visual" | "before_keyword" | "on_keyword";
  outputMs: number;
  material: SfxCatalogAsset["material"];
  direction: SfxCatalogAsset["direction"];
  intensity: SfxCatalogAsset["intensity"];
  semanticTags: string[];
  reason: string;
};

export type JosephSfxOmission = {eventId: string; outputMs: number; reason: "fatigue_relief" | "rhetorical_space" | "low_semantic_weight" | "pattern_break" | "dialogue_clarity" | "no_suitable_asset"};

export const planJosephSfxIntents = (events: JosephSfxSourceEvent[]): {intents: JosephSfxIntent[]; omissions: JosephSfxOmission[]} => {
  const intents: JosephSfxIntent[] = [];
  const omissions: JosephSfxOmission[] = [];
  for (const event of [...events].sort((left, right) => left.outputMs - right.outputMs)) {
    const words = event.text?.trim().split(/\s+/).filter(Boolean).length ?? 0;
    if (event.kind === "text" && /\?$/.test(event.text?.trim() ?? "")) {
      omissions.push({eventId: event.eventId, outputMs: event.outputMs, reason: "rhetorical_space"});
    } else if (event.kind === "text" && (words >= 8 || (event.durationMs ?? 0) >= 1800)) {
      intents.push({eventId: event.eventId, lifecycleRole: "motion_follow", timingRelation: "on_visual", outputMs: event.outputMs, material: "texture", direction: "neutral", intensity: "soft", semanticTags: ["text", "continuous"], reason: "Long text receives one continuous texture, never repeated clicks."});
    } else if (event.kind === "text" && words > 0) {
      intents.push({eventId: event.eventId, lifecycleRole: "entry", timingRelation: "on_visual", outputMs: event.outputMs, material: "digital", direction: "neutral", intensity: "soft", semanticTags: ["text", "click"], reason: "Short text is eligible for one restrained entry punctuation."});
    } else if (event.kind === "transition" || event.kind === "camera") {
      intents.push({eventId: event.eventId, lifecycleRole: "transition_bridge", timingRelation: "before_visual", outputMs: Math.max(0, event.outputMs - 80), material: "air", direction: event.direction ?? "neutral", intensity: "medium", semanticTags: ["transition", "motion"], reason: "Directional movement receives one pre-visual bridge."});
    } else if (event.kind === "payoff") {
      intents.push({eventId: event.eventId, lifecycleRole: "release", timingRelation: "on_keyword", outputMs: event.outputMs, material: "cinematic", direction: "outward", intensity: "medium", semanticTags: ["payoff", "release"], reason: "Payoff can earn one semantic release after preserved setup space."});
    } else {
      omissions.push({eventId: event.eventId, outputMs: event.outputMs, reason: "low_semantic_weight"});
    }
  }
  return {intents, omissions};
};

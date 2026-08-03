import {describe, expect, it} from "vitest";

import {planJosephSfxTreatment} from "./audio-treatment-planner.js";

const asset = (assetId: string, tags: string[]) => ({assetId, sha256: "a".repeat(64), objectKey: `${assetId}.wav`, durationMs: 300, format: "wav", analysis: {provider: "ffprobe", inputHash: "a".repeat(64), durationStatus: "measured", loudnessLufs: null, truePeakDbtp: null, onsetMs: null, tailMs: null, status: "metadata_only"}, lifecycleRoles: ["entry", "motion_follow", "transition_bridge", "release"], material: "digital", direction: "neutral", intensity: "soft", semanticTags: tags, rights: {state: "release_allowed", usage: "release", sourceEvidence: "receipt", licenseEvidence: "license"}}) as any;

describe("Joseph SFX treatment planner", () => {
  it("uses restraint, omission, and deterministic variation", () => {
    const plan = planJosephSfxTreatment({assets: [asset("click_a", ["text", "click"]), asset("click_b", ["text", "click"])], events: [
      {eventId: "short", kind: "text", outputMs: 0, text: "Proof"},
      {eventId: "question", kind: "text", outputMs: 400, text: "Why now?"},
      {eventId: "long", kind: "text", outputMs: 2600, durationMs: 2000, text: "This is a deliberately long explanatory sentence that must not click repeatedly"},
      {eventId: "extra", kind: "text", outputMs: 5000, text: "Again"},
      {eventId: "extra2", kind: "text", outputMs: 7000, text: "Again"},
      {eventId: "extra3", kind: "text", outputMs: 9000, text: "Again"},
    ]});
    expect(plan.selected).toHaveLength(3);
    expect(plan.selected.map((cue) => cue.assetId)).toEqual(["click_a", "click_b", "click_a"]);
    expect(plan.omissions).toEqual(expect.arrayContaining([expect.objectContaining({eventId: "question", reason: "rhetorical_space"}), expect.objectContaining({eventId: "long", reason: "no_suitable_asset"}), expect.objectContaining({eventId: "extra3", reason: "fatigue_relief"})]));
  });
});

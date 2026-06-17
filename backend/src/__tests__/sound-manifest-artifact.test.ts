import {describe, expect, it} from "vitest";

import {adaptedSoundDesignRenderHintsSchema} from "../music/persistence/sound-manifest-artifact";

describe("adaptedSoundDesignRenderHintsSchema", () => {
  it("preserves typed orphan transition events for the audio renderer", () => {
    const renderHints = adaptedSoundDesignRenderHintsSchema.parse({
      planMode: "render_ready",
      orphanTransitionEvents: [{
        id: "transition-1",
        type: "riser_into_impact",
        videoStartSec: 1.2,
        videoEndSec: 1.8
      }]
    });

    expect(renderHints.orphanTransitionEvents[0]?.type).toBe("riser_into_impact");
  });

  it("rejects orphan transition events that the renderer cannot type safely", () => {
    const result = adaptedSoundDesignRenderHintsSchema.safeParse({
      planMode: "render_ready",
      orphanTransitionEvents: [{
        id: "transition-1",
        type: "mystery_transition",
        videoStartSec: 1.2,
        videoEndSec: 1.8
      }]
    });

    expect(result.success).toBe(false);
  });
});

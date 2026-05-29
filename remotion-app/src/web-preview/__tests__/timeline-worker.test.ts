import {describe, expect, it, vi} from "vitest";

import {seekHyperframesTimelineToFrame} from "../hyperframes/timeline.worker";

describe("Hyperframes timeline seeking", () => {
  it("keeps legacy GSAP timeline seeking deterministic without baking frames", () => {
    const timeline = {
      seek: vi.fn(),
      play: vi.fn()
    };

    seekHyperframesTimelineToFrame({
      timeline,
      currentFrame: 45,
      fps: 30
    });

    expect(timeline.seek).toHaveBeenCalledWith(1.5, false);
    expect(timeline.play).not.toHaveBeenCalled();
  });
});

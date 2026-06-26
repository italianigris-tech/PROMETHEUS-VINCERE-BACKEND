import {describe, expect, it} from "vitest";
import {buildJosephPiPCompositionPlan} from "./joseph-pip-composition";

describe("Joseph PiP composition planner", () => {
  it("builds a reusable speaker rig with docking, depth, typography, and background rules", () => {
    const plan = buildJosephPiPCompositionPlan({
      durationFrames: 180,
      width: 1080,
      height: 1920,
      profile: "joseph_aggressive",
      sourceTrackId: "primary",
      attentionAnchors: ["win"],
      doctrineId: "spotlight-swap",
    });

    expect(plan.version).toBe("joseph-pip-v1");
    expect(plan.layout).toBe("speaker_right_text_left");
    expect(plan.sourceTrackId).toBe("primary");
    expect(plan.frame.depth).toBe("subject");
    expect(plan.frame.safeMarginPercent).toBeGreaterThan(0);
    expect(plan.dockingPosition).toBe("upper_right");
    expect(plan.availableMotionBehaviors).toEqual(
      expect.arrayContaining(["enter", "dock", "expand", "collapse", "handoff"]),
    );
    expect(plan.activeMotion.map((segment) => segment.behavior)).toEqual(["enter", "dock", "handoff"]);
    expect(plan.typographyZones.some((zone) => zone.role === "hero" && zone.minClearancePercent >= 6)).toBe(true);
    expect(plan.backgroundLayers.some((layer) => layer.role === "focus_field")).toBe(true);
    expect(plan.coexistenceRules).toMatchObject({
      preserveSubjectFocus: true,
      protectTypography: true,
    });
  });

  it("changes layout doctrine without losing the same coexistence contract", () => {
    const cinematic = buildJosephPiPCompositionPlan({
      durationFrames: 240,
      width: 1080,
      height: 1920,
      profile: "joseph_cinematic",
      sourceTrackId: "primary",
      attentionAnchors: ["clarity"],
      doctrineId: "restrained-cinematic",
    });
    const minimal = buildJosephPiPCompositionPlan({
      durationFrames: 240,
      width: 1080,
      height: 1920,
      profile: "joseph_minimal",
      sourceTrackId: "primary",
      attentionAnchors: ["clarity"],
    });

    expect(cinematic.layout).toBe("speaker_left_text_right");
    expect(minimal.layout).toBe("corner_speaker_hero_text");
    expect(cinematic.coexistenceRules.protectTypography).toBe(true);
    expect(minimal.coexistenceRules.protectTypography).toBe(true);
    expect(cinematic.typographyZones.map((zone) => zone.role)).toEqual(
      expect.arrayContaining(["hero", "support", "caption"]),
    );
    expect(minimal.backgroundLayers.length).toBeGreaterThan(0);
  });
});
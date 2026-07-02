import {describe, expect, it} from "vitest";
import type {JosephPiPPlan} from "@prometheus/shared-types";
import {buildJosephTalkingHeadMacroRig} from "./joseph-macro-rig";

const pipPlan: JosephPiPPlan = {
  version: "joseph-pip-v1",
  layout: "speaker_right_text_left",
  sourceTrackId: "primary",
  subjectAnchor: {xPercent: 51, yPercent: 34, confidence: 0.82, source: "heuristic"},
  frame: {
    leftPercent: 58,
    topPercent: 12,
    widthPercent: 34,
    heightPercent: 38,
    borderRadiusPx: 28,
    safeMarginPercent: 4,
    depth: "subject",
  },
  dockingPosition: "upper_right",
  availableMotionBehaviors: ["enter", "dock", "expand", "collapse", "handoff"],
  activeMotion: [
    {behavior: "enter", startFrame: 0, endFrame: 20, easing: "ease_out"},
    {behavior: "dock", startFrame: 20, endFrame: 60, easing: "ease_in_out"},
  ],
  typographyZones: [
    {role: "hero", leftPercent: 7, topPercent: 14, widthPercent: 43, heightPercent: 28, align: "left", minClearancePercent: 6},
    {role: "support", leftPercent: 8, topPercent: 45, widthPercent: 38, heightPercent: 18, align: "left", minClearancePercent: 5},
  ],
  backgroundLayers: [
    {role: "asset_board", leftPercent: 7, topPercent: 65, widthPercent: 39, heightPercent: 18, intensity: 0.46},
  ],
  coexistenceRules: {
    preserveSubjectFocus: true,
    protectTypography: true,
    textClearancePercent: 6,
    backgroundDefocus: 0.42,
  },
};

const words = ["Here", "is", "the", "proof", "data", "exhibit"].map((text, index) => ({
  text,
  startMs: index * 120,
  endMs: index * 120 + 100,
}));

describe("Joseph semantic macro-rig planner", () => {
  it("declares the talking-head proof/data/exhibit contract from a valid semantic trigger", () => {
    const rig = buildJosephTalkingHeadMacroRig({
      semanticSummary: {
        intent: "show proof with data exhibit",
        rhetoricalArc: "open with proof",
        tone: "aggressive",
      },
      transcript: words,
      pipPlan,
    });

    expect(rig).toMatchObject({
      version: "joseph-macro-rig-v1",
      rigId: "talking-head-proof-data-exhibit",
      semanticTrigger: {
        valid: true,
        triggerKind: "proof_data_exhibit",
        matchedSignals: expect.arrayContaining(["proof", "data", "exhibit"]),
      },
      inputs: {
        sourceTrackId: "primary",
        requiredSceneRoles: expect.arrayContaining(["talking_head", "proof", "data_exhibit"]),
      },
      sceneFacts: {
        momentKind: "proof_data_exhibit",
        talkingHeadPresent: true,
        exhibitAnchors: expect.arrayContaining(["proof", "data", "exhibit"]),
      },
      renderFields: {
        pipPlan,
        typographySlots: expect.arrayContaining([
          expect.objectContaining({role: "proof_headline"}),
          expect.objectContaining({role: "data_label"}),
        ]),
        assetPlacements: expect.arrayContaining([
          expect.objectContaining({role: "exhibit_board"}),
        ]),
      },
    });
    expect(rig?.assetRequirements.map((requirement) => requirement.role)).toEqual(
      expect.arrayContaining(["speaker_source", "exhibit_board", "proof_typography"]),
    );
    expect(rig?.failureFallbacks.map((fallback) => fallback.action)).toEqual(
      expect.arrayContaining(["omit_macro_rig", "use_typography_only_exhibit"]),
    );
  });

  it("omits the macro-rig when proof/data/exhibit semantics are not present", () => {
    const rig = buildJosephTalkingHeadMacroRig({
      semanticSummary: {
        intent: "brand awareness hook",
        rhetoricalArc: "open with attention",
        tone: "minimal",
      },
      transcript: ["Move", "fast", "and", "win"].map((text, index) => ({
        text,
        startMs: index * 120,
        endMs: index * 120 + 100,
      })),
      pipPlan,
    });

    expect(rig).toBeNull();
  });
});

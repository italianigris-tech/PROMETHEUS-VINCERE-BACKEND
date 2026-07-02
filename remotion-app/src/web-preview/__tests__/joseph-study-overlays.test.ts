import {describe, expect, it} from "vitest";
import type {JosephMacroRigPlan, JosephPiPPlan, UnifiedRenderManifest} from "@prometheus/shared-types";
import {buildJosephStudyOverlaySections} from "../joseph-study-overlays";

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

const macroRigPlan: JosephMacroRigPlan = {
  version: "joseph-macro-rig-v1",
  rigId: "talking-head-proof-data-exhibit",
  semanticTrigger: {
    valid: true,
    triggerKind: "proof_data_exhibit",
    matchedSignals: ["proof", "data", "exhibit"],
    confidence: 0.91,
  },
  inputs: {
    sourceTrackId: "primary",
    requiredSceneRoles: ["talking_head", "proof", "data_exhibit"],
    semanticSignals: ["proof", "data", "exhibit"],
  },
  sceneFacts: {
    momentKind: "proof_data_exhibit",
    talkingHeadPresent: true,
    exhibitAnchors: ["proof", "data", "exhibit"],
    proofText: "Proof data exhibit",
  },
  assetRequirements: [
    {
      role: "speaker_source",
      required: true,
      acceptableFallback: "omit_macro_rig",
      semanticNeed: "Talking-head source track must be available.",
    },
  ],
  renderFields: {
    pipPlan,
    typographySlots: [
      {role: "proof_headline", text: "PROOF", leftPercent: 7, topPercent: 14, widthPercent: 43, heightPercent: 12, zIndex: 42},
      {role: "data_label", text: "DATA", leftPercent: 8, topPercent: 45, widthPercent: 38, heightPercent: 10, zIndex: 41},
    ],
    assetPlacements: [
      {role: "exhibit_board", leftPercent: 7, topPercent: 65, widthPercent: 39, heightPercent: 18, zIndex: 24},
    ],
  },
  failureFallbacks: [
    {
      tag: "macro_rig_semantic_trigger_missing",
      reason: "Do not render the rig unless proof/data/exhibit semantics are present.",
      action: "omit_macro_rig",
    },
  ],
};

const baseManifest: UnifiedRenderManifest = {
  version: "2.0",
  jobId: "123e4567-e89b-12d3-a456-426614174000",
  seed: 76,
  createdAt: "2026-01-01T00:00:00.000Z",
  durationFrames: 120,
  fps: 30,
  width: 1920,
  height: 1080,
  videoTracks: [{id: "primary", sourcePath: "/uploads/job-1/video.mp4", startFrame: 0, endFrame: 119}],
  cameraMoves: [],
  textOverlays: [],
  transitions: [],
  josephPiP: pipPlan,
  source: {
    videoUrl: "/uploads/job-1/video.mp4",
    transcript: [],
    durationMs: 4000,
    width: 1920,
    height: 1080,
    fps: 30,
  },
  audio: {
    beats: [],
    onsets: [],
    sfx: [],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [],
  creativeProfile: {
    name: "joseph_aggressive",
    cutDensity: 0.8,
    textDensity: 0.8,
    sfxDensity: 0.8,
    cameraAggression: 0.8,
    colorIntensity: 0.7,
  },
  output: {width: 1920, height: 1080, fps: 30, codec: "h264", crf: 18},
};

describe("Joseph Study Studio overlays", () => {
  it("surfaces the semantic macro-rig only when the candidate manifest contains a valid rig", () => {
    const activeSections = buildJosephStudyOverlaySections({
      ...baseManifest,
      josephMacroRig: macroRigPlan,
    });
    const inactiveSections = buildJosephStudyOverlaySections(baseManifest);

    const macroRigSection = activeSections.find((section) => section.id === "macro-rig");

    expect(macroRigSection).toMatchObject({
      title: "Macro Rig",
      entries: expect.arrayContaining([
        expect.objectContaining({label: "talking-head-proof-data-exhibit"}),
        expect.objectContaining({label: "proof,data,exhibit"}),
        expect.objectContaining({label: "proof_headline"}),
      ]),
    });
    expect(inactiveSections.some((section) => section.id === "macro-rig")).toBe(false);
  });
});

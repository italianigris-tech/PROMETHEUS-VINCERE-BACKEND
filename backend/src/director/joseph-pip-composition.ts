import type {
  JosephPiPBackgroundLayer,
  JosephPiPDockingPosition,
  JosephPiPFrame,
  JosephPiPLayout,
  JosephPiPPlan,
  JosephPiPTypographyZone,
} from "@prometheus/shared-types";
import type {DirectorInput} from "./joseph-director";

export type JosephPiPCompositionInput = {
  durationFrames: number;
  width: number;
  height: number;
  profile: DirectorInput["profile"];
  sourceTrackId: string;
  attentionAnchors: readonly string[];
  doctrineId?: string;
};

const AVAILABLE_MOTION_BEHAVIORS = ["enter", "dock", "expand", "collapse", "handoff"] as const;

const layoutFor = (profile: DirectorInput["profile"], doctrineId?: string): JosephPiPLayout => {
  if (doctrineId === "spotlight-swap") {
    return "speaker_right_text_left";
  }
  if (profile === "joseph_minimal") {
    return "corner_speaker_hero_text";
  }
  if (profile === "joseph_cinematic") {
    return "speaker_left_text_right";
  }
  return "speaker_right_text_left";
};

const dockingFor = (layout: JosephPiPLayout): JosephPiPDockingPosition => {
  if (layout === "speaker_left_text_right") {
    return "upper_left";
  }
  if (layout === "corner_speaker_hero_text") {
    return "lower_right";
  }
  return "upper_right";
};

const frameFor = (layout: JosephPiPLayout): JosephPiPFrame => {
  if (layout === "speaker_left_text_right") {
    return {
      leftPercent: 6,
      topPercent: 12,
      widthPercent: 38,
      heightPercent: 42,
      borderRadiusPx: 30,
      safeMarginPercent: 4,
      depth: "subject",
    };
  }
  if (layout === "corner_speaker_hero_text") {
    return {
      leftPercent: 58,
      topPercent: 55,
      widthPercent: 34,
      heightPercent: 31,
      borderRadiusPx: 26,
      safeMarginPercent: 5,
      depth: "subject",
    };
  }
  return {
    leftPercent: 58,
    topPercent: 12,
    widthPercent: 34,
    heightPercent: 38,
    borderRadiusPx: 28,
    safeMarginPercent: 4,
    depth: "subject",
  };
};

const typographyZonesFor = (layout: JosephPiPLayout): JosephPiPTypographyZone[] => {
  if (layout === "speaker_left_text_right") {
    return [
      {role: "hero", leftPercent: 52, topPercent: 14, widthPercent: 39, heightPercent: 28, align: "left", minClearancePercent: 6},
      {role: "support", leftPercent: 53, topPercent: 46, widthPercent: 35, heightPercent: 18, align: "left", minClearancePercent: 5},
      {role: "caption", leftPercent: 10, topPercent: 83, widthPercent: 80, heightPercent: 10, align: "center", minClearancePercent: 4},
    ];
  }
  if (layout === "corner_speaker_hero_text") {
    return [
      {role: "hero", leftPercent: 7, topPercent: 13, widthPercent: 52, heightPercent: 32, align: "left", minClearancePercent: 7},
      {role: "support", leftPercent: 8, topPercent: 49, widthPercent: 44, heightPercent: 18, align: "left", minClearancePercent: 6},
      {role: "caption", leftPercent: 8, topPercent: 82, widthPercent: 42, heightPercent: 10, align: "left", minClearancePercent: 5},
    ];
  }
  return [
    {role: "hero", leftPercent: 7, topPercent: 14, widthPercent: 43, heightPercent: 28, align: "left", minClearancePercent: 6},
    {role: "support", leftPercent: 8, topPercent: 45, widthPercent: 38, heightPercent: 18, align: "left", minClearancePercent: 5},
    {role: "caption", leftPercent: 8, topPercent: 82, widthPercent: 42, heightPercent: 10, align: "left", minClearancePercent: 4},
  ];
};

const backgroundLayersFor = (layout: JosephPiPLayout): JosephPiPBackgroundLayer[] => {
  if (layout === "speaker_left_text_right") {
    return [
      {role: "focus_field", leftPercent: 4, topPercent: 8, widthPercent: 44, heightPercent: 50, intensity: 0.58},
      {role: "asset_board", leftPercent: 53, topPercent: 66, widthPercent: 36, heightPercent: 18, intensity: 0.48},
    ];
  }
  if (layout === "corner_speaker_hero_text") {
    return [
      {role: "backplate", leftPercent: 4, topPercent: 9, widthPercent: 58, heightPercent: 42, intensity: 0.5},
      {role: "focus_field", leftPercent: 55, topPercent: 52, widthPercent: 40, heightPercent: 36, intensity: 0.62},
    ];
  }
  return [
    {role: "focus_field", leftPercent: 54, topPercent: 8, widthPercent: 42, heightPercent: 46, intensity: 0.64},
    {role: "asset_board", leftPercent: 7, topPercent: 65, widthPercent: 39, heightPercent: 18, intensity: 0.46},
  ];
};

export const buildJosephPiPCompositionPlan = ({
  durationFrames,
  profile,
  sourceTrackId,
  doctrineId,
}: JosephPiPCompositionInput): JosephPiPPlan => {
  const layout = layoutFor(profile, doctrineId);
  const enterEnd = Math.min(20, Math.max(8, Math.floor(durationFrames * 0.08)));
  const dockEnd = Math.min(durationFrames - 1, enterEnd + Math.max(24, Math.floor(durationFrames * 0.16)));
  const handoffEnd = Math.min(durationFrames - 1, dockEnd + Math.max(18, Math.floor(durationFrames * 0.1)));

  return {
    version: "joseph-pip-v1",
    layout,
    sourceTrackId,
    subjectAnchor: {
      xPercent: layout === "speaker_right_text_left" ? 51 : 49,
      yPercent: layout === "corner_speaker_hero_text" ? 32 : 35,
      confidence: 0.78,
      source: "heuristic",
    },
    frame: frameFor(layout),
    dockingPosition: dockingFor(layout),
    availableMotionBehaviors: [...AVAILABLE_MOTION_BEHAVIORS],
    activeMotion: [
      {behavior: "enter", startFrame: 0, endFrame: enterEnd, easing: "ease_out"},
      {behavior: "dock", startFrame: enterEnd, endFrame: dockEnd, easing: "ease_in_out"},
      {behavior: "handoff", startFrame: dockEnd, endFrame: handoffEnd, easing: "ease_out"},
    ],
    typographyZones: typographyZonesFor(layout),
    backgroundLayers: backgroundLayersFor(layout),
    coexistenceRules: {
      preserveSubjectFocus: true,
      protectTypography: true,
      textClearancePercent: layout === "corner_speaker_hero_text" ? 7 : 6,
      backgroundDefocus: profile === "joseph_aggressive" ? 0.34 : 0.46,
    },
  };
};
import type {UnifiedRenderManifest} from "@prometheus/shared-types";

export type JosephStudyOverlayEntry = {
  label: string;
  range: string;
};

export type JosephStudyOverlaySection = {
  id: "cuts" | "text" | "camera" | "transitions" | "sfx";
  title: string;
  entries: JosephStudyOverlayEntry[];
};

const formatRange = (start: number, end: number): string => `${start}-${end}`;

export const buildJosephStudyOverlaySections = (manifest: UnifiedRenderManifest): JosephStudyOverlaySection[] => {
  const cuts: JosephStudyOverlayEntry[] = manifest.videoTracks.map((track, index) => ({
    label: `Video track ${index + 1}`,
    range: formatRange(track.startFrame, track.endFrame)
  }));

  const text: JosephStudyOverlayEntry[] = manifest.textOverlays.map((overlay) => ({
    label: overlay.text,
    range: formatRange(overlay.startFrame, overlay.endFrame)
  }));

  const camera: JosephStudyOverlayEntry[] = manifest.cameraMoves.map((move, index) => ({
    label: `Camera move ${index + 1}`,
    range: formatRange(move.startFrame, move.endFrame)
  }));

  const transitions: JosephStudyOverlayEntry[] = manifest.transitions.map((transition, index) => ({
    label: `Transition ${index + 1}`,
    range: formatRange(transition.startFrame, transition.endFrame)
  }));

  const sfx: JosephStudyOverlayEntry[] = manifest.audio.sfx.map((event) => ({
    label: event.cue,
    range: formatRange(Math.max(0, Math.round(event.triggerMs / 1000)), Math.max(0, Math.round((event.triggerMs + event.durationMs) / 1000)))
  }));

  return [
    {id: "cuts", title: "Cuts", entries: cuts},
    {id: "text", title: "Text", entries: text},
    {id: "camera", title: "Camera", entries: camera},
    {id: "transitions", title: "Transitions", entries: transitions},
    {id: "sfx", title: "SFX", entries: sfx}
  ];
};

import type {UnifiedRenderManifest} from "@prometheus/shared-types";

export type JosephStudyOverlayEntry = {
  label: string;
  range: string;
};

export type JosephStudyOverlaySection = {
  id: "cuts" | "text" | "camera" | "transitions" | "sfx" | "macro-rig" | "planner" | "pip" | "evaluator" | "evidence" | "frame-state";
  title: string;
  entries: JosephStudyOverlayEntry[];
};

export type JosephStudyCompilerArtifact = {
  id?: string;
  selectedPathId?: string;
  plannerAuditPointer?: string | null;
  graphNodes?: Array<{
    id: string;
    primitiveIds?: string[];
    startFrame: number;
    endFrame: number;
  }>;
};

export type JosephStudyFrameDiagnostics = {
  frame: number;
  plannerAuditPointer: string | null;
  missingEvidence: string[];
  sections: JosephStudyOverlaySection[];
};

const formatRange = (start: number, end: number): string => `${start}-${end}`;

const isFrameActive = (frame: number, startFrame: number, endFrame: number): boolean => frame >= startFrame && frame <= endFrame;

const msToFrame = (ms: number, fps: number): number => Math.max(0, Math.round((ms / 1000) * fps));

const nonEmptySection = (section: JosephStudyOverlaySection): JosephStudyOverlaySection | null =>
  section.entries.length > 0 ? section : null;

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

  const macroRig = manifest.josephMacroRig?.semanticTrigger.valid
    ? [{
      id: "macro-rig" as const,
      title: "Macro Rig",
      entries: [
        {
          label: manifest.josephMacroRig.rigId,
          range: manifest.josephMacroRig.sceneFacts.momentKind,
        },
        {
          label: manifest.josephMacroRig.semanticTrigger.matchedSignals.join(","),
          range: `${Math.round(manifest.josephMacroRig.semanticTrigger.confidence * 100)}%`,
        },
        ...manifest.josephMacroRig.renderFields.typographySlots.map((slot) => ({
          label: slot.role,
          range: formatRange(slot.zIndex, slot.zIndex),
        })),
      ],
    }]
    : [];

  return [
    {id: "cuts", title: "Cuts", entries: cuts},
    {id: "text", title: "Text", entries: text},
    {id: "camera", title: "Camera", entries: camera},
    {id: "transitions", title: "Transitions", entries: transitions},
    {id: "sfx", title: "SFX", entries: sfx},
    ...macroRig,
  ];
};

export const buildJosephStudyFrameDiagnostics = ({
  manifest,
  frame,
  compilerArtifact = null,
  plannerAuditPointer = null,
}: {
  manifest: UnifiedRenderManifest;
  frame: number;
  compilerArtifact?: JosephStudyCompilerArtifact | null;
  plannerAuditPointer?: string | null;
}): JosephStudyFrameDiagnostics => {
  const fps = manifest.fps ?? manifest.output?.fps ?? 30;
  const resolvedPlannerAuditPointer = plannerAuditPointer ?? compilerArtifact?.plannerAuditPointer ?? null;
  const missingEvidence = [
    ...(!compilerArtifact ? ["compiler_artifact_missing"] : []),
    ...(!resolvedPlannerAuditPointer ? ["planner_audit_pointer_missing"] : []),
  ];

  const activeGraphNodes = compilerArtifact?.graphNodes?.filter((node) => isFrameActive(frame, node.startFrame, node.endFrame)) ?? [];
  const plannerEntries: JosephStudyOverlayEntry[] = [
    ...(compilerArtifact?.selectedPathId ? [{label: "Selected path", range: compilerArtifact.selectedPathId}] : []),
    ...activeGraphNodes.map((node) => ({
      label: node.id,
      range: node.primitiveIds?.length ? node.primitiveIds.join(", ") : formatRange(node.startFrame, node.endFrame),
    })),
  ];

  const textEntries: JosephStudyOverlayEntry[] = manifest.textOverlays
    .filter((overlay) => isFrameActive(frame, overlay.startFrame, overlay.endFrame))
    .map((overlay) => ({
      label: overlay.text,
      range: overlay.microAnimation?.primitiveId
        ? `${formatRange(overlay.startFrame, overlay.endFrame)} | ${overlay.microAnimation.primitiveId}`
        : formatRange(overlay.startFrame, overlay.endFrame),
    }));

  const cameraEntries: JosephStudyOverlayEntry[] = manifest.cameraMoves
    .filter((move) => isFrameActive(frame, move.startFrame, move.endFrame))
    .map((move) => {
      const entryVelocity = move.entryVelocity ?? 1;
      const exitVelocity = move.exitVelocity ?? 1;
      return {
        label: move.type,
        range: `${formatRange(move.startFrame, move.endFrame)} | velocity ${entryVelocity}->${exitVelocity}`,
      };
    });

  const pipEntries: JosephStudyOverlayEntry[] = manifest.josephPiP
    ? manifest.josephPiP.activeMotion
      .filter((segment) => isFrameActive(frame, segment.startFrame, segment.endFrame))
      .map((segment) => ({
        label: segment.behavior,
        range: `${formatRange(segment.startFrame, segment.endFrame)} | ${manifest.josephPiP?.frame.depth ?? "unknown-depth"} | ${manifest.josephPiP?.dockingPosition ?? "unknown-dock"}`,
      }))
    : [];

  const sfxEntries: JosephStudyOverlayEntry[] = manifest.audio.sfx
    .map((event) => ({
      event,
      startFrame: msToFrame(event.triggerMs, fps),
      endFrame: msToFrame(event.triggerMs + event.durationMs, fps),
    }))
    .filter(({startFrame, endFrame}) => isFrameActive(frame, startFrame, endFrame))
    .map(({event, startFrame, endFrame}) => ({
      label: event.cue,
      range: formatRange(startFrame, endFrame),
    }));

  const evaluatorEntries: JosephStudyOverlayEntry[] = [
    ...(manifest.microAnimationAudit?.failures.map((failure) => ({label: failure, range: "failure"})) ?? []),
    ...(manifest.microAnimationAudit?.warnings.map((warning) => ({label: warning, range: "warning"})) ?? []),
    ...(manifest.microAnimationAudit?.fixIntents.map((intent) => ({label: intent, range: "fix intent"})) ?? []),
  ];

  const sections = [
    nonEmptySection({id: "planner", title: "Planner Audit", entries: plannerEntries}),
    nonEmptySection({id: "text", title: "Text Primitive", entries: textEntries}),
    nonEmptySection({id: "camera", title: "Camera Vector", entries: cameraEntries}),
    nonEmptySection({id: "pip", title: "PiP Layer", entries: pipEntries}),
    nonEmptySection({id: "sfx", title: "Audio Transient", entries: sfxEntries}),
    nonEmptySection({id: "evaluator", title: "Evaluator Warnings", entries: evaluatorEntries}),
    nonEmptySection({
      id: "evidence",
      title: "Evidence",
      entries: [
        ...(resolvedPlannerAuditPointer ? [{label: "Planner Audit", range: resolvedPlannerAuditPointer}] : []),
        ...(compilerArtifact?.id ? [{label: "Compiler Artifact", range: compilerArtifact.id}] : []),
        ...missingEvidence.map((evidence) => ({label: evidence, range: "missing"})),
      ],
    }),
  ].filter((section): section is JosephStudyOverlaySection => Boolean(section));

  if (!sections.some((section) => section.id !== "evidence")) {
    sections.unshift({
      id: "frame-state",
      title: "Frame State",
      entries: [{label: "No active primitive", range: String(frame)}],
    });
  }

  return {
    frame,
    plannerAuditPointer: resolvedPlannerAuditPointer,
    missingEvidence,
    sections,
  };
};

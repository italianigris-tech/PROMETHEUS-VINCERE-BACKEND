import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {buildJosephStudyFrameDiagnostics, buildJosephStudyOverlaySections} from "../joseph-study-overlays";
import {buildJosephStudyPlayerConfig, JosephStudyStudioView, toggleJosephStudyDiagnostics} from "../JosephStudyStudio";

describe("Joseph study diagnostic overlays", () => {
  it("derives manifest timing facts for cuts text camera transitions and sfx", () => {
    const manifest = buildJosephStudyPlayerConfig().inputProps.manifest;
    const sections = buildJosephStudyOverlaySections(manifest);

    expect(sections).toEqual([
      {
        id: "cuts",
        title: "Cuts",
        entries: [{label: "Video track 1", range: "0-299"}]
      },
      {
        id: "text",
        title: "Text",
        entries: [{label: "PROMETHEUS", range: "12-72"}]
      },
      {
        id: "camera",
        title: "Camera",
        entries: []
      },
      {
        id: "transitions",
        title: "Transitions",
        entries: []
      },
      {
        id: "sfx",
        title: "SFX",
        entries: []
      }
    ]);
  });

  it("resolves an empty frozen frame and flags missing evidence", () => {
    const manifest = {
      ...buildJosephStudyPlayerConfig().inputProps.manifest,
      textOverlays: [],
      cameraMoves: [],
      transitions: [],
      audio: {
        ...buildJosephStudyPlayerConfig().inputProps.manifest.audio,
        sfx: []
      }
    };

    const diagnostics = buildJosephStudyFrameDiagnostics({manifest, frame: 96});

    expect(diagnostics.frame).toBe(96);
    expect(diagnostics.missingEvidence).toEqual(["compiler_artifact_missing", "planner_audit_pointer_missing"]);
    expect(diagnostics.sections).toContainEqual({
      id: "frame-state",
      title: "Frame State",
      entries: [{label: "No active primitive", range: "96"}]
    });
  });

  it("resolves overlapping graph text camera PiP audio and evaluator diagnostics for a frozen frame", () => {
    const manifest = {
      ...buildJosephStudyPlayerConfig().inputProps.manifest,
      durationFrames: 180,
      textOverlays: [{
        text: "FRAME PROOF",
        startFrame: 40,
        endFrame: 80,
        animation: "pop",
        color: "#FFFFFF",
        microAnimation: {
          primitiveId: "text-emphasis.sweep-highlight",
          family: "text_emphasis",
          role: "emphasis",
          renderFallback: "pop",
          combinationGroup: "emphasis-mark",
          semanticRole: "hero",
          parameters: {intensity: 0.7, durationMs: 300, delayMs: 0, anchor: "word"}
        }
      }],
      cameraMoves: [{
        type: "push_in",
        startFrame: 36,
        endFrame: 90,
        entryVelocity: 0.4,
        exitVelocity: 0.8,
        focalBehavior: "hold_subject"
      }],
      audio: {
        ...buildJosephStudyPlayerConfig().inputProps.manifest.audio,
        sfx: [{id: "hit-1", cue: "impact_hit", triggerMs: 1667, durationMs: 500, volumeDb: -10, duckMusicDb: -4}]
      },
      josephPiP: {
        version: "joseph-pip-v1",
        layout: "speaker_right_text_left",
        subjectAnchor: {xPercent: 66, yPercent: 48, confidence: 0.91, source: "tracked"},
        frame: {leftPercent: 60, topPercent: 10, widthPercent: 32, heightPercent: 42, borderRadiusPx: 18, safeMarginPercent: 4, depth: "foreground"},
        dockingPosition: "upper_right",
        availableMotionBehaviors: ["enter", "dock"],
        activeMotion: [{behavior: "dock", startFrame: 45, endFrame: 100, easing: "ease_out"}],
        typographyZones: [{role: "hero", leftPercent: 8, topPercent: 18, widthPercent: 48, heightPercent: 22, align: "left", minClearancePercent: 8}],
        backgroundLayers: [{role: "backplate", leftPercent: 4, topPercent: 12, widthPercent: 52, heightPercent: 48, intensity: 0.6}],
        coexistenceRules: {preserveSubjectFocus: true, protectTypography: true, textClearancePercent: 8, backgroundDefocus: 0.35}
      },
      microAnimationAudit: {
        taxonomyVersion: "joseph-micro-animation-v1",
        primitiveIds: ["text-emphasis.sweep-highlight"],
        score: 0.7,
        failures: [],
        warnings: ["micro_animation_intensity_budget_hot"],
        fixIntents: ["Reduce high-intensity primitive count before the moment loses readable hierarchy."]
      }
    } as any;

    const diagnostics = buildJosephStudyFrameDiagnostics({
      manifest,
      frame: 50,
      plannerAuditPointer: "evidence/planner-audit.json",
      compilerArtifact: {
        id: "compiler-artifact-a",
        selectedPathId: "path-a",
        graphNodes: [{id: "graph-node-proof", primitiveIds: ["pip.dock", "text-emphasis.sweep-highlight"], startFrame: 30, endFrame: 90}]
      }
    });

    expect(diagnostics.missingEvidence).toEqual([]);
    expect(diagnostics.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({id: "planner", entries: expect.arrayContaining([{label: "graph-node-proof", range: "pip.dock, text-emphasis.sweep-highlight"}])}),
      expect.objectContaining({id: "text", entries: expect.arrayContaining([{label: "FRAME PROOF", range: "40-80 | text-emphasis.sweep-highlight"}])}),
      expect.objectContaining({id: "camera", entries: expect.arrayContaining([{label: "push_in", range: "36-90 | velocity 0.4->0.8"}])}),
      expect.objectContaining({id: "pip", entries: expect.arrayContaining([{label: "dock", range: "45-100 | foreground | upper_right"}])}),
      expect.objectContaining({id: "sfx", entries: expect.arrayContaining([{label: "impact_hit", range: "50-65"}])}),
      expect.objectContaining({id: "evaluator", entries: expect.arrayContaining([{label: "micro_animation_intensity_budget_hot", range: "warning"}])})
    ]));
  });
  it("renders the diagnostic overlay panel when diagnostics are enabled", () => {
    const manifest = buildJosephStudyPlayerConfig().inputProps.manifest;
    const markup = renderToStaticMarkup(
      <JosephStudyStudioView
        state={{
          mode: "fixture",
          status: "ready",
          manifest
        } as any}
        diagnosticsVisible
        onToggleDiagnostics={() => undefined}
      />
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-joseph-study-overlays="true"');
    expect(markup).toContain('data-joseph-study-diagnostics-frame="0"');
    expect(markup).toContain("Frame State");
    expect(markup).toContain("No active primitive");
    expect(markup).toContain("compiler_artifact_missing");
    expect(markup).toContain("planner_audit_pointer_missing");
  });

  it("toggles diagnostic visibility deterministically", () => {
    expect(toggleJosephStudyDiagnostics(false)).toBe(true);
    expect(toggleJosephStudyDiagnostics(true)).toBe(false);
  });
});
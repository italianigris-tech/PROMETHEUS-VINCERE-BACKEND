import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {buildJosephStudyOverlaySections} from "../joseph-study-overlays";
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
    expect(markup).toContain("Cuts");
    expect(markup).toContain("Video track 1");
  });

  it("toggles diagnostic visibility deterministically", () => {
    expect(toggleJosephStudyDiagnostics(false)).toBe(true);
    expect(toggleJosephStudyDiagnostics(true)).toBe(false);
  });
});
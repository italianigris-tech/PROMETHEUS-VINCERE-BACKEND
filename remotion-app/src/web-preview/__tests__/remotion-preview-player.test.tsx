import path from "node:path";
import {readFileSync} from "node:fs";

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {
  buildProjectScopedMotionInputProps,
  RemotionPreviewPlayer
} from "../RemotionPreviewPlayer";
import {resolveProjectScopedCaptionRuntimeDiagnostics} from "../../compositions/ProjectScopedMotionComposition";
import {isSvgCaptionChunk} from "../../components/SvgCaptionOverlay";
import type {CaptionChunk} from "../../lib/types";

const playerSnapshots: Array<{
  componentName: string;
  motionTier: string;
  livePreviewSessionId: string | null;
  captionChunkCount: number;
}> = [];

vi.mock("@remotion/player", async () => {
  return {
    Player: ({component, inputProps}: {component: React.ComponentType<unknown>; inputProps: Record<string, unknown>}) => {
      playerSnapshots.push({
        componentName: component.displayName ?? component.name ?? "unknown",
        motionTier: String(inputProps.motionTier ?? ""),
        captionChunkCount: Array.isArray(inputProps.captionChunksOverride)
          ? inputProps.captionChunksOverride.length
          : 0,
        livePreviewSessionId:
          inputProps.livePreviewSession &&
          typeof inputProps.livePreviewSession === "object" &&
          "sessionId" in inputProps.livePreviewSession
            ? String((inputProps.livePreviewSession as {sessionId?: unknown}).sessionId ?? "")
            : null
      });

      return (
        <div
          data-component-name={component.displayName ?? component.name ?? "unknown"}
          data-motion-tier={String(inputProps.motionTier ?? "")}
          data-caption-chunk-count={Array.isArray(inputProps.captionChunksOverride)
            ? String(inputProps.captionChunksOverride.length)
            : "0"}
          data-live-preview-session-id={
            inputProps.livePreviewSession &&
            typeof inputProps.livePreviewSession === "object" &&
            "sessionId" in inputProps.livePreviewSession
              ? String((inputProps.livePreviewSession as {sessionId?: unknown}).sessionId ?? "")
              : ""
          }
        />
      );
    }
  };
});

const videoMetadata = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 12,
  durationInFrames: 360
} as const;

const createMotionModel = (tier: "minimal" | "premium") => ({
  tier,
  motion3DPlan: {
    enabled: tier === "premium"
  },
  captionBias: "auto",
  chunks: []
}) as any;

const captionChunks: CaptionChunk[] = [{
  id: "chunk-project-a-1",
  text: "Project A live preview",
  startMs: 0,
  endMs: 900,
  words: [
    {text: "Project", startMs: 0, endMs: 200, confidence: 0.99},
    {text: "A", startMs: 200, endMs: 320, confidence: 0.99},
    {text: "live", startMs: 320, endMs: 520, confidence: 0.99},
    {text: "preview", startMs: 520, endMs: 900, confidence: 0.99}
  ],
  styleKey: "svg_typography_v1:cinematic_text_preset_10",
  motionKey: "svg_typography_v1:cinematic_text_preset_10",
  layoutVariant: "inline",
  emphasisWordIndices: [2, 3],
  profileId: "longform_svg_typography_v1"
}];

describe("RemotionPreviewPlayer", () => {
  it("routes the active preview through the canonical project-scoped motion composition", () => {
    const markup = renderToStaticMarkup(
      <RemotionPreviewPlayer
        videoSrc="http://127.0.0.1:8000/api/edit-sessions/project-a/source"
        videoMetadata={videoMetadata}
        motionModel={createMotionModel("premium")}
        captionChunks={captionChunks}
        captionProfileId="longform_svg_typography_v1"
        previewPerformanceMode="balanced"
        livePreviewSession={{
          sessionId: "project-a",
          status: "preview_text_ready",
          previewStatus: "preview_text_ready",
          transcriptStatus: "full_transcript_ready",
          analysisStatus: "analysis_ready",
          motionGraphicsStatus: "motion_graphics_ready",
          renderStatus: "idle",
          sourceLabel: "Project A",
          sourceFilename: "project-a.mp4",
          sourceHasVideo: true,
          sourceWidth: 1920,
          sourceHeight: 1080,
          sourceFps: 30,
          sourceDurationMs: 12000,
          previewLines: ["Project A live preview"],
          previewMotionSequence: [],
          transcriptWords: []
        }}
      />
    );

    expect(markup).toContain("data-component-name=\"ProjectScopedMotionComposition\"");
    expect(markup).toContain("data-caption-chunk-count=\"1\"");
    expect(markup).toContain("data-live-preview-session-id=\"project-a\"");
    expect(playerSnapshots.at(-1)?.componentName).toBe("ProjectScopedMotionComposition");
    expect(playerSnapshots.at(-1)?.captionChunkCount).toBe(1);
    expect(playerSnapshots.at(-1)?.livePreviewSessionId).toBe("project-a");
  });

  it("builds canonical motion input props that carry live backend preview data and explicit caption chunks", () => {
    const inputProps = buildProjectScopedMotionInputProps({
      videoSrc: "http://127.0.0.1:8000/api/edit-sessions/project-a/source",
      videoMetadata,
      motionModel: createMotionModel("premium"),
      captionChunks,
      captionProfileId: "longform_svg_typography_v1",
      previewPerformanceMode: "balanced",
      livePreviewSession: {
        sessionId: "project-a",
        status: "preview_text_ready",
        previewStatus: "preview_text_ready",
        transcriptStatus: "full_transcript_ready",
        analysisStatus: "analysis_ready",
        motionGraphicsStatus: "motion_graphics_ready",
        renderStatus: "idle",
        sourceLabel: "Project A",
        sourceFilename: "project-a.mp4",
        sourceHasVideo: true,
        sourceWidth: 1920,
        sourceHeight: 1080,
        sourceFps: 30,
        sourceDurationMs: 12000,
        previewLines: ["Project A live preview"],
        previewMotionSequence: [
          {
            cueId: "cue-1",
            text: "Project A live preview",
            startMs: 0,
            durationMs: 900,
            lineIndex: 0
          }
        ],
        transcriptWords: [
          {
            text: "Project",
            start_ms: 0,
            end_ms: 160
          }
        ]
      }
    });

    expect(inputProps.motionModelOverride).toBeTruthy();
    expect(inputProps.captionChunksOverride).toEqual(captionChunks);
    expect(inputProps.livePreviewSession?.sessionId).toBe("project-a");
    expect(inputProps.livePreviewSession?.previewMotionSequence).toHaveLength(1);
    expect(inputProps.livePreviewSession?.transcriptWords).toHaveLength(1);
    expect(inputProps.debugMotionArtifacts).toBe(false);
  });

  it("falls back to explicit motion-model chunks when session captions are supplied through the live player state", () => {
    const motionModelWithChunks = {
      ...createMotionModel("premium"),
      chunks: captionChunks
    };

    const inputProps = buildProjectScopedMotionInputProps({
      videoSrc: "http://127.0.0.1:8000/api/edit-sessions/project-a/source",
      videoMetadata,
      motionModel: motionModelWithChunks,
      captionProfileId: "longform_svg_typography_v1",
      previewPerformanceMode: "balanced"
    });

    expect(inputProps.captionChunksOverride).toEqual(captionChunks);
    expect(inputProps.motionModelOverride).toBe(motionModelWithChunks);
  });

  it("resolves the canonical long-form caption renderer with real caption chunks instead of a dead shell", () => {
    expect(resolveProjectScopedCaptionRuntimeDiagnostics({
      presentationMode: "long-form",
      hideCaptionOverlays: false,
      longformCaptionRenderMode: "svg",
      captionChunks,
      cinematicCaptionChunks: [],
      svgCaptionChunks: captionChunks.filter((chunk) => isSvgCaptionChunk(chunk))
    })).toEqual({
      activeCaptionRenderer: "svg",
      captionDomNodesExpected: true
    });
  });

  it("keeps the canonical composition wired to the shared font runtime loader", () => {
    const sourcePath = path.resolve("src/compositions/ProjectScopedMotionComposition.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("primeHouseTypographyFonts");
    expect(source).not.toContain("House fonts unavailable — using fallback typography.");
    expect(source).toContain("[ProjectScopedMotionComposition] typography");
  });

  it("keeps the active project-scoped preview wrapper neutral instead of importing female-coach demo identity", () => {
    const sourcePath = path.resolve("src/compositions/ProjectScopedPreviewComposition.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("./ProjectScopedMotionComposition");
    expect(source).not.toContain("FemaleCoachDeanGraziosi");
  });

  it("does not derive a Player reset key from changing preview props", () => {
    const sourcePath = path.resolve("src/web-preview/RemotionPreviewPlayer.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/<Player[\s\S]*?\bkey=/);
    expect(source).toContain("data-player-instance-id");
  });
});


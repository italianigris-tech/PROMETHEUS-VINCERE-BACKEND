import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {
  buildJosephStudyPlayerConfig,
  buildJosephStudyGeneratedComparisonState,
  JosephStudyStudio,
  JosephStudyStudioView,
  parseJosephStudyCandidateManifest,
  requestJosephStudyCandidates,
  resolveJosephStudyInitialSource,
  syncJosephStudyPlayers
} from "../JosephStudyStudio";
import {resolveWebPreviewRootRoute, shouldPreloadWebPreviewFonts} from "../sandbox-data";

const playerSnapshots: Array<{
  componentName: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  manifestJobId: string;
}> = [];

vi.mock("@remotion/player", async () => {
  return {
    Player: ({
      component,
      durationInFrames,
      fps,
      compositionWidth,
      compositionHeight,
      inputProps
    }: {
      component: React.ComponentType<unknown>;
      durationInFrames: number;
      fps: number;
      compositionWidth: number;
      compositionHeight: number;
      inputProps: {manifest?: {jobId?: string}};
    }) => {
      playerSnapshots.push({
        componentName: component.displayName ?? component.name ?? "unknown",
        durationInFrames,
        fps,
        width: compositionWidth,
        height: compositionHeight,
        manifestJobId: inputProps.manifest?.jobId ?? ""
      });

      return (
        <div
          data-testid="joseph-study-player"
          data-component-name={component.displayName ?? component.name ?? "unknown"}
          data-duration-in-frames={durationInFrames}
          data-fps={fps}
          data-width={compositionWidth}
          data-height={compositionHeight}
          data-manifest-job-id={inputProps.manifest?.jobId ?? ""}
        />
      );
    }
  };
});

describe("JosephStudyStudio", () => {
  const fixtureManifest = buildJosephStudyPlayerConfig().inputProps.manifest;
  const candidateManifest = {
    ...fixtureManifest,
    jobId: "223e4567-e89b-42d3-a456-426614174222",
    seed: 24680,
    durationFrames: 180,
    source: {
      ...fixtureManifest.source,
      durationMs: 6000
    },
    videoTracks: [{
      sourcePath: "/dev-fixtures/test-video.mp4",
      startFrame: 0,
      endFrame: 179
    }]
  };

  const candidateBManifest = {
    ...candidateManifest,
    jobId: "423e4567-e89b-42d3-a456-426614174444",
    seed: 13579,
    durationFrames: 210,
    source: {
      ...candidateManifest.source,
      durationMs: 7000
    },
    videoTracks: [{
      sourcePath: "/dev-fixtures/test-video.mp4",
      startFrame: 0,
      endFrame: 209
    }]
  };

  it("builds a deterministic Joseph player config from the fixture manifest", () => {
    const config = buildJosephStudyPlayerConfig();

    expect(config.durationInFrames).toBe(300);
    expect(config.fps).toBe(30);
    expect(config.compositionWidth).toBe(1080);
    expect(config.compositionHeight).toBe(1920);
    expect(config.inputProps.manifest.jobId).toBe("123e4567-e89b-42d3-a456-426614174111");
  });

  it("routes /joseph-study to the isolated study root", () => {
    expect(resolveWebPreviewRootRoute("/joseph-study")).toBe("joseph-study");
    expect(resolveWebPreviewRootRoute("/joseph-study?manifest=/joseph-study/candidate-manifest.json")).toBe("joseph-study");
    expect(resolveWebPreviewRootRoute("/joseph-study/")).toBe("joseph-study");
  });

  it("lets the Joseph study route mount without waiting on preview font preload", () => {
    expect(shouldPreloadWebPreviewFonts("joseph-study")).toBe(false);
    expect(shouldPreloadWebPreviewFonts("sandbox")).toBe(true);
    expect(shouldPreloadWebPreviewFonts("preview-app")).toBe(true);
  });

  it("mounts the Joseph study surface with the Joseph composition player", () => {
    const markup = renderToStaticMarkup(<JosephStudyStudio />);

    expect(markup).toContain("data-joseph-study-route=\"true\"");
    expect(markup).toContain("Joseph Study Studio");
    expect(markup).toContain("data-testid=\"joseph-study-player\"");
    expect(markup).toContain("data-component-name=\"JosephEdit\"");
    expect(playerSnapshots.at(-1)).toMatchObject({
      componentName: "JosephEdit",
      durationInFrames: 300,
      fps: 30,
      width: 1080,
      height: 1920,
      manifestJobId: "123e4567-e89b-42d3-a456-426614174111"
    });
  });

  it("resolves a browser-safe manifest query into candidate mode", () => {
    expect(resolveJosephStudyInitialSource("?manifest=/joseph-study/candidate-manifest.json")).toEqual({
      mode: "candidate",
      manifestUrl: "/joseph-study/candidate-manifest.json"
    });

    expect(resolveJosephStudyInitialSource("?manifest=file:///tmp/bad.json")).toEqual({
      mode: "fixture",
      rejectedManifestUrl: "file:///tmp/bad.json",
      rejectionReason: "Manifest URL must be browser-safe."
    });
  });


  it("resolves a bounded candidate generation query into generate mode", () => {
    expect(resolveJosephStudyInitialSource("?candidates=4")).toEqual({
      mode: "generate",
      candidateCount: 4
    });

    expect(resolveJosephStudyInitialSource("?candidateCount=7")).toEqual({
      mode: "fixture",
      rejectionReason: "Candidate count must be between 2 and 6."
    });
  });
  it("validates an external candidate manifest before building the player config", () => {
    const parsed = parseJosephStudyCandidateManifest(candidateManifest);
    const config = buildJosephStudyPlayerConfig(parsed);

    expect(config.durationInFrames).toBe(180);
    expect(config.inputProps.manifest.jobId).toBe("223e4567-e89b-42d3-a456-426614174222");
    expect(config.inputProps.manifest.videoTracks[0]?.endFrame).toBe(179);
  });

  it("renders synchronized comparison lanes with visible candidate identities", () => {
    const markup = renderToStaticMarkup(
      <JosephStudyStudioView
        state={{
          mode: "comparison",
          status: "ready",
          manifestUrls: ["/joseph-study/candidate-manifest.json", "/joseph-study/candidate-b-manifest.json"],
          lanes: [
            {id: "candidate-a", label: "Candidate A", manifestUrl: "/joseph-study/candidate-manifest.json", manifest: candidateManifest},
            {id: "candidate-b", label: "Candidate B", manifestUrl: "/joseph-study/candidate-b-manifest.json", manifest: candidateBManifest}
          ]
        } as any}
      />
    );

    expect(markup).toContain("data-joseph-study-mode=\"comparison\"");
    expect(markup).toContain("data-joseph-comparison-lanes=\"2\"");
    expect(markup).toContain("Candidate A");
    expect(markup).toContain("Candidate B");
    expect(markup).toContain("223e4567-e89b-42d3-a456-426614174222");
    expect(markup).toContain("423e4567-e89b-42d3-a456-426614174444");
  });


  it("renders generated candidate lane metadata and failed lanes", () => {
    const state = buildJosephStudyGeneratedComparisonState({
      version: "joseph-study-candidates-v1",
      requestedCount: 2,
      lanes: [
        {
          id: "candidate-1",
          label: "Candidate A",
          status: "ready",
          candidateId: "candidate-a",
          doctrineBranch: "punch",
          manifestHash: "a".repeat(64),
          evidencePointer: "/evidence/candidate-a",
          manifest: candidateManifest
        },
        {
          id: "candidate-2",
          label: "Candidate B",
          status: "failed",
          candidateId: null,
          doctrineBranch: null,
          manifestHash: null,
          evidencePointer: "/evidence/candidate-b",
          errorMessage: "generation failed",
          failureTags: ["candidate_generation_failed"]
        }
      ],
      failures: []
    });

    const markup = renderToStaticMarkup(<JosephStudyStudioView state={state} />);

    expect(markup).toContain("data-joseph-comparison-lanes=\"2\"");
    expect(markup).toContain("candidate-a");
    expect(markup).toContain("punch");
    expect(markup).toContain("a".repeat(64));
    expect(markup).toContain("/evidence/candidate-a");
    expect(markup).toContain("Lane generation failed");
    expect(markup).toContain("generation failed");
    expect(markup).toContain("candidate_generation_failed");
  });

  it("requests generated candidates from the Studio API", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({candidateCount: 3}));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version: "joseph-study-candidates-v1",
          requestedCount: 3,
          lanes: [{
            id: "candidate-1",
            label: "Candidate A",
            status: "ready",
            candidateId: "candidate-a",
            doctrineBranch: "hold",
            manifestHash: "b".repeat(64),
            evidencePointer: "/evidence/candidate-a",
            manifest: candidateManifest
          }],
          failures: []
        })
      } as Response;
    });

    const state = await requestJosephStudyCandidates({candidateCount: 3, fetchImpl});

    expect(fetchImpl).toHaveBeenCalledWith("/api/joseph-study/candidates", expect.any(Object));
    expect(state.lanes[0]).toMatchObject({
      candidateId: "candidate-a",
      doctrineBranch: "hold",
      evidencePointer: "/evidence/candidate-a"
    });
  });
  it("synchronizes play pause and scrub commands across comparison player handles", () => {
    const calls: string[] = [];
    const firstPlayer = {
      play: () => calls.push("first:play"),
      pause: () => calls.push("first:pause"),
      seekTo: (frame: number) => calls.push(`first:seek:${frame}`)
    };
    const secondPlayer = {
      play: () => calls.push("second:play"),
      pause: () => calls.push("second:pause"),
      seekTo: (frame: number) => calls.push(`second:seek:${frame}`)
    };

    expect(syncJosephStudyPlayers([
      {id: "first", player: firstPlayer, durationInFrames: 180},
      {id: "second", player: secondPlayer, durationInFrames: 90}
    ], {type: "seek", frame: 120})).toEqual([
      {id: "first", frame: 120},
      {id: "second", frame: 89}
    ]);

    syncJosephStudyPlayers([
      {id: "first", player: firstPlayer, durationInFrames: 180},
      {id: "second", player: secondPlayer, durationInFrames: 90}
    ], {type: "play"});
    syncJosephStudyPlayers([
      {id: "first", player: firstPlayer, durationInFrames: 180},
      {id: "second", player: secondPlayer, durationInFrames: 90}
    ], {type: "pause"});

    expect(calls).toEqual([
      "first:seek:120",
      "second:seek:89",
      "first:play",
      "second:play",
      "first:pause",
      "second:pause"
    ]);
  });

  it("renders a visible candidate validation error instead of mounting a broken player", () => {
    const markup = renderToStaticMarkup(
      <JosephStudyStudioView
        state={{
          mode: "candidate",
          status: "error",
          manifestUrl: "/joseph-study/broken-manifest.json",
          errorMessage: "Invalid Joseph candidate manifest: output.width must be 1080."
        }}
      />
    );

    expect(markup).toContain("data-joseph-study-route=\"true\"");
    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("Candidate manifest failed");
    expect(markup).toContain("output.width must be 1080");
    expect(markup).not.toContain("data-testid=\"joseph-study-player\"");
  });
});

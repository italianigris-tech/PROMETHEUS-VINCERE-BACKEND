import React, {useEffect, useMemo, useRef, useState} from "react";
import {Player} from "@remotion/player";
import type {PlayerRef} from "@remotion/player";
import type {UnifiedRenderManifest} from "@prometheus/shared-types";

import {buildJosephStudyFrameDiagnostics, type JosephStudyCompilerArtifact} from "./joseph-study-overlays";
import {
  JOSEPH_STUDY_FAILURE_TAGS,
  captureJosephStudyReview,
  loadJosephStudyReviewLedger,
  toggleJosephStudyFailureTag,
  type JosephStudyFailureTag,
  type JosephStudyReviewRecord,
  type JosephStudyReviewStorage
} from "./joseph-study-review-ledger";
import {DEFAULT_JOSEPH_MANIFEST, JOSEPH_RENDER_FPS, JOSEPH_RENDER_HEIGHT, JOSEPH_RENDER_WIDTH} from "../compositions/joseph-default-manifest";
import {JosephEdit} from "../compositions/JosephEdit";

type JosephStudyPlayerHandle = Pick<PlayerRef, "play" | "pause" | "seekTo">;

type JosephStudyPlayerConfig = {
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  inputProps: {
    manifest: UnifiedRenderManifest;
  };
};

type JosephStudyComparisonLane = {
  id: string;
  label: string;
  status?: "ready" | "failed";
  manifestUrl?: string;
  manifest?: UnifiedRenderManifest;
  candidateId?: string | null;
  doctrineBranch?: string | null;
  manifestHash?: string | null;
  evidencePointer?: string | null;
  errorMessage?: string;
  failureTags?: string[];
  compilerArtifact?: JosephStudyCompilerArtifact | null;
  plannerAuditPointer?: string | null;
};

type JosephStudyComparisonState = {
  mode: "comparison";
  status: "ready" | "error";
  manifestUrls: string[];
  lanes: JosephStudyComparisonLane[];
};

type JosephStudyFixtureState = {
  mode: "fixture";
  status: "ready" | "error";
  manifest?: UnifiedRenderManifest;
};

type JosephStudyCandidateState = {
  mode: "candidate";
  status: "ready" | "error";
  manifestUrl: string;
  errorMessage?: string;
};

type JosephStudyGenerationState = {
  mode: "generation";
  status: "loading" | "error";
  candidateCount: number;
  errorMessage?: string;
};

type JosephStudyStudioState = JosephStudyComparisonState | JosephStudyFixtureState | JosephStudyCandidateState | JosephStudyGenerationState;

type JosephStudyGeneratedCandidateResponse = {
  version: "joseph-study-candidates-v1";
  requestedCount: number;
  lanes: JosephStudyComparisonLane[];
  failures: JosephStudyComparisonLane[];
};

type JosephStudyStudioViewProps = {
  state: JosephStudyStudioState;
  diagnosticsVisible?: boolean;
  onToggleDiagnostics?: () => void;
};

type JosephStudyReviewPanelProps = {
  lanes: JosephStudyComparisonLane[];
};

const getReviewStorage = (): JosephStudyReviewStorage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const toggleJosephStudyDiagnostics = (visible: boolean): boolean => !visible;

export const parseJosephStudyCandidateManifest = (manifest: UnifiedRenderManifest): UnifiedRenderManifest => {
  const requiredWidth = manifest.output?.width ?? manifest.width;
  const requiredHeight = manifest.output?.height ?? manifest.height;

  if (requiredWidth !== JOSEPH_RENDER_WIDTH) {
    throw new Error(`Invalid Joseph candidate manifest: output.width must be ${JOSEPH_RENDER_WIDTH}.`);
  }

  if (requiredHeight !== JOSEPH_RENDER_HEIGHT) {
    throw new Error(`Invalid Joseph candidate manifest: output.height must be ${JOSEPH_RENDER_HEIGHT}.`);
  }

  return manifest;
};

export const resolveJosephStudyInitialSource = (search: string): {
  mode: "fixture" | "candidate" | "generate";
  manifestUrl?: string;
  candidateCount?: number;
  rejectedManifestUrl?: string;
  rejectionReason?: string;
} => {
  const params = new URLSearchParams(search);
  const manifestUrl = params.get("manifest")?.trim() ?? "";
  const candidateCountText = params.get("candidates")?.trim() ?? params.get("candidateCount")?.trim() ?? "";

  if (candidateCountText) {
    const candidateCount = Number(candidateCountText);
    if (Number.isInteger(candidateCount) && candidateCount >= 2 && candidateCount <= 6) {
      return {mode: "generate", candidateCount};
    }

    return {
      mode: "fixture",
      rejectionReason: "Candidate count must be between 2 and 6."
    };
  }

  if (!manifestUrl) {
    return {mode: "fixture"};
  }

  if (/^(file|https?):/i.test(manifestUrl)) {
    return {
      mode: "fixture",
      rejectedManifestUrl: manifestUrl,
      rejectionReason: "Manifest URL must be browser-safe."
    };
  }

  return {
    mode: "candidate",
    manifestUrl
  };
};

export const buildJosephStudyGeneratedComparisonState = (
  response: JosephStudyGeneratedCandidateResponse
): JosephStudyComparisonState => ({
  mode: "comparison",
  status: "ready",
  manifestUrls: response.lanes.map((lane) => lane.manifestUrl ?? lane.evidencePointer ?? lane.id),
  lanes: response.lanes.map((lane) => ({
    ...lane,
    status: lane.status ?? "ready"
  }))
});

export const requestJosephStudyCandidates = async ({
  candidateCount,
  fetchImpl = fetch
}: {
  candidateCount: number;
  fetchImpl?: typeof fetch;
}): Promise<JosephStudyComparisonState> => {
  const response = await fetchImpl("/api/joseph-study/candidates", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({candidateCount})
  });

  if (!response.ok) {
    throw new Error(`Joseph candidate generation failed with HTTP ${response.status}.`);
  }

  return buildJosephStudyGeneratedComparisonState(await response.json() as JosephStudyGeneratedCandidateResponse);
};

export const buildJosephStudyPlayerConfig = (manifest: UnifiedRenderManifest = DEFAULT_JOSEPH_MANIFEST): JosephStudyPlayerConfig => {
  const resolvedManifest = parseJosephStudyCandidateManifest(manifest);
  return {
    durationInFrames: resolvedManifest.durationFrames,
    fps: resolvedManifest.fps ?? JOSEPH_RENDER_FPS,
    compositionWidth: resolvedManifest.output?.width ?? JOSEPH_RENDER_WIDTH,
    compositionHeight: resolvedManifest.output?.height ?? JOSEPH_RENDER_HEIGHT,
    inputProps: {
      manifest: resolvedManifest
    }
  };
};

const clampJosephStudyFrame = (frame: number, durationInFrames: number): number => {
  const finalFrame = Math.max(0, durationInFrames - 1);
  return Math.max(0, Math.min(Math.round(frame), finalFrame));
};

export const formatJosephStudyTimecode = (frame: number, fps: number): string => {
  const safeFps = Math.max(1, Math.round(fps));
  const safeFrame = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(safeFrame / safeFps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = safeFrame % safeFps;
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
};

export const syncJosephStudyPlayers = (
  lanes: Array<{id: string; player: JosephStudyPlayerHandle; durationInFrames: number}>,
  command: {type: "play"} | {type: "pause"} | {type: "seek"; frame: number} | {type: "step"; currentFrame: number; deltaFrames: number}
): Array<{id: string; frame: number}> => {
  if (command.type === "play") {
    lanes.forEach((lane) => lane.player.play());
    return [];
  }

  if (command.type === "pause") {
    lanes.forEach((lane) => lane.player.pause());
    return [];
  }

  const requestedFrame = command.type === "step" ? command.currentFrame + command.deltaFrames : command.frame;
  return lanes.map((lane) => {
    const frame = clampJosephStudyFrame(requestedFrame, lane.durationInFrames);
    lane.player.seekTo(frame);
    return {id: lane.id, frame};
  });
};


const isReadyLane = (lane: JosephStudyComparisonLane): lane is JosephStudyComparisonLane & {manifest: UnifiedRenderManifest} =>
  lane.status !== "failed" && Boolean(lane.manifest);

const candidateLabelFromLane = (lane: JosephStudyComparisonLane): string =>
  `${lane.label} (${lane.candidateId ?? lane.manifest?.jobId ?? "unresolved"})`;

const JosephStudyReviewPanel: React.FC<JosephStudyReviewPanelProps> = ({lanes}) => {
  const [activeCandidateId, setActiveCandidateId] = useState(() => lanes[0]?.id ?? "");
  const [failureTags, setFailureTags] = useState<JosephStudyFailureTag[]>([]);
  const [ledger, setLedger] = useState<JosephStudyReviewRecord[]>(() => loadJosephStudyReviewLedger(getReviewStorage()));

  const activeCandidate = lanes.find((lane) => lane.id === activeCandidateId) ?? lanes[0] ?? null;

  const captureReview = (verdict: "preferred" | "failed"): void => {
    if (!activeCandidate) {
      return;
    }

    const nextLedger = captureJosephStudyReview(getReviewStorage(), {
      candidateId: activeCandidate.id,
      candidateLabel: candidateLabelFromLane(activeCandidate),
      verdict,
      failureTags: verdict === "failed" ? failureTags : []
    });

    setLedger(nextLedger);
  };

  return (
    <section aria-label="Candidate review capture" data-joseph-study-review-ledger="true" className="joseph-study-review-panel">
      <h2>Review Capture</h2>
      <div className="joseph-study-review-candidate-switcher">
        {lanes.map((lane) => (
          <button
            key={lane.id}
            type="button"
            aria-pressed={lane.id === activeCandidate?.id}
            onClick={() => setActiveCandidateId(lane.id)}
          >
            {lane.label}
          </button>
        ))}
      </div>
      <div className="joseph-study-review-controls">
        <button type="button" onClick={() => captureReview("preferred")} disabled={!activeCandidate}>Mark preferred</button>
        <button type="button" onClick={() => captureReview("failed")} disabled={!activeCandidate}>Mark failed</button>
      </div>
      <div className="joseph-study-review-tags">
        {JOSEPH_STUDY_FAILURE_TAGS.map((tag) => {
          const checked = failureTags.includes(tag.id);
          return (
            <label key={tag.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setFailureTags((current) => toggleJosephStudyFailureTag(current, tag.id))}
              />
              <span>{tag.label}</span>
            </label>
          );
        })}
      </div>
      <p>Selected tags: {failureTags.length > 0 ? failureTags.join(", ") : "None"}</p>
      <div className="joseph-study-review-ledger">
        {ledger.length > 0 ? ledger.map((entry) => (
          <article key={`${entry.candidateId}-${entry.capturedAt}`}>
            <strong>{entry.candidateLabel}</strong>
            <span>{entry.verdict}</span>
            <small>{entry.failureTags.length > 0 ? entry.failureTags.join(", ") : "No failure tags"}</small>
          </article>
        )) : <p>No reviews captured yet.</p>}
      </div>
    </section>
  );
};

export const JosephStudyStudioView: React.FC<JosephStudyStudioViewProps> = ({
  state,
  diagnosticsVisible = false,
  onToggleDiagnostics
}) => {
  const manifest = state.mode === "comparison"
    ? state.lanes.find(isReadyLane)?.manifest ?? DEFAULT_JOSEPH_MANIFEST
    : state.mode === "candidate" || state.mode === "generation"
      ? DEFAULT_JOSEPH_MANIFEST
      : state.manifest ?? DEFAULT_JOSEPH_MANIFEST;
  const readyLanes = state.mode === "comparison" ? state.lanes.filter(isReadyLane) : [];
  const diagnosticLane = state.mode === "comparison" ? state.lanes.find(isReadyLane) ?? null : null;
  const playerRefs = useRef<Record<string, JosephStudyPlayerHandle>>({});
  const [transportFrame, setTransportFrame] = useState(0);
  const [transportPlaying, setTransportPlaying] = useState(false);
  const comparisonDurationInFrames = readyLanes.reduce(
    (maxFrame, lane) => Math.max(maxFrame, buildJosephStudyPlayerConfig(lane.manifest).durationInFrames),
    0
  );
  const comparisonFinalFrame = Math.max(0, comparisonDurationInFrames - 1);
  const comparisonFps = readyLanes[0]?.manifest.fps ?? JOSEPH_RENDER_FPS;
  const diagnosticsFrame = state.mode === "comparison" ? transportFrame : 0;
  const frameDiagnostics = diagnosticsVisible
    ? buildJosephStudyFrameDiagnostics({
      manifest,
      frame: diagnosticsFrame,
      compilerArtifact: diagnosticLane?.compilerArtifact ?? null,
      plannerAuditPointer: diagnosticLane?.plannerAuditPointer ?? null,
    })
    : null;
  const diagnosticsSections = frameDiagnostics?.sections ?? [];

  useEffect(() => {
    setTransportFrame((frame) => clampJosephStudyFrame(frame, comparisonDurationInFrames));
  }, [comparisonDurationInFrames]);

  const buildSyncableLanes = (): Array<{id: string; player: JosephStudyPlayerHandle; durationInFrames: number}> => readyLanes.flatMap((lane) => {
    const player = playerRefs.current[lane.id];
    return player
      ? [{id: lane.id, player, durationInFrames: buildJosephStudyPlayerConfig(lane.manifest).durationInFrames}]
      : [];
  });

  const applyTransportCommand = (command: Parameters<typeof syncJosephStudyPlayers>[1]): void => {
    syncJosephStudyPlayers(buildSyncableLanes(), command);

    if (command.type === "play") {
      setTransportPlaying(true);
      return;
    }

    if (command.type === "pause") {
      setTransportPlaying(false);
      return;
    }

    const requestedFrame = command.type === "step" ? command.currentFrame + command.deltaFrames : command.frame;
    setTransportFrame(clampJosephStudyFrame(requestedFrame, comparisonDurationInFrames));
  };
  if (state.mode === "candidate" && state.status === "error") {
    return (
      <div data-joseph-study-route="true" data-joseph-study-mode={state.mode}>
        <header className="joseph-study-header">
          <h1>Joseph Study Studio</h1>
          <button
            type="button"
            aria-pressed={diagnosticsVisible}
            onClick={() => onToggleDiagnostics?.()}
          >
            {diagnosticsVisible ? "Diagnostics off" : "Diagnostics on"}
          </button>
        </header>
        <div role="alert" className="joseph-study-error">
          <strong>Candidate manifest failed</strong>
          <span>{state.errorMessage ?? "Invalid Joseph candidate manifest."}</span>
        </div>
      </div>
    );
  }

  if (state.mode === "generation") {
    return (
      <div data-joseph-study-route="true" data-joseph-study-mode={state.mode}>
        <header className="joseph-study-header">
          <h1>Joseph Study Studio</h1>
          <button
            type="button"
            aria-pressed={diagnosticsVisible}
            onClick={() => onToggleDiagnostics?.()}
          >
            {diagnosticsVisible ? "Diagnostics off" : "Diagnostics on"}
          </button>
        </header>
        {state.status === "loading" ? (
          <div role="status" data-joseph-study-generation-status="loading">
            Generating {state.candidateCount} candidate lanes
          </div>
        ) : (
          <div role="alert" className="joseph-study-error">
            <strong>Candidate generation failed</strong>
            <span>{state.errorMessage ?? "Joseph candidate generation failed."}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-joseph-study-route="true" data-joseph-study-mode={state.mode}>
      <header className="joseph-study-header">
        <h1>Joseph Study Studio</h1>
        <button
          type="button"
          aria-pressed={diagnosticsVisible}
          onClick={() => onToggleDiagnostics?.()}
        >
          {diagnosticsVisible ? "Diagnostics off" : "Diagnostics on"}
        </button>
      </header>

      {state.mode === "comparison" ? (
        <section data-joseph-comparison-lanes={state.lanes.length} className="joseph-study-comparison">
          {readyLanes.length > 0 ? (
            <div className="joseph-study-comparison-controls" data-joseph-study-sync-controls="true">
              <button type="button" aria-label="Play all comparison lanes" aria-pressed={transportPlaying} onClick={() => applyTransportCommand({type: "play"})}>Play</button>
              <button type="button" aria-label="Pause all comparison lanes" aria-pressed={!transportPlaying} onClick={() => applyTransportCommand({type: "pause"})}>Pause</button>
              <button type="button" aria-label="Step all lanes backward one frame" onClick={() => applyTransportCommand({type: "step", currentFrame: transportFrame, deltaFrames: -1})}>-1 frame</button>
              <button type="button" aria-label="Step all lanes forward one frame" onClick={() => applyTransportCommand({type: "step", currentFrame: transportFrame, deltaFrames: 1})}>+1 frame</button>
              <label>
                <span>Scrub</span>
                <input
                  type="range"
                  aria-label="Scrub all comparison lanes"
                  min={0}
                  max={comparisonFinalFrame}
                  value={transportFrame}
                  onChange={(event) => applyTransportCommand({type: "seek", frame: Number(event.currentTarget.value)})}
                />
              </label>
              <output data-joseph-study-current-frame={transportFrame}>Frame {transportFrame} / {formatJosephStudyTimecode(transportFrame, comparisonFps)}</output>
            </div>
          ) : null}
          <div className="joseph-study-comparison-grid">
            {state.lanes.map((lane) => (
              <article key={lane.id} className="joseph-study-comparison-lane" role={lane.status === "failed" ? "alert" : undefined}>
                <header>
                  <strong>{lane.label}</strong>
                  <span>{lane.candidateId ?? lane.manifest?.jobId ?? "Generation failed"}</span>
                </header>
                <dl className="joseph-study-lane-metadata">
                  <div><dt>Doctrine</dt><dd>{lane.doctrineBranch ?? "unresolved"}</dd></div>
                  <div><dt>Manifest hash</dt><dd>{lane.manifestHash ?? "unavailable"}</dd></div>
                  <div><dt>Evidence</dt><dd>{lane.evidencePointer ?? lane.manifestUrl ?? "unavailable"}</dd></div>
                </dl>
                {isReadyLane(lane) ? (
                  <div className="joseph-study-comparison-player">
                    <Player
                      ref={(player) => {
                        if (player) {
                          playerRefs.current[lane.id] = player;
                        } else {
                          delete playerRefs.current[lane.id];
                        }
                      }}
                      component={JosephEdit}
                      durationInFrames={buildJosephStudyPlayerConfig(lane.manifest).durationInFrames}
                      fps={lane.manifest.fps}
                      compositionWidth={lane.manifest.output?.width ?? JOSEPH_RENDER_WIDTH}
                      compositionHeight={lane.manifest.output?.height ?? JOSEPH_RENDER_HEIGHT}
                      inputProps={{manifest: lane.manifest}}
                      controls={false}
                      clickToPlay={false}
                    />
                  </div>
                ) : (
                  <div className="joseph-study-error">
                    <strong>Lane generation failed</strong>
                    <span>{lane.errorMessage ?? "Candidate lane could not be generated."}</span>
                    <small>{lane.failureTags?.join(", ") ?? "candidate_generation_failed"}</small>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="joseph-study-stage">
          <Player
            component={JosephEdit}
            durationInFrames={buildJosephStudyPlayerConfig(manifest).durationInFrames}
            fps={manifest.fps}
            compositionWidth={manifest.output?.width ?? JOSEPH_RENDER_WIDTH}
            compositionHeight={manifest.output?.height ?? JOSEPH_RENDER_HEIGHT}
            inputProps={{manifest}}
            controls
            clickToPlay
          />
        </section>
      )}

      {readyLanes.length > 0 ? (
        <JosephStudyReviewPanel lanes={readyLanes} />
      ) : null}

      {diagnosticsVisible ? (
        <section data-joseph-study-overlays="true" data-joseph-study-diagnostics-frame={frameDiagnostics?.frame ?? diagnosticsFrame} aria-label="Diagnostic overlays">
          {diagnosticsSections.map((section) => (
            <article key={section.id}>
              <h2>{section.title}</h2>
              <ul>
                {section.entries.map((entry) => (
                  <li key={`${section.id}-${entry.label}-${entry.range}`}>
                    <strong>{entry.label}</strong> <span>{entry.range}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
};

export const JosephStudyStudio: React.FC = () => {
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const initialSource = useMemo(() => {
    if (typeof window === "undefined") {
      return {mode: "fixture"} as const;
    }

    return resolveJosephStudyInitialSource(window.location.search);
  }, []);

  const [state, setState] = useState<JosephStudyStudioState>(() => initialSource.mode === "candidate"
    ? {
        mode: "candidate",
        status: "ready",
        manifestUrl: initialSource.manifestUrl ?? "/joseph-study/candidate-manifest.json"
      }
    : initialSource.mode === "generate"
      ? {
          mode: "generation",
          status: "loading",
          candidateCount: initialSource.candidateCount ?? 4
        }
      : {
          mode: "fixture",
          status: "ready",
          manifest: DEFAULT_JOSEPH_MANIFEST
        });

  useEffect(() => {
    if (initialSource.mode !== "generate") {
      return;
    }

    let cancelled = false;
    requestJosephStudyCandidates({candidateCount: initialSource.candidateCount ?? 4})
      .then((nextState) => {
        if (!cancelled) {
          setState(nextState);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            mode: "generation",
            status: "error",
            candidateCount: initialSource.candidateCount ?? 4,
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialSource]);

  return (
    <JosephStudyStudioView
      state={state}
      diagnosticsVisible={diagnosticsVisible}
      onToggleDiagnostics={() => setDiagnosticsVisible((visible) => toggleJosephStudyDiagnostics(visible))}
    />
  );
};

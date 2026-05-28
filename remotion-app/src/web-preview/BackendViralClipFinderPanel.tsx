import React, {startTransition, useEffect, useMemo, useState} from "react";

import {
  buildViralClipJobPayload,
  formatViralClipStageLabel,
  getBackendViralClipApiBaseUrl,
  getBackendViralClipApiUrl,
  getViralClipJobResult,
  getViralClipJobStatus,
  isTerminalViralClipStage,
  pingBackendApi,
  submitViralClipJob,
  type BackendTargetPlatform,
  type ViralClipJobCreateResponse,
  type ViralClipJobStatus,
  type ViralClipSelection
} from "../lib/backend-viral-clips";
import type {PresentationMode, TranscribedWord} from "../lib/types";

type BackendViralClipFinderPanelProps = {
  projectId: string;
  videoId: string;
  presentationMode: PresentationMode;
  sourceLabel?: string | null;
  sourceMediaRef?: string | null;
  creatorNiche?: string | null;
  transcriptWords?: TranscribedWord[];
  defaultPrompt?: string;
};

const formatSeconds = (valueMs: number): string => `${(valueMs / 1000).toFixed(1)}s`;

const formatTimecode = (valueMs: number): string => {
  const totalSeconds = Math.max(0, valueMs) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

const formatPortraitFocus = (focus: NonNullable<ViralClipSelection["selected_clips"][number]["portrait_focus"]> | null | undefined): string => {
  if (!focus) {
    return "Centered";
  }

  const modeLabel =
    focus.mode === "speaker_head"
      ? "Speaker head"
      : focus.mode === "semantic_anchor"
        ? "Semantic anchor"
        : "Center";
  const referenceLabel = focus.reference_label?.trim() || null;

  return referenceLabel
    ? `${modeLabel} · ${referenceLabel} · ${focus.focus_x_pct.toFixed(0)}% / ${focus.focus_y_pct.toFixed(0)}%`
    : `${modeLabel} · ${focus.focus_x_pct.toFixed(0)}% / ${focus.focus_y_pct.toFixed(0)}%`;
};

const createDefaultPrompt = ({
  sourceLabel,
  presentationMode
}: {
  sourceLabel: string | null | undefined;
  presentationMode: PresentationMode;
}): string => {
  const sourceName = sourceLabel?.trim() || "the current preview";
  const modeLabel = presentationMode === "long-form" ? "long-form" : "short-form";
  return `Find 2 to 4 premium ${modeLabel} clips from ${sourceName}. Prioritize standalone hooks, restrained cinematic pacing, emotional lift, and strong payoff density.`;
};

const platformOptions: Array<{value: BackendTargetPlatform; label: string}> = [
  {value: "shorts", label: "YouTube Shorts"},
  {value: "tiktok", label: "TikTok"},
  {value: "reels", label: "Instagram Reels"},
  {value: "youtube", label: "YouTube"},
  {value: "generic", label: "Generic"}
];

export const BackendViralClipFinderPanel: React.FC<BackendViralClipFinderPanelProps> = ({
  projectId,
  videoId,
  presentationMode,
  sourceLabel,
  sourceMediaRef,
  creatorNiche,
  transcriptWords = [],
  defaultPrompt
}) => {
  const backendBaseUrl = getBackendViralClipApiBaseUrl();
  const [submittedProjectId, setSubmittedProjectId] = useState(projectId);
  const [submittedVideoId, setSubmittedVideoId] = useState(videoId);
  const [submittedSourceMediaRef, setSubmittedSourceMediaRef] = useState(sourceMediaRef ?? "");
  const [submittedCreatorNiche, setSubmittedCreatorNiche] = useState(creatorNiche ?? "");
  const [submittedTargetPlatform, setSubmittedTargetPlatform] = useState<BackendTargetPlatform>("shorts");
  const [submittedClipCountMin, setSubmittedClipCountMin] = useState(2);
  const [submittedClipCountMax, setSubmittedClipCountMax] = useState(4);
  const [submittedPrompt, setSubmittedPrompt] = useState(
    defaultPrompt ?? createDefaultPrompt({sourceLabel, presentationMode})
  );
  const [attachTranscript, setAttachTranscript] = useState(transcriptWords.length > 0);
  const [backendHealth, setBackendHealth] = useState<"checking" | "connected" | "offline">("checking");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobCreateResponse, setJobCreateResponse] = useState<ViralClipJobCreateResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<ViralClipJobStatus | null>(null);
  const [selection, setSelection] = useState<ViralClipSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const transcriptCount = transcriptWords.length;

  const payloadPreview = useMemo(() => {
    try {
      return buildViralClipJobPayload({
        projectId: submittedProjectId.trim() || projectId,
        videoId: submittedVideoId.trim() || videoId,
        targetPlatform: submittedTargetPlatform,
        clipCountMin: submittedClipCountMin,
        clipCountMax: submittedClipCountMax,
        prompt: submittedPrompt.trim() || undefined,
        sourceMediaRef: submittedSourceMediaRef.trim() || undefined,
        creatorNiche: submittedCreatorNiche.trim() || undefined,
        providedTranscript: attachTranscript ? transcriptWords : undefined,
        metadataOverrides: {
          presentationMode,
          sourceLabel: sourceLabel ?? null,
          transcriptWordCount: transcriptCount
        }
      });
    } catch {
      return null;
    }
  }, [
    attachTranscript,
    presentationMode,
    projectId,
    sourceLabel,
    submittedClipCountMax,
    submittedClipCountMin,
    submittedCreatorNiche,
    submittedPrompt,
    submittedProjectId,
    submittedSourceMediaRef,
    submittedTargetPlatform,
    submittedVideoId,
    transcriptCount,
    transcriptWords,
    videoId
  ]);

  useEffect(() => {
    let cancelled = false;

    setBackendHealth("checking");
    void pingBackendApi()
      .then(() => {
        if (!cancelled) {
          setBackendHealth("connected");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackendHealth("offline");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backendBaseUrl]);

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let intervalId = 0;

    const refreshJob = async (): Promise<void> => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;
      try {
        const nextStatus = await getViralClipJobStatus(activeJobId);
        if (cancelled) {
          return;
        }

        setJobStatus(nextStatus);
        setErrorMessage(null);
        setLastRefreshedAt(new Date().toLocaleTimeString());

        if (nextStatus.stage === "completed") {
          const nextSelection = await getViralClipJobResult(activeJobId);
          if (cancelled) {
            return;
          }
          setSelection(nextSelection);
          window.clearInterval(intervalId);
        } else if (nextStatus.stage === "failed") {
          setSelection(null);
          window.clearInterval(intervalId);
        }
      } catch (pollError) {
        if (!cancelled) {
          setErrorMessage(pollError instanceof Error ? pollError.message : String(pollError));
          window.clearInterval(intervalId);
        }
      } finally {
        inFlight = false;
      }
    };

    intervalId = window.setInterval(() => {
      void refreshJob();
    }, 1600);
    void refreshJob();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobId]);

  useEffect(() => {
    setSubmittedProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    setSubmittedVideoId(videoId);
  }, [videoId]);

  useEffect(() => {
    setSubmittedSourceMediaRef(sourceMediaRef ?? "");
  }, [sourceMediaRef]);

  useEffect(() => {
    setSubmittedCreatorNiche(creatorNiche ?? "");
  }, [creatorNiche]);

  useEffect(() => {
    if (transcriptWords.length > 0) {
      setAttachTranscript(true);
    }
  }, [transcriptWords.length]);

  const handleGenerate = async (): Promise<void> => {
    setErrorMessage(null);
    setSelection(null);
    setJobCreateResponse(null);
    setJobStatus(null);
    setActiveJobId(null);

    const normalizedProjectId = submittedProjectId.trim();
    const normalizedVideoId = submittedVideoId.trim();
    if (!normalizedProjectId || !normalizedVideoId) {
      setErrorMessage("Project ID and video ID are required.");
      return;
    }

    if (
      !Number.isFinite(submittedClipCountMin) ||
      !Number.isFinite(submittedClipCountMax) ||
      submittedClipCountMin < 1 ||
      submittedClipCountMax < 1 ||
      submittedClipCountMin > submittedClipCountMax
    ) {
      setErrorMessage("Clip count min must be less than or equal to clip count max.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitViralClipJob({
        projectId: normalizedProjectId,
        videoId: normalizedVideoId,
        targetPlatform: submittedTargetPlatform,
        clipCountMin: submittedClipCountMin,
        clipCountMax: submittedClipCountMax,
        prompt: submittedPrompt.trim() || undefined,
        sourceMediaRef: submittedSourceMediaRef.trim() || undefined,
        creatorNiche: submittedCreatorNiche.trim() || undefined,
        providedTranscript: attachTranscript ? transcriptWords : undefined,
        metadataOverrides: {
          presentationMode,
          sourceLabel: sourceLabel ?? null,
          transcriptWordCount: transcriptCount
        }
      });

      setJobCreateResponse(response);
      setActiveJobId(response.jobId);
      setJobStatus({
        job_id: response.jobId,
        status: response.status,
        current_stage: response.stage,
        stage: response.stage,
        executionVisibility: response.executionVisibility,
        urls: response.urls
      });
    } catch (submitError) {
      setErrorMessage(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = (): void => {
    setActiveJobId(null);
    setJobCreateResponse(null);
    setJobStatus(null);
    setSelection(null);
    setErrorMessage(null);
    setLastRefreshedAt(null);
  };

  const selectedClipCards = selection?.selected_clips ?? [];
  const candidateCount = selection?.candidate_segments.length ?? 0;
  const backendStatusLabel =
    backendHealth === "connected" ? "Connected" : backendHealth === "offline" ? "Offline" : "Checking";
  const currentStageLabel = jobStatus ? formatViralClipStageLabel(jobStatus.stage) : "Idle";
  const jobJsonUrl = jobCreateResponse?.urls?.job ?? null;
  const jobResultUrl = jobCreateResponse?.urls?.result ?? null;

  return (
    <div className="preview-meta-card preview-backend-card">
      <div className="preview-backend-header">
        <div>
          <h2>Backend Viral Clip Finder</h2>
          <p>
            Submit a clip-selection job to the local backend, poll the stage, and inspect the selected clips in place.
          </p>
        </div>
        <div className={`preview-backend-status is-${backendHealth}`}>{backendStatusLabel}</div>
      </div>

      <div className="preview-backend-meta">
        <div className="preview-backend-meta-item">
          <span>API base</span>
          <strong>{backendBaseUrl}</strong>
        </div>
        <div className="preview-backend-meta-item">
          <span>Transcript</span>
          <strong>{attachTranscript ? `${transcriptCount} words attached` : "off"}</strong>
        </div>
        <div className="preview-backend-meta-item">
          <span>Current stage</span>
          <strong>{currentStageLabel}</strong>
        </div>
        <div className="preview-backend-meta-item">
          <span>Result</span>
          <strong>{selection ? `${selection.selected_clips.length} clips` : "none yet"}</strong>
        </div>
      </div>

      <div className="preview-controls preview-backend-controls">
        <label className="preview-control">
          <span>Project ID</span>
          <input
            value={submittedProjectId}
            onChange={(event) => {
              const value = event.target.value;
              startTransition(() => {
                setSubmittedProjectId(value);
              });
            }}
          />
        </label>

        <label className="preview-control">
          <span>Video ID</span>
          <input
            value={submittedVideoId}
            onChange={(event) => {
              const value = event.target.value;
              startTransition(() => {
                setSubmittedVideoId(value);
              });
            }}
          />
        </label>

        <label className="preview-control">
          <span>Source ref</span>
          <input
            value={submittedSourceMediaRef}
            onChange={(event) => setSubmittedSourceMediaRef(event.target.value)}
            placeholder="Optional local path or asset reference"
          />
        </label>

        <label className="preview-control">
          <span>Creator niche</span>
          <input
            value={submittedCreatorNiche}
            onChange={(event) => setSubmittedCreatorNiche(event.target.value)}
            placeholder="creator, podcast, education..."
          />
        </label>

        <label className="preview-control">
          <span>Target platform</span>
          <select
            value={submittedTargetPlatform}
            onChange={(event) => setSubmittedTargetPlatform(event.target.value as BackendTargetPlatform)}
          >
            {platformOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="preview-control">
          <span>Clip count min</span>
          <input
            type="number"
            min={1}
            max={8}
            step={1}
            value={submittedClipCountMin}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setSubmittedClipCountMin(Number.isFinite(nextValue) ? nextValue : 1);
            }}
          />
        </label>

        <label className="preview-control">
          <span>Clip count max</span>
          <input
            type="number"
            min={1}
            max={8}
            step={1}
            value={submittedClipCountMax}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setSubmittedClipCountMax(Number.isFinite(nextValue) ? nextValue : 4);
            }}
          />
        </label>
      </div>

      <label className="preview-control preview-backend-prompt">
        <span>Prompt</span>
        <textarea
          rows={4}
          value={submittedPrompt}
          onChange={(event) => setSubmittedPrompt(event.target.value)}
        />
      </label>

      <div className="preview-backend-checkboxes">
        <label className="preview-backend-checkbox">
          <input
            type="checkbox"
            checked={attachTranscript}
            onChange={(event) => setAttachTranscript(event.target.checked)}
          />
          <span>Attach current preview transcript</span>
        </label>
      </div>

      <div className="preview-draft-actions preview-backend-actions">
        <button
          type="button"
          className="preview-link preview-link-button"
          onClick={() => {
            void handleGenerate();
          }}
          disabled={isSubmitting || backendHealth === "offline"}
        >
          {isSubmitting ? "Submitting..." : "Generate Viral Clips"}
        </button>
        <button
          type="button"
          className="preview-reset-button"
          onClick={handleReset}
          disabled={!activeJobId && !jobCreateResponse && !selection && !errorMessage}
        >
          Reset panel
        </button>
      </div>

      {errorMessage ? <p className="preview-backend-error">{errorMessage}</p> : null}

      <div className="preview-backend-summary">
        <div className="preview-backend-summary-item">
          <span>Job ID</span>
          <strong>{jobStatus?.job_id ?? jobCreateResponse?.jobId ?? "not started"}</strong>
        </div>
        <div className="preview-backend-summary-item">
          <span>Status</span>
          <strong>{jobStatus?.status ?? jobCreateResponse?.status ?? "idle"}</strong>
        </div>
        <div className="preview-backend-summary-item">
          <span>Stage</span>
          <strong>{jobStatus ? formatViralClipStageLabel(jobStatus.stage) : "idle"}</strong>
        </div>
        <div className="preview-backend-summary-item">
          <span>Selected</span>
          <strong>{selection?.source_summary.selected_count ?? 0}</strong>
        </div>
      </div>

      {jobStatus?.progress ? (
        <div className="preview-backend-progress">
          <span>Progress</span>
          <strong>
            {jobStatus.progress.percent ?? 0}% {jobStatus.progress.current_step ?? 0}/{jobStatus.progress.total_steps ?? 0}
          </strong>
        </div>
      ) : null}

      {jobStatus?.error_message ? <p className="preview-backend-error">{jobStatus.error_message}</p> : null}

      {(jobJsonUrl || jobResultUrl) ? (
        <div className="preview-backend-actions">
          {jobJsonUrl ? (
            <a
              className="preview-link preview-link-button"
              href={getBackendViralClipApiUrl(jobJsonUrl)}
              target="_blank"
              rel="noreferrer"
            >
              Open job JSON
            </a>
          ) : null}
          {jobResultUrl ? (
            <a
              className="preview-link preview-link-button"
              href={getBackendViralClipApiUrl(jobResultUrl)}
              target="_blank"
              rel="noreferrer"
            >
              Open result JSON
            </a>
          ) : null}
        </div>
      ) : null}

      {selection ? (
        <div className="preview-backend-results">
          <div className="preview-backend-results-header">
            <h3>Selected Clips</h3>
            <span>
              {candidateCount} candidates · {selection.selected_clips.length} selected
            </span>
          </div>

          <div className="preview-backend-result-grid">
            {selectedClipCards.map((clip) => (
              <article key={clip.clip_id} className="preview-backend-clip-card">
                <div className="preview-backend-clip-header">
                  <strong>Rank {clip.rank}</strong>
                  <span>
                    {formatTimecode(clip.export_start_ms)} - {formatTimecode(clip.export_end_ms)} ·{" "}
                    {formatSeconds(clip.export_duration_ms)}
                  </span>
                </div>

                <div className="preview-backend-clip-body">
                  <p>{clip.hook_line}</p>
                  <p>{clip.reason_selected}</p>
                </div>

                <dl className="preview-backend-clip-meta">
                  <div>
                    <dt>Title</dt>
                    <dd>{clip.suggested_title}</dd>
                  </div>
                  <div>
                    <dt>Caption</dt>
                    <dd>{clip.suggested_caption}</dd>
                  </div>
                  <div>
                    <dt>Scores</dt>
                    <dd>
                      Final {clip.final_score.toFixed(2)} · Virality {clip.virality_score.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt>Framing</dt>
                    <dd>{formatPortraitFocus(clip.portrait_focus)}</dd>
                  </div>
                </dl>

                {clip.subtitle_emphasis_words.length > 0 ? (
                  <div className="preview-backend-tag-row">
                    {clip.subtitle_emphasis_words.map((word) => (
                      <span key={`${clip.clip_id}-${word}`} className="preview-backend-tag">
                        {word}
                      </span>
                    ))}
                  </div>
                ) : null}

                {clip.punch_in_moments_ms.length > 0 ? (
                  <div className="preview-backend-tag-row">
                    {clip.punch_in_moments_ms.map((moment, index) => (
                      <span key={`${clip.clip_id}-punch-${index}`} className="preview-backend-tag">
                        Punch {formatTimecode(moment)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          {selection.warnings.length > 0 ? (
            <div className="preview-backend-warnings">
              {selection.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="preview-backend-details">
        <summary>Request preview</summary>
        <div className="preview-backend-details-grid">
          <div>
            <span>Transcript words</span>
            <strong>{attachTranscript ? transcriptCount : 0}</strong>
          </div>
          <div>
            <span>Last refresh</span>
            <strong>{lastRefreshedAt ?? "not refreshed yet"}</strong>
          </div>
          <div>
            <span>Attached source</span>
            <strong>{submittedSourceMediaRef.trim() || "none"}</strong>
          </div>
          <div>
            <span>Backend stage</span>
            <strong>{jobStatus?.executionVisibility?.stageGraph.currentStage ?? jobStatus?.current_stage ?? "idle"}</strong>
          </div>
          <div>
            <span>Overall progress</span>
            <strong>{Math.round(jobStatus?.executionVisibility?.progress.overall ?? jobStatus?.progress?.percent ?? 0)}%</strong>
          </div>
          <div>
            <span>ETA remaining</span>
            <strong>
              {jobStatus?.executionVisibility
                ? `${Math.ceil(jobStatus.executionVisibility.eta.remainingMs / 1000)}s`
                : "unknown"}
            </strong>
          </div>
          <div>
            <span>Compute</span>
            <strong>{jobStatus?.executionVisibility?.compute.activeComputeType ?? "idle"}</strong>
          </div>
        </div>
        {payloadPreview ? (
          <pre className="preview-backend-json">{JSON.stringify(payloadPreview, null, 2)}</pre>
        ) : (
          <p className="preview-backend-error">
            The current form is not valid yet, so the request preview is hidden.
          </p>
        )}
      </details>
    </div>
  );
};

import React from "react";

import type {VideoAwareMusicEventSummary} from "../../lib/music/music-api-types";
import {
  type VideoAwareMusicViewState,
  useVideoAwareMusicState
} from "../../lib/music/use-video-aware-music-state";
import {MusicCatalogPanel} from "./MusicCatalogPanel";

type MusicDjControlPanelProps = {
  readonly jobId?: string | null;
  readonly controller?: VideoAwareMusicViewState;
};

const panelStyles: React.CSSProperties = {
  display: "grid",
  gap: 18
};

const cardStyles: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 18,
  borderRadius: 24,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(2, 6, 23, 0.84)",
  color: "#e2e8f0"
};

const sectionTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.2
};

const badgeStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  padding: "5px 10px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  fontSize: 12
};

const actionButtonStyles: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: 999,
  background: "#111827",
  color: "#f8fafc",
  padding: "8px 12px",
  cursor: "pointer"
};

const getStatusTone = (controller: VideoAwareMusicViewState): {label: string; tone: string} => {
  if (!controller.jobId) {
    return {label: "no job", tone: "#475569"};
  }
  if (!controller.djState?.hasAudioPlan) {
    return {label: "no plan", tone: "#475569"};
  }
  if (controller.preflight?.status === "block") {
    return {label: "preflight blocked", tone: "#dc2626"};
  }
  if (controller.preflight?.status === "warn") {
    return {label: "preflight warn", tone: "#d97706"};
  }
  if (controller.djState.hasAudioPlan) {
    return {label: "plan ready", tone: "#16a34a"};
  }
  return {label: "no plan", tone: "#475569"};
};

const renderTrackMeta = (
  event: VideoAwareMusicEventSummary | null | undefined
): React.ReactNode => {
  if (!event) {
    return <p style={{margin: 0, color: "#94a3b8"}}>No DJ-selected track yet.</p>;
  }

  return (
    <div style={{display: "grid", gap: 8}}>
      <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
        <span style={badgeStyles}>{event.title ?? event.trackId}</span>
        <span style={badgeStyles}>trackId: {event.trackId}</span>
        <span style={badgeStyles}>{event.category ?? "uncategorized"}</span>
        <span style={badgeStyles}>{event.previewOnly ? "previewOnly" : "previewable"}</span>
        <span style={badgeStyles}>{event.renderSafe ? "renderSafe" : "render blocked"}</span>
      </div>
      {event.sourceObjectKey ? (
        <p style={{margin: 0, fontSize: 12, color: "#94a3b8"}}>
          sourceObjectKey: {event.sourceObjectKey}
        </p>
      ) : null}
      {event.warning ? (
        <p style={{margin: 0, fontSize: 12, color: "#fca5a5"}}>{event.warning}</p>
      ) : null}
    </div>
  );
};

export const MusicDjControlPanelView: React.FC<{
  controller: VideoAwareMusicViewState;
}> = ({controller}) => {
  const status = getStatusTone(controller);
  const selectedDjTrack = controller.djState?.selectedTracks[0] ?? null;
  const licenseWarning = controller.djState && !controller.djState.renderAllowed
    ? "Preview only - license not verified for export."
    : null;
  const canSubmitOverride = Boolean(controller.jobId && controller.selectedTrack && !controller.submittingOverride);

  return (
    <section style={panelStyles} data-music-dj-control-panel="true">
      <div style={cardStyles}>
        <header style={{display: "grid", gap: 8}}>
          <p style={{margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8"}}>
            Video-Aware DJ
          </p>
          <h2 style={sectionTitleStyles}>Dry-run music control plane</h2>
          <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
            <span style={{...badgeStyles, borderColor: status.tone, color: status.tone}}>
              status: {status.label}
            </span>
            <span style={badgeStyles}>jobId: {controller.jobId ?? "missing"}</span>
            <span style={badgeStyles}>renderAllowed: {String(controller.djState?.renderAllowed ?? false)}</span>
            <span style={badgeStyles}>canRenderMusic: {String(controller.djState?.canRenderMusic ?? false)}</span>
            <span style={badgeStyles}>previewMix: {controller.djState?.previewMix?.status ?? "missing"}</span>
          </div>
          {licenseWarning ? (
            <p style={{margin: 0, color: "#fca5a5"}}>{licenseWarning}</p>
          ) : null}
          {!controller.jobId ? (
            <p style={{margin: 0, color: "#94a3b8"}}>DJ plan controls need a backend jobId.</p>
          ) : null}
          {controller.error ? (
            <p style={{margin: 0, color: "#fca5a5"}}>{controller.error}</p>
          ) : null}
          {controller.lastActionMessage ? (
            <p style={{margin: 0, color: "#94a3b8"}}>{controller.lastActionMessage}</p>
          ) : null}
        </header>

        <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
          <button
            type="button"
            style={actionButtonStyles}
            disabled={!controller.jobId || controller.runningRehearsal}
            onClick={() => {
              void controller.runRehearsal({useCatalogCandidates: true, overwrite: true});
            }}
          >
            {controller.runningRehearsal ? "Running DJ rehearsal..." : "Run DJ rehearsal"}
          </button>
          <button
            type="button"
            style={actionButtonStyles}
            disabled={!controller.jobId || controller.runningPreflight}
            onClick={() => {
              void controller.runPreflight();
            }}
          >
            {controller.runningPreflight ? "Running preflight..." : "Run preflight"}
          </button>
          <button
            type="button"
            style={actionButtonStyles}
            disabled={controller.loading}
            onClick={() => {
              void controller.refreshState();
            }}
          >
            {controller.loading ? "Refreshing..." : "Refresh state"}
          </button>
        </div>
      </div>

      <div style={{...cardStyles, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"}}>
        <section style={{display: "grid", gap: 10}}>
          <h3 style={{margin: 0}}>Selected Track</h3>
          {renderTrackMeta(selectedDjTrack)}
        </section>

        <section style={{display: "grid", gap: 10}}>
          <h3 style={{margin: 0}}>Active Override Track</h3>
          {controller.selectedTrack ? (
            <div style={{display: "grid", gap: 8}}>
              <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                <span style={badgeStyles}>{controller.selectedTrack.title}</span>
                <span style={badgeStyles}>trackId: {controller.selectedTrack.id}</span>
                <span style={badgeStyles}>{controller.selectedTrack.category}</span>
              </div>
              <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
                <button
                  type="button"
                  style={actionButtonStyles}
                  disabled={!canSubmitOverride}
                  onClick={() => {
                    void controller.overridePreviewTrack(controller.selectedTrack!.id);
                  }}
                >
                  Use for preview
                </button>
              </div>
            </div>
          ) : (
            <p style={{margin: 0, color: "#94a3b8"}}>
              Pick a catalog track below to use it as the active override track.
            </p>
          )}
        </section>
      </div>

      <div style={cardStyles}>
        <h3 style={{margin: 0}}>Music Events</h3>
        {controller.djState?.musicEvents.length ? (
          <div style={{display: "grid", gap: 10}}>
            {controller.djState.musicEvents.map((event) => (
              <article
                key={event.id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(148, 163, 184, 0.16)",
                  background: "rgba(15, 23, 42, 0.64)"
                }}
              >
                <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                  <span style={badgeStyles}>event: {event.id}</span>
                  <span style={badgeStyles}>purpose: {event.purpose ?? "unknown"}</span>
                  <span style={badgeStyles}>
                    {event.videoStartSec.toFixed(2)}s - {event.videoEndSec.toFixed(2)}s
                  </span>
                  <span style={badgeStyles}>trackId: {event.trackId}</span>
                  <span style={badgeStyles}>{event.previewOnly ? "previewOnly" : "previewable"}</span>
                  <span style={badgeStyles}>{event.renderSafe ? "renderSafe" : "render blocked"}</span>
                </div>
                {event.warning ? (
                  <p style={{margin: 0, color: "#fca5a5"}}>{event.warning}</p>
                ) : null}
                <div>
                  <button
                    type="button"
                    style={actionButtonStyles}
                    disabled={!canSubmitOverride}
                    onClick={() => {
                      if (controller.selectedTrack) {
                        void controller.overrideMusicEvent(event.id, controller.selectedTrack.id);
                      }
                    }}
                  >
                    Replace with selected catalog track
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p style={{margin: 0, color: "#94a3b8"}}>No music events yet. Run DJ rehearsal first.</p>
        )}
      </div>

      <div style={cardStyles}>
        <h3 style={{margin: 0}}>SFX Events</h3>
        {controller.djState?.sfxEvents.length ? (
          <div style={{display: "grid", gap: 10}}>
            {controller.djState.sfxEvents.map((event) => (
              <article
                key={event.id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(148, 163, 184, 0.16)",
                  background: "rgba(15, 23, 42, 0.64)"
                }}
              >
                <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                  <span style={badgeStyles}>type: {event.type}</span>
                  <span style={badgeStyles}>
                    {event.videoStartSec.toFixed(2)}s - {event.videoEndSec.toFixed(2)}s
                  </span>
                  <span style={badgeStyles}>intensity: {typeof event.intensity === "number" ? event.intensity.toFixed(2) : "n/a"}</span>
                </div>
                <p style={{margin: 0, color: "#94a3b8"}}>
                  {event.reason ?? "No SFX reason provided."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p style={{margin: 0, color: "#94a3b8"}}>No SFX events generated yet.</p>
        )}
      </div>

      <div style={cardStyles}>
        <h3 style={{margin: 0}}>Audio Preview Mix</h3>
        {controller.djState?.previewMix?.status === "rendered" ? (
          <div style={{display: "grid", gap: 8}}>
            <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
              <span style={badgeStyles}>status: rendered</span>
            </div>
            {controller.djState.previewMix.artifactPath ? (
              <p style={{margin: 0, fontSize: 12, color: "#94a3b8"}}>
                artifactPath: {controller.djState.previewMix.artifactPath}
              </p>
            ) : null}
          </div>
        ) : (
          <p style={{margin: 0, color: "#94a3b8"}}>
            No real preview mix artifact recorded yet.
          </p>
        )}
      </div>

      <div style={cardStyles}>
        <h3 style={{margin: 0}}>Preflight</h3>
        {controller.preflight ? (
          <div style={{display: "grid", gap: 12}}>
            <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
              <span style={badgeStyles}>status: {controller.preflight.status}</span>
              <span style={badgeStyles}>canRender: {String(controller.preflight.canRender)}</span>
              <span style={badgeStyles}>planMode: {controller.preflight.planMode}</span>
            </div>
            {controller.preflight.issues.length ? (
              <div style={{display: "grid", gap: 6}}>
                {controller.preflight.issues.map((issue) => (
                  <p key={issue.id} style={{margin: 0, color: issue.severity === "error" ? "#fca5a5" : "#fcd34d"}}>
                    [{issue.severity}] {issue.message}
                  </p>
                ))}
              </div>
            ) : (
              <p style={{margin: 0, color: "#94a3b8"}}>No preflight issues recorded.</p>
            )}
            {controller.preflight.nextActions.length ? (
              <div style={{display: "grid", gap: 6}}>
                {controller.preflight.nextActions.map((action) => (
                  <p key={action} style={{margin: 0, color: "#94a3b8"}}>{action}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p style={{margin: 0, color: "#94a3b8"}}>No preflight report yet. Run preflight after rehearsal.</p>
        )}
      </div>

      <MusicCatalogPanel
        selectedTrackId={controller.selectedTrack?.id ?? null}
        onTrackFocus={controller.setSelectedTrack}
      />
    </section>
  );
};

export const MusicDjControlPanel: React.FC<MusicDjControlPanelProps> = ({
  jobId = null,
  controller
}) => {
  const resolvedController = useVideoAwareMusicState(jobId);

  return (
    <MusicDjControlPanelView controller={controller ?? resolvedController} />
  );
};

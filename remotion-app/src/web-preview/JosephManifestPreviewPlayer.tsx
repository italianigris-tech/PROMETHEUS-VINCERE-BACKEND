import React, {useEffect, useState} from "react";
import {Player} from "@remotion/player";
import type {UnifiedRenderManifest} from "@prometheus/shared-types";

import {JosephEdit} from "../compositions/JosephEdit";

export type JosephManifestPreviewPlayerProps = {
  readonly manifest: UnifiedRenderManifest;
  readonly renderJobUrl?: string | null;
};

type JosephRenderJobSnapshot = {
  status?: "queued" | "leased" | "completed" | "failed";
  output_url?: string | null;
  error?: string | null;
};

export const JosephManifestPreviewPlayer: React.FC<JosephManifestPreviewPlayerProps> = ({manifest, renderJobUrl}) => {
  const [renderJob, setRenderJob] = useState<JosephRenderJobSnapshot | null>(null);

  useEffect(() => {
    if (!renderJobUrl) {
      setRenderJob(null);
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(renderJobUrl, {cache: "no-store"});
        if (!response.ok) {
          return;
        }
        const snapshot = await response.json() as JosephRenderJobSnapshot;
        if (!cancelled) {
          setRenderJob(snapshot);
          if (snapshot.status === "completed" || snapshot.status === "failed") {
            window.clearInterval(intervalId);
          }
        }
      } catch {
        // The interactive manifest remains usable while a worker reconnects.
      }
    };

    void refresh();
    intervalId = window.setInterval(() => void refresh(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [renderJobUrl]);

  if (renderJob?.status === "completed" && renderJob.output_url) {
    return (
      <div data-preview-mode="joseph-final-mp4" style={{width: "100%", height: "100%", display: "grid", background: "#000"}}>
        <video controls playsInline src={renderJob.output_url} style={{width: "100%", height: "100%", objectFit: "contain"}} />
        <a
          href={renderJob.output_url}
          download
          style={{position: "absolute", right: 16, bottom: 16, padding: "10px 14px", background: "#fff", color: "#111", textDecoration: "none", fontWeight: 700}}
        >
          Download final MP4
        </a>
      </div>
    );
  }

  return (
    <div
      data-preview-mode="joseph-manifest-player"
      style={{width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#000"}}
    >
      <Player
        component={JosephEdit}
        inputProps={{manifest}}
        durationInFrames={manifest.durationFrames}
        compositionWidth={manifest.width}
        compositionHeight={manifest.height}
        fps={manifest.fps}
        controls
        clickToPlay
        loop
        style={{width: "100%", height: "100%"}}
      />
    </div>
  );
};

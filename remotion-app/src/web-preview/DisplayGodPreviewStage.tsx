import React from "react";

import {HyperframesPreview} from "./HyperframesPreview";
import type {PreviewPlaybackHealth} from "./preview-telemetry";
import type {PreviewPerformanceMode} from "../lib/types";
import type {DisplayTimeline} from "./display-god/display-timeline";
import type {HyperframesPreviewManifest} from "./hyperframes/manifest-schema";

type DisplayGodPreviewStageProps = {
  readonly displayTimeline: DisplayTimeline;
  readonly manifest?: HyperframesPreviewManifest | null;
  readonly previewPerformanceMode: PreviewPerformanceMode;
  readonly onHealthChange?: (health: PreviewPlaybackHealth) => void;
  readonly onErrorMessageChange?: (message: string | null) => void;
};

export const DisplayGodPreviewStage: React.FC<DisplayGodPreviewStageProps> = ({
  displayTimeline,
  manifest,
  previewPerformanceMode,
  onHealthChange,
  onErrorMessageChange
}) => {
  return (
    <HyperframesPreview
      displayTimeline={displayTimeline}
      manifest={manifest}
      previewPerformanceMode={previewPerformanceMode}
      onHealthChange={onHealthChange}
      onErrorMessageChange={onErrorMessageChange}
    />
  );
};

import React from "react";

import {
  ProjectScopedMotionComposition,
  type ProjectScopedMotionCompositionProps
} from "./ProjectScopedMotionComposition";
import type {PresentationModeSetting, PreviewPerformanceMode} from "../lib/types";

export type FemaleCoachDeanGraziosiProps = ProjectScopedMotionCompositionProps;

export const resolvePreviewVisualFeatureFlags = ({
  focusedStudioMode,
  previewPerformanceMode,
  showPiPShowcase
}: {
  focusedStudioMode: boolean;
  previewPerformanceMode: PreviewPerformanceMode;
  showPiPShowcase: boolean;
}) => {
  return {
    showBackgroundOverlay: !focusedStudioMode && previewPerformanceMode !== "turbo" && !showPiPShowcase,
    showMotionAssetOverlay: !focusedStudioMode && previewPerformanceMode !== "turbo" && !showPiPShowcase,
    showMatteForeground: !focusedStudioMode && previewPerformanceMode === "full" && !showPiPShowcase,
    showShowcaseOverlay: !focusedStudioMode && previewPerformanceMode !== "turbo" && !showPiPShowcase,
    showSoundDesign: !focusedStudioMode && previewPerformanceMode === "full",
    showTypographyBiasOverlay: !focusedStudioMode && !showPiPShowcase,
    showTransitionOverlay: !focusedStudioMode && !showPiPShowcase
  };
};

export const resolveFocusedStudioCaptionCompositor = ({
  focusedStudioMode,
  presentationMode,
  hideCaptionOverlays
}: {
  focusedStudioMode: boolean;
  presentationMode: PresentationModeSetting;
  hideCaptionOverlays: boolean;
}): "longform-word-by-word" | null => {
  if (hideCaptionOverlays) {
    return null;
  }

  return focusedStudioMode && presentationMode === "long-form"
    ? "longform-word-by-word"
    : null;
};

export const FemaleCoachDeanGraziosi: React.FC<FemaleCoachDeanGraziosiProps> = (props) => {
  return <ProjectScopedMotionComposition {...props} />;
};
FemaleCoachDeanGraziosi.displayName = "FemaleCoachDeanGraziosi";

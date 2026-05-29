type TimelineLike = {
  seek: (time: number, suppressEvents?: boolean) => unknown;
};

export const seekHyperframesTimelineToFrame = ({
  timeline,
  currentFrame,
  fps
}: {
  timeline: TimelineLike | null;
  currentFrame: number;
  fps: number;
}): void => {
  if (!timeline || !Number.isFinite(fps) || fps <= 0) {
    return;
  }

  timeline.seek(currentFrame / fps, false);
};

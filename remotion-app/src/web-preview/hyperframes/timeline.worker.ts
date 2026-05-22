import gsap from "gsap";

import type {FrameMap, FrameMapEntry} from "./types";

type TimelineWorkerInput = {
  manifest: {
    hyperframes?: Array<{
      id: string;
      startX: number;
      endX: number;
      startY: number;
      endY: number;
      duration: number;
      startTime: number;
      ease: string;
      text?: string;
    }>;
  };
  fps: number;
  durationInFrames: number;
};

type TimelineLike = {
  seek: (time: number, suppressEvents?: boolean) => unknown;
};

const buildTimeline = (input: TimelineWorkerInput): {
  timeline: gsap.core.Timeline;
  proxies: Array<FrameMapEntry>;
} => {
  const proxies = (input.manifest.hyperframes ?? []).map((hyperframe) => ({
    id: hyperframe.id,
    x: hyperframe.startX,
    y: hyperframe.startY,
    scale: 1,
    sharpOpacity: 0,
    blurredOpacity: 1,
    rotation: 0,
    text: hyperframe.text ?? hyperframe.id
  }));

  const timeline = gsap.timeline({paused: true});
  (input.manifest.hyperframes ?? []).forEach((hyperframe, index) => {
    const proxy = proxies[index];
    if (!proxy) {
      return;
    }

    timeline.fromTo(
      proxy,
      {
        x: hyperframe.startX,
        y: hyperframe.startY,
        scale: 0.94,
        rotation: 0,
        sharpOpacity: 0,
        blurredOpacity: 1,
        text: hyperframe.text ?? hyperframe.id
      },
      {
        x: hyperframe.endX,
        y: hyperframe.endY,
        scale: 1,
        rotation: 0,
        sharpOpacity: 1,
        blurredOpacity: 0,
        text: hyperframe.text ?? hyperframe.id,
        duration: hyperframe.duration / Math.max(1, input.fps),
        ease: hyperframe.ease
      },
      hyperframe.startTime / Math.max(1, input.fps)
    );
  });

  timeline.pause();
  return {timeline, proxies};
};

const bakeFrameMap = (input: TimelineWorkerInput): FrameMap => {
  const {timeline, proxies} = buildTimeline(input);
  const frameMap: FrameMap = {};

  for (let frame = 0; frame < input.durationInFrames; frame += 1) {
    timeline.seek(frame / Math.max(1, input.fps), false);
    frameMap[frame] = proxies.map((proxy) => ({...proxy}));
  }

  timeline.kill();
  return frameMap;
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

if (typeof self !== "undefined") {
  const ctx = self as unknown as Worker;

  ctx.addEventListener("message", (event: MessageEvent<TimelineWorkerInput>) => {
    const frameMap = bakeFrameMap(event.data);
    ctx.postMessage({
      type: "TIMELINE_READY",
      frameMap
    });
  });
}

export {bakeFrameMap};

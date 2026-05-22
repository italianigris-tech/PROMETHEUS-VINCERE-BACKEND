import {useEffect, useMemo, useRef, useState} from "react";
import {continueRender, delayRender, useCurrentFrame} from "remotion";

import type {FrameMap, FrameMapEntry} from "./types";

type UseTimelineWorkerInput = {
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
    }>;
  } | null;
  fps: number;
  durationInFrames: number;
};

export const useTimelineWorker = ({
  manifest,
  fps,
  durationInFrames
}: UseTimelineWorkerInput): FrameMapEntry[] => {
  const frame = useCurrentFrame();
  const [frameMap, setFrameMap] = useState<FrameMap>({});
  const workerRef = useRef<Worker | null>(null);
  const renderHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!manifest) {
      return;
    }

    const handle = delayRender("Waiting for timeline worker");
    renderHandleRef.current = handle;
    const worker = new Worker(new URL("./timeline.worker.ts", import.meta.url), {type: "module"});
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{type: string; frameMap: FrameMap}>) => {
      if (event.data.type !== "TIMELINE_READY") {
        return;
      }

      setFrameMap(event.data.frameMap);
      continueRender(handle);
      renderHandleRef.current = null;
    };

    worker.postMessage({
      manifest,
      fps,
      durationInFrames
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
      if (renderHandleRef.current) {
        continueRender(renderHandleRef.current);
        renderHandleRef.current = null;
      }
    };
  }, [durationInFrames, fps, manifest]);

  return useMemo(() => frameMap[frame] ?? [], [frame, frameMap]);
};

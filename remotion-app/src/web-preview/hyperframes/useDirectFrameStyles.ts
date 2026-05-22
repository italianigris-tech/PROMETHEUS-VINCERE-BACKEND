import {useEffect} from "react";
import {useCurrentFrame} from "remotion";

import type {FrameMapEntry} from "./types";

export const useDirectFrameStyles = (
  containerRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
  sharpRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>,
  blurredRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>,
  frameData: FrameMapEntry[]
): void => {
  const frame = useCurrentFrame();

  useEffect(() => {
    frameData.forEach((node) => {
      const container = containerRefs.current.get(node.id);
      const sharp = sharpRefs.current.get(node.id);
      const blurred = blurredRefs.current.get(node.id);

      if (!container || !sharp || !blurred) {
        return;
      }

      container.style.transform = `translate3d(${node.x}px, ${node.y}px, 0) scale(${node.scale}) rotate(${node.rotation}deg)`;
      container.style.willChange = "transform";
      container.style.backfaceVisibility = "hidden";
      sharp.style.opacity = String(node.sharpOpacity);
      blurred.style.opacity = String(node.blurredOpacity);
    });
  }, [blurredRefs, containerRefs, frame, frameData, sharpRefs]);
};

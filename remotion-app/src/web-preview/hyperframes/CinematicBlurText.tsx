import React from "react";

import {useEngineDriver, type EngineDriverIntervalState} from "../../lib/render-graph";

type CinematicBlurTextProps = {
  text: string;
  engineState: Omit<EngineDriverIntervalState, "textLayer">;
};

export const CinematicBlurText = React.memo(({
  text,
  engineState
}: CinematicBlurTextProps) => {
  const sharpRef = React.useRef<HTMLSpanElement | null>(null);
  const blurredRef = React.useRef<HTMLSpanElement | null>(null);
  const sharpStyle = useEngineDriver(sharpRef, {
    ...engineState,
    textLayer: "sharp"
  });
  const blurredStyle = useEngineDriver(blurredRef, {
    ...engineState,
    textLayer: "blurred"
  });

  return (
    <div style={{position: "relative", width: "100%", height: "100%"}}>
      <span
        ref={sharpRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "translate3d(0,0,0)",
          willChange: "opacity",
          opacity: 0,
          ...sharpStyle
        }}
      >
        {text}
      </span>
      <span
        ref={blurredRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          filter: "blur(8px)",
          transform: "translate3d(0,0,0)",
          willChange: "opacity",
          opacity: 1,
          ...blurredStyle
        }}
      >
        {text}
      </span>
    </div>
  );
});

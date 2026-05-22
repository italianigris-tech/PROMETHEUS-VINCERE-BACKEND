import React from "react";

type CinematicBlurTextProps = {
  text: string;
  sharpRef: React.RefCallback<HTMLSpanElement>;
  blurredRef: React.RefCallback<HTMLSpanElement>;
};

export const CinematicBlurText = React.memo(({
  text,
  sharpRef,
  blurredRef
}: CinematicBlurTextProps) => {
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
          opacity: 0
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
          opacity: 1
        }}
      >
        {text}
      </span>
    </div>
  );
});

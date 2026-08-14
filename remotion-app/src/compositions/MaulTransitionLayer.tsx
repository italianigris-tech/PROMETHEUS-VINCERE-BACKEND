import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import type {MaulTransitionEvent} from "@prometheus/shared-types";

export const resolveMaulTransitionFrame = ({
  event,
  outputFrame,
  fps,
}: {
  event: MaulTransitionEvent;
  outputFrame: number;
  fps: number;
}) => {
  const elapsedMs = outputFrame / fps * 1000 - event.outputMs;
  if (elapsedMs < 0 || elapsedMs >= event.durationMs) {
    return {opacity: 0, translateXPercent: 0};
  }
  const progress = elapsedMs / event.durationMs;
  const opacity = event.intensity * (1 - progress) ** 2;
  const translateXPercent = event.kind === "whip_pan" ? -110 + progress * 220 : 0;
  return {opacity, translateXPercent};
};

export const MaulTransitionLayer = ({events}: {events: readonly MaulTransitionEvent[]}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill aria-hidden="true" style={{pointerEvents: "none"}}>
      {events.map((event) => {
        const state = resolveMaulTransitionFrame({event, outputFrame: frame, fps});
        if (state.opacity <= 0) return null;
        const background = event.kind === "light_flash"
          ? "linear-gradient(100deg, transparent 5%, #ffffff 42%, #fff5d6 55%, transparent 94%)"
          : event.kind === "dip_to_color"
            ? "#08090b"
            : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.88) 48%, transparent 100%)";
        return (
          <AbsoluteFill
            key={event.transitionId}
            data-maul-transition={event.kind}
            data-maul-transition-reason={event.reason}
            style={{
              opacity: state.opacity,
              background,
              transform: `translateX(${state.translateXPercent}%)`,
              mixBlendMode: event.kind === "dip_to_color" ? "normal" : "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

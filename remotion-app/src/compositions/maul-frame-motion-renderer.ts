import {
  evaluateMaulFrameMotion,
  type MaulFrameMotionProgram,
  type MaulFrameMotionTransform,
  type MaulTextAnimationProgram,
} from "@prometheus/shared-types";
import type {CSSProperties} from "react";

export type ResolvedMaulFrameMotion = {
  program: MaulTextAnimationProgram;
  frameMotion: MaulFrameMotionProgram;
  transform: MaulFrameMotionTransform;
};

const frameMotionProgramsForToken = (
  programs: readonly MaulTextAnimationProgram[],
  tokenId: string,
): MaulTextAnimationProgram[] => programs
  .filter((program) => (
    program.frameMotion !== undefined &&
    program.target.scope === "tokens" &&
    program.target.tokenIds.length === 1 &&
    program.target.tokenIds[0] === tokenId
  ))
  .sort((left, right) => (
    (left.frameMotion?.phases.entry.startFrame ?? 0) -
    (right.frameMotion?.phases.entry.startFrame ?? 0)
  ));

/** Selects the frame program for a token without reinterpreting treatment names. */
export const resolveMaulFrameMotionForToken = ({
  programs,
  tokenId,
  outputFrame,
}: {
  programs: readonly MaulTextAnimationProgram[];
  tokenId: string;
  outputFrame: number | undefined;
}): ResolvedMaulFrameMotion | null => {
  if (outputFrame === undefined) return null;
  const candidates = frameMotionProgramsForToken(programs, tokenId);
  if (candidates.length === 0) return null;
  const selected = candidates.find((program) => {
    const frameMotion = program.frameMotion!;
    return (
      outputFrame >= frameMotion.phases.entry.startFrame &&
      outputFrame <= frameMotion.phases.exit.endFrame
    );
  }) ?? candidates.find((program) => outputFrame < program.frameMotion!.phases.entry.startFrame)
    ?? candidates[candidates.length - 1]!;
  const frameMotion = selected.frameMotion!;
  return {
    program: selected,
    frameMotion,
    transform: evaluateMaulFrameMotion(frameMotion, outputFrame),
  };
};

export const maulFrameMotionStyle = (
  transform: MaulFrameMotionTransform,
  baseLetterSpacingEm = 0,
): CSSProperties => ({
  display: "inline-block",
  opacity: transform.opacity,
  transform: `translate3d(${transform.translateXPx}px, ${transform.translateYPx}px, 0) scale(${transform.scale}) rotate(${transform.rotationDeg}deg)`,
  transformOrigin: "left center",
  filter: transform.blurPx > 0 ? `blur(${transform.blurPx}px)` : undefined,
  clipPath: transform.clipProgress < 1
    ? `inset(0 ${((1 - transform.clipProgress) * 100).toFixed(3).replace(/\.000$/, "")}% 0 0)`
    : undefined,
  letterSpacing: `${(baseLetterSpacingEm + transform.trackingEm).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}em`,
  position: "relative",
});

export const maulLetterStaggerFrame = (
  outputFrame: number,
  letterIndex: number,
  variant: number,
): number => outputFrame - letterIndex * (1 + (variant % 3));

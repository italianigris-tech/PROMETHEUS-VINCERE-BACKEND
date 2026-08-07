// THROWAWAY PROTOTYPE: twelve MAUL SVG typography treatments in one 9:16 session.
import {loadFont} from "@remotion/fonts";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

import {SvgCaptionOverlayAtFrame} from "../components/SvgCaptionOverlay";
import {
  SVG_TYPOGRAPHY_LAYOUT_VARIANT,
  SVG_TYPOGRAPHY_PROFILE_ID,
  svgTypographyVariantsV1,
  toSvgTypographyMotionKey,
  toSvgTypographyStyleKey,
} from "../lib/stylebooks/svg-typography-v1";
import type {CaptionChunk, CaptionVerticalBias} from "../lib/types";

const FPS = 30;
const SUBJECT_ASSET = ".maul-prototypes/matted-lady.png";

if (typeof FontFace !== "undefined") {
  void Promise.all([
    loadFont({family: "Bebas Neue", url: staticFile("fonts/maul/bebas-neue-400.woff2"), weight: "400"}),
    loadFont({family: "Great Vibes", url: staticFile("fonts/maul/great-vibes-400.ttf"), weight: "400"}),
    loadFont({family: "Playfair Display", url: staticFile("fonts/maul/playfair-display-700.woff2"), weight: "700"}),
    loadFont({family: "DM Sans", url: staticFile("fonts/maul/dm-sans-700.woff2"), weight: "700"}),
    loadFont({family: "DM Serif Display", url: staticFile("fonts/maul/dm-serif-display-400.woff2"), weight: "400"}),
  ]);
}

type PrototypeBeat = {
  presetId: string;
  words: string[];
  depth: "behind" | "front";
  bias: CaptionVerticalBias;
  shiftX: number;
  shiftY: number;
  scale: number;
};

const BEATS: PrototypeBeat[] = [
  {presetId: "cinematic_text_preset", words: ["SPEED"], depth: "behind", bias: "top", shiftX: -70, shiftY: -70, scale: 1.12},
  {presetId: "cinematic_text_preset_1", words: ["EVERYTHING"], depth: "front", bias: "bottom", shiftX: 55, shiftY: 160, scale: 0.92},
  {presetId: "cinematic_text_preset_2", words: ["CLEAR", "STRATEGY"], depth: "front", bias: "top", shiftX: 150, shiftY: -70, scale: 0.88},
  {presetId: "cinematic_text_preset_3", words: ["RUNNING", "CIRCLES"], depth: "behind", bias: "middle", shiftX: -150, shiftY: 20, scale: 1.04},
  {presetId: "cinematic_text_preset_4", words: ["TRUE", "BUSINESS", "GROWTH"], depth: "front", bias: "bottom", shiftX: 20, shiftY: 155, scale: 0.86},
  {presetId: "cinematic_text_preset_5", words: ["WITH", "ABSOLUTE", "FOCUS"], depth: "front", bias: "middle", shiftX: 70, shiftY: 90, scale: 0.94},
  {presetId: "cinematic_text_preset_6", words: ["LOOK", "AT", "DATA"], depth: "front", bias: "top", shiftX: 155, shiftY: -45, scale: 0.85},
  {presetId: "cinematic_text_preset_7", words: ["DEEPEST", "PAIN", "POINTS"], depth: "behind", bias: "middle", shiftX: -110, shiftY: 20, scale: 1.02},
  {presetId: "cinematic_text_preset_8", words: ["ELIMINATE", "THE", "FRICTION"], depth: "front", bias: "bottom", shiftX: 30, shiftY: 170, scale: 0.88},
  {presetId: "cinematic_text_preset_9", words: ["ALIGN", "YOUR TEAM"], depth: "front", bias: "top", shiftX: 145, shiftY: -65, scale: 0.88},
  {presetId: "cinematic_text_preset_10", words: ["ONE", "SINGLE", "MASSIVE", "GOAL"], depth: "behind", bias: "middle", shiftX: -130, shiftY: 20, scale: 1.02},
  {presetId: "cinematic_text_preset_11", words: ["BUILD", "A", "SYSTEM"], depth: "front", bias: "bottom", shiftX: 35, shiftY: 165, scale: 0.9},
];

const variantById = new Map(svgTypographyVariantsV1.map((variant) => [variant.id, variant]));
const durationFramesFor = (beat: PrototypeBeat) => {
  const duration = variantById.get(beat.presetId)?.timingProfile.total_seconds ?? 2.4;
  return Math.ceil((duration + 0.18) * FPS);
};

export const MAUL_CINEMATIC_SVG_PROTOTYPE_DURATION = BEATS.reduce(
  (total, beat) => total + durationFramesFor(beat),
  0,
);

const chunkFor = (beat: PrototypeBeat, durationFrames: number): CaptionChunk => {
  const durationMs = (durationFrames / FPS) * 1000;
  const wordDurationMs = durationMs / beat.words.length;
  return {
    id: `prototype_${beat.presetId}`,
    text: beat.words.join(" "),
    startMs: 0,
    endMs: durationMs,
    words: beat.words.map((text, index) => ({
      text,
      startMs: index * wordDurationMs,
      endMs: (index + 1) * wordDurationMs,
      confidence: 1,
    })),
    styleKey: toSvgTypographyStyleKey(beat.presetId),
    motionKey: toSvgTypographyMotionKey(beat.presetId),
    layoutVariant: SVG_TYPOGRAPHY_LAYOUT_VARIANT,
    emphasisWordIndices: [beat.words.length - 1],
    profileId: SVG_TYPOGRAPHY_PROFILE_ID,
    semantic: {
      intent: "punch-emphasis",
      nameSpans: [],
      isVariation: true,
      suppressDefault: true,
    },
    suppressDefault: true,
  };
};

const TypographyBeat: React.FC<{beat: PrototypeBeat; durationFrames: number}> = ({beat, durationFrames}) => {
  const frame = useCurrentFrame();
  const chunk = chunkFor(beat, durationFrames);
  const settle = interpolate(frame, [0, 10], [0.96, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${beat.shiftX}px, ${beat.shiftY}px, 0) scale(${beat.scale * settle})`,
        transformOrigin: "center",
      }}
    >
      <SvgCaptionOverlayAtFrame
        chunks={[chunk]}
        frame={frame}
        fps={FPS}
        captionBias={beat.bias}
      />
    </AbsoluteFill>
  );
};

const AmbientStage: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: "#090d12"}}>
    <div style={{position: "absolute", left: 66, top: 250, width: 8, height: 930, backgroundColor: "#f06424", boxShadow: "0 0 54px 18px rgba(240,100,36,0.38)"}} />
    <div style={{position: "absolute", right: 74, top: 330, width: 5, height: 720, backgroundColor: "#00b7c7", boxShadow: "0 0 46px 16px rgba(0,183,199,0.24)"}} />
    <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 330, backgroundColor: "#05070a", opacity: 0.78}} />
  </AbsoluteFill>
);

const BeatScene: React.FC<{beat: PrototypeBeat; durationFrames: number}> = ({beat, durationFrames}) => {
  const frame = useCurrentFrame();
  const cameraScale = interpolate(frame, [0, durationFrames], [1.015, 1.055], {
    easing: Easing.bezier(0.45, 0, 0.55, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flashOpacity = interpolate(frame, [0, 2, 7], [0.22, 0.1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{overflow: "hidden"}}>
      <AmbientStage />
      {beat.depth === "behind" ? <TypographyBeat beat={beat} durationFrames={durationFrames} /> : null}
      <AbsoluteFill style={{transform: `scale(${cameraScale})`, transformOrigin: "50% 52%"}}>
        <Img
          src={staticFile(SUBJECT_ASSET)}
          style={{width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.06) saturate(0.92) brightness(0.96)"}}
        />
      </AbsoluteFill>
      {beat.depth === "front" ? <TypographyBeat beat={beat} durationFrames={durationFrames} /> : null}
      <AbsoluteFill style={{backgroundColor: "#f06424", opacity: flashOpacity, mixBlendMode: "screen"}} />
    </AbsoluteFill>
  );
};

export const MaulCinematicSvgPrototype: React.FC = () => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{backgroundColor: "#090d12"}}>
      {BEATS.map((beat) => {
        const durationFrames = durationFramesFor(beat);
        const from = cursor;
        cursor += durationFrames;
        return (
          <Sequence key={beat.presetId} from={from} durationInFrames={durationFrames}>
            <BeatScene beat={beat} durationFrames={durationFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

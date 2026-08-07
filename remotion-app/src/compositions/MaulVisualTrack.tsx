import React from "react";
import {Img, AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {Video} from "@remotion/media";
import type {MaulNormalizedBox, MaulVisualTrack as MaulVisualTrackContract} from "@prometheus/shared-types";

type MaulVisualInterval = MaulVisualTrackContract["intervals"][number];

const assetFor = (track: MaulVisualTrackContract, assetId: string | null) =>
  assetId ? track.assets.find((asset) => asset.assetId === assetId) ?? null : null;

const mediaStyle = (crop: MaulNormalizedBox): React.CSSProperties => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: `${(crop.x + crop.width / 2) * 100}% ${(crop.y + crop.height / 2) * 100}%`,
  transform: `scale(${Math.max(1 / crop.width, 1 / crop.height)})`,
  transformOrigin: `${(crop.x + crop.width / 2) * 100}% ${(crop.y + crop.height / 2) * 100}%`,
});

const sourceUrl = (storagePath: string) => staticFile(storagePath);

export const buildMaulVisualSequenceDurations = (
  track: Pick<MaulVisualTrackContract, "intervals">,
  fps: number,
) =>
  track.intervals.map((interval) => ({
    from: Math.round((interval.outputStartMs / 1000) * fps),
    durationInFrames: Math.max(
      1,
      Math.round(((interval.outputEndMs - interval.outputStartMs) / 1000) * fps),
    ),
  }));

const transitionOpacity = ({
  interval,
  outputFrame,
  fps,
  from,
}: {
  interval: MaulVisualInterval;
  outputFrame: number;
  fps: number;
  from: number;
}) => {
  if (interval.transition.type === "hard_cut" || interval.transition.durationMs === 0) return 1;
  const durationFrames = Math.max(1, Math.round((interval.transition.durationMs / 1000) * fps));
  return interpolate(outputFrame - from, [0, durationFrames], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

const sourceTiming = (interval: MaulVisualInterval, fps: number) => {
  if (interval.sourceStartMs === null || interval.sourceEndMs === null) {
    return {};
  }
  return {
    trimBefore: Math.round((interval.sourceStartMs / 1000) * fps),
    trimAfter: Math.round((interval.sourceEndMs / 1000) * fps),
    playbackRate:
      (interval.sourceEndMs - interval.sourceStartMs) /
      (interval.outputEndMs - interval.outputStartMs),
  };
};

const AssetVideo: React.FC<{
  src: string;
  crop: MaulNormalizedBox;
  timing?: ReturnType<typeof sourceTiming>;
}> = ({src, crop, timing = {}}) => (
  <Video
    src={sourceUrl(src)}
    muted
    {...timing}
    style={mediaStyle(crop)}
  />
);

export const MaulVisualInterval: React.FC<{
  track: MaulVisualTrackContract;
  interval: MaulVisualInterval;
  outputFrame: number;
  fps: number;
}> = ({track, interval, outputFrame, fps}) => {
  const primary = assetFor(track, interval.assetId);
  const secondary = assetFor(track, interval.secondaryAssetId);
  const from = Math.round((interval.outputStartMs / 1000) * fps);
  const opacity = transitionOpacity({interval, outputFrame, fps, from});
  const timing = sourceTiming(interval, fps);
  const baseStyle: React.CSSProperties = {
    opacity,
    transform: `scale(${interpolate(outputFrame - from, [0, Math.max(1, fps * 4)], [1, 1.018], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})})`,
    transformOrigin: "center center",
  };

  if (interval.mode === "split_proof") {
    return (
      <AbsoluteFill data-maul-visual-mode={interval.mode} style={baseStyle}>
        <div data-maul-split-region="speaker" style={{position: "absolute", left: 0, top: 0, width: "58%", height: "100%", overflow: "hidden"}}>
          {primary?.mediaKind === "video" ? <AssetVideo src={primary.storagePath} crop={interval.crop} timing={timing} /> : null}
        </div>
        <div data-maul-split-region="evidence" style={{position: "absolute", right: 0, top: 0, width: "42%", height: "100%", overflow: "hidden", background: "#101820"}}>
          {secondary?.mediaKind === "image" ? <Img src={sourceUrl(secondary.storagePath)} style={mediaStyle(interval.crop)} /> : null}
        </div>
      </AbsoluteFill>
    );
  }

  if (interval.mode === "editorial_graphic") {
    return (
      <AbsoluteFill data-maul-visual-mode={interval.mode} data-maul-visual-media="graphic" style={{...baseStyle, background: "#101820", padding: "180px 96px", justifyContent: "center"}}>
        <div style={{borderLeft: `12px solid ${interval.graphic?.accentColor ?? "#f06424"}`, paddingLeft: 36}}>
          <div data-maul-graphic-headline style={{color: "#fff8ea", fontSize: 88, fontWeight: 800, lineHeight: 0.98}}>{interval.graphic?.headline}</div>
          <div style={{color: "#d6e0e5", fontSize: 36, marginTop: 28, lineHeight: 1.15}}>{interval.graphic?.detail}</div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill data-maul-visual-mode={interval.mode} data-maul-visual-media={primary?.mediaKind ?? "video"} style={baseStyle}>
      {primary?.mediaKind === "image" ? (
        <Img src={sourceUrl(primary.storagePath)} style={mediaStyle(interval.crop)} />
      ) : primary?.mediaKind === "video" ? (
        <AssetVideo src={primary.storagePath} crop={interval.crop} timing={timing} />
      ) : null}
    </AbsoluteFill>
  );
};

export const MaulVisualTrack: React.FC<{track: MaulVisualTrackContract}> = ({track}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill data-maul-visual-track="v1">
      {track.intervals.map((interval) => {
        const from = Math.round((interval.outputStartMs / 1000) * fps);
        const durationInFrames = Math.max(1, Math.round(((interval.outputEndMs - interval.outputStartMs) / 1000) * fps));
        return (
          <Sequence key={interval.intervalId} from={from} durationInFrames={durationInFrames}>
            <MaulVisualInterval track={track} interval={interval} outputFrame={frame} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

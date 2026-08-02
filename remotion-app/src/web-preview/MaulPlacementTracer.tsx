import {Player} from "@remotion/player";
import React from "react";
import {AbsoluteFill, Html5Video, staticFile, useCurrentFrame} from "remotion";

import {MaulPlannedTextCard} from "../compositions/MaulPlannedTextLayer";
import {buildMaulPlannedSourceVideoStyle, buildMaulVisualStyle} from "../compositions/MaulShort";
import {toMaulPixelBox, type MaulPlannedTextRecord} from "../compositions/maul-short-manifest-adapter";
import {
  MAUL_PLACEMENT_TRACER_FIXTURES,
  resolveMaulPlacementTracerCropCenterX,
  type MaulPlacementTracerFixture,
} from "./sandbox-data";

const OUTPUT = {width: 1080, height: 1920, fps: 30} as const;
const DM_SANS_METRICS_FINGERPRINT =
  "ea9a1595e1927b2412901fad354e56a9f6eba61e9a98e7bc8769d2004fc52ee3";

export const buildMaulPlacementTracerRecord = (
  fixture: MaulPlacementTracerFixture,
): MaulPlannedTextRecord => {
  const words = fixture.text.split(" ");
  const tokens = words.map((text, index) => ({
    tokenId: `${fixture.probeId}_token_${index + 1}`,
    text,
    outputSpans: [{outputStartMs: 0, outputEndMs: 1000}],
  }));
  return {
    segmentId: `${fixture.probeId}_segment`,
    outputStartMs: 0,
    outputEndMs: 1000,
    boxPx: toMaulPixelBox(fixture.box, OUTPUT),
    family: fixture.family,
    variantId: fixture.variantId,
    fallbackCode: fixture.fallbackCode,
    fallbackReason: fixture.fallbackCode
      ? "Governed tracer fallback."
      : null,
    alignment: fixture.alignment,
    minimumLegibilityPrimitive: fixture.primitive,
    font: {
      profileId: "maul-compat-dm-sans-v1",
      metricsFingerprint: DM_SANS_METRICS_FINGERPRINT,
      family: "DM Sans",
      assetId: "font_google_dm_sans_700",
      weight: 700,
      fontSizePx: fixture.fontSizePx,
      lineHeight: 1.1,
      hierarchyScale: 1,
    },
    lines: [
      {
        lineId: `${fixture.probeId}_line_1`,
        text: fixture.text,
        tokens,
      },
    ],
  };
};

const MaulPlacementProbeComposition: React.FC<{
  fixture: MaulPlacementTracerFixture;
}> = ({fixture}) => {
  const frame = useCurrentFrame();
  const cropCenterX = resolveMaulPlacementTracerCropCenterX(frame);
  const crop = {
    x: cropCenterX - 0.2,
    y: 0,
    width: 0.4,
    height: 1,
  };
  const videoStyle = buildMaulPlannedSourceVideoStyle({
    crop,
    scale: {x: 1, y: 1},
  });
  const visualStyle = buildMaulVisualStyle(
    fixture.family === "editorial"
      ? "premium_direct_response"
      : fixture.family === "personal"
        ? "founder_podcast"
        : "minimal_expert",
  );
  return (
    <AbsoluteFill
      data-maul-tracer-canvas={fixture.probeId}
      data-crop-center-x={cropCenterX}
      style={{background: visualStyle.background, overflow: "hidden"}}
    >
      <Html5Video
        className="maul-tracer-video"
        data-maul-tracer-video={fixture.probeId}
        src={staticFile("test-video.mp4")}
        volume={0}
        pauseWhenBuffering={false}
        style={{position: "absolute", ...videoStyle}}
      />
      <AbsoluteFill
        style={{background: "rgba(0, 0, 0, 0.12)", pointerEvents: "none"}}
      />
      <MaulPlannedTextCard
        record={buildMaulPlacementTracerRecord(fixture)}
        absoluteTimeMs={(frame / OUTPUT.fps) * 1000}
        textColor={visualStyle.captionText}
        accentColor={visualStyle.captionAccent}
      />
    </AbsoluteFill>
  );
};

export const MaulPlacementTracer: React.FC = () => (
  <main
    data-maul-placement-tracer="true"
    style={{
      minHeight: "100vh",
      padding: 16,
      background: "#e7e8e4",
      color: "#17191b",
      fontFamily: '"DM Sans", system-ui, sans-serif',
    }}
  >
    <header
      style={{
        maxWidth: 1280,
        margin: "0 auto 14px",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: "2px solid #17191b",
        paddingBottom: 10,
      }}
    >
      <h1 style={{margin: 0, fontSize: 20, lineHeight: 1.2, letterSpacing: 0}}>
        MAUL Placement Tracer
      </h1>
      <code style={{fontSize: 12}}>1080 x 1920 / 30 fps</code>
    </header>
    <section
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      {MAUL_PLACEMENT_TRACER_FIXTURES.map((fixture) => (
        <article
          key={fixture.probeId}
          data-maul-placement-probe={fixture.probeId}
          data-expected-family={fixture.family}
          data-expected-fallback={fixture.fallbackCode ?? "none"}
          data-expected-box-x={fixture.box.x}
          data-expected-box-y={fixture.box.y}
          data-expected-box-width={fixture.box.width}
          data-expected-box-height={fixture.box.height}
          style={{
            minWidth: 0,
            padding: 8,
            border: "1px solid #a8aaa5",
            borderRadius: 6,
            background: "#f7f7f4",
          }}
        >
          <header
            style={{
              minHeight: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <strong style={{fontSize: 13}}>{fixture.probeId}</strong>
            <code style={{fontSize: 11, color: "#4e5559"}}>
              f{fixture.frame} / {fixture.family}
            </code>
          </header>
          <div
            data-maul-tracer-player-shell={fixture.probeId}
            style={{
              width: "100%",
              aspectRatio: "9 / 16",
              overflow: "hidden",
              borderRadius: 4,
              background: "#090b0d",
            }}
          >
            <Player
              component={MaulPlacementProbeComposition}
              inputProps={{fixture}}
              durationInFrames={30}
              initialFrame={fixture.frame}
              compositionWidth={OUTPUT.width}
              compositionHeight={OUTPUT.height}
              fps={OUTPUT.fps}
              controls={false}
              clickToPlay={false}
              style={{width: "100%", height: "100%"}}
              acknowledgeRemotionLicense
            />
          </div>
        </article>
      ))}
    </section>
  </main>
);

export default MaulPlacementTracer;

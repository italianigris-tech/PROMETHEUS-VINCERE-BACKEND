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

import {MaulTransitionLayer} from "./MaulTransitionLayer";

export const LUXURY_SHOWCASE_DURATION_IN_FRAMES = 360;
const SCENE_DURATION = 90;

if (typeof FontFace !== "undefined") {
  void Promise.all([
    loadFont({family: "Bebas Neue", url: staticFile("fonts/maul/bebas-neue-400.woff2"), weight: "400"}),
    loadFont({family: "DM Sans", url: staticFile("fonts/maul/dm-sans-700.woff2"), weight: "700"}),
    loadFont({family: "DM Serif Display", url: staticFile("fonts/maul/dm-serif-display-400.woff2"), weight: "400"}),
    loadFont({family: "Playfair Display", url: staticFile("fonts/maul/playfair-display-700.woff2"), weight: "700"}),
  ]);
}

export const LUXURY_SHOWCASE_SCENES = [
  {
    traitId: "trait_staggered_rotate_x",
    title: "DESIGNED TO MOVE",
    semanticRole: "hook",
    transitionBurn: false,
    asset: "showcase-assets/building-tall.png",
    font: {profileId: "maul-luxury-display-v1", family: "Bebas Neue", weights: [400, 700], letterSpacingEm: 0},
  },
  {
    traitId: "trait_hexta_ghost_typewriter",
    title: "Clarity becomes desire.",
    semanticRole: "proof",
    transitionBurn: true,
    asset: "showcase-assets/camera-rangefinder.png",
    font: {profileId: "maul-luxury-editorial-v1", family: "DM Sans", weights: [400, 700], letterSpacingEm: 0},
  },
  {
    traitId: "trait_vercel_yellow_pill",
    title: "PRECISION",
    semanticRole: "contrast",
    transitionBurn: false,
    asset: "showcase-assets/watch-luxury.png",
    font: {profileId: "maul-luxury-signal-v1", family: "DM Sans", weights: [400, 700], letterSpacingEm: 0},
  },
  {
    traitId: "trait_isometric_3d_stack",
    title: "BUILT TO LAST",
    semanticRole: "payoff",
    transitionBurn: true,
    asset: "showcase-assets/home-modern-exterior.png",
    font: {profileId: "maul-luxury-relic-v1", family: "Playfair Display", weights: [400, 700], letterSpacingEm: 0},
  },
] as const;

export const resolveLuxuryBurnOpacity = (frame: number, cutFrame: number): number => {
  const distance = Math.abs(frame - cutFrame);
  return distance > 6 ? 0 : 1 - distance / 6;
};

const easeOut = (frame: number, start: number, end: number): number => interpolate(
  frame,
  [start, end],
  [0, 1],
  {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  },
);

const SceneShell: React.FC<{
  asset: string;
  tint: string;
  children: React.ReactNode;
}> = ({asset, tint, children}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, SCENE_DURATION], [1.02, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{backgroundColor: "#090909", overflow: "hidden"}}>
      <Img
        src={staticFile(asset)}
        style={{width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`}}
      />
      <AbsoluteFill style={{backgroundColor: tint}} />
      <div style={{position: "absolute", inset: 40, border: "1px solid rgba(255,255,255,0.34)"}} />
      {children}
    </AbsoluteFill>
  );
};

const DiagonalCascade: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["DESIGNED", "TO", "MOVE"];
  let glyphOffset = 0;
  return (
    <SceneShell asset={LUXURY_SHOWCASE_SCENES[0].asset} tint="rgba(8,13,18,0.58)">
      <div style={{position: "absolute", left: 88, top: 220, color: "#D9E7E2", fontFamily: "DM Sans", fontSize: 26, fontWeight: 700, letterSpacing: 0}}>
        MOTION / 01
      </div>
      <div style={{position: "absolute", left: 84, top: 720, width: 900, perspective: 1000}}>
        {words.map((word, wordIndex) => {
          const startOffset = glyphOffset;
          glyphOffset += word.length;
          return (
            <div key={word} style={{height: 178, whiteSpace: "nowrap"}}>
              {Array.from(word).map((glyph, index) => {
                const progress = easeOut(frame, 4 + (startOffset + index) * 2, 24 + (startOffset + index) * 2);
                return (
                  <span
                    key={`${word}-${index}`}
                    style={{
                      display: "inline-block",
                      color: wordIndex === 1 ? "#F4C95D" : "#F7F4EC",
                      fontFamily: "Bebas Neue",
                      fontSize: wordIndex === 1 ? 122 : 164,
                      fontWeight: 400,
                      lineHeight: 1,
                      letterSpacing: 0,
                      opacity: progress,
                      filter: `blur(${(1 - progress) * 10}px)`,
                      transform: `translate3d(${(1 - progress) * (index + 1) * 8}px, ${(1 - progress) * 58}px, 0) rotateX(${(1 - progress) * -90}deg)`,
                      transformOrigin: "center bottom",
                    }}
                  >
                    {glyph}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};

const GlassTypewriter: React.FC = () => {
  const frame = useCurrentFrame();
  const source = LUXURY_SHOWCASE_SCENES[1].title;
  const visibleCount = Math.floor(interpolate(frame, [8, 58], [0, source.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  const cursorOpacity = frame % 16 < 10 ? 1 : 0.18;
  return (
    <SceneShell asset={LUXURY_SHOWCASE_SCENES[1].asset} tint="rgba(20,14,27,0.7)">
      <div style={{position: "absolute", left: 72, right: 72, top: 650, minHeight: 390, padding: "64px 58px", border: "1px solid rgba(230,218,255,0.48)", borderRadius: 8, backgroundColor: "rgba(28,20,38,0.72)", boxShadow: "0 28px 80px rgba(0,0,0,0.42)"}}>
        <div style={{position: "absolute", left: 58, top: 46, color: "rgba(222,208,244,0.12)", fontFamily: "DM Sans", fontSize: 74, fontWeight: 700, lineHeight: 1.1, letterSpacing: 0}}>
          {source}
        </div>
        <div style={{position: "relative", color: "#F8F4FF", fontFamily: "DM Sans", fontSize: 74, fontWeight: 700, lineHeight: 1.1, letterSpacing: 0}}>
          {source.slice(0, visibleCount)}
          <span style={{display: "inline-block", width: 5, height: 78, marginLeft: 7, verticalAlign: "-12px", backgroundColor: "#C9A9FF", boxShadow: "0 0 22px #C9A9FF", opacity: cursorOpacity}} />
        </div>
        <div style={{marginTop: 78, color: "#CDBFE0", fontFamily: "DM Serif Display", fontSize: 30, fontWeight: 400, letterSpacing: 0}}>
          MANIFOLD TYPE / FRAME-ADDRESSED CURSOR
        </div>
      </div>
    </SceneShell>
  );
};

const HighlightBox: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = easeOut(frame, 10, 34);
  const textProgress = easeOut(frame, 20, 42);
  return (
    <SceneShell asset={LUXURY_SHOWCASE_SCENES[2].asset} tint="rgba(8,9,9,0.56)">
      <div style={{position: "absolute", left: 88, top: 360, color: "#F2EFE8", fontFamily: "DM Serif Display", fontSize: 44, fontWeight: 400, letterSpacing: 0}}>
        Luxury is restraint,
      </div>
      <div style={{position: "absolute", left: 88, top: 760, width: 904, height: 190}}>
        <div style={{position: "absolute", inset: 0, backgroundColor: "#F4D35E", borderRadius: 4, transform: `scaleX(${progress})`, transformOrigin: "left center", boxShadow: "0 24px 70px rgba(0,0,0,0.38)"}} />
        <div style={{position: "relative", height: "100%", display: "flex", alignItems: "center", paddingLeft: 42, color: "#11120F", fontFamily: "DM Sans", fontSize: 126, fontWeight: 700, letterSpacing: 0, opacity: textProgress, clipPath: `inset(0 ${(1 - textProgress) * 100}% 0 0)`}}>
          PRECISION
        </div>
      </div>
      <div style={{position: "absolute", left: 90, top: 1002, color: "#F2EFE8", fontFamily: "DM Sans", fontSize: 30, fontWeight: 700, letterSpacing: 0}}>
        AND ONE DECISIVE SIGNAL.
      </div>
    </SceneShell>
  );
};

const RelicRiseStack: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = easeOut(frame, 6, 42);
  const serifOpacity = interpolate(frame, [20, 48], [0.82, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const displayOpacity = interpolate(frame, [24, 54], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return (
    <SceneShell asset={LUXURY_SHOWCASE_SCENES[3].asset} tint="rgba(24,8,10,0.62)">
      <div style={{position: "absolute", left: 78, right: 78, top: 660, height: 560, perspective: 1200}}>
        {[4, 3, 2, 1].map((depth, index) => (
          <div key={depth} style={{position: "absolute", left: 0, top: index * 48 + (1 - progress) * 90, color: `rgba(238,202,164,${0.12 + index * 0.1})`, fontFamily: "DM Serif Display", fontSize: 108, fontWeight: 400, lineHeight: 0.94, letterSpacing: 0, transform: `translateZ(${-depth * 28}px) translateX(${depth * 14}px) rotateX(${(1 - progress) * 18}deg)`, opacity: progress}}>
            BUILT TO LAST
          </div>
        ))}
        <div style={{position: "absolute", left: 0, top: 210, color: "#F6E9D8", fontFamily: "DM Serif Display", fontSize: 108, fontWeight: 400, lineHeight: 0.94, letterSpacing: 0, opacity: serifOpacity}}>
          BUILT TO LAST
        </div>
        <div style={{position: "absolute", left: 0, top: 210, color: "#FFF7EC", fontFamily: "Playfair Display", fontSize: 108, fontWeight: 700, lineHeight: 0.94, letterSpacing: 0, opacity: displayOpacity, textShadow: "0 18px 42px rgba(0,0,0,0.48)"}}>
          BUILT TO LAST
        </div>
        <div style={{position: "absolute", left: 2, top: 454, width: 260 * progress, height: 6, backgroundColor: "#D93B42"}} />
      </div>
    </SceneShell>
  );
};

const transitions = [
  {transitionId: "luxury_proof_burn", kind: "light_flash" as const, outputMs: 3_000, durationMs: 360, intensity: 0.82, reason: "proof semantic peak permits one restrained transition burn"},
  {transitionId: "luxury_payoff_burn", kind: "light_flash" as const, outputMs: 9_000, durationMs: 420, intensity: 0.82, reason: "payoff semantic peak permits final transition burn"},
];

export const MaulLuxuryTraitShowcase: React.FC = () => (
  <AbsoluteFill data-maul-luxury-showcase="kinetic-registry-v1">
    <Sequence from={0} durationInFrames={SCENE_DURATION}><DiagonalCascade /></Sequence>
    <Sequence from={90} durationInFrames={SCENE_DURATION}><GlassTypewriter /></Sequence>
    <Sequence from={180} durationInFrames={SCENE_DURATION}><HighlightBox /></Sequence>
    <Sequence from={270} durationInFrames={SCENE_DURATION}><RelicRiseStack /></Sequence>
    <MaulTransitionLayer events={transitions} />
  </AbsoluteFill>
);

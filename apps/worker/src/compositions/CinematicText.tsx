import React, {useEffect, useMemo, useRef} from "react";
import {Canvas} from "@react-three/fiber";
import type {RenderManifest} from "@prometheus/shared-types";
import {renderManifestSchema} from "@prometheus/shared-types";
import gsap from "gsap";
import {Audio, useCurrentFrame, useVideoConfig} from "remotion";

import {
  cameraProxy,
  resetGsapProxies,
  syncGsapProxiesToStore,
  textProxy
} from "../lib/gsap-proxy.js";
import {useFontPreload} from "../lib/font-preload.js";
import {Scene} from "../scenes/Scene.js";

export type CinematicTextProps = {
  manifest: RenderManifest;
};

export const CinematicText: React.FC<CinematicTextProps> = ({manifest: inputManifest}) => {
  const manifest = useMemo(() => renderManifestSchema.parse(inputManifest), [inputManifest]);
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const fontReady = useFontPreload({
    font: manifest.fontUrl,
    characters: manifest.transcript,
    sdfGlyphSize: 96
  });
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!fontReady) {
      return;
    }

    const durationSeconds = manifest.durationInFrames / manifest.fps;
    resetGsapProxies({cameraZ: manifest.camera.startZ});

    const timeline = gsap.timeline({
      paused: true,
      defaults: {overwrite: true},
      onUpdate: syncGsapProxiesToStore
    });

    timeline.to(cameraProxy, {
      z: manifest.camera.endZ,
      x: manifest.camera.parallaxStrength * 0.35,
      y: manifest.camera.parallaxStrength * 0.12,
      rotationZ: manifest.camera.parallaxStrength * 0.018,
      duration: durationSeconds,
      ease: "power2.inOut"
    }, 0);
    timeline.to(textProxy, {
      uProgress: 1,
      duration: durationSeconds * 0.68,
      ease: "power3.out",
      onUpdate: syncGsapProxiesToStore
    }, 0.16);

    timelineRef.current = timeline;
    timeline.seek(frame / manifest.fps, false);
    syncGsapProxiesToStore();

    return () => {
      timeline.kill();
      timelineRef.current = null;
    };
  }, [fontReady, manifest]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }
    timeline.seek(frame / manifest.fps, false);
    syncGsapProxiesToStore();
  }, [frame, manifest.fps]);

  if (!fontReady) {
    return <Audio src={manifest.audioUrl} />;
  }

  return (
    <>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{
          alpha: false,
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance"
        }}
        camera={{
          fov: manifest.camera.fov,
          aspect: config.width / config.height,
          near: 0.1,
          far: 100,
          position: [0, 0, manifest.camera.startZ]
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "block"
        }}
      >
        <Scene manifest={manifest} frame={frame} fps={config.fps} />
      </Canvas>
      <Audio src={manifest.audioUrl} />
    </>
  );
};

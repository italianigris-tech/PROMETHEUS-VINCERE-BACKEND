import {staticFile} from "remotion";
import type {RenderManifest} from "@prometheus/shared-types";
import {renderManifestSchema} from "@prometheus/shared-types";

export const regenerateSampleManifest: RenderManifest = renderManifestSchema.parse({
  jobId: "regenerate-sample",
  transcript: "REGENERATE",
  backgroundVideoUrl: staticFile("samples/regenerate-matte.webm"),
  rvmMatteUrl: staticFile("samples/regenerate-matte.webm"),
  matteUrl: staticFile("samples/regenerate-matte.webm"),
  audioUrl: staticFile("samples/regenerate-audio.m4a"),
  fontUrl: staticFile("fonts/Fraunces-Regular.ttf"),
  durationInFrames: 300,
  fps: 60,
  width: 1920,
  height: 1080,
  animationPreset: "cinematic",
  matteZ: 3,
  wordStagger: 0.1,
  extrudeDepth: 0.1,
  bevelEnabled: true,
  bevelSize: 0.02,
  bevelThickness: 0.02,
  gradientColors: ["#ffffff", "#7be8ff"],
  envMapIntensity: 0,
  cameraKeyframes: [
    {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
    {position: {x: 0, y: 0, z: 5}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
    {position: {x: 15, y: 5, z: 10}, lookAt: {x: 0, y: 0, z: 0}, roll: 0.2},
    {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0}
  ],
  autoRoll: true,
  autoRollIntensity: 0.3,
  matteSafeZone: {
    minX: -0.45,
    maxX: 0.45,
    minY: -0.4,
    maxY: 0.4
  },
  depthOfFieldEnabled: false,
  depthOfFieldFocusDistance: 10,
  depthOfFieldFalloff: 5,
  matte: {
    fps: 60,
    durationInFrames: 300,
    planeZ: 0,
    planeHeight: 9,
    premultipliedAlpha: true
  },
  camera: {
    startZ: 10,
    endZ: 5.2,
    parallaxStrength: 0.42,
    fov: 46
  },
  text: {
    color: "#f8fbff",
    emissive: "#7be8ff",
    size: 0.92,
    maxWidth: 9.2,
    lineHeight: 1.04,
    stagger: 0.58,
    revealSoftness: 0.18,
    depthTravel: 2.8,
    depthZ: -2.4,
    sdfGlyphSize: 96
  }
});

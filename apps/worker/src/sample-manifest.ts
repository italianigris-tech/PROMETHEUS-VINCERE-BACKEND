import {staticFile} from "remotion";
import type {RenderManifest} from "@prometheus/shared-types";
import {renderManifestSchema} from "@prometheus/shared-types";

export const regenerateSampleManifest: RenderManifest = renderManifestSchema.parse({
  jobId: "regenerate-sample",
  transcript: "REGENERATE",
  matteUrl: staticFile("samples/regenerate-matte.webm"),
  audioUrl: staticFile("samples/regenerate-audio.m4a"),
  fontUrl: staticFile("fonts/Fraunces_72pt-Black.ttf"),
  durationInFrames: 300,
  fps: 60,
  width: 1920,
  height: 1080,
  animationPreset: "cinematic",
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
    depthZ: -2.4
  }
});

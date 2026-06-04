import React from "react";
import type {RenderManifest} from "@prometheus/shared-types";

import {BackgroundVideoPlane} from "./BackgroundVideoPlane.js";
import {CameraRig} from "./CameraRig.js";
import {KineticText} from "./KineticText.js";
import {MattePlane} from "./MattePlane.js";
import {PostProcessing, shouldRenderPostProcessing} from "./post-processing.js";

export type SceneProps = {
  manifest: RenderManifest;
  frame: number;
  fps: number;
};

export const Scene: React.FC<SceneProps> = ({manifest, frame, fps}) => {
  void frame;
  void fps;
  const shouldPostProcess = shouldRenderPostProcessing(manifest);

  return (
    <>
      <CameraRig manifest={manifest} />
      <BackgroundVideoPlane src={manifest.backgroundVideoUrl} />
      <MattePlane url={manifest.rvmMatteUrl ?? manifest.matteUrl} matteZ={manifest.matteZ} />
      <KineticText manifest={manifest} />
      {shouldPostProcess && <PostProcessing manifest={manifest} />}
    </>
  );
};

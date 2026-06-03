import React from "react";
import {Composition} from "remotion";
import {z} from "zod";
import {renderManifestSchema} from "@prometheus/shared-types";

import {CinematicText} from "./compositions/CinematicText.js";
import {regenerateSampleManifest} from "./sample-manifest.js";

const cinematicTextPropsSchema = z.object({
  manifest: renderManifestSchema
});

export const PROMETHEUS_SAMPLE_COMPOSITION_ID = "PrometheusRegenerateSample";

export const Root: React.FC = () => (
  <Composition
    id={PROMETHEUS_SAMPLE_COMPOSITION_ID}
    component={CinematicText}
    schema={cinematicTextPropsSchema}
    width={regenerateSampleManifest.width}
    height={regenerateSampleManifest.height}
    fps={regenerateSampleManifest.fps}
    durationInFrames={regenerateSampleManifest.durationInFrames}
    defaultProps={{
      manifest: regenerateSampleManifest
    }}
    calculateMetadata={({props}) => ({
      width: props.manifest.width,
      height: props.manifest.height,
      fps: props.manifest.fps,
      durationInFrames: props.manifest.durationInFrames
    })}
  />
);

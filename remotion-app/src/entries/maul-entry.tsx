import React from "react";
import {Composition, registerRoot} from "remotion";

import {
  calculateMaulShortMetadata,
  MAUL_SHORT_DEFAULT_PROPS,
  MaulShort,
} from "../compositions/MaulShort";

export const MaulOnlyRoot: React.FC = () => (
  <Composition
    id="MaulShort"
    component={MaulShort}
    calculateMetadata={calculateMaulShortMetadata}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={MAUL_SHORT_DEFAULT_PROPS}
  />
);

registerRoot(MaulOnlyRoot);

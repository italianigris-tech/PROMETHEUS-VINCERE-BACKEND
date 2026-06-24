import React from 'react';
import {Composition, registerRoot} from 'remotion';

import {JosephEdit} from '../compositions/JosephEdit';
import {
  DEFAULT_JOSEPH_MANIFEST,
  JOSEPH_RENDER_FPS,
  JOSEPH_RENDER_HEIGHT,
  JOSEPH_RENDER_WIDTH,
} from '../compositions/joseph-default-manifest';

export const JosephComposition: React.FC<{manifest: typeof DEFAULT_JOSEPH_MANIFEST}> = ({manifest}) => (
  <JosephEdit manifest={manifest} />
);

export const JosephOnlyRoot: React.FC = () => (
  <Composition
    id="JosephEdit"
    component={JosephComposition}
    calculateMetadata={async ({props}) => {
      const manifest = props.manifest ?? DEFAULT_JOSEPH_MANIFEST;
      if (
        manifest.width !== JOSEPH_RENDER_WIDTH ||
        manifest.height !== JOSEPH_RENDER_HEIGHT ||
        manifest.output.width !== JOSEPH_RENDER_WIDTH ||
        manifest.output.height !== JOSEPH_RENDER_HEIGHT
      ) {
        throw new Error(`JosephEdit composition requires ${JOSEPH_RENDER_WIDTH}x${JOSEPH_RENDER_HEIGHT} manifest/output dimensions.`);
      }

      return {
        durationInFrames: manifest.durationFrames,
        fps: manifest.fps || JOSEPH_RENDER_FPS,
        width: JOSEPH_RENDER_WIDTH,
        height: JOSEPH_RENDER_HEIGHT,
        props: {manifest},
      };
    }}
    width={JOSEPH_RENDER_WIDTH}
    height={JOSEPH_RENDER_HEIGHT}
    fps={JOSEPH_RENDER_FPS}
    durationInFrames={DEFAULT_JOSEPH_MANIFEST.durationFrames}
    defaultProps={{manifest: DEFAULT_JOSEPH_MANIFEST}}
  />
);

registerRoot(JosephOnlyRoot);

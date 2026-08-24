import React from 'react';
import {Composition, registerRoot} from 'remotion';

import {JosephEdit} from '../compositions/JosephEdit';
import {JosephLandscapeEdit} from '../compositions/JosephLandscapeEdit';
import {
  DEFAULT_JOSEPH_MANIFEST,
  JOSEPH_RENDER_FPS,
  JOSEPH_RENDER_HEIGHT,
  JOSEPH_RENDER_WIDTH,
} from '../compositions/joseph-default-manifest';
import {
  DEFAULT_LANDSCAPE_MANIFEST,
  LANDSCAPE_RENDER_FPS,
  LANDSCAPE_RENDER_HEIGHT,
  LANDSCAPE_RENDER_WIDTH,
} from '../compositions/landscape-default-manifest';

/**
 * 9:16 portrait composition wrapper — reuses JosephEdit.
 */
export const JosephComposition: React.FC<{manifest: typeof DEFAULT_JOSEPH_MANIFEST}> = ({manifest}) => (
  <JosephEdit manifest={manifest} />
);

/**
 * 16:9 landscape composition wrapper — reuses JosephLandscapeEdit.
 */
export const JosephLandscapeComposition: React.FC<{
  manifest: typeof DEFAULT_LANDSCAPE_MANIFEST;
}> = ({manifest}) => <JosephLandscapeEdit manifest={manifest} />;

/**
 * Combined root that registers both portrait (JosephEdit) and landscape
 * (JosephLandscapeEdit) compositions. This is the single entry point for the
 * Remotion bundle so that Lambda + local worker can serve both from one site.
 */
export const LandscapeRoot: React.FC = () => (
  <>
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
          throw new Error(
            `JosephEdit composition requires ${JOSEPH_RENDER_WIDTH}x${JOSEPH_RENDER_HEIGHT} manifest/output dimensions.`,
          );
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
    <Composition
      id="JosephLandscapeEdit"
      component={JosephLandscapeComposition}
      calculateMetadata={async ({props}) => {
        const manifest = props.manifest ?? DEFAULT_LANDSCAPE_MANIFEST;
        if (
          manifest.width !== LANDSCAPE_RENDER_WIDTH ||
          manifest.height !== LANDSCAPE_RENDER_HEIGHT ||
          manifest.output.width !== LANDSCAPE_RENDER_WIDTH ||
          manifest.output.height !== LANDSCAPE_RENDER_HEIGHT
        ) {
          throw new Error(
            `JosephLandscapeEdit composition requires ${LANDSCAPE_RENDER_WIDTH}x${LANDSCAPE_RENDER_HEIGHT} manifest/output dimensions.`,
          );
        }
        return {
          durationInFrames: manifest.durationFrames,
          fps: manifest.fps || LANDSCAPE_RENDER_FPS,
          width: LANDSCAPE_RENDER_WIDTH,
          height: LANDSCAPE_RENDER_HEIGHT,
          props: {manifest},
        };
      }}
      width={LANDSCAPE_RENDER_WIDTH}
      height={LANDSCAPE_RENDER_HEIGHT}
      fps={LANDSCAPE_RENDER_FPS}
      durationInFrames={DEFAULT_LANDSCAPE_MANIFEST.durationFrames}
      defaultProps={{manifest: DEFAULT_LANDSCAPE_MANIFEST}}
    />
  </>
);

registerRoot(LandscapeRoot);
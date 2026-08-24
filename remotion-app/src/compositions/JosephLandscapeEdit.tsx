import React from 'react';
import type {UnifiedRenderManifest} from '@prometheus/shared-types';
import {JosephEdit} from './JosephEdit';

/**
 * 16:9 landscape twin of JosephEdit.
 *
 * JosephEdit is already a pure @react-three/fiber scene graph driven entirely
 * by UnifiedRenderManifest percentages (percentRectToViewport, percent-based
 * layout contracts), so nothing is portrait-locked: feeding it a 1920x1080
 * manifest with a 1920x1080 video config renders the identical treatment in
 * landscape. This thin wrapper exists as the named, registrable composition
 * (kept separate from JosephEdit so the 9:16 contract stays untouched).
 */
export const JosephLandscapeEdit: React.FC<{
  manifest: UnifiedRenderManifest;
  audioPreviewEnabled?: boolean;
}> = ({manifest, audioPreviewEnabled = false}) => (
  <JosephEdit manifest={manifest} audioPreviewEnabled={audioPreviewEnabled} />
);

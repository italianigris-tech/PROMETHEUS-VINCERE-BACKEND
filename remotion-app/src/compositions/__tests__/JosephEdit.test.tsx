import {describe, expect, it} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('JosephEdit Composition', () => {
  const filePath = path.resolve(__dirname, '../JosephEdit.tsx');
  const videoPlanePath = path.resolve(__dirname, '../VideoPlane.tsx');
  const josephEntryPath = path.resolve(__dirname, '../../entries/joseph-entry.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  const videoPlaneContent = fs.readFileSync(videoPlanePath, 'utf-8');

  it('uses Canvas from @react-three/fiber and Text from @react-three/drei', () => {
    expect(content).toContain("import {Canvas");
    expect(content).toContain("from '@react-three/fiber'");
    expect(content).toContain("import {Text} from '@react-three/drei'");
    expect(content).toContain('<Canvas');
    expect(content).toContain('<Text');
  });

  it('contains the required R3F architecture pieces', () => {
    expect(content).toContain('VideoPlane');
    expect(content).toContain('JosephPiPRig');
    expect(videoPlaneContent).toContain('THREE.VideoTexture');
    expect(content).toContain('const CameraRig');
    expect(content).toContain('const KineticText');
    expect(content).toContain('const ZoomBlurQuad');
    expect(content).toContain('new THREE.ShaderMaterial');
  });

  it('contains no DOM fallbacks inside the composition scene', () => {
    expect(content).not.toContain('<div');
    expect(content).not.toContain('</div>');
    expect(content).not.toContain('<span');
  });

  it('does not contain forbidden globals', () => {
    expect(content).not.toMatch(/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|gsap/i);
  });

  it('rejects local file video sources instead of allowing black renders', () => {
    expect(videoPlaneContent).toContain('VideoPlane cannot render local file');
    expect(videoPlaneContent).toContain('Use a browser-safe URL.');
    expect(videoPlaneContent).not.toContain("candidate.startsWith('file:///')");
  });

  it('converts root-relative public video URLs through Remotion staticFile', () => {
    expect(videoPlaneContent).toContain("import {staticFile");
    expect(videoPlaneContent).toContain("staticFile(candidate.replace");
    expect(videoPlaneContent).toContain("https?:");
  });

  it('previews the same source voice, DJ cue, ducking, fade, and SFX timings carried by the final manifest', () => {
    expect(content).toContain('const JosephAudioPreview');
    expect(content).toContain('manifest.source.videoUrl');
    expect(content).toContain('djPlan?.musicEvents.map');
    expect(content).toContain('event.browserUrl');
    expect(content).toContain('djPlan.duckingRegions');
    expect(content).toContain('event.fadeInSec');
    expect(content).toContain('event.fadeOutSec');
    expect(content).toContain('manifest.audio.sfx.map');
    expect(content).toContain('audioPreviewEnabled');
    expect(content).toContain('audioPreviewEnabled && <JosephAudioPreview manifest={manifest} />');
  });

  it('loads Joseph text font from manifest typography instead of only hard-coding Antenna', () => {
    expect(content).toContain('resolveTypographyRenderContract');
    expect(content).toContain('manifest.typography');
    expect(content).toContain('fontAssetUrl');
    expect(content).not.toContain('const FONT_URL =');
  });


  it('uses role-specific Joseph typography font assets for rendered text', () => {
    expect(content).toContain('roleStyle?.fontAssetUrl ?? typography.fontAssetUrl');
    expect(content).toContain('font={roleFontAssetUrl}');
  });

  it('preloads every typography font before conditional overlays can suspend mid-render', () => {
    expect(content).toContain('const TypographyFontPreloader');
    expect(content).toContain('<TypographyFontPreloader contract={typographyPreload} />');
    expect(content).toContain('characters={typographyPreload.characters}');
    expect(content).toContain('resolveTypographyPreloadContract');
  });

  it('keeps source video cover-cropped for vertical output instead of stretched', () => {
    expect(videoPlaneContent).toContain('calculateCoverTextureTransform');
    expect(videoPlaneContent).toContain('sourceAspect > outputAspect');
    expect(videoPlaneContent).toContain('texture.repeat.set');
    expect(videoPlaneContent).toContain('texture.offset.set');
    expect(videoPlaneContent).toContain('viewport.width');
    expect(videoPlaneContent).toContain('viewport.height');
    expect(videoPlaneContent).toContain('videoElement.play');
  });

  it('renders Joseph PiP from the manifest without DOM overlays', () => {
    expect(content).toContain('manifest.josephPiP');
    expect(content).toContain('PiPFrameChrome');
    expect(content).toContain('resolvePiPRenderContract');
    expect(content).toContain('JosephBackgroundRig');
    expect(videoPlaneContent).toContain('frameRect');
    expect(videoPlaneContent).toContain('percentRectToViewport');
  });

  it('wires the 2.5D PiP compositor to matte and camera-risk signals', () => {
    expect(content).toContain('resolveMatteRenderContract(manifest)');
    expect(content).toContain('cameraMoves={manifest.cameraMoves}');
    expect(content).toContain('matteContract={matteContract}');
    expect(content).toContain('PiPFailureTagMarkers');
    expect(content).toContain('contract.clearance.failureTags');
  });
  it('has a Joseph-only Remotion entry that registers no unrelated compositions', () => {
    const entryContent = fs.readFileSync(josephEntryPath, 'utf-8');
    expect(entryContent).toContain('registerRoot');
    expect(entryContent).toContain('JosephOnlyRoot');
    expect(entryContent).toContain('JosephComposition');
    expect(entryContent).not.toContain('FemaleCoachDeanGraziosi');
    expect(entryContent).not.toContain('ProjectScopedMotionComposition');
    expect(entryContent).not.toContain('CreativeAudioPreview');
  });
});

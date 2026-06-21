import {describe, expect, it} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('JosephEdit Composition', () => {
  const filePath = path.resolve(__dirname, '../JosephEdit.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('uses Canvas from @react-three/fiber and Text from @react-three/drei', () => {
    expect(content).toContain("import {Canvas");
    expect(content).toContain("from '@react-three/fiber'");
    expect(content).toContain("import {Text} from '@react-three/drei'");
    expect(content).toContain('<Canvas');
    expect(content).toContain('<Text');
  });

  it('contains the required R3F architecture pieces', () => {
    expect(content).toContain('const VideoPlane');
    expect(content).toContain('THREE.VideoTexture');
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
    expect(content).toContain('cannot render local file video sources');
    expect(content).toContain('Use MediaReference.browserUrl');
    expect(content).not.toContain("candidate.startsWith('file:///')");
  });
});

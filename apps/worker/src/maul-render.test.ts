import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';

import {describe, expect, it} from 'vitest';

const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'maul-render.ts');

describe('MAUL frame transport', () => {
  it('pipes ordered in-memory frame buffers into NVENC without a PNG frame directory', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain('onFrameBuffer');
    expect(source).toContain('image2pipe');
    expect(source).toContain("imageFormat: 'jpeg'");
    expect(source).toContain('jpegQuality: 95');
    expect(source).not.toContain("const framesDir =");
    expect(source).not.toContain("imageSequencePattern: 'frame-[frame].[ext]'");
  });

  it('supports bounded frame-range slices and direct FFmpeg audio assembly', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain("mode?: 'full' | 'video-slice' | 'audio-only'");
    expect(source).toContain('frameRange?: [number, number]');
    expect(source).toContain("videoEncoder?: 'h264_nvenc' | 'libx264'");
    expect(source).toContain("videoEncoder === 'h264_nvenc'");
    expect(source).toContain('frameRange,');
    expect(source).toContain("mode === 'video-slice'");
    expect(source).toContain("const concurrency = mode === 'video-slice'\n      ? 1");
    expect(source).toContain('renderMaulAudioWithFfmpeg');
    expect(source).toContain('timestampMap');
    expect(source).toContain('amix=inputs=');
    expect(source).not.toContain("concurrency: mode === 'audio-only' ? 8 : 1");
  });
});

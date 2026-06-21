import {execFileSync} from 'node:child_process';
import {mkdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = join(root, 'remotion-app', 'public', 'sfx');

const CUES = [
  'whoosh_fast',
  'whoosh_slow',
  'impact_deep',
  'impact_sharp',
  'riser_short',
  'sub_drop',
  'glitch_digital',
  'pop_text',
];

const toneFor = (cue, variant) => {
  const offset = variant * 23;
  switch (cue) {
    case 'whoosh_fast':
      return `anoisesrc=color=white:amplitude=0.18:d=0.32,afade=t=in:st=0:d=0.02,afade=t=out:st=0.22:d=0.1,highpass=f=${900 + offset},lowpass=f=${5200 + offset}`;
    case 'whoosh_slow':
      return `anoisesrc=color=pink:amplitude=0.16:d=0.55,afade=t=in:st=0:d=0.04,afade=t=out:st=0.38:d=0.17,highpass=f=${360 + offset},lowpass=f=${2600 + offset}`;
    case 'impact_deep':
      return `sine=frequency=${70 + variant * 8}:duration=0.42,afade=t=out:st=0.12:d=0.3,volume=0.9`;
    case 'impact_sharp':
      return `sine=frequency=${880 + variant * 60}:duration=0.18,afade=t=out:st=0.04:d=0.14,volume=0.35`;
    case 'riser_short':
      return `sine=frequency=${360 + variant * 20}:duration=0.6,asetrate=44100*1.28,aresample=44100,afade=t=in:st=0:d=0.08,afade=t=out:st=0.45:d=0.15,volume=0.35`;
    case 'sub_drop':
      return `sine=frequency=${115 - variant * 5}:duration=0.7,asetrate=44100*0.72,aresample=44100,afade=t=out:st=0.18:d=0.52,volume=0.9`;
    case 'glitch_digital':
      return `anoisesrc=color=white:amplitude=0.12:d=0.24,atempo=1.25,highpass=f=${1800 + offset},acrusher=level_in=1:level_out=0.28:bits=6:mode=log`;
    case 'pop_text':
      return `sine=frequency=${520 + variant * 90}:duration=0.16,afade=t=out:st=0.03:d=0.13,volume=0.35`;
    default:
      throw new Error(`Unknown cue: ${cue}`);
  }
};

mkdirSync(outputDir, {recursive: true});

for (const cue of CUES) {
  for (let variant = 1; variant <= 5; variant += 1) {
    const outputPath = join(outputDir, `${cue}_${variant}.mp3`);
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      toneFor(cue, variant),
      '-ac',
      '2',
      '-ar',
      '44100',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath,
    ], {stdio: 'inherit'});

    const size = statSync(outputPath).size;
    if (size <= 0) {
      throw new Error(`Generated empty SFX file: ${outputPath}`);
    }
    console.log(`${cue}_${variant}.mp3 ${size} bytes`);
  }
}

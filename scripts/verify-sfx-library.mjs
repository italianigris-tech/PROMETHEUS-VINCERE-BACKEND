import {statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sfxDir = join(root, 'remotion-app', 'public', 'sfx');

const cues = [
  'whoosh_fast',
  'whoosh_slow',
  'impact_deep',
  'impact_sharp',
  'riser_short',
  'sub_drop',
  'glitch_digital',
  'pop_text',
];

const failures = [];

for (const cue of cues) {
  for (let variant = 1; variant <= 5; variant += 1) {
    const filePath = join(sfxDir, `${cue}_${variant}.mp3`);
    try {
      const size = statSync(filePath).size;
      if (size <= 0) {
        failures.push(`${cue}_${variant}.mp3 is empty`);
      } else {
        console.log(`PASS ${cue}_${variant}.mp3 ${size} bytes`);
      }
    } catch (error) {
      failures.push(`${cue}_${variant}.mp3 missing: ${error.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error('SFX LIBRARY CHECK FAILED');
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log('SFX LIBRARY CHECK PASSED: 40 nonzero MP3 assets');

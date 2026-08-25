/**
 * MINI LANDSCAPE RUNS — TEST: LANDSCAPE-TO-UNIFIED BRIDGE
 *
 * Verifies that the landscape treatment manifest maps onto the locked
 * UnifiedRenderManifest contract consumed by the Joseph WebGL render spine.
 *
 * Run: npx tsx docs/mini_landscape_runs/tests/test_landscape_to_unified.ts
 */

import fs from 'node:fs';
import path from 'node:path';

import {UnifiedRenderManifestSchema} from '@prometheus/shared-types';

import {
  LANDSCAPE_CUES,
  landscapeTreatmentToUnifiedManifest,
  mapSfxFamilyToCue,
  variantForId,
} from '../landscape-to-unified.js';
import type {LandscapeTreatmentManifest} from '../types.js';

let passedChecks = 0;
let totalChecks = 0;
function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

const MANIFEST_PATH = path.resolve(path.join(__dirname, '..', 'out', 'landscape_treatment_manifest.json'));

console.log('=============================================');
console.log('LANDSCAPE-TO-UNIFIED BRIDGE TESTS');
console.log('=============================================');

assert(fs.existsSync(MANIFEST_PATH), `landscape treatment manifest exists at ${MANIFEST_PATH}`);

const input = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as LandscapeTreatmentManifest;
const output = landscapeTreatmentToUnifiedManifest(input);

// 1. Contract: output parses under the locked UnifiedRenderManifest schema.
const parsed = UnifiedRenderManifestSchema.safeParse(output);
assert(parsed.success, `output satisfies UnifiedRenderManifestSchema (${parsed.success ? 'ok' : JSON.stringify(parsed.error?.issues ?? '')})`);

// 2. Geometry + duration (landscape canvas, ~248.81s @ 30fps).
assert(output.width === 1920 && output.height === 1080, 'output is 1920x1080 (LANDSCAPE_CANVAS)');
assert(output.output.width === 1920 && output.output.height === 1080, 'output.output is 1920x1080');
assert(output.fps === 30, 'output fps is 30');
const expectedFrames = Math.round(input.silenceCut.outputDurationSec * 30);
assert(output.durationFrames === expectedFrames, `durationFrames ${output.durationFrames} === ${expectedFrames} (round(248.81*30))`);

// 3. SFX seam: every renderable family lands on a locked cue; every cue gets a
//    variant (corpus only ships `${cue}_N.mp3` files); omissions are dropped.
const renderableSfx = input.sfxCues.filter((c) => !c.intentionalOmission && c.family !== 'none');
assert(output.audio.sfx.length === renderableSfx.length, `sfx events ${output.audio.sfx.length} === renderable cues ${renderableSfx.length}`);
for (const sfx of output.audio.sfx) {
  assert(LANDSCAPE_CUES.includes(sfx.cue as (typeof LANDSCAPE_CUES)[number]), `sfx cue '${sfx.cue}' is in locked corpus`);
  assert(sfx.variant !== undefined && sfx.variant >= 1 && sfx.variant <= 5, `sfx ${sfx.id} has variant ${sfx.variant} (1..5)`);
  assert(Number.isFinite(sfx.triggerMs) && sfx.triggerMs >= 0, `sfx ${sfx.id} has finite triggerMs ${sfx.triggerMs}`);
}
const omissionIds = input.sfxCues.filter((c) => c.intentionalOmission || c.family === 'none').map((c) => c.id);
const omissionIdsInOutput = new Set(output.audio.sfx.map((s) => s.id.replace('landscape-sfx-', '')));
for (const id of omissionIds) {
  assert(!omissionIdsInOutput.has(id), `omission cue '${id}' (family none) is NOT in the mix`);
}
assert(output.audio.sfx.every((s, i, arr) => i === 0 || arr[i - 1]!.triggerMs <= s.triggerMs), 'sfx events are sorted by triggerMs');

// family->cue spot checks
const whoosh = input.sfxCues.find((c) => c.family === 'whoosh')!;
assert(mapSfxFamilyToCue(whoosh) === 'whoosh_slow', `whoosh(0.7s) -> whoosh_slow (got ${mapSfxFamilyToCue(whoosh)})`);
const impact = input.sfxCues.find((c) => c.family === 'impact')!;
assert(mapSfxFamilyToCue(impact) === 'impact_sharp', `impact(0.5s) -> impact_sharp (got ${mapSfxFamilyToCue(impact)})`);
const riser = input.sfxCues.find((c) => c.family === 'riser')!;
assert(mapSfxFamilyToCue(riser) === 'riser_short', `riser -> riser_short (got ${mapSfxFamilyToCue(riser)})`);
const click = input.sfxCues.find((c) => c.family === 'click')!;
assert(mapSfxFamilyToCue(click) === 'pop_text', `click -> pop_text (got ${mapSfxFamilyToCue(click)})`);
assert(variantForId('cue_4') >= 1 && variantForId('cue_4') <= 5, 'variantForId is deterministic in 1..5');


// 4. Camera moves: fatigue_relief + momentum_death are intentional no-camera
//    windows; everything else must map.
const noCameraMoves = new Set(['fatigue_relief', 'momentum_death']);
const expectedCameraCount = input.editMoves.filter((m) => !noCameraMoves.has(m.moveId)).length;
assert(output.cameraMoves.length === expectedCameraCount, `cameraMoves ${output.cameraMoves.length} === moves-with-camera ${expectedCameraCount}`);
for (const cam of output.cameraMoves) {
  assert(['push_in', 'dutch', 'shake'].includes(cam.type), `camera move type '${cam.type}' is valid`);
  assert(cam.startFrame >= 0 && cam.endFrame > cam.startFrame, `camera move frame window valid (${cam.startFrame}..${cam.endFrame})`);
}

// 5. Text overlays derive from typographyCueMoveIds only.
assert(output.textOverlays.length === input.typographyCueMoveIds.length, `textOverlays ${output.textOverlays.length} === typographyCueMoveIds ${input.typographyCueMoveIds.length}`);
for (const o of output.textOverlays) {
  assert(o.startFrame >= 0 && o.endFrame > o.startFrame, `text overlay ${o.text} has valid frame window`);
  assert(/^#[0-9A-Fa-f]{6}$/.test(o.color), `text overlay ${o.text} color ${o.color} is hex`);
}
assert(output.textOverlays.length > 0, 'generative dynamic text overlays generated');
assert(output.textOverlays.every((o) => o.text && o.text.trim().length > 0), 'every text overlay has dynamic copy');


// 6. Transitions: only non-'none' effects become frame windows.
const expectedTransitions = input.transitions.filter((t) => t.effectId !== 'none');
assert(output.transitions.length === expectedTransitions.length, `transitions ${output.transitions.length} === non-none treatments ${expectedTransitions.length}`);
for (const t of output.transitions) {
  assert(t.startFrame >= 0 && t.endFrame > t.startFrame, `transition window valid (${t.startFrame}..${t.endFrame})`);
}

// 7. Audio source is the real voice track (hum-free by construction).
const wavTrack = path.resolve(path.join(__dirname, '..', 'out', 'src_track.wav'));
if (fs.existsSync(wavTrack)) {
  assert(output.source.audioUrl === wavTrack, `source.audioUrl is the real voice track: ${output.source.audioUrl}`);
} else {
  assert(output.source.audioUrl === input.silenceCut.sourcePath, `fallback audioUrl is the silence-cut source (${output.source.audioUrl})`);
}
assert(output.audio.voiceVolumeDb === 0, 'voice stays at unity (real track, no synthesized hum)');
assert(output.audio.targetLufs === input.soundtrack.integratedTargetLufs, 'targetLufs matches soundtrack integrated target');

// 8. Timeline events are non-empty and time-ascending.
assert(output.timeline.length > 0, `timeline has ${output.timeline.length} events`);
const ms = (e: (typeof output.timeline)[number]) => ('atMs' in e ? (e as {atMs: number}).atMs : (e as {startMs: number}).startMs);
assert(output.timeline.every((e, i, arr) => i === 0 || ms(arr[i - 1]!) <= ms(e)), 'timeline events are sorted ascending by time');

// 9. Governance cross-check: typography cue rate stays under 0.7.
const sections = input.sections.length;
assert(input.typographyCueMoveIds.length / Math.max(1, sections) <= 0.7, `typography cue rate ${(input.typographyCueMoveIds.length / Math.max(1, sections)).toFixed(2)} <= 0.7`);

console.log('=============================================');
console.log(`BRIDGE TESTS: ${passedChecks}/${totalChecks} passed`);
console.log(`→ unified manifest at ${output.durationFrames} frames / ${output.fps}fps / ${output.width}x${output.height}`);
console.log(`→ ${output.audio.sfx.length} sfx · ${output.cameraMoves.length} camera moves · ${output.textOverlays.length} text overlays · ${output.transitions.length} transitions`);
console.log('=============================================');

if (passedChecks !== totalChecks) {
  process.exit(1);
}

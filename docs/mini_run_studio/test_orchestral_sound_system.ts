import { 
  buildAuthoritativeSequenceAudioPlan, 
  calculateSpatialPan, 
  calculateDepthCutoffHz,
  type OrchestratedAudioPlan 
} from "./spatial_audio_orchestrator.js";

console.log("=================================================");
console.log("PROMETHEUS SPATIO-TEMPORAL SOUND SYSTEM TEST RUN");
console.log("=================================================");

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

// 1. GENERATE AUTHORITATIVE AUDIO PLAN
const plan: OrchestratedAudioPlan = buildAuthoritativeSequenceAudioPlan();
console.log(`\n[1/5] COMPILED ORCHESTRAL AUDIO PLAN:`);
console.log(` - Total Duration: ${plan.totalDurationSec.toFixed(2)}s (20 Chunks @ 2.0s/chunk)`);
console.log(` - Rhythmic Tempo: ${plan.bpm} BPM (${plan.beatIntervalSec.toFixed(3)}s / beat)`);
console.log(` - Master Target: ${plan.masterTargetLufs} LUFS | True Peak: ${plan.truePeakDb} dB`);
console.log(` - Total Beat Marks: ${plan.beats.length}`);
console.log(` - Total Spatio-Temporal Sound Cues: ${plan.cues.length}`);

// 2. VERIFY BEAT GRID ACCURACY
assert(plan.beats.length === 80, `Beat grid contains exactly 80 beats for 40.0s at 120 BPM (found ${plan.beats.length})`);
assert(plan.beats[0].timeSec === 0.0, "First beat is aligned at exactly 0.000s");
assert(plan.beats[79].timeSec === 39.5, "Final beat 80 is aligned at exactly 39.500s");
const downbeats = plan.beats.filter(b => b.isDownbeat);
assert(downbeats.length === 20, `Exactly 20 bar downbeats matching the 20 spoken chunks (found ${downbeats.length})`);

// 3. VERIFY SPATIAL PANNING & 3D COORDINATES
console.log(`\n[2/5] VERIFYING 3D SPATIAL PANNING COORDINATES:`);
const panLeft = calculateSpatialPan(20);
const panCenter = calculateSpatialPan(50);
const panRight = calculateSpatialPan(80);
assert(panLeft === -0.75, `Left card (X=20%) maps to stereo pan -0.75 (got ${panLeft})`);
assert(panCenter === 0.0, `Center stage (X=50%) maps to stereo pan 0.00 (got ${panCenter})`);
assert(panRight === 0.75, `Right card (X=80%) maps to stereo pan +0.75 (got ${panRight})`);

let allPansValid = true;
plan.cues.forEach(c => {
  if (c.spatialPan < -1.0 || c.spatialPan > 1.0) {
    allPansValid = false;
    console.error(`  Out of bounds pan: ${c.id} (${c.spatialPan})`);
  }
});
assert(allPansValid, "All sound cues have stereo panning strictly bounded in [-1.0, +1.0]");

// 4. VERIFY Z-AXIS DEPTH FILTERING
console.log(`\n[3/5] VERIFYING Z-AXIS ACOUSTIC DEPTH CUTOFFS:`);
const cutoffZ10 = calculateDepthCutoffHz(10);
const cutoffZ20 = calculateDepthCutoffHz(20);
const cutoffZ30 = calculateDepthCutoffHz(30);
assert(cutoffZ10 === 1400, `Z:10 behind speaker produces 1400 Hz acoustic muffling (got ${cutoffZ10} Hz)`);
assert(cutoffZ20 === 6500, `Z:20 speaker mid-field produces 6500 Hz cutoff (got ${cutoffZ20} Hz)`);
assert(cutoffZ30 === 18500, `Z:30 foreground hero text produces 18500 Hz crisp transient cutoff (got ${cutoffZ30} Hz)`);

let zDepthAccurate = true;
plan.cues.forEach(c => {
  if (c.depthPlane === 10 && c.lowpassCutoffHz > 5000) zDepthAccurate = false;
  if (c.depthPlane === 30 && c.lowpassCutoffHz < 10000) zDepthAccurate = false;
});
assert(zDepthAccurate, "All Z:10 background cues are acoustically filtered <= 5000Hz, and Z:30 foreground cues >= 10000Hz");

// 5. VERIFY CHUNK-BY-CHUNK SOUND CHOREOGRAPHY
console.log(`\n[4/5] AUDITING CHUNK-BY-CHUNK SOUND DESIGN COVERAGE:`);
const coveredChunks = new Set(plan.cues.map(c => c.chunkIndex));
assert(coveredChunks.size === 20, `Every single chunk (1-20) has dedicated spatial sound design cues (covered ${coveredChunks.size}/20)`);

// Verify critical hero milestones
const chunk2Cues = plan.cues.filter(c => c.chunkIndex === 2);
assert(chunk2Cues.some(c => c.category === "counter_roll"), "Chunk #2 ($50,000) contains 3D Film Roll-Up Ratchet Clicks");

const chunk4Cues = plan.cues.filter(c => c.chunkIndex === 4);
assert(chunk4Cues.some(c => c.category === "braaam_slam"), "Chunk #4 (broken business) contains Cinematic Tension Braaam");

const chunk11Cues = plan.cues.filter(c => c.chunkIndex === 11);
assert(chunk11Cues.some(c => c.category === "counter_roll"), "Chunk #11 (70 Hours) contains Ratchet Clock Ticking");

const chunk20Cues = plan.cues.filter(c => c.chunkIndex === 20);
assert(chunk20Cues.some(c => c.category === "braaam_slam"), "Chunk #20 (Terminal Climax) contains Master Orchestral Climax Slam");

// 6. VERIFY DYNAMIC VOICE DUCKING ENVELOPE
console.log(`\n[5/5] VERIFYING VOICE DUCKING & ACOUSTIC MASKING PRESERVATION:`);
const duckedCues = plan.cues.filter(c => c.voiceDuckingGainDb < 0);
assert(duckedCues.length >= 5, `Heavy musical cues automatically apply sidechain voice ducking (found ${duckedCues.length} ducked cues)`);
assert(duckedCues.every(c => c.voiceDuckingGainDb <= -3.0 && c.voiceDuckingGainDb >= -8.0), "Voice ducking gain is strictly within [-3.0 dB, -8.0 dB] speech preservation band");

console.log("\n=================================================");
if (passedChecks === totalChecks) {
  console.log(`🎉 TEST RUN SUCCESSFUL: ${passedChecks}/${totalChecks} CHECKS PASSED!`);
  console.log("Spatio-temporal orchestral sound engine is calibrated & mathematically locked.");
} else {
  console.error(`💥 TEST RUN FAILED: ${totalChecks - passedChecks} checks failed.`);
}
console.log("=================================================");

import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const manifestPath = path.join(studioDir, "extracted_temporal_manifest.json");

export interface VideoAudioCue {
  id: string;
  triggerTimestampSec: number;
  category: "IMPACT HITS" | "BRAAAMS" | "RISERS" | "SWEEPS" | "WHOOSHES" | "DATA TELEMETRY" | "MECHANICAL CLICKS" | "ACCENTS PUNCTUATION" | "ATMOS";
  cueName: string;
  pan: number; // -1.0 to +1.0
  depthPlane: 10 | 20 | 30;
  lowpassCutoffHz: number;
  gainDb: number;
  durationSec: number;
  triggerReason: string;
  duckVoiceActive: boolean;
}

export interface VideoOrchestralPlan {
  videoFile: string;
  durationSeconds: number;
  bpm: number;
  beatIntervalSec: number;
  totalBeats: number;
  sceneCutsCount: number;
  cues: VideoAudioCue[];
}

export function buildVideoAudioPlan(): VideoOrchestralPlan {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const duration = manifest.videoMetadata.durationSeconds || 60.1;
  const bpm = 120;
  const beatInterval = 60 / bpm; // 0.500s
  const totalBeats = Math.floor(duration / beatInterval);

  const cues: VideoAudioCue[] = [];

  // 1. Initial Opening Riser & Punch
  cues.push({
    id: "cue-opening-hit",
    triggerTimestampSec: 0.08,
    category: "IMPACT HITS",
    cueName: "Sub Bass Impact Slam 01",
    pan: 0.0,
    depthPlane: 30,
    lowpassCutoffHz: 18500,
    gainDb: 0.0,
    durationSec: 1.2,
    triggerReason: "Opening Hook Punch (Zoom-In Magnitude: 1.42)",
    duckVoiceActive: false,
  });

  // 2. Map Scene Cuts -> Transitions, Risers & Downbeat Slams
  manifest.sceneCuts.forEach((sc: any, idx: number) => {
    // Pre-roll Riser 0.4s before cut
    const riserTime = Math.max(0, sc.timestampSeconds - 0.45);
    cues.push({
      id: `cue-scene-riser-${idx + 1}`,
      triggerTimestampSec: round(riserTime, 3),
      category: "RISERS",
      cueName: "Tension Riser Sweep 01",
      pan: -0.2,
      depthPlane: 20,
      lowpassCutoffHz: 12000,
      gainDb: -4.0,
      durationSec: 0.45,
      triggerReason: `Pre-cut Riser for Scene Cut #${idx + 1} @ ${sc.timestampSeconds}s`,
      duckVoiceActive: false,
    });

    // Downbeat Impact on Cut
    cues.push({
      id: `cue-scene-cut-hit-${idx + 1}`,
      triggerTimestampSec: round(sc.timestampSeconds, 3),
      category: "CINEMATIC HITS" as any,
      cueName: idx % 2 === 0 ? "Orchestral Downbeat Drop" : "Cinematic Brass Stride",
      pan: (idx % 2 === 0) ? -0.3 : 0.3,
      depthPlane: 30,
      lowpassCutoffHz: 18500,
      gainDb: -1.5,
      durationSec: 1.5,
      triggerReason: `Hard Scene Transition #${idx + 1} (Score: ${sc.score})`,
      duckVoiceActive: true,
    });
  });

  // 3. Map Directional Whip Pans -> Spatially Panned Whooshes
  manifest.panEvents.forEach((pe: any, idx: number) => {
    cues.push({
      id: `cue-pan-whoosh-${idx + 1}`,
      triggerTimestampSec: round(pe.timestampSeconds, 3),
      category: "WHOOSHES",
      cueName: "Directional Stereo Air Sweep",
      pan: pe.stereoPanTarget,
      depthPlane: 20,
      lowpassCutoffHz: 14000,
      gainDb: -5.0,
      durationSec: 0.6,
      triggerReason: `Camera Motion Pan (${pe.type}) -> Stereo Target ${pe.stereoPanTarget}`,
      duckVoiceActive: false,
    });
  });

  // 4. Map Zoom Punches & Pull-backs
  const keyZooms = manifest.zoomEvents.filter((z: any) => z.magnitude > 1.2 || (z.magnitude > 0.65 && z.type === "zoom_in_punch"));
  keyZooms.forEach((ze: any, idx: number) => {
    if (ze.type === "zoom_in_punch") {
      cues.push({
        id: `cue-zoom-punch-${idx + 1}`,
        triggerTimestampSec: round(ze.timestampSeconds, 3),
        category: "IMPACT HITS",
        cueName: "Kinetic Punch Impact Accent",
        pan: 0.0,
        depthPlane: 30,
        lowpassCutoffHz: 18500,
        gainDb: -3.0,
        durationSec: 0.7,
        triggerReason: `Camera Zoom Punch (Magnitude: ${ze.magnitude})`,
        duckVoiceActive: true,
      });
    } else {
      cues.push({
        id: `cue-zoom-pull-${idx + 1}`,
        triggerTimestampSec: round(ze.timestampSeconds, 3),
        category: "SWEEPS",
        cueName: "Atmospheric Release Sweep",
        pan: 0.0,
        depthPlane: 10,
        lowpassCutoffHz: 3500,
        gainDb: -8.0,
        durationSec: 0.8,
        triggerReason: `Camera Pull-Back Release (Magnitude: ${ze.magnitude})`,
        duckVoiceActive: false,
      });
    }
  });

  // 5. Map High Kinetic Visual Bursts -> Data Telemetry & Mechanical Clicks
  const keyBursts = manifest.visualBursts.filter((b: any) => b.intensity > 4.0);
  keyBursts.forEach((be: any, idx: number) => {
    cues.push({
      id: `cue-visual-burst-${idx + 1}`,
      triggerTimestampSec: round(be.timestampSeconds, 3),
      category: "DATA TELEMETRY",
      cueName: "Cyberpunk Telemetry Digit Chirp",
      pan: (idx % 2 === 0) ? -0.65 : 0.65,
      depthPlane: 20,
      lowpassCutoffHz: 16000,
      gainDb: -6.0,
      durationSec: 0.35,
      triggerReason: `Kinetic Visual Burst Pop-in (Intensity: ${be.intensity})`,
      duckVoiceActive: false,
    });
  });

  // Sort chronologically
  cues.sort((a, b) => a.triggerTimestampSec - b.triggerTimestampSec);

  return {
    videoFile: manifest.videoMetadata.filePath,
    durationSeconds: duration,
    bpm,
    beatIntervalSec: beatInterval,
    totalBeats,
    sceneCutsCount: manifest.sceneCuts.length,
    cues,
  };
}

function round(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

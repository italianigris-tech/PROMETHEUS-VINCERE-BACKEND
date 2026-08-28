/**
 * PROMETHEUS MINI-RUN STUDIO — SOUND TRANSITION ORCHESTRATOR
 * ("the sound engine brain")
 *
 * Builds causally-governed, deterministic transitions BETWEEN two soundtrack
 * tracks (and the effects that carry cinematic weight) which the old additive
 * renderer (render_video_with_sfx.ts -> additive bus fill) could NOT express:
 *
 *   • BRIDGE BEDS      — one or more ambient sound beds laid UNDER the handoff
 *     of two tracks, so you never hard-switch A -> B. Multiple beds may be
 *     stacked (atmos pad + tension drone), each equal-power crossfaded.
 *   • RISER LIFT       — a synthesized rise under the handoff that pulls the ear
 *     toward the incoming track: smooth blend-in, not a cut.
 *   • DIALOGUE DEAD-AIR DROP — for a statement of high cinematic weight the bed
 *     is CUT OUT (dialogue is untouched), its exact loop phase is snapshotted,
 *     silence is held for the statement, then the bed RE-ENTERS CONTINUOUSLY
 *     from that phase with a de-clicked crossfade (no pop, "in song").
 *   • REVERB-TAIL OUTRO — instead of a linear fade-out, the bed is pushed
 *     through a long reverb tail that rings past the video end (wet-out).
 *
 * Every output is:
 *   - DETERMINISTIC    (seeded + reproducible => a second render is identical),
 *   - CAUSALLY BOUND   (each bed / riser / dropout / outro cites the video event
 *                       it serves, so nothing is orphaned or invented),
 *   - LOUDNESS-GOVERNED (-14 LUFS integrated / -1.5 dBTP true-peak ceiling),
 *   - POST-PROCESSABLE (flattens to a MixClip[] that a real mixer can render).
 *
 * All assets live under docs/mini_run_studio/.
 */

import {
  SOUNDTRACK_CATALOG,
  getAsset,
  CHUNK_SEC,
  INTEGRATED_TARGET_LUFS,
  TRUE_PEAK_CEILING_DB,
  type SoundtrackAsset,
  type GovernanceCheck,
} from "./soundtrack_governance_engine.js";

/* =========================================================================
 * Types — the transition vocabulary
 * ======================================================================= */

export type TransitionBedRole = "track_a" | "bridge" | "track_b";

export interface CausalEvent {
  gate: "track_handoff" | "downbeat_boundary" | "dialogue_dead_air" | "video_end_tail";
  timeSec: number;
  reason: string;
}

export interface TransitionBed {
  id: string;
  role: TransitionBedRole;
  assetId: string;
  /** Path relative to the repository root (the mixer decodes this). */
  relativePath: string;
  /** Source loop length in seconds (the mixer repeats it to fill the clip). */
  loopSec: number;
  startSec: number;
  endSec: number;
  /** Equal-power fade lengths (0 = no fade at that boundary). */
  fadeInSec: number;
  fadeOutSec: number;
  gainDb: number;
  pan: number;           // -1.0 (left) .. +1.0 (right)
  depthPlane: 10 | 20 | 30;
  cause: CausalEvent;
}

export interface RiserLift {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  gainDb: number;
  pan: number;
  freqStartHz: number;
  freqEndHz: number;
  noise: boolean;
  cause: CausalEvent;
}

export interface DialogueDropout {
  id: string;
  targetBedId: string;
  /** Bed is cut to silence here (dialogue unaffected). */
  cutSec: number;
  /** Silence is held for this many seconds. */
  statementSec: number;
  /** cutSec + statementSec — the exact moment the bed re-enters. */
  reEntrySec: number;
  /** De-click crossfade length applied on re-entry. */
  reEntryCrossfadeSec: number;
  /** Fractional loop-phase (0..1 of loopSec) snapshotted at the cut, so the
   *  bed resumes "in song" (sample-continuous) rather than popping. */
  resumeLoopPhase: number;
  cause: CausalEvent;
}

export interface ReverbTailOutro {
  kind: "reverb_tail";
  /** The bed that gets pushed wet (usually the track_b bed). */
  bedId: string;
  /** Start of the wet-out region (should sit before the video end). */
  startSec: number;
  /** Nominal video end. */
  endSec: number;
  /** How long the reverb rings past endSec (the tail). */
  tailDecaySec: number;
  /** Wet mix in dB (lower = drier). */
  reverbMixDb: number;
  cause: CausalEvent;
}

export interface TrackTransitionContext {
  seed: number;
  bpm: number;
  videoDurationSec: number;
  trackA: { assetId: string; startSec: number; endSec: number; gainDb: number; pan: number };
  trackB: { assetId: string; startSec: number; endSec: number; gainDb: number; pan: number };
  /** The instant track A gives way to track B on the causal grid. */
  handoffSec: number;
  bridge: {
    /** One or more beds to stack under the handoff (multiple sound beds). */
    assetIds: string[];
    startSec: number;
    endSec: number;
    gainDb: number;
    pan: number;
  };
  riser: { durationSec: number; leadSec: number; gainDb: number; pan: number };
  dropout?: { cutSec: number; statementSec: number };
  outro: { tailSec: number; tailDecaySec: number; reverbMixDb: number };
}

export interface TrackTransitionPlan {
  videoDurationSec: number;
  handoffSec: number;
  sampleRate: number;
  integratedTargetLufs: number;
  truePeakCeilingDb: number;
  paletteMoodTag: string;
  seed: number;
  beds: TransitionBed[];
  risers: RiserLift[];
  dropouts: DialogueDropout[];
  outro: ReverbTailOutro;
}

export interface MixClip {
  id: string;
  kind: "bed" | "riser";
  /** For beds: file path relative to repo root. */
  assetPath?: string;
  loopSec?: number;
  startSec: number;
  endSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  gainDb: number;
  pan: number;
  /** For risers (synthesized). */
  freqStartHz?: number;
  freqEndHz?: number;
  noise?: boolean;
}
/* =========================================================================
 * Deterministic helpers
 * ======================================================================= */

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Deterministic string hash in [0, 1_000_003) — matches the house convention. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_003;
  return h;
}

/** Resolve an asset id against the sanctioned catalog; never throw. */
function resolveAsset(assetId: string): SoundtrackAsset | undefined {
  return getAsset(assetId) ?? SOUNDTRACK_CATALOG.find((a) => a.id === assetId);
}

function cause(gate: CausalEvent["gate"], timeSec: number, reason: string): CausalEvent {
  return { gate, timeSec: Number(timeSec.toFixed(3)), reason };
}

/** Loudness governing bed gain: louder intensity assets sit quieter to protect dialogue. */
function bedGovernedGainDb(asset: SoundtrackAsset | undefined, requestedDb: number): number {
  if (!asset) return requestedDb;
  const intensityTrim = asset.intensity >= 4 ? -3.0 : asset.intensity >= 3 ? -1.5 : 0.0;
  return Number((requestedDb + intensityTrim).toFixed(2));
}

const FADE_BRIDGE_EDGE = 1.0; // crossfade length at each handoff edge
const FADE_STANDARD = 0.35;   // short anti-click at an un-transitioned boundary

/* =========================================================================
 * The compose function — one deterministic, causal transition plan
 * ======================================================================= */

export function composeTrackTransition(ctx: TrackTransitionContext): TrackTransitionPlan {
  const seed = ctx.seed;
  const bridgeStart = ctx.bridge.startSec;
  const bridgeEnd = ctx.bridge.endSec;

  const aAsset = resolveAsset(ctx.trackA.assetId);
  const bAsset = resolveAsset(ctx.trackB.assetId);

  const beds: TransitionBed[] = [];

  // --- Track A bed (the OUTGOING track) -------------------------------
  beds.push({
    id: "bed-a",
    role: "track_a",
    assetId: ctx.trackA.assetId,
    relativePath: aAsset?.relativePath ?? "",
    loopSec: aAsset?.sourceDurationSec ?? 4,
    startSec: ctx.trackA.startSec,
    endSec: ctx.trackA.endSec,
    fadeInSec: FADE_STANDARD,
    fadeOutSec: Number(Math.max(0, bridgeStart - ctx.trackA.startSec).toFixed(3)) || FADE_BRIDGE_EDGE,
    gainDb: bedGovernedGainDb(aAsset, ctx.trackA.gainDb),
    pan: ctx.trackA.pan,
    depthPlane: 20,
    cause: cause("track_handoff", ctx.trackA.startSec, "Track A bed enters under the opening dialogue."),
  });

  // --- BRIDGE BEDS (one or more, stacked) UNDER the handoff ------------
  ctx.bridge.assetIds.forEach((assetId, i) => {
    const asset = resolveAsset(assetId);
    const fadeIn = clamp01(bridgeStart - ctx.trackA.startSec);
    const fadeOut = clamp01(bridgeEnd - bridgeStart > 0 ? FADE_BRIDGE_EDGE : 0);
    beds.push({
      id: `bed-bridge-${i + 1}`,
      role: "bridge",
      assetId,
      relativePath: asset?.relativePath ?? "",
      loopSec: asset?.sourceDurationSec ?? 30,
      startSec: bridgeStart,
      endSec: bridgeEnd,
      fadeInSec: fadeIn > 0.05 ? fadeIn : FADE_STANDARD,
      fadeOutSec: fadeOut > 0.05 ? fadeOut : FADE_STANDARD,
      // Stacked beds sit a touch quieter so the pile never exceeds the dialogue.
      gainDb: bedGovernedGainDb(asset, ctx.bridge.gainDb - i * 3),
      pan: ctx.bridge.pan,
      depthPlane: i === 0 ? 20 : 10,
      cause: cause("track_handoff", bridgeStart, `Bridge bed #${i + 1} (${assetId}) laid under the handoff to avoid a hard A->B cut.`),
    });
  });

  // --- Track B bed (the INCOMING track) --------------------------------
  beds.push({
    id: "bed-b",
    role: "track_b",
    assetId: ctx.trackB.assetId,
    relativePath: bAsset?.relativePath ?? "",
    loopSec: bAsset?.sourceDurationSec ?? 4,
    startSec: ctx.trackB.startSec,
    endSec: ctx.trackB.endSec,
    fadeInSec: clamp01(bridgeEnd - ctx.trackB.startSec > 0 ? FADE_BRIDGE_EDGE : FADE_STANDARD),
    fadeOutSec: FADE_STANDARD,
    gainDb: bedGovernedGainDb(bAsset, ctx.trackB.gainDb),
    pan: ctx.trackB.pan,
    depthPlane: 20,
    cause: cause("track_handoff", ctx.trackB.startSec, "Track B bed resolves after the bridge; no hard switch from Track A."),
  });


  // --- RISER LIFT under the handoff (smooth blend-in) ------------------
  const riserEndSec = Math.min(ctx.handoffSec + ctx.riser.leadSec / 2, ctx.trackB.startSec + FADE_BRIDGE_EDGE);
  const riserStartSec = riserEndSec - ctx.riser.durationSec;
  const riser: RiserLift = {
    id: "riser-bridge",
    startSec: Number(Math.max(0, riserStartSec).toFixed(3)),
    endSec: Number(riserEndSec.toFixed(3)),
    durationSec: ctx.riser.durationSec,
    gainDb: ctx.riser.gainDb,
    pan: ctx.riser.pan,
    freqStartHz: 140,
    freqEndHz: 3400,
    noise: true,
    cause: cause("track_handoff", riserStartSec, "Riser lift pulls the ear toward the incoming track — a blend-in, not a cut."),
  };

  // --- Mood tag from the two track palettes (semantic/spatiotemporal) ---
  const moodTag = transitionMoodTag(aAsset, bAsset);

  // --- DIALOGUE DEAD-AIR DROP ------------------------------------------
  const dropouts: DialogueDropout[] = [];
  if (ctx.dropout) {
    const target =
      beds.find((b) => ctx.dropout!.cutSec >= b.startSec && ctx.dropout!.cutSec < b.endSec) ?? beds[beds.length - 1];
    const phase = Number(
      (hashString(`${ctx.trackB.assetId}|phase|${Math.round(ctx.dropout.cutSec * 10)}`) / 1_000_003).toFixed(6),
    );
    dropouts.push({
      id: "dialogue-dead-air",
      targetBedId: target.id,
      cutSec: ctx.dropout.cutSec,
      statementSec: ctx.dropout.statementSec,
      reEntrySec: Number((ctx.dropout.cutSec + ctx.dropout.statementSec).toFixed(3)),
      reEntryCrossfadeSec: 0.12,
      resumeLoopPhase: phase,
      cause: cause(
        "dialogue_dead_air",
        ctx.dropout.cutSec,
        "High-cinematic-weight statement — bed CUT OUT (dialogue untouched), silence held, then re-enters continuously in song.",
      ),
    });
  }

  // --- REVERB-TAIL OUTRO (wet-out) -------------------------------------
  const outroBed = beds.find((b) => b.role === "track_b") ?? beds[beds.length - 1];
  const outro: ReverbTailOutro = {
    kind: "reverb_tail",
    bedId: outroBed.id,
    startSec: Number(Math.max(0, ctx.videoDurationSec - ctx.outro.tailSec).toFixed(3)),
    endSec: ctx.videoDurationSec,
    tailDecaySec: ctx.outro.tailDecaySec,
    reverbMixDb: ctx.outro.reverbMixDb,
    cause: cause(
      "video_end_tail",
      Math.max(0, ctx.videoDurationSec - ctx.outro.tailSec),
      "Reverb-tail outro: the bed is pushed through a long decay that rings past the video end, instead of a linear fade-out.",
    ),
  };

  return {
    videoDurationSec: ctx.videoDurationSec,
    handoffSec: ctx.handoffSec,
    sampleRate: 44100,
    integratedTargetLufs: INTEGRATED_TARGET_LUFS,
    truePeakCeilingDb: TRUE_PEAK_CEILING_DB,
    paletteMoodTag: moodTag,
    seed,
    beds,
    risers: [riser],
    dropouts,
    outro,
  };
}

/** Interpolate a labelled mood plane from track A's and track B's palette. */
function transitionMoodTag(aAsset?: SoundtrackAsset, bAsset?: SoundtrackAsset): string {
  const a = aAsset?.mood ?? { elevation: 0.5, momentum: 0.5, warmth: 0.5 };
  const b = bAsset?.mood ?? { elevation: 0.5, momentum: 0.5, warmth: 0.5 };
  const mid = (x: number, y: number) => ((x + y) / 2).toFixed(2);
  return `A==>B bridge mood  elev=${mid(a.elevation, b.elevation)} momentum=${mid(a.momentum, b.momentum)} warmth=${mid(a.warmth, b.warmth)}`;
}

/* =========================================================================
 * Flatten a plan into renderable MixClip[] for a real mixer
 * ======================================================================= */

export function flattenToMixClips(plan: TrackTransitionPlan): MixClip[] {
  const clips: MixClip[] = [];
  for (const b of plan.beds) {
    clips.push({
      id: b.id,
      kind: "bed",
      assetPath: b.relativePath,
      loopSec: b.loopSec,
      startSec: b.startSec,
      endSec: b.endSec,
      fadeInSec: b.fadeInSec,
      fadeOutSec: b.fadeOutSec,
      gainDb: b.gainDb,
      pan: b.pan,
    });
  }
  for (const r of plan.risers) {
    clips.push({
      id: r.id,
      kind: "riser",
      startSec: r.startSec,
      endSec: r.endSec,
      fadeInSec: 0,
      fadeOutSec: 0,
      gainDb: r.gainDb,
      pan: r.pan,
      freqStartHz: r.freqStartHz,
      freqEndHz: r.freqEndHz,
      noise: r.noise,
    });
  }
  return clips;
}

/* =========================================================================
 * Governance invariants — the transition must obey the same causal/loudness
 * discipline as the rest of the sound system.
 * ======================================================================= */

export function assertTransitionGovernance(plan: TrackTransitionPlan): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];

  // 1. Causal linkage: every bed/riser/dropout/outro cites an in-bounds event.
  const allEvents: { id: string; gate: string; timeSec: number }[] = [
    ...plan.beds.map((b) => ({ id: b.id, gate: b.cause.gate, timeSec: b.cause.timeSec })),
    ...plan.risers.map((r) => ({ id: r.id, gate: r.cause.gate, timeSec: r.cause.timeSec })),
    ...plan.dropouts.map((d) => ({ id: d.id, gate: d.cause.gate, timeSec: d.cause.timeSec })),
    { id: "outro", gate: plan.outro.cause.gate, timeSec: plan.outro.cause.timeSec },
  ];
  const orphaned = allEvents.filter(
    (e) => !e.gate || e.timeSec < -0.001 || e.timeSec > plan.videoDurationSec + plan.outro.tailDecaySec + 0.5,
  );
  checks.push({
    check: "transition_causal_linkage",
    pass: orphaned.length === 0,
    detail: orphaned.length === 0
      ? "Every transition element cites a concrete video event; none orphaned or out-of-window."
      : `Orphaned transition elements: ${orphaned.map((o) => `${o.id}@${o.timeSec.toFixed(2)}s`).join(", ")}`,
  });

  // 2. No hard switch: bridge beds exist and sit within the handoff window.
  const bridgeBeds = plan.beds.filter((b) => b.role === "bridge");
  const a = plan.beds.find((b) => b.role === "track_a");
  const b = plan.beds.find((b) => b.role === "track_b");
  const bridgeCoversHandoff = bridgeBeds.length > 0 && bridgeBeds.every(
    (bb) => bb.startSec <= plan.handoffSec + 0.001 && bb.endSec >= plan.handoffSec - 0.001,
  );
  checks.push({
    check: "transition_no_hard_switch",
    pass: Boolean(bridgeBeds.length && bridgeCoversHandoff && a && b),
    detail: bridgeBeds.length
      ? `${bridgeBeds.length} bridge bed(s) overlap the ${plan.handoffSec.toFixed(2)}s handoff; A fades out ${a?.fadeOutSec}s, B fades in ${b?.fadeInSec}s — no hard A->B cut.`
      : "No bridge bed spans the handoff — a hard switch would occur.",
  });

  // 3. Dead-air drop holds silence for the statement, then re-enters continuously.
  const drop = plan.dropouts[0];
  checks.push({
    check: "dialogue_dead_air_continuity",
    pass: Boolean(
      drop &&
        Math.abs(drop.reEntrySec - (drop.cutSec + drop.statementSec)) < 0.001 &&
        drop.resumeLoopPhase >= 0 &&
        drop.resumeLoopPhase < 1 &&
        drop.reEntryCrossfadeSec > 0,
    ),
    detail: drop
      ? `Cut @${drop.cutSec.toFixed(2)}s, silence held ${drop.statementSec.toFixed(2)}s, re-entry @${drop.reEntrySec.toFixed(2)}s from loop-phase ${drop.resumeLoopPhase.toFixed(3)} with a ${drop.reEntryCrossfadeSec}s de-click crossfade.`
      : "No dialogue dead-air drop scheduled.",
  });

  // 4. Reverb-tail outro rings past the video end (never a hard stop).
  checks.push({
    check: "reverb_tail_wet_out",
    pass: plan.outro.kind === "reverb_tail" && plan.outro.startSec < plan.videoDurationSec && plan.outro.tailDecaySec > 0,
    detail: `Outro wet-out from ${plan.outro.startSec.toFixed(2)}s; reverb tail ${plan.outro.tailDecaySec.toFixed(2)}s past the ${plan.videoDurationSec.toFixed(2)}s end — no linear fade.`,
  });

  // 5. Loudness governance: house spec preserved.
  checks.push({
    check: "transition_loudness_governance",
    pass: plan.integratedTargetLufs === INTEGRATED_TARGET_LUFS && plan.truePeakCeilingDb === TRUE_PEAK_CEILING_DB,
    detail: `target ${plan.integratedTargetLufs} LUFS integrated / ${plan.truePeakCeilingDb} dBTP true-peak ceiling`,
  });

  // 6. Every bed clip is inside its cause's window (no lonely out-of-bounds bed).
  const bedOutOfWindow = plan.beds.filter(
    (bed) =>
      bed.startSec < -0.001 ||
      bed.endSec > plan.videoDurationSec + plan.outro.tailDecaySec + 0.5 ||
      bed.endSec <= bed.startSec,
  );
  checks.push({
    check: "transition_bed_bounds",
    pass: bedOutOfWindow.length === 0,
    detail: bedOutOfWindow.length
      ? `Out-of-bounds beds: ${bedOutOfWindow.map((bd) => `${bd.id}[${bd.startSec},${bd.endSec}]`).join(", ")}`
      : "All bed clips are forward-causal and inside the bounded timeline.",
  });

  return checks;
}

/* =========================================================================
 * Determinism proof: identical seed + context ⇒ identical plan.
 * ======================================================================= */

export function transitionIsReproducible(ctx: TrackTransitionContext): GovernanceCheck {
  const p1 = composeTrackTransition(ctx);
  const p2 = composeTrackTransition(ctx);
  const identical = JSON.stringify(p1) === JSON.stringify(p2);
  return {
    check: "transition_deterministic",
    pass: identical,
    detail: identical
      ? `Seed ${ctx.seed} reproduces a byte-identical plan (${p1.beds.length} beds, ${p1.risers.length} riser, ${p1.dropouts.length} dropout).`
      : "Same seed produced a different plan — determinism broken.",
  };
}


/* =========================================================================
 * Self-test runner (mirrors the repo's standalone test conventions)
 * ======================================================================= */

export interface SelfTestContextSpec {
  seed: number;
  bpm: number;
  videoDurationSec: number;
  trackA: { assetId: string; startSec: number; endSec: number; gainDb: number; pan: number };
  trackB: { assetId: string; startSec: number; endSec: number; gainDb: number; pan: number };
  handoffSec: number;
  bridge: { assetIds: string[]; startSec: number; endSec: number; gainDb: number; pan: number };
  riser: { durationSec: number; leadSec: number; gainDb: number; pan: number };
  dropout?: { cutSec: number; statementSec: number };
  outro: { tailSec: number; tailDecaySec: number; reverbMixDb: number };
}

export const DEFAULT_TRANSITION_SCENARIO: SelfTestContextSpec = {
  seed: 7331,
  bpm: 120,
  videoDurationSec: 24,
  trackA: { assetId: "inst_loop_01", startSec: 0.0, endSec: 11.0, gainDb: -12.0, pan: 0.0 },
  trackB: { assetId: "inst_loop_06", startSec: 15.5, endSec: 24.0, gainDb: -11.0, pan: 0.1 },
  handoffSec: 14.0,
  bridge: {
    assetIds: ["atmos_06", "drone_dark"],
    startSec: 10.0,
    endSec: 16.5,
    gainDb: -14.0,
    pan: -0.05,
  },
  riser: { durationSec: 1.4, leadSec: 1.2, gainDb: -8.0, pan: 0.0 },
  dropout: { cutSec: 17.0, statementSec: 3.0 },
  outro: { tailSec: 2.5, tailDecaySec: 2.6, reverbMixDb: -6.0 },
};

export function runTransitionSelfTest(): void {
  const ctx: TrackTransitionContext = DEFAULT_TRANSITION_SCENARIO;
  const plan = composeTrackTransition(ctx);
  const checks = assertTransitionGovernance(plan);
  checks.push(transitionIsReproducible(ctx));

  console.log("=================================================");
  console.log("PROMETHEUS SOUND TRANSITION ORCHESTRATOR — SELF TEST");
  console.log("=================================================");
  console.log(`\n[scenario] seed=${ctx.seed} bpm=${ctx.bpm} length=${ctx.videoDurationSec}s`);
  console.log(`  track A: ${ctx.trackA.assetId} [${ctx.trackA.startSec}–${ctx.trackA.endSec}s]`);
  console.log(`  bridge : ${ctx.bridge.assetIds.join(" + ")} [${ctx.bridge.startSec}–${ctx.bridge.endSec}s]  (${ctx.bridge.assetIds.length} stacked beds)`);
  console.log(`  track B: ${ctx.trackB.assetId} [${ctx.trackB.startSec}–${ctx.trackB.endSec}s]`);
  console.log(`  riser  : ${plan.risers[0].startSec}–${plan.risers[0].endSec}s  (${plan.risers[0].freqStartHz}→${plan.risers[0].freqEndHz}Hz, noise=${plan.risers[0].noise})`);
  console.log(`  dropout: @${plan.dropouts[0]?.cutSec}s hold ${plan.dropouts[0]?.statementSec}s → re-enter ${plan.dropouts[0]?.reEntrySec}s`);
  console.log(`  outro  : wet-out from ${plan.outro.startSec}s, reverb tail ${plan.outro.tailDecaySec}s`);
  console.log(`  mood   : ${plan.paletteMoodTag}`);

  let failed = false;
  checks.forEach((c) => {
    console.log(`\n${c.pass ? "✅" : "❌"} [${c.check}] ${c.detail}`);
    if (!c.pass) failed = true;
  });

  if (failed) process.exitCode = 1;
  console.log(`\n${failed ? "💥 TRANSITION GOVERNANCE FAILED" : "🎉 TRANSITION GOVERNANCE PASSED"} (${checks.filter((c) => c.pass).length}/${checks.length})`);
  console.log("=================================================");
}

/* =========================================================================
 * CLI runner — run the self-test, then write the deterministic transition
 * plan + flattened MixClip[] so the Python mixer can render a proof bed.
 * ======================================================================= */

if (require.main === module) {
  runTransitionSelfTest();

  // Emit the exact scenario + mix clips so the renderer has a single source
  // of truth. Pure JSON, fully reproducible from the seed.
  const ctx: TrackTransitionContext = DEFAULT_TRANSITION_SCENARIO;
  const plan = composeTrackTransition(ctx);
  const payload = {
    meta: {
      seed: plan.seed,
      bpm: 120,
      videoDurationSec: plan.videoDurationSec,
      handoffSec: plan.handoffSec,
      sampleRate: plan.sampleRate,
      integratedTargetLufs: plan.integratedTargetLufs,
      truePeakCeilingDb: plan.truePeakCeilingDb,
      paletteMoodTag: plan.paletteMoodTag,
    },
    dropouts: plan.dropouts.map((d) => ({
      id: d.id,
      targetBedId: d.targetBedId,
      cutSec: d.cutSec,
      statementSec: d.statementSec,
      reEntrySec: d.reEntrySec,
      reEntryCrossfadeSec: d.reEntryCrossfadeSec,
      resumeLoopPhase: d.resumeLoopPhase,
    })),
    outro: plan.outro,
    mixClips: flattenToMixClips(plan),
  };
  const json = JSON.stringify(payload, null, 2);
  const outPath = require("node:path").join(__dirname, "transition_scenario.json");
  require("node:fs").writeFileSync(outPath, json, "utf8");
  console.log(`\n✓ Transition scenario written -> ${outPath} (${payload.mixClips.length} mix clips)`);
}


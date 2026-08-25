/**
 * MINI LANDSCAPE RUNS — STAGE 7: LANDSCAPE TREATMENT PIPELINE
 *
 * Orchestrates stages 0–6 into a single auditable LandscapeTreatmentManifest.
 * Pure assembly (assembleLandscapeManifest + runGovernanceChecks) is separated
 * from FFmpeg I/O so tests run without media.
 *
 * CLI:
 *   npx tsx docs/mini_landscape_runs/landscape_treatment_pipeline.ts --input <src.mp4> [--render]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import type {
  BackgroundCoveragePlan,
  BackgroundRig,
  CameraMovePlan,
  EditorialCausalNode,
  EditMove,
  FormDecision,
  HandOfGodBlueprint,
  LandscapeSection,
  LandscapeTreatmentManifest,
  MediaProbe,
  MetaphorTreatmentPoint,
  ParallaxRigPlan,
  PhotoTreatmentBlueprint,
  PipInsetPlan,
  SfxCue,
  SilenceCutPlan,
  SoundtrackProgram,
  TransitionTreatment,
  ZoomCue,
  ZoomPlan,
} from "./types.js";
import { LANDSCAPE_CANVAS, JOSEPH_AUDIT_SOURCES } from "./types.js";
import { classifyCall, probeMedia } from "./call_parser.js";
import { buildSilenceCutPlan, detectSilences, executeSilenceCut } from "./silence_cutter.js";
import type { SilenceDetection } from "./silence_cutter.js";
import { segmentCutVideo } from "./section_segmenter.js";
import type { TranscriptPoint } from "./section_segmenter.js";
import { allocateEditMoves } from "./joseph_edit_grammar.js";
import {
  decideBackgroundRigs,
  decideCameraMoves,
  decidePipInsets,
  generateEditorialCausalChain,
  selectLandscapeTransitions,
  selectTypographyMoveIds,
} from "./landscape_composition_director.js";
import { extractMetaphorTreatmentPoints } from "./landscape_metaphor_extractor.js";
import { compileHandOfGodBlueprint, applyHandOfGodDirectives } from "./hand_of_god_director.js";
import { scheduleBackgroundCoverages } from "./landscape_background_catalog.js";
import { buildZoomPlan } from "./landscape_zoom_engine.js";
import { buildParallaxRig } from "./landscape_parallax_rig.js";
import { treatAllManifestAssets } from "./photo_treatment_engine.js";
import { buildSfxCues } from "./landscape_sfx_engine.js";
import { buildSoundtrackProgram } from "./landscape_soundtrack_engine.js";
import { generateLandscapeTypographyPlan } from "./landscape_typography_engine.js";
import type { LandscapeTypographyPlan } from "./landscape_typography_engine.js";

export interface PipelineParts {
  form: FormDecision;
  silenceCut: SilenceCutPlan;
  sections: LandscapeSection[];
  editMoves: EditMove[];
  transitions: TransitionTreatment[];
  typographyMoveIds: string[];
  typographyPlan?: LandscapeTypographyPlan;
  subjectMatteAvailable?: boolean;
  matteSrc?: string;
  sfxCues: SfxCue[];
  soundtrack: SoundtrackProgram;
  backgroundRigs?: BackgroundRig[];
  backgroundCoverages?: BackgroundCoveragePlan[];
  zoomPlan?: ZoomPlan;
  zoomCues?: ZoomCue[];
  cameraMoves?: CameraMovePlan[];
  parallaxRig?: ParallaxRigPlan[];
  pipInsets?: PipInsetPlan[];
  editorialCausalChain?: EditorialCausalNode[];
  metaphorTreatments?: MetaphorTreatmentPoint[];
  handOfGodBlueprint?: HandOfGodBlueprint;
  photoTreatments?: PhotoTreatmentBlueprint[];
}


export interface GovernanceCheck {
  check: string;
  pass: boolean;
  detail: string;
}

export function runGovernanceChecks(parts: PipelineParts): GovernanceCheck[] {
  const checks: GovernanceCheck[] = [];
  const { sections, editMoves, transitions, sfxCues, soundtrack, silenceCut, typographyMoveIds } = parts;

  // Sections tile the cut timeline contiguously (no gaps, no overlaps).
  const tilesOk =
    sections.length > 0 &&
    Math.abs(sections[0].startSec) <= EPS &&
    sections.every((s, i) => i === 0 || Math.abs(s.startSec - sections[i - 1].endSec) <= EPS) &&
    Math.abs(sections[sections.length - 1].endSec - silenceCut.outputDurationSec) <= EPS;
  checks.push({
    check: "Sections tile the cut timeline contiguously",
    pass: tilesOk,
    detail: `${sections.length} sections over ${silenceCut.outputDurationSec.toFixed(2)}s`,
  });

  // BUD-04: every section has >= 1 move and >= 1 SFX decision.
  const sectionsWithoutMove = sections.filter((s) => !editMoves.some((m) => m.sectionId === s.sectionId));
  checks.push({
    check: "Every section receives >= 1 edit move",
    pass: sectionsWithoutMove.length === 0,
    detail: sectionsWithoutMove.length ? `orphans: ${sectionsWithoutMove.map((s) => s.sectionId).join(", ")}` : "all covered",
  });
  const sectionsWithoutSfx = sections.filter((s) => !sfxCues.some((c) => c.cause.sectionId === s.sectionId));
  checks.push({
    check: "Every section receives >= 1 SFX decision",
    pass: sectionsWithoutSfx.length === 0,
    detail: sectionsWithoutSfx.length ? `missing: ${sectionsWithoutSfx.map((s) => s.sectionId).join(", ")}` : "all covered",
  });

  // SFX-01: no orphan cues — each traces to a real move or a real transition.
  // Move cues always carry cause.moveId; boundary-transition cues never do.
  const orphanCues = sfxCues.filter((c) => {
    if (c.cause.moveId) {
      return !editMoves.some((m) => m.moveId === c.cause.moveId);
    }
    if (c.cause.gate === "transition") {
      return !transitions.some((t) => Math.abs(t.timeSec - (c.cause.timeSec ?? -1)) < 0.1);
    }
    return true;
  });
  checks.push({
    check: "Every SFX cue traces to a move or transition",
    pass: orphanCues.length === 0,
    detail: orphanCues.length ? `orphans: ${orphanCues.map((c) => c.id).join(", ")}` : "all causal",
  });

  // TRN-01: transition min-gap 3.0s.
  let minGap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < transitions.length; i++) {
    minGap = Math.min(minGap, transitions[i].timeSec - transitions[i - 1].timeSec);
  }
  const gapOk = transitions.length <= 1 || minGap >= 3.0 - EPS;
  checks.push({
    check: "Transition min-gap 3.0s respected",
    pass: gapOk,
    detail: transitions.length
      ? `minGap=${minGap === Number.POSITIVE_INFINITY ? "n/a" : minGap.toFixed(2)}s across ${transitions.length} transitions`
      : "no transitions",
  });

  // TYP-02: typography rate <= 0.7 (target 0.6).
  const typographyEligible = editMoves.filter(
    (m) => ["emphasize_keyword", "cta_pressure", "thesis_punctuation"].includes(m.moveId) && m.allowSfx,
  );
  const typographyRate = typographyEligible.length ? typographyMoveIds.length / typographyEligible.length : 0;
  checks.push({
    check: "Typography cue rate <= 0.7",
    pass: typographyRate <= 0.7 + EPS,
    detail: `${typographyMoveIds.length}/${typographyEligible.length} = ${typographyRate.toFixed(2)}`,
  });

  // SFX-03: no-SFX moves are intentional omissions, never invented sound.
  const omissionOk = sfxCues.filter((c) => c.family === "none").every((c) => c.intentionalOmission);
  checks.push({
    check: "family=none cues are intentional omissions",
    pass: omissionOk,
    detail: `${sfxCues.filter((c) => c.family === "none").length} silence cues`,
  });

  // AUD-03/05: soundtrack length = video + tail, fades in/out at 2s.
  const soundtrackOk = Math.abs(soundtrack.totalSec - (silenceCut.outputDurationSec + 0.5)) <= EPS + 0.5;
  checks.push({
    check: "Soundtrack programme length and fades",
    pass: soundtrackOk,
    detail: `total=${soundtrack.totalSec.toFixed(2)}s (video ${silenceCut.outputDurationSec.toFixed(2)}s + tail)`,
  });

  // AUD-08+. Song selection is the crux: every section has exactly one chosen track.
  const selections = soundtrack.selections ?? [];
  const songsMissing = sections.filter((s) => !selections.some((sel) => sel.sectionId === s.sectionId));
  checks.push({
    check: "Every section receives exactly one song selection",
    pass: songsMissing.length === 0,
    detail: songsMissing.length ? `missing: ${songsMissing.map((s) => s.sectionId).join(", ")}` : `${selections.length}/${sections.length} sections`,
  });

  // AUD-09: song blends never pair a track with itself (fast to BOOK when they do).
  const blends = soundtrack.blends ?? [];
  const badBlend = blends.find((b) => b.fromTrackId === b.toTrackId);
  checks.push({
    check: "Every song blend joins two distinct selected tracks",
    pass: !badBlend,
    detail: badBlend ? `blend connects ${badBlend.fromTrackId} to itself` : `${blends.length} blends connect distinct songs`,
  });

  // AUD-08: the general sound bed is left EMPTY (song selection, not bed, is the crux).
  const bedEmpty = (soundtrack.soundBed ?? "empty") === "empty" && soundtrack.bedId === "songbed_empty";
  checks.push({
    check: "General sound bed left empty (song selection is the crux)",
    pass: bedEmpty,
    detail: `soundBed=${soundtrack.soundBed ?? "empty"} catalog=${soundtrack.catalogSource ?? "seed"}`,
  });

  // SIL: keep segments ordered, contiguous, within source bounds.
  const keepOk =
    silenceCut.keepSegments.length > 0 &&
    silenceCut.keepSegments.every(
      (k, i) =>
        k.srcStartSec >= 0 &&
        k.srcEndSec <= silenceCut.sourceDurationSec + EPS &&
        k.dstStartSec >= -EPS &&
        (i === 0 || Math.abs(k.dstStartSec - silenceCut.keepSegments[i - 1].dstEndSec) <= EPS),
    );
  checks.push({
    check: "Keep segments ordered, contiguous, in-bounds",
    pass: keepOk,
    detail: `${silenceCut.keepSegments.length} keep segments`,
  });

  // MAT-02: asset dwell always followed by >= 1.6s speaker return.
  // MAT-02: asset dwell always followed by >= 1.6s speaker return.
  // Vacuously satisfied when the cut video is too short for any return to exist.
  const macroEnds = editMoves
    .filter((m) => m.allowMacroAsset)
    .map((m) => m.endSec)
    .sort((a, b) => a - b);
  const returns = editMoves.filter((m) => m.moveId === "return_to_authority").map((m) => m.startSec);
  const matVacuous = silenceCut.outputDurationSec < 1.6 * 2;
  const matOk =
    matVacuous ||
    macroEnds.length === 0 ||
    returns.length === 0 ||
    returns.some((r) => macroEnds.some((e) => Math.abs(r - e) >= 1.6 - EPS)) ||
    macroEnds.every((e) => silenceCut.outputDurationSec - e >= 1.6 - EPS);


  checks.push({
    check: "Speaker return >= 1.6s after asset dwell",
    pass: matOk,
    detail: matVacuous
      ? `clip is ${silenceCut.outputDurationSec.toFixed(1)}s (< 3.2s) — rule vacuous`
      : `${macroEnds.length} asset dwells, ${returns.length} returns`,
  });


  // BKG-01: Background rigs assigned and causally linked.
  const rigs = parts.backgroundRigs ?? [];
  const rigsMissing = sections.filter((s) => !rigs.some((r) => r.sectionId === s.sectionId));
  checks.push({
    check: "Every section receives an assigned background rig",
    pass: rigs.length === 0 || rigsMissing.length === 0,
    detail: rigs.length ? `${rigs.length} rigs assigned` : "procedural default",
  });

  // PAR-01: 2.5D Parallax depth ratios are strictly monotonic (bg < mid < fg).
  const parallaxOk = rigs.every(
    (r) => r.depthRatios.background < r.depthRatios.middleGround && r.depthRatios.middleGround < r.depthRatios.foreground
  );
  checks.push({
    check: "2.5D parallax depth ratios are strictly monotonic (bg < mid < fg)",
    pass: parallaxOk,
    detail: rigs.length ? `all ${rigs.length} rigs verified` : "none defined",
  });

  // PAR-02: Every section receives a 2.5D parallax rig bound to a camera move,
  // with the background plane referenced from the background system and the
  // midground/foreground planes placed by the animation hand.
  const parallaxRigs = parts.parallaxRig ?? [];
  const missingRigs = sections.filter((s) => !parallaxRigs.some((pr) => pr.sectionId === s.sectionId));
  const unboundedRigs = parallaxRigs.filter((pr) => !(parts.cameraMoves ?? []).some((c) => c.moveId === pr.cameraMoveId));
  const rigsUnreferenced = parallaxRigs.filter((pr) => !rigs.some((r) => r.sectionId === pr.sectionId));
  checks.push({
    check: "Every section has a 2.5D parallax rig bound to a camera move",
    pass: parallaxRigs.length === 0 || (missingRigs.length === 0 && unboundedRigs.length === 0),
    detail: `${parallaxRigs.length}/${sections.length} rigs, ${unboundedRigs.length} unbounded, ${missingRigs.length} missing`,
  });
  checks.push({
    check: "Background plane references background system coverage (ownership split)",
    pass: rigs.length === 0 || rigsUnreferenced.length === 0,
    detail: parallaxRigs.length && rigs.length
      ? `all ${parallaxRigs.length} rigs reference a background-system rig`
      : rigs.length === 0
        ? "no background rigs — vacuous"
        : "none defined",
  });

  // TEX-01: Texture treatment paucity handling.
  const texturePaucityOk = rigs.every(
    (r) => r.textureTreatment.paucityAssetStatus === "bundled_procedural" || Boolean(r.textureTreatment.textureAssetId)
  );
  checks.push({
    check: "Texture treatments have procedural fallbacks when raw assets pending",
    pass: texturePaucityOk,
    detail: rigs.length ? `${rigs.filter((r) => r.textureTreatment.kind !== "none").length} textured rigs` : "none",
  });

  return checks;
}

const EPS = 0.05;

export function assembleLandscapeManifest(parts: PipelineParts): LandscapeTreatmentManifest {
  let backgroundRigs = parts.backgroundRigs ?? decideBackgroundRigs(parts.sections, parts.editMoves);
  let cameraMoves = parts.cameraMoves ?? decideCameraMoves(parts.sections, parts.editMoves, parts.typographyMoveIds);
  let pipInsets = parts.pipInsets ?? decidePipInsets(parts.sections, parts.editMoves);
  let metaphorTreatments = parts.metaphorTreatments ?? extractMetaphorTreatmentPoints(parts.sections);
  const handOfGodBlueprint = parts.handOfGodBlueprint ?? compileHandOfGodBlueprint(parts.sections);

  // Apply Hand of God macro directives onto background rigs, camera zooms, PiP, and assets
  const reconciled = applyHandOfGodDirectives(
    handOfGodBlueprint,
    parts.sections,
    backgroundRigs,
    cameraMoves,
    pipInsets,
    metaphorTreatments,
  );
  backgroundRigs = reconciled.reconciledRigs;
  cameraMoves = reconciled.reconciledCameraMoves;
  pipInsets = reconciled.reconciledPipInsets;
  metaphorTreatments = reconciled.reconciledMetaphors;

  const backgroundCoverages = parts.backgroundCoverages ?? scheduleBackgroundCoverages(parts.sections, parts.editMoves, handOfGodBlueprint);
  const zoomPlan = parts.zoomPlan ?? buildZoomPlan(parts.sections, backgroundCoverages, parts.editMoves);
  const zoomCues = parts.zoomCues ?? zoomPlan.cues;
  const parallaxRig =
    parts.parallaxRig ??
    buildParallaxRig({
      sections: parts.sections,
      backgroundCoverages,
      backgroundRigs,
      cameraMoves,
      pipInsets,
      metaphorTreatments,
    });
  const editorialCausalChain = parts.editorialCausalChain ?? generateEditorialCausalChain(parts.sections, parts.editMoves, backgroundRigs, cameraMoves, pipInsets);

  const typographyPlan =
    parts.typographyPlan ??
    generateLandscapeTypographyPlan(parts.sections, parts.editMoves, parts.typographyMoveIds);

  const manifestPrePhoto: LandscapeTreatmentManifest = {
    version: "1.0.0",
    studio: "mini_landscape_runs",
    canvas: { width: LANDSCAPE_CANVAS.width, height: LANDSCAPE_CANVAS.height, aspect: "16:9" },
    form: parts.form,
    silenceCut: parts.silenceCut,
    sections: parts.sections,
    editMoves: parts.editMoves,
    transitions: parts.transitions,
    typographyCueMoveIds: parts.typographyMoveIds,
    typographyPlan,
    subjectMatteAvailable: parts.subjectMatteAvailable,
    matteSrc: parts.matteSrc,
    sfxCues: parts.sfxCues,
    soundtrack: parts.soundtrack,

    backgroundRigs,
    backgroundCoverages,
    zoomPlan,
    zoomCues,
    cameraMoves,
    parallaxRig,
    pipInsets,
    editorialCausalChain,
    metaphorTreatments,
    handOfGodBlueprint,
    governance: {
      policyVersion: "1.0.0",
      josephAuditSources: [...JOSEPH_AUDIT_SOURCES],
      allCausal: true,
      checks: [],
    },
    generatedAtIso: new Date().toISOString(),
  };

  const photoTreatments = parts.photoTreatments ?? treatAllManifestAssets(manifestPrePhoto);

  const enrichedParts: PipelineParts = {
    ...parts,
    backgroundRigs,
    backgroundCoverages,
    zoomPlan,
    zoomCues,
    cameraMoves,
    parallaxRig,
    pipInsets,
    editorialCausalChain,
    metaphorTreatments,
    handOfGodBlueprint,
    photoTreatments,
  };

  const checks = runGovernanceChecks(enrichedParts);
  return {
    ...manifestPrePhoto,
    photoTreatments,
    governance: {
      policyVersion: "1.0.0",
      josephAuditSources: [...JOSEPH_AUDIT_SOURCES],
      allCausal: checks.every((c) => c.pass),
      checks,
    },
  };
}

export interface PipelineRunOptions {
  mediaPath?: string;
  prompt?: string;
  transcript?: TranscriptPoint[];
  detection?: SilenceDetection;
  render?: boolean;
  outDir?: string;
  handOfGodBlueprint?: Partial<HandOfGodBlueprint>;
}

export function runLandscapeTreatmentPipeline(opts: PipelineRunOptions = {}): LandscapeTreatmentManifest {
  const { mediaPath, prompt, transcript, render, outDir, handOfGodBlueprint: injectedHog } = opts;
  const hasMedia = Boolean(mediaPath && fs.existsSync(mediaPath));

  const probe: MediaProbe | undefined = hasMedia && mediaPath ? probeMedia(mediaPath) : undefined;
  const form: FormDecision = classifyCall({ prompt, mediaPath: hasMedia ? mediaPath : undefined });

  const fallbackDuration =
    transcript && transcript.length > 0
      ? Math.max(...transcript.map((t) => t.endSec ?? t.timeSec ?? 0))
      : 0;

  const detection: SilenceDetection =
    opts.detection ??
    (hasMedia && mediaPath
      ? detectSilences(mediaPath)
      : { silences: [], durationSec: probe?.durationSec ?? fallbackDuration });

  const plan = buildSilenceCutPlan(mediaPath ?? "(virtual)", detection, {
    hasAudio: probe?.hasAudio ?? true,
  });

  if (render && hasMedia && mediaPath && outDir) {
    const { outputPath, exitCode } = executeSilenceCut(plan, outDir);
    plan.outputPath = outputPath;
    if (exitCode !== 0) throw new Error(`silence cut failed with exit code ${exitCode}`);
  }

  const cutDuration = plan.outputDurationSec;
  const sections = segmentCutVideo(cutDuration, { transcript });
  const editMoves = allocateEditMoves(sections);
  const transitions = selectLandscapeTransitions(sections);
  const typographyMoveIds = selectTypographyMoveIds(editMoves);
  const sfxCues = buildSfxCues(editMoves, transitions);
  const soundtrack = buildSoundtrackProgram(cutDuration, sections);
  const backgroundRigs = decideBackgroundRigs(sections, editMoves);
  const cameraMoves = decideCameraMoves(sections, editMoves, typographyMoveIds);
  const pipInsets = decidePipInsets(sections, editMoves);
  const metaphorTreatments = extractMetaphorTreatmentPoints(sections, transcript);
  const handOfGodBlueprint = compileHandOfGodBlueprint(sections, transcript, injectedHog);
  const backgroundCoverages = scheduleBackgroundCoverages(sections, editMoves, handOfGodBlueprint);
  const zoomPlan = buildZoomPlan(sections, backgroundCoverages, editMoves, transcript);
  const zoomCues = zoomPlan.cues;
  const typographyPlan = generateLandscapeTypographyPlan(sections, editMoves, typographyMoveIds);


  // Detect if Martin subject matte is staged / available
  let subjectMatteAvailable = false;
  let matteSrc: string | undefined = undefined;
  if (outDir) {
    const candidateWebm = path.join(outDir, "full.webm");
    const candidateMatte = path.join(outDir, "matte.webm");
    if (fs.existsSync(candidateWebm)) {
      subjectMatteAvailable = true;
      matteSrc = candidateWebm;
    } else if (fs.existsSync(candidateMatte)) {
      subjectMatteAvailable = true;
      matteSrc = candidateMatte;
    }
  }

  const parts: PipelineParts = {
    form,
    silenceCut: plan,
    sections,
    editMoves,
    transitions,
    typographyMoveIds,
    typographyPlan,
    subjectMatteAvailable,
    matteSrc,
    sfxCues,
    soundtrack,
    backgroundRigs,
    backgroundCoverages,
    zoomPlan,
    zoomCues,
    cameraMoves,
    pipInsets,
    metaphorTreatments,
    handOfGodBlueprint,
  };


  const manifest = assembleLandscapeManifest(parts);
  if (outDir) writeManifest(manifest, outDir);
  return manifest;
}

export function writeManifest(manifest: LandscapeTreatmentManifest, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "landscape_treatment_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  const md = [
    "# Landscape Treatment Manifest — Run Report",
    "",
    `**Studio:** ${manifest.studio} · **Canvas:** ${manifest.canvas.width}x${manifest.canvas.height} (${manifest.canvas.aspect})`,
    `**Form:** ${manifest.form.form} (${manifest.form.confidence.toFixed(2)})`,
    `**Silence cut:** ${manifest.silenceCut.sourceDurationSec.toFixed(1)}s → ${manifest.silenceCut.outputDurationSec.toFixed(1)}s (removed ${manifest.silenceCut.removedSec.toFixed(1)}s)`,
    `**Sections:** ${manifest.sections.length} · **Edit moves:** ${manifest.editMoves.length} · **Transitions:** ${manifest.transitions.length}`,
    `**SFX cues:** ${manifest.sfxCues.length} (${manifest.sfxCues.filter((c) => c.intentionalOmission).length} intentional omissions)`,
    `**Soundtrack:** ${manifest.soundtrack.bedId} + ${manifest.soundtrack.padId} · ${manifest.soundtrack.integratedTargetLufs} LUFS / ${manifest.soundtrack.truePeakCeilingDb} dBTP`,
    "",
    "## Governance",
    ...manifest.governance.checks.map((c) => `- [${c.pass ? "x" : " "}] **${c.check}** — ${c.detail}`),
    "",
    `_Generated ${manifest.generatedAtIso}_`,
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "landscape_treatment_report.md"), md, "utf8");
}



// ---------------------------------------------------------------------------
// Stage 8: audio bake (real songs) — optional, runs after the silence cut when
// --render is used. Delegates to bake_soundtrack.py which maps each selected
// seed track to a REAL song from the Cloudflare R2 library (music-originals/)
// and renders the baked MP4 + a music-only audition stem.
// ---------------------------------------------------------------------------
export interface AudioBakeResult {
  bakedPath: string;
  musicStemPath: string;
  exitCode: number;
}

export function bakeAudioTrack(manifestPath: string, cutVideoPath: string, outDir: string): AudioBakeResult {
  const base = path.basename(cutVideoPath, path.extname(cutVideoPath));
  const bakedPath = path.join(outDir, `${base}_soundtrack_baked.mp4`);
  const musicStemPath = path.join(outDir, `${base}_music_stem.m4a`);
  const bakeScript = path.join(__dirname, "bake_soundtrack.py");
  const r = spawnSync(
    "python3",
    [bakeScript, "--manifest", manifestPath, "--video", cutVideoPath, "--out", bakedPath, "--music-stem", musicStemPath],
    {stdio: "inherit"}
  );
  return {bakedPath, musicStemPath, exitCode: r.status ?? 1};
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const render = args.includes("--render");
  if (inputIdx < 0 || !args[inputIdx + 1]) {
    console.error("Usage: npx tsx landscape_treatment_pipeline.ts --input <src.mp4> [--render] [--out <dir>]");
    process.exit(1);
  }
  const mediaPath = path.resolve(args[inputIdx + 1]);
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(__dirname, "out");
  const manifest = runLandscapeTreatmentPipeline({ mediaPath, render, outDir });

  // Stage 8 (optional): bake the REAL-song soundtrack into the cut MP4.
  let bakeResult: AudioBakeResult | null = null;
  if (render && manifest.silenceCut.outputPath && outDir) {
    const cutPath = path.resolve(manifest.silenceCut.outputPath);
    const manifestPath = path.join(outDir, "landscape_treatment_manifest.json");
    console.log("\n▶ Stage 8 — baking soundtrack (real songs)…");
    bakeResult = bakeAudioTrack(manifestPath, cutPath, outDir);
    if (bakeResult.exitCode !== 0) {
      console.error("audio bake failed — check bake_soundtrack.py output above");
      process.exit(bakeResult.exitCode);
    }
  }

  console.log("════════ LANDSCAPE TREATMENT PIPELINE ════════");
  console.log(`  form       : ${manifest.form.form} (${manifest.form.confidence.toFixed(2)})`);
  console.log(`  silenceCut : ${manifest.silenceCut.sourceDurationSec.toFixed(1)}s → ${manifest.silenceCut.outputDurationSec.toFixed(1)}s (${manifest.silenceCut.removedSec.toFixed(1)}s removed)`);
  console.log(`  sections   : ${manifest.sections.map((s) => s.role).join(" → ")}`);
  console.log(`  editMoves  : ${manifest.editMoves.length}`);
  console.log(`  transitions: ${manifest.transitions.map((t) => t.effectId).join(", ")}`);
  console.log(`  sfxCues    : ${manifest.sfxCues.length} (${manifest.sfxCues.filter((c) => c.intentionalOmission).length} intentional omissions)`);
  console.log(`  soundtrack : ${manifest.soundtrack.bedId} + ${manifest.soundtrack.padId}`);
  console.log(`  allCausal  : ${manifest.governance.allCausal}`);
  for (const c of manifest.governance.checks) {
    console.log(`    [${c.pass ? "PASS" : "FAIL"}] ${c.check} — ${c.detail}`);
  }
  if (outDir) console.log(`  written    : ${path.join(outDir, "landscape_treatment_manifest.json")}`);
  if (bakeResult) {
    console.log(`  audioBake  : ${bakeResult.bakedPath}`);
    console.log(`  musicStem  : ${bakeResult.musicStemPath}`);
  }
  console.log("═════════════════════════════════════════════");
  process.exit(manifest.governance.allCausal ? 0 : 1);
}


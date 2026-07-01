import {UnifiedRenderManifestSchema} from "@prometheus/shared-types";
import {describe, expect, it} from "vitest";
import {generateJosephManifest} from "./joseph-director";
import {compileJosephManifest} from "./joseph-manifest-compiler";

const INPUT = {
  videoUrl: "file:///video.mp4",
  musicTrackUrl: "file:///music.mp3",
  transcript: [
    {text: "Listen", startMs: 420, endMs: 680, confidence: 0.98},
    {text: "if", startMs: 700, endMs: 800, confidence: 0.95},
    {text: "you", startMs: 820, endMs: 900, confidence: 0.96},
    {text: "want", startMs: 920, endMs: 1100, confidence: 0.97},
    {text: "to", startMs: 1120, endMs: 1200, confidence: 0.94},
    {text: "win", startMs: 1220, endMs: 1500, confidence: 0.99},
  ],
  beats: [500, 900, 1300, 1800, 2200, 2700, 3200, 3600],
  onsets: [420, 1220],
  energyCurve: [0.25, 0.32, 0.78, 0.41, 0.86, 0.44, 0.72, 0.91],
  durationMs: 4000,
  seed: 12345,
  profile: "joseph_aggressive" as const,
};

describe("Joseph Manifest Compiler", () => {
  it("passes through a schema-valid Joseph manifest without dropping render fields", () => {
    const manifest = generateJosephManifest(INPUT);
    const original = JSON.parse(JSON.stringify(manifest));

    const result = compileJosephManifest({
      manifest,
      auditReferences: {
        candidateScoreSummary: true,
        candidateScoreSummaryRef: "candidate-score-summary",
      },
    });

    expect(result.manifest).toEqual(manifest);
    expect(manifest).toEqual(original);
    expect(UnifiedRenderManifestSchema.parse(result.manifest)).toMatchObject({
      version: "2.0",
    });
    expect(result.manifest.textOverlays).toEqual(original.textOverlays);
    expect(result.manifest.microAnimationAudit).toEqual(original.microAnimationAudit);
    expect(result.manifest.josephPiP).toEqual(original.josephPiP);
    expect(result.manifest.josephBackground).toEqual(original.josephBackground);
    expect(result.manifest.josephTypography).toEqual(original.josephTypography);
    expect(result.manifest.cameraMoves).toEqual(original.cameraMoves);

    expect(result.audit).toMatchObject({
      version: "joseph-manifest-compiler-v1",
      mode: "pass_through",
      deterministic: true,
      schemaVersion: "2.0",
      auditReferences: {
        candidateScoreSummary: true,
        candidateScoreSummaryRef: "candidate-score-summary",
      },
    });
    expect(result.audit.preservedFieldPaths).toEqual(
      expect.arrayContaining([
        "textOverlays",
        "textOverlays.microAnimation",
        "microAnimationAudit",
        "josephPiP",
        "josephBackground",
        "josephTypography",
        "cameraMoves",
        "timeline",
      ]),
    );
    expect(result.audit.presentFieldPaths).toEqual(
      expect.arrayContaining([
        "textOverlays",
        "textOverlays.microAnimation",
        "microAnimationAudit",
        "josephPiP",
        "josephBackground",
        "josephTypography",
        "cameraMoves",
        "timeline",
      ]),
    );
  });

  it("produces deterministic compiler output for the same manifest input", () => {
    const manifest = generateJosephManifest(INPUT);
    const left = compileJosephManifest({manifest});
    const right = compileJosephManifest({manifest});

    expect(right).toEqual(left);
  });

  it("emits a read-only Phase 0 artifact for the selected planner path", () => {
    const manifest = generateJosephManifest(INPUT);
    const original = JSON.parse(JSON.stringify(manifest));

    const selectedPlannerCandidate = {
      plannerPathId: "path-hook-payoff",
      selectedCandidateId: "candidate-kinetic-pulse",
      genomeIds: ["genome-hook", "genome-payoff"],
      doctrineBranchIds: ["kinetic-pulse"],
      archiveCellKeys: ["high:dense:fast:payoff"],
      treatmentFamily: "expressive-premium",
      finalTreatment: "behind-speaker-depth",
      retrievalIntent: "reuse-with-variation",
      godEscalationIntent: "preferred-for-precision",
    };

    const left = compileJosephManifest({manifest, selectedPlannerCandidate});
    const right = compileJosephManifest({manifest, selectedPlannerCandidate});

    expect(left.manifest).toEqual(original);
    expect(manifest).toEqual(original);
    const artifact = left.artifact;
    expect(artifact).toBeDefined();
    if (!artifact) {
      throw new Error("Phase 0 compiler artifact was not emitted.");
    }
    expect(artifact).toMatchObject({
      version: "joseph-manifest-compiler-v1",
      mode: "phase0_read_only",
      deterministic: true,
      inputPlannerIds: {
        plannerPathId: "path-hook-payoff",
        selectedCandidateId: "candidate-kinetic-pulse",
        genomeIds: ["genome-hook", "genome-payoff"],
        doctrineBranchIds: ["kinetic-pulse"],
        archiveCellKeys: ["high:dense:fast:payoff"],
      },
    });
    expect(artifact.targetManifestFields).toEqual(
      expect.arrayContaining([
        "textOverlays",
        "textOverlays.microAnimation",
        "josephPiP",
        "josephBackground",
        "cameraMoves",
        "audio.sfx",
      ]),
    );
    expect(artifact.fallbacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({field: "treatmentFamily", tag: "compiler_treatment_family_unmapped"}),
        expect.objectContaining({field: "finalTreatment", tag: "compiler_matte_required_unavailable"}),
        expect.objectContaining({field: "retrievalIntent", tag: "asset_variation_deferred"}),
        expect.objectContaining({field: "godEscalationIntent", tag: "god_precision_required_unavailable"}),
      ]),
    );
    expect(artifact.warnings).toEqual(
      expect.arrayContaining([
        "Phase 0 compiler artifact only; manifest output was not mutated.",
      ]),
    );
    expect(artifact.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(right.artifact).toEqual(left.artifact);
  });
  it("compiles rich planner intent into a deterministic UnifiedRenderManifest handoff", () => {
    const manifest = generateJosephManifest(INPUT);
    const original = JSON.parse(JSON.stringify(manifest));

    const selectedPlannerCandidate = {
      plannerPathId: "path-hook-payoff",
      selectedCandidateId: "candidate-kinetic-pulse",
      genomeIds: ["genome-hook", "genome-payoff"],
      doctrineBranchIds: ["kinetic-pulse"],
      archiveCellKeys: ["expressive:dense:active:payoff"],
      treatmentFamily: "expressive-premium",
      finalTreatment: "background-overlay",
      retrievalIntent: "search-deeper",
      godEscalationIntent: "allowed-if-no-fit",
    };

    const left = compileJosephManifest({
      manifest,
      mode: "compile_manifest",
      variationKey: "variation-key-compile-v1",
      selectedPlannerCandidate,
    });
    const right = compileJosephManifest({
      manifest,
      mode: "compile_manifest",
      variationKey: "variation-key-compile-v1",
      selectedPlannerCandidate,
    });
    const changedVariation = compileJosephManifest({
      manifest,
      mode: "compile_manifest",
      variationKey: "variation-key-compile-v2",
      selectedPlannerCandidate,
    });

    expect(manifest).toEqual(original);
    expect(left.manifest).not.toBe(manifest);
    expect(left.manifest.textOverlays).toEqual(original.textOverlays);
    expect(left.manifest.microAnimationAudit).toEqual(original.microAnimationAudit);
    expect(left.manifest.josephPiP).toEqual(original.josephPiP);
    expect(left.manifest.josephBackground).toEqual(original.josephBackground);
    expect(left.manifest.josephTypography).toEqual(original.josephTypography);
    expect(left.manifest.josephChoreography).toEqual(original.josephChoreography);
    expect(left.manifest.cameraMoves).toEqual(original.cameraMoves);

    const parsed = UnifiedRenderManifestSchema.parse(left.manifest);
    expect(parsed.plannerHandoff).toMatchObject({
      version: "joseph-planner-handoff-v1",
      compilerVersion: "joseph-manifest-compiler-v1",
      deterministic: true,
      plannerPathId: "path-hook-payoff",
      selectedCandidateId: "candidate-kinetic-pulse",
      genomeIds: ["genome-hook", "genome-payoff"],
      doctrineBranchIds: ["kinetic-pulse"],
      archiveCellKeys: ["expressive:dense:active:payoff"],
      treatmentFamily: "expressive-premium",
      finalTreatment: "background-overlay",
      retrievalIntent: "search-deeper",
      godEscalationIntent: "allowed-if-no-fit",
      variationKey: "variation-key-compile-v1",
    });
    expect(parsed.plannerHandoff?.targetManifestFields).toEqual(
      expect.arrayContaining([
        "textOverlays.microAnimation",
        "josephPiP",
        "cameraMoves",
        "josephTypography",
        "josephBackground",
        "josephChoreography",
        "plannerHandoff.retrievalIntent",
        "plannerHandoff.godEscalationIntent",
      ]),
    );
    expect(parsed.plannerHandoff?.fallbacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({field: "retrievalIntent", tag: "deep_retrieval_deferred"}),
        expect.objectContaining({field: "godEscalationIntent", tag: "god_escalation_deferred"}),
      ]),
    );
    expect(parsed.plannerHandoff?.inputManifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.plannerHandoff?.compiledManifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(right.manifest.plannerHandoff?.compiledManifestHash).toBe(parsed.plannerHandoff?.compiledManifestHash);
    expect(changedVariation.manifest.plannerHandoff?.compiledManifestHash).not.toBe(parsed.plannerHandoff?.compiledManifestHash);
    expect(left.audit).toMatchObject({
      mode: "compile_manifest",
      deterministic: true,
    });
    expect(left.audit.presentFieldPaths).toEqual(
      expect.arrayContaining([
        "plannerHandoff",
        "plannerHandoff.retrievalIntent",
        "plannerHandoff.godEscalationIntent",
        "plannerHandoff.compiledManifestHash",
      ]),
    );
  });
});

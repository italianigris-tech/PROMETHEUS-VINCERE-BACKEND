import {createHash, randomUUID} from "node:crypto";
import {copyFile, mkdir, rename, writeFile} from "node:fs/promises";
import * as path from "node:path";

import type {MaulUnifiedShortRenderManifest} from "@prometheus/shared-types";

import type {CompositionCapabilityCoverage} from "./composition-capability-coverage.js";
import type {DeclaredComposition} from "./composition-experiment-contracts.js";
import {buildCompositionFidelityReport, type CompositionFidelityReport} from "./composition-fidelity.js";
import type {ObservedComposition} from "./composition-observer.js";
import {
  createBlindedCompositionReviewPackage,
  type BlindedCompositionReviewPackage,
  type PrivateCompositionReviewAssignment,
} from "./composition-review.js";
import type {CompositionRepairLedgerEntry} from "./composition-repair.js";
import type {
  MaulShortRenderEngine,
  MaulShortRenderEngineResult,
} from "./render-engine.js";

export type CompositionExperimentCondition = "baseline" | "repair";

export type CompositionExperimentCompilation = {
  artifactId: string;
  candidateArtifactId: string;
  treatmentGenomeArtifactId: string;
  planningBundleArtifactId: string;
  manifest: MaulUnifiedShortRenderManifest;
};

export type CompositionExperimentManifestCompiler = {
  version: string;
  compile: (input: {
    condition: CompositionExperimentCondition;
    declaration: DeclaredComposition;
  }) => Promise<CompositionExperimentCompilation>;
};

export type CompositionExperimentObserver = {
  version: string;
  observe: (input: {
    condition: CompositionExperimentCondition;
    declaration: DeclaredComposition;
    compilation: CompositionExperimentCompilation;
    render: MaulShortRenderEngineResult;
    observationControl: MaulShortRenderEngineResult;
  }) => Promise<ObservedComposition>;
};

export type CompositionExperimentDecision = {
  schemaVersion: "maul-composition-experiment-decision/v1";
  decisionId: string;
  sequence: number;
  condition: CompositionExperimentCondition | "experiment";
  decisionType:
    | "declaration_accepted"
    | "manifest_compiled"
    | "render_completed"
    | "observation_control_rendered"
    | "observation_completed"
    | "fidelity_reported"
    | "repair_validated"
    | "review_package_blinded";
  subjectId: string;
  reason: string;
  evidenceIds: string[];
};

export type CompositionExperimentRunEvidence = {
  declaration: DeclaredComposition;
  manifest: CompositionExperimentCompilation & {
    compilerVersion: string;
    manifestSha256: string;
  };
  render: MaulShortRenderEngineResult;
  observationControl: MaulShortRenderEngineResult;
  observation: ObservedComposition;
  fidelity: CompositionFidelityReport;
  artifactPaths: {
    declaration: string;
    manifest: string;
    render: string;
    frames: string[];
    observationControl: string;
    observationControlFrames: string[];
    observation: string;
    fidelity: string;
  };
};

export type CompositionExperimentResult = {
  schemaVersion: "maul-composition-experiment-result/v1";
  experimentId: string;
  capabilityCoverage: CompositionCapabilityCoverage;
  repairLedger: CompositionRepairLedgerEntry;
  runs: Record<CompositionExperimentCondition, CompositionExperimentRunEvidence>;
  review: {
    publicPackage: BlindedCompositionReviewPackage;
    privateAssignment: PrivateCompositionReviewAssignment;
  };
  decisionLedger: CompositionExperimentDecision[];
  tracePath: string;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (Buffer.isBuffer(value)) return createHash("sha256").update(value).digest("hex");
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));
const sha256Json = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const sha256Bytes = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const writeAtomic = async (filePath: string, bytes: Buffer | string): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, bytes, {flag: "wx"});
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    throw error;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> =>
  writeAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);

const assertSame = (name: string, baseline: unknown, repair: unknown): void => {
  if (canonicalJson(baseline) !== canonicalJson(repair)) {
    throw new Error(`Composition experiment invariant changed outside repair closure: ${name}.`);
  }
};

const fontAssetSet = (declaration: DeclaredComposition): string[] =>
  declaration.typography.roles
    .map((role) => `${role.font.assetId}:${role.font.sha256}`)
    .sort();

const capabilityShape = (declaration: DeclaredComposition) =>
  declaration.capabilityVerification.map(({capabilityId, status, supports}) => ({
    capabilityId,
    status,
    supports,
  }));

const assertExperimentInvariants = ({
  baseline,
  repair,
  repairLedger,
  coverage,
  compilerVersion,
  rendererVersion,
  observerVersion,
}: {
  baseline: DeclaredComposition;
  repair: DeclaredComposition;
  repairLedger: CompositionRepairLedgerEntry;
  coverage: CompositionCapabilityCoverage;
  compilerVersion: string;
  rendererVersion: string;
  observerVersion: string;
}): void => {
  if (baseline.output.width !== 1080 || baseline.output.height !== 1920) {
    throw new Error("Composition experiment requires the governed 1080x1920 output.");
  }
  if (baseline.output.durationMs !== 4000) {
    throw new Error("Composition experiment requires the governed four-second output.");
  }
  if (repair.parentDeclarationId !== baseline.declarationId) {
    throw new Error("Repair declaration must name the baseline declaration as its parent.");
  }
  if (
    repairLedger.parentDeclarationId !== baseline.declarationId ||
    repairLedger.childDeclarationId !== repair.declarationId ||
    repairLedger.targetDimension !== "semanticHierarchy"
  ) {
    throw new Error("Repair ledger does not bind the declared semantic-hierarchy mutation.");
  }
  if (coverage.fixtureId !== baseline.fixtureId || coverage.duplicateAuthorities.length > 0) {
    throw new Error("Capability coverage is not bound to this fixture or reports duplicate authorities.");
  }
  assertSame("fixtureId", baseline.fixtureId, repair.fixtureId);
  assertSame("sourceGroup", baseline.sourceGroup, repair.sourceGroup);
  assertSame("sourceSha256", baseline.sourceSha256, repair.sourceSha256);
  assertSame("output", baseline.output, repair.output);
  assertSame("fixture evidence", baseline.causalLineage.fixtureEvidenceIds, repair.causalLineage.fixtureEvidenceIds);
  assertSame("reference evidence", baseline.causalLineage.referenceObservationIds, repair.causalLineage.referenceObservationIds);
  assertSame("semantic tree", baseline.causalLineage.semanticTreeId, repair.causalLineage.semanticTreeId);
  assertSame("Treatment Genome", baseline.causalLineage.treatmentGenomeArtifactId, repair.causalLineage.treatmentGenomeArtifactId);
  assertSame("font assets", fontAssetSet(baseline), fontAssetSet(repair));
  assertSame("placement depth", baseline.placement.depthMode, repair.placement.depthMode);
  assertSame("placement scene evidence", baseline.placement.sceneEvidenceIds, repair.placement.sceneEvidenceIds);
  assertSame("treatment", baseline.treatment, repair.treatment);
  assertSame("motion", baseline.motion, repair.motion);
  assertSame("source transform", baseline.sourceTransform, repair.sourceTransform);
  assertSame("required observations", baseline.requiredObservations, repair.requiredObservations);
  assertSame("presentation capability coverage", capabilityShape(baseline), capabilityShape(repair));
  assertSame("fallbacks", baseline.fallbacks, repair.fallbacks);
  if (baseline.causalLineage.planningBundleArtifactId === repair.causalLineage.planningBundleArtifactId) {
    throw new Error("Baseline and repair require distinct planning bundles.");
  }
  if (!compilerVersion.trim()) throw new Error("Manifest Compiler version is required.");
  for (const declaration of [baseline, repair]) {
    if (declaration.versions.renderer !== rendererVersion) {
      throw new Error(`Declared renderer ${declaration.versions.renderer} does not match ${rendererVersion}.`);
    }
    if (declaration.versions.observer !== observerVersion) {
      throw new Error(`Declared observer ${declaration.versions.observer} does not match ${observerVersion}.`);
    }
  }
};

const assertCompilationLineage = (
  declaration: DeclaredComposition,
  compilation: CompositionExperimentCompilation,
): void => {
  if (compilation.treatmentGenomeArtifactId !== declaration.causalLineage.treatmentGenomeArtifactId) {
    throw new Error("Compiled manifest changed the declared Treatment Genome lineage.");
  }
  if (compilation.planningBundleArtifactId !== declaration.causalLineage.planningBundleArtifactId) {
    throw new Error("Compiled manifest changed the declared Planning Bundle lineage.");
  }
  if (!compilation.artifactId.trim() || !compilation.candidateArtifactId.trim()) {
    throw new Error("Compiled manifest receipt lacks governed artifact identity.");
  }
};

const assertRenderEvidence = (
  declaration: DeclaredComposition,
  render: MaulShortRenderEngineResult,
  expectedObservationMode: "creative" | "typography_suppressed",
): void => {
  if (sha256Bytes(render.bytes) !== render.sha256 || render.bytes.length === 0) {
    throw new Error("Canonical render bytes do not match the renderer receipt.");
  }
  if (
    render.width !== declaration.output.width ||
    render.height !== declaration.output.height ||
    render.durationMs !== declaration.output.durationMs
  ) {
    throw new Error("Canonical render geometry or duration differs from Declared Composition.");
  }
  if (render.evidence.compositionId !== "MaulShort" || render.evidence.renderer !== "remotion") {
    throw new Error("Composition experiment render did not use canonical Remotion MaulShort.");
  }
  if (render.evidence.observationMode !== expectedObservationMode) {
    throw new Error(
      `Canonical render reported ${render.evidence.observationMode} instead of ${expectedObservationMode}.`,
    );
  }
  const expectedTimes = [1000, 2000, 3000];
  if (canonicalJson(render.frameSamples.map((sample) => sample.outputMs)) !== canonicalJson(expectedTimes)) {
    throw new Error("Canonical render did not retain the governed 1 s, 2 s, and 3 s frames.");
  }
  for (const sample of render.frameSamples) {
    if (sample.contentType !== "image/png" || sha256Bytes(sample.bytes) !== sample.sha256 || sample.bytes.length === 0) {
      throw new Error(`Retained frame ${sample.outputMs} lacks valid PNG evidence bytes.`);
    }
  }
};

const relativeTo = (root: string, target: string): string =>
  path.relative(root, target).replace(/\\/g, "/");

export async function runCompositionExperiment({
  experimentId,
  outputDirectory,
  workRoot,
  reviewSeed,
  baselineDeclaration,
  repairDeclaration,
  repairLedger,
  capabilityCoverage,
  compiler,
  renderer,
  observer,
}: {
  experimentId: string;
  outputDirectory: string;
  workRoot: string;
  reviewSeed: string;
  baselineDeclaration: DeclaredComposition;
  repairDeclaration: DeclaredComposition;
  repairLedger: CompositionRepairLedgerEntry;
  capabilityCoverage: CompositionCapabilityCoverage;
  compiler: CompositionExperimentManifestCompiler;
  renderer: {version: string; render: MaulShortRenderEngine};
  observer: CompositionExperimentObserver;
}): Promise<CompositionExperimentResult> {
  if (!experimentId.trim() || !reviewSeed.trim()) {
    throw new Error("Composition experiment ID and hidden review seed are required.");
  }
  assertExperimentInvariants({
    baseline: baselineDeclaration,
    repair: repairDeclaration,
    repairLedger,
    coverage: capabilityCoverage,
    compilerVersion: compiler.version,
    rendererVersion: renderer.version,
    observerVersion: observer.version,
  });
  await mkdir(outputDirectory, {recursive: true});
  await mkdir(workRoot, {recursive: true});
  const decisionLedger: CompositionExperimentDecision[] = [];
  const recordDecision = (
    condition: CompositionExperimentDecision["condition"],
    decisionType: CompositionExperimentDecision["decisionType"],
    subjectId: string,
    reason: string,
    evidenceIds: string[],
  ): void => {
    const sequence = decisionLedger.length + 1;
    decisionLedger.push({
      schemaVersion: "maul-composition-experiment-decision/v1",
      decisionId: `${experimentId}:decision:${String(sequence).padStart(2, "0")}`,
      sequence,
      condition,
      decisionType,
      subjectId,
      reason,
      evidenceIds,
    });
  };

  const execute = async (
    condition: CompositionExperimentCondition,
    declaration: DeclaredComposition,
  ): Promise<CompositionExperimentRunEvidence> => {
    const runDirectory = path.join(outputDirectory, condition);
    await mkdir(runDirectory, {recursive: true});
    recordDecision(condition, "declaration_accepted", declaration.declarationId, "Frozen declaration passed experiment invariants.", [declaration.declarationSha256]);
    const compilation = await compiler.compile({condition, declaration});
    assertCompilationLineage(declaration, compilation);
    const manifestSha256 = sha256Json(compilation.manifest);
    recordDecision(condition, "manifest_compiled", compilation.artifactId, "Existing Manifest Compiler produced governed render intent.", [manifestSha256]);
    const render = await renderer.render({
      workRoot: path.join(workRoot, condition),
      manifest: compilation.manifest,
      renderMode: "final",
      previewFrameTimesMs: [1000, 2000, 3000],
      observationMode: "creative",
    });
    assertRenderEvidence(declaration, render, "creative");
    recordDecision(condition, "render_completed", render.sha256, "Canonical Remotion MaulShort produced retained pixel evidence.", [render.sha256, ...render.frameSamples.map((sample) => sample.sha256)]);
    const observationControl = await renderer.render({
      workRoot: path.join(workRoot, condition, "observation-control"),
      manifest: compilation.manifest,
      renderMode: "final",
      previewFrameTimesMs: [1000, 2000, 3000],
      observationMode: "typography_suppressed",
    });
    assertRenderEvidence(declaration, observationControl, "typography_suppressed");
    if (render.frameSamples.every((sample, index) =>
      sample.sha256 === observationControl.frameSamples[index]?.sha256
    )) {
      throw new Error("Typography-suppressed control is pixel-identical to the creative render.");
    }
    recordDecision(
      condition,
      "observation_control_rendered",
      observationControl.sha256,
      "Canonical Remotion MaulShort rendered the same manifest with typography suppressed.",
      [observationControl.sha256, ...observationControl.frameSamples.map((sample) => sample.sha256)],
    );
    const observation = await observer.observe({
      condition,
      declaration,
      compilation,
      render,
      observationControl,
    });
    if (observation.declarationId !== declaration.declarationId) {
      throw new Error("Observed Composition is not bound to the rendered declaration.");
    }
    recordDecision(condition, "observation_completed", observation.observationId, "Observer measured retained pixels independently of declared values.", [observation.observationSha256, ...observation.frameEvidenceIds]);
    const fidelity = buildCompositionFidelityReport({
      reportId: `${experimentId}:${condition}:fidelity`,
      declaration,
      observed: observation,
      manifestSha256,
      rendererReceipt: {renderer: render.evidence.renderer, compositionId: render.evidence.compositionId},
    });
    recordDecision(condition, "fidelity_reported", fidelity.reportId, "Fidelity Report separates execution correspondence from visual observation.", [fidelity.reportSha256]);

    const declarationPath = path.join(runDirectory, "declared-composition.json");
    const manifestPath = path.join(runDirectory, "render-manifest.json");
    const renderPath = path.join(runDirectory, "render.mp4");
    const observationControlPath = path.join(runDirectory, "observation-control.mp4");
    const observationPath = path.join(runDirectory, "observed-composition.json");
    const fidelityPath = path.join(runDirectory, "fidelity-report.json");
    const framePaths = render.frameSamples.map((sample) =>
      path.join(runDirectory, "frames", `frame-${sample.outputMs}.png`),
    );
    const observationControlFramePaths = observationControl.frameSamples.map((sample) =>
      path.join(runDirectory, "observation-control-frames", `frame-${sample.outputMs}.png`),
    );
    await Promise.all([
      writeJson(declarationPath, declaration),
      writeJson(manifestPath, {
        compilerVersion: compiler.version,
        manifestArtifactId: compilation.artifactId,
        manifestSha256,
        candidateArtifactId: compilation.candidateArtifactId,
        treatmentGenomeArtifactId: compilation.treatmentGenomeArtifactId,
        planningBundleArtifactId: compilation.planningBundleArtifactId,
        manifest: compilation.manifest,
      }),
      writeAtomic(renderPath, render.bytes),
      writeAtomic(observationControlPath, observationControl.bytes),
      writeJson(observationPath, observation),
      writeJson(fidelityPath, fidelity),
      ...render.frameSamples.map((sample, index) => writeAtomic(framePaths[index]!, sample.bytes)),
      ...observationControl.frameSamples.map((sample, index) =>
        writeAtomic(observationControlFramePaths[index]!, sample.bytes)
      ),
    ]);
    return {
      declaration,
      manifest: {...compilation, compilerVersion: compiler.version, manifestSha256},
      render,
      observationControl,
      observation,
      fidelity,
      artifactPaths: {
        declaration: declarationPath,
        manifest: manifestPath,
        render: renderPath,
        frames: framePaths,
        observationControl: observationControlPath,
        observationControlFrames: observationControlFramePaths,
        observation: observationPath,
        fidelity: fidelityPath,
      },
    };
  };

  const baseline = await execute("baseline", baselineDeclaration);
  recordDecision("experiment", "repair_validated", repairLedger.repairId, "Semantic-hierarchy repair passed dependency closure and frozen-dimension checks.", [repairLedger.beforeFingerprint, repairLedger.afterFingerprint]);
  const repair = await execute("repair", repairDeclaration);
  if (
    baseline.manifest.candidateArtifactId !== repair.manifest.candidateArtifactId ||
    baseline.manifest.treatmentGenomeArtifactId !== repair.manifest.treatmentGenomeArtifactId
  ) {
    throw new Error("Baseline and repair compilation did not retain one candidate and Treatment Genome.");
  }

  const review = createBlindedCompositionReviewPackage({
    reviewPackageId: `${experimentId}:review`,
    sourceGroup: baselineDeclaration.sourceGroup,
    sceneContext: {fixtureId: baselineDeclaration.fixtureId, phrase: baselineDeclaration.typography.lineBreaks.flat().join(" ")},
    reviewSeed,
    candidates: [
      {
        candidateId: `${experimentId}:baseline`,
        declaredFingerprint: baselineDeclaration.declarationSha256,
        observedFingerprint: baseline.observation.observationSha256,
        videoPath: baseline.artifactPaths.render,
        stillPaths: baseline.artifactPaths.frames,
        mutationProvenance: null,
      },
      {
        candidateId: `${experimentId}:repair`,
        declaredFingerprint: repairDeclaration.declarationSha256,
        observedFingerprint: repair.observation.observationSha256,
        videoPath: repair.artifactPaths.render,
        stillPaths: repair.artifactPaths.frames,
        mutationProvenance: {
          parentCandidateId: `${experimentId}:baseline`,
          repairId: repairLedger.repairId,
          targetDimension: repairLedger.targetDimension,
        },
      },
    ],
  });
  const reviewDirectory = path.join(outputDirectory, "review");
  await Promise.all(((["a", "b"] as const)).map(async (label) => {
    const assignment = review.privateAssignment.candidatesByLabel[label];
    const copies = [
      {source: assignment.videoPath, destination: path.join(reviewDirectory, assignment.publicVideoPath)},
      ...assignment.stillPaths.map((source, index) => ({
        source,
        destination: path.join(reviewDirectory, assignment.publicStillPaths[index]!),
      })),
    ];
    await Promise.all(copies.map(({destination}) => mkdir(path.dirname(destination), {recursive: true})));
    await Promise.all(copies.map(({source, destination}) => copyFile(source, destination)));
  }));
  const publicPackagePath = path.join(reviewDirectory, "public-package.json");
  const privateAssignmentPath = path.join(reviewDirectory, "private-assignment.json");
  await Promise.all([
    writeJson(publicPackagePath, review.publicPackage),
    writeJson(privateAssignmentPath, review.privateAssignment),
  ]);
  recordDecision("experiment", "review_package_blinded", review.publicPackage.reviewPackageId, "Public media labels are randomized and identity metadata remains private.", [review.privateAssignment.publicPackageFingerprint]);

  const capabilityCoveragePath = path.join(outputDirectory, "capability-coverage.json");
  const repairLedgerPath = path.join(outputDirectory, "repair-ledger.json");
  const decisionLedgerPath = path.join(outputDirectory, "decision-ledger.json");
  const tracePath = path.join(outputDirectory, "trace.json");
  const trace = {
    schemaVersion: "maul-composition-experiment-trace/v1",
    experimentId,
    fixtureId: baselineDeclaration.fixtureId,
    sourceGroup: baselineDeclaration.sourceGroup,
    capabilityCoverage: {
      path: relativeTo(outputDirectory, capabilityCoveragePath),
      sha256: capabilityCoverage.coverageSha256,
    },
    repairLedger: {
      path: relativeTo(outputDirectory, repairLedgerPath),
      repairId: repairLedger.repairId,
      beforeFingerprint: repairLedger.beforeFingerprint,
      afterFingerprint: repairLedger.afterFingerprint,
    },
    runs: Object.fromEntries((["baseline", "repair"] as const).map((condition) => {
      const run = condition === "baseline" ? baseline : repair;
      return [condition, {
        declarationId: run.declaration.declarationId,
        declarationSha256: run.declaration.declarationSha256,
        manifestArtifactId: run.manifest.artifactId,
        manifestSha256: run.manifest.manifestSha256,
        renderSha256: run.render.sha256,
        observationControlSha256: run.observationControl.sha256,
        observationId: run.observation.observationId,
        observationSha256: run.observation.observationSha256,
        fidelityReportId: run.fidelity.reportId,
        fidelityReportSha256: run.fidelity.reportSha256,
        artifactPaths: Object.fromEntries(Object.entries(run.artifactPaths).map(([key, value]) => [
          key,
          Array.isArray(value)
            ? value.map((entry) => relativeTo(outputDirectory, entry))
            : relativeTo(outputDirectory, value),
        ])),
      }];
    })),
    review: {
      publicPackagePath: relativeTo(outputDirectory, publicPackagePath),
      privateAssignmentPath: relativeTo(outputDirectory, privateAssignmentPath),
      publicPackageFingerprint: review.privateAssignment.publicPackageFingerprint,
    },
    decisionLedgerPath: relativeTo(outputDirectory, decisionLedgerPath),
  };
  await Promise.all([
    writeJson(capabilityCoveragePath, capabilityCoverage),
    writeJson(repairLedgerPath, repairLedger),
    writeJson(decisionLedgerPath, decisionLedger),
    writeJson(tracePath, trace),
  ]);

  return {
    schemaVersion: "maul-composition-experiment-result/v1",
    experimentId,
    capabilityCoverage,
    repairLedger,
    runs: {baseline, repair},
    review,
    decisionLedger,
    tracePath,
  };
}

import type {UnifiedRenderManifest} from "@prometheus/shared-types";
import {generateJosephManifest, type DirectorInput} from "./joseph-director";
import {
  compileJosephManifest,
  type JosephSelectedPlannerCandidate,
} from "./joseph-manifest-compiler";
import {buildJosephEditRenderProof} from "./orchestrator";

export const JOSEPH_DETERMINISM_GUARDIAN_VERSION = "joseph-determinism-guardian-v1" as const;

export type JosephDeterminismProofInput = {
  input: DirectorInput;
  selectedPlannerCandidate: JosephSelectedPlannerCandidate;
  variationKey: string;
  changedVariationKey: string;
};

export type JosephDeterminismProof = {
  version: typeof JOSEPH_DETERMINISM_GUARDIAN_VERSION;
  sameInput: {
    passed: boolean;
    selectedCandidateId: string | null;
    manifestHash: string;
    manifestHashStable: boolean;
    compiledManifestHash: string;
    compiledManifestHashStable: boolean;
    renderFrameSignaturesStable: boolean;
    frameProofSignatures: string[];
    pixelTolerance: 0;
  };
  changedVariation: {
    passed: boolean;
    compiledManifestHashChanged: boolean;
    renderManifestHashChanged: boolean;
    governedDifferencePaths: string[];
  };
};

const compiledHashOf = (manifest: UnifiedRenderManifest): string =>
  manifest.plannerHandoff?.compiledManifestHash ?? "";

const selectedCandidateIdOf = (manifest: UnifiedRenderManifest): string | null =>
  manifest.plannerHandoff?.selectedCandidateId ?? (typeof manifest.jobId === "string" ? manifest.jobId : null);

const frameProofSignaturesOf = (manifest: UnifiedRenderManifest): string[] =>
  buildJosephEditRenderProof(manifest).frameProofs.map((proof) => proof.signature);

const stableManifestForProof = (manifest: UnifiedRenderManifest): UnifiedRenderManifest => ({
  ...manifest,
  jobId: "00000000-0000-4000-8000-000000000081",
  createdAt: "1970-01-01T00:00:00.000Z",
});

export const createJosephDeterminismProof = ({
  input,
  selectedPlannerCandidate,
  variationKey,
  changedVariationKey,
}: JosephDeterminismProofInput): JosephDeterminismProof => {
  const compile = (key: string) =>
    compileJosephManifest({
      manifest: stableManifestForProof(generateJosephManifest(input)),
      mode: "compile_manifest",
      variationKey: key,
      selectedPlannerCandidate,
    }).manifest;

  const left = compile(variationKey);
  const right = compile(variationKey);
  const changed = compile(changedVariationKey);
  const leftRenderProof = buildJosephEditRenderProof(left);
  const rightRenderProof = buildJosephEditRenderProof(right);
  const changedRenderProof = buildJosephEditRenderProof(changed);
  const leftFrameProofSignatures = frameProofSignaturesOf(left);
  const rightFrameProofSignatures = frameProofSignaturesOf(right);
  const manifestHashStable = leftRenderProof.manifestHash === rightRenderProof.manifestHash;
  const compiledManifestHashStable = compiledHashOf(left) === compiledHashOf(right);
  const renderFrameSignaturesStable =
    JSON.stringify(leftFrameProofSignatures) === JSON.stringify(rightFrameProofSignatures);
  const compiledManifestHashChanged = compiledHashOf(left) !== compiledHashOf(changed);
  const renderManifestHashChanged = leftRenderProof.manifestHash !== changedRenderProof.manifestHash;

  return {
    version: JOSEPH_DETERMINISM_GUARDIAN_VERSION,
    sameInput: {
      passed: manifestHashStable && compiledManifestHashStable && renderFrameSignaturesStable,
      selectedCandidateId: selectedCandidateIdOf(left),
      manifestHash: leftRenderProof.manifestHash,
      manifestHashStable,
      compiledManifestHash: compiledHashOf(left),
      compiledManifestHashStable,
      renderFrameSignaturesStable,
      frameProofSignatures: leftFrameProofSignatures,
      pixelTolerance: 0,
    },
    changedVariation: {
      passed: compiledManifestHashChanged && renderManifestHashChanged,
      compiledManifestHashChanged,
      renderManifestHashChanged,
      governedDifferencePaths: [
        "plannerHandoff.variationKey",
        "plannerHandoff.compiledManifestHash",
      ],
    },
  };
};
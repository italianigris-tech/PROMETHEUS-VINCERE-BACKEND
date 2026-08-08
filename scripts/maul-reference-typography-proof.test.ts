import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import * as path from "node:path";

import {describe, expect, it} from "vitest";

import {encodeRgbaPng} from "../backend/src/maul/png-rgba.js";
import {
  assertReferenceTypographyProofFidelity,
  fingerprintReferenceTypographyProofValue,
  measureReferenceTypographySourceTreatmentVisibility,
  resolveReferenceTypographyProofPlacementBox,
  selectReferenceTypographyFidelitySegment,
  writeReferenceTypographyProofFrameArtifacts,
} from "./maul-reference-typography-proof.js";

describe("reference typography proof frame artifacts", () => {
  it("creates both frame directories and preserves each retained sample", async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "maul-reference-proof-"));
    const creativeSample = {outputMs: 1000, bytes: Buffer.from("creative-frame")};
    const suppressedSample = {outputMs: 1000, bytes: Buffer.from("suppressed-frame")};
    const sourceTreatmentSuppressedSample = {outputMs: 1000, bytes: Buffer.from("source-treatment-suppressed-frame")};

    try {
      await writeReferenceTypographyProofFrameArtifacts({
        outputDirectory,
        creativeFrames: [creativeSample],
        typographySuppressedFrames: [suppressedSample],
        sourceTreatmentSuppressedFrames: [sourceTreatmentSuppressedSample],
      });

      await expect(readFile(path.join(outputDirectory, "frames", "frame-1000.png")))
        .resolves.toEqual(creativeSample.bytes);
      await expect(readFile(path.join(
        outputDirectory,
        "typography-suppressed-frames",
        "frame-1000.png",
      ))).resolves.toEqual(suppressedSample.bytes);
      await expect(readFile(path.join(
        outputDirectory,
        "source-treatment-suppressed-frames",
        "frame-1000.png",
      ))).resolves.toEqual(sourceTreatmentSuppressedSample.bytes);
    } finally {
      await rm(outputDirectory, {recursive: true, force: true});
    }
  });

  it("observes the declared source grade independently of the typography control", () => {
    const creative = encodeRgbaPng({
      width: 2,
      height: 1,
      pixels: Buffer.from([20, 20, 20, 255, 20, 20, 20, 255]),
    });
    const sourceTreatmentSuppressed = encodeRgbaPng({
      width: 2,
      height: 1,
      pixels: Buffer.from([10, 10, 10, 255, 10, 10, 10, 255]),
    });

    expect(measureReferenceTypographySourceTreatmentVisibility({
      creativeFrames: [{outputMs: 1000, bytes: creative}],
      sourceTreatmentSuppressedFrames: [{outputMs: 1000, bytes: sourceTreatmentSuppressed}],
    })).toMatchObject({
      visible: true,
      changedPixelCount: 2,
      sampleCount: 1,
    });
  });

  it("persists matched frame evidence before evaluating sample placement", async () => {
    const source = await readFile(
      path.resolve("scripts/maul-reference-typography-proof.ts"),
      "utf8",
    );

    const frameArtifactWriteIndex = source.indexOf(
      "await writeReferenceTypographyProofFrameArtifacts({",
    );
    const placementAssertionIndex = source.indexOf(
      "assertReferenceTypographyProofSamplePlacements({",
    );

    expect(frameArtifactWriteIndex).toBeGreaterThanOrEqual(0);
    expect(frameArtifactWriteIndex).toBeLessThan(placementAssertionIndex);
  });

  it("rejects a proof whose declared typography line layout is not observed", () => {
    expect(() => assertReferenceTypographyProofFidelity({
      status: "partial",
      hardFailures: [],
      fields: {
        lineBreaks: {status: "mismatch"},
        placement: {status: "match"},
        treatment: {status: "match"},
        motion: {status: "match"},
      },
    } as never)).toThrow(/line-break fidelity/i);
  });

  it("fingerprints declared proof values without volatile MAUL artifact identity", () => {
    const stable = {
      treatmentId: "premium_direct_response",
      sourceArtifactId: "maul_artifact_first",
      replayKey: "first-replay-key",
      storagePath: "C:/proof/run-e/source.mp4",
      textChunkPlanHash: "a".repeat(64),
    };
    const repeated = {
      treatmentId: "premium_direct_response",
      sourceArtifactId: "maul_artifact_second",
      replayKey: "second-replay-key",
      storagePath: "C:/proof/run-f/source.mp4",
      textChunkPlanHash: "b".repeat(64),
    };
    const changed = {treatmentId: "minimal_expert", sourceArtifactId: "maul_artifact_second"};

    expect(fingerprintReferenceTypographyProofValue(stable)).toBe(
      fingerprintReferenceTypographyProofValue(repeated),
    );
    expect(fingerprintReferenceTypographyProofValue(stable)).not.toBe(
      fingerprintReferenceTypographyProofValue(changed),
    );
  });

  it("binds proof fidelity to the completed-hold placement segment", () => {
    expect(selectReferenceTypographyFidelitySegment({
      sampleMs: 3000,
      placementSegments: [
        {segmentId: "entry", outputStartMs: 851, outputEndMs: 1884},
        {segmentId: "hold", outputStartMs: 1884, outputEndMs: 3099},
      ],
    })).toMatchObject({segmentId: "hold"});
  });

  it("declares the measured maximum envelope for containment fidelity", () => {
    expect(resolveReferenceTypographyProofPlacementBox({
      box: {x: 0.04, y: 0.16, width: 0.28, height: 0.25},
      maximumEnvelope: {x: 0.028, y: 0.14, width: 0.36, height: 0.32},
    })).toEqual({x: 0.028, y: 0.14, width: 0.36, height: 0.32});
  });
});

import {describe, expect, it} from "vitest";

import {
  GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION,
  evaluateAnnotationQa,
  goldenCorpusAnnotationSchema
} from "./annotation";

describe("golden corpus annotation protocol", () => {
  it("requires versioned annotations linked to the corpus registry and extracted trajectory", () => {
    const annotation = goldenCorpusAnnotationSchema.parse({
      schemaVersion: GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION,
      registryId: "ref_joseph_licensed_001",
      annotator: {
        reviewerId: "human-reviewer-1",
        reviewedAt: "2026-07-03T12:00:00.000Z"
      },
      referenceEdit: {
        qualityTier: "elite",
        styleFit: "on_style",
        duplicateAssessment: {isDuplicate: false},
        compressionAssessment: "clean",
        requiredNotes: "Elite Joseph-style pacing with crisp typography and clean audio.",
        visibleCraftDecisions: [
          {
            category: "camera",
            timeRangeSeconds: {start: 0, end: 2.4},
            observation: "Opening push-in lands on the hook phrase.",
            extractorFeasibility: "direct"
          },
          {
            category: "typography",
            timeRangeSeconds: {start: 2.4, end: 4.1},
            observation: "Two-word emphasis appears above eye trace without occlusion.",
            extractorFeasibility: "heuristic"
          }
        ],
        failureClasses: ["cheap-template-motion"]
      },
      extractedTrajectory: {
        trajectoryPath: "artifacts/golden/ref_joseph_licensed_001/trajectory.json",
        featureVersion: "trajectory-features-v1",
        validationStatus: "validated",
        trajectoryNotes: "Window boundaries align with the reviewed craft decisions.",
        windowAnnotations: [
          {
            windowIndex: 0,
            verdict: "usable",
            visibleDecisionRefs: ["camera:0-2.4"],
            notes: "Hook movement is strong enough for training."
          }
        ]
      }
    });

    expect(annotation.schemaVersion).toBe("golden-corpus-annotation-v1");
    expect(annotation.registryId).toBe("ref_joseph_licensed_001");
    expect(annotation.extractedTrajectory.featureVersion).toBe("trajectory-features-v1");
  });

  it("rejects low-quality, off-style, duplicate, and over-compressed references", () => {
    const annotation = goldenCorpusAnnotationSchema.parse({
      schemaVersion: GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION,
      registryId: "ref_bad_reference",
      annotator: {
        reviewerId: "human-reviewer-1",
        reviewedAt: "2026-07-03T12:00:00.000Z"
      },
      referenceEdit: {
        qualityTier: "weak",
        styleFit: "off_style",
        duplicateAssessment: {isDuplicate: true, duplicateOfRegistryId: "ref_original"},
        compressionAssessment: "over_compressed",
        requiredNotes: "Generic edit with visible compression and weak motion grammar.",
        visibleCraftDecisions: [
          {
            category: "motion_graphics",
            timeRangeSeconds: {start: 1, end: 3},
            observation: "Preset zoom repeats without semantic timing.",
            extractorFeasibility: "direct"
          }
        ],
        failureClasses: ["cheap-template-motion", "boring-under-editing"]
      },
      extractedTrajectory: {
        trajectoryPath: "artifacts/golden/ref_bad_reference/trajectory.json",
        featureVersion: "trajectory-features-v1",
        validationStatus: "validated",
        trajectoryNotes: "Extracted only to prove QA rejection.",
        windowAnnotations: [
          {
            windowIndex: 0,
            verdict: "reject",
            visibleDecisionRefs: ["motion_graphics:1-3"],
            notes: "Too generic for the Golden corpus."
          }
        ]
      }
    });

    expect(evaluateAnnotationQa(annotation)).toEqual({
      approved: false,
      rejectionReasons: [
        "quality_tier_weak",
        "off_style",
        "duplicate_reference",
        "over_compressed_source"
      ]
    });
  });
});

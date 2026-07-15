import {describe, expect, it} from "vitest";

import {GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION, goldenCorpusAnnotationSchema} from "./annotation";
import {buildGolden100Dashboard} from "./dashboard";
import {goldenCorpusRegistrySchema} from "./registry";

const makeRegistryEntry = (input: {
  registryId: string;
  styleLabel?: string;
  vehicle?: "talking_head" | "property";
  qualityTier?: "elite" | "weak";
  annotationStatus?: "complete" | "not_started";
  trajectoryStatus?: "validated" | "not_extracted";
}) => ({
  registryId: input.registryId,
  title: input.registryId,
  source: {
    kind: "licensed_asset" as const,
    assetId: `asset_${input.registryId}`,
    storageUri: `r2://prometheus-corpus/${input.registryId}.mp4`,
    provenanceNote: "Licensed production corpus asset."
  },
  license: {
    posture: "licensed_production" as const,
    commercialUse: "allowed" as const,
    evidence: "Creator license agreement."
  },
  creatorStyle: {
    creatorId: input.styleLabel ?? "joseph",
    styleLabel: input.styleLabel ?? "joseph",
    vehicle: input.vehicle ?? "talking_head"
  },
  quality: {
    tier: input.qualityTier ?? "elite",
    sourceQuality: "high" as const,
    compressionRisk: "low" as const
  },
  curation: {
    status: "approved_golden_candidate" as const,
    annotationStatus: input.annotationStatus ?? "complete",
    trajectoryStatus: input.trajectoryStatus ?? "validated"
  }
});

const makeAnnotation = (input: {
  registryId: string;
  qualityTier?: "elite" | "weak";
  duplicateOfRegistryId?: string;
}) =>
  goldenCorpusAnnotationSchema.parse({
    schemaVersion: GOLDEN_CORPUS_ANNOTATION_SCHEMA_VERSION,
    registryId: input.registryId,
    annotator: {
      reviewerId: "human-reviewer-1",
      reviewedAt: "2026-07-03T12:00:00.000Z"
    },
    referenceEdit: {
      qualityTier: input.qualityTier ?? "elite",
      styleFit: "on_style",
      duplicateAssessment: input.duplicateOfRegistryId
        ? {isDuplicate: true, duplicateOfRegistryId: input.duplicateOfRegistryId}
        : {isDuplicate: false},
      compressionAssessment: "clean",
      requiredNotes: "Reviewed for Golden Corpus threshold.",
      visibleCraftDecisions: [
        {
          category: "camera",
          timeRangeSeconds: {start: 0, end: 1},
          observation: "Hook camera move is usable.",
          extractorFeasibility: "direct"
        }
      ],
      failureClasses: []
    },
    extractedTrajectory: {
      trajectoryPath: `artifacts/golden/${input.registryId}/trajectory.json`,
      featureVersion: "trajectory-features-v1",
      validationStatus: "validated",
      trajectoryNotes: "Trajectory preserves the reviewed decision.",
      windowAnnotations: [
        {
          windowIndex: 0,
          verdict: "usable",
          visibleDecisionRefs: ["camera:0-1"],
          notes: "Usable training window."
        }
      ]
    }
  });

describe("Golden 100 threshold dashboard", () => {
  it("counts references by style, vehicle, curation tier, extraction status, and annotation status", () => {
    const registry = goldenCorpusRegistrySchema.parse({
      schemaVersion: "golden-corpus-registry-v1",
      entries: [
        makeRegistryEntry({registryId: "ref_joseph_ready"}),
        makeRegistryEntry({registryId: "ref_property_waiting", styleLabel: "property-demo", vehicle: "property", annotationStatus: "not_started", trajectoryStatus: "not_extracted"})
      ]
    });

    const dashboard = buildGolden100Dashboard({
      registry,
      annotations: [makeAnnotation({registryId: "ref_joseph_ready"})],
      threshold: 2
    });

    expect(dashboard.counts.byStyle).toEqual({joseph: 1, "property-demo": 1});
    expect(dashboard.counts.byVehicle).toEqual({talking_head: 1, property: 1});
    expect(dashboard.counts.byCurationTier).toEqual({elite: 2});
    expect(dashboard.counts.byExtractionStatus).toEqual({validated: 1, not_extracted: 1});
    expect(dashboard.counts.byAnnotationStatus).toEqual({complete: 1, not_started: 1});
    expect(dashboard.golden100.validatedCandidateCount).toBe(1);
    expect(dashboard.golden100.thresholdMet).toBe(false);
    expect(dashboard.golden100.status).toBe("below_threshold");
  });

  it("blocks inflated Golden 100 counts from weak or duplicate annotations", () => {
    const registry = goldenCorpusRegistrySchema.parse({
      schemaVersion: "golden-corpus-registry-v1",
      entries: [
        makeRegistryEntry({registryId: "ref_clean_1"}),
        makeRegistryEntry({registryId: "ref_duplicate"}),
        makeRegistryEntry({registryId: "ref_weak", qualityTier: "weak"})
      ]
    });

    const dashboard = buildGolden100Dashboard({
      registry,
      annotations: [
        makeAnnotation({registryId: "ref_clean_1"}),
        makeAnnotation({registryId: "ref_duplicate", duplicateOfRegistryId: "ref_clean_1"}),
        makeAnnotation({registryId: "ref_weak", qualityTier: "weak"})
      ],
      threshold: 1
    });

    expect(dashboard.golden100.thresholdMet).toBe(true);
    expect(dashboard.golden100.status).toBe("blocked");
    expect(dashboard.golden100.validatedCandidateCount).toBe(1);
    expect(dashboard.golden100.inflatedReferenceIds).toEqual(["ref_duplicate", "ref_weak"]);
    expect(dashboard.warnings).toEqual([
      "ref_duplicate rejected from Golden 100 count: duplicate_reference",
      "ref_weak rejected from Golden 100 count: quality_tier_weak"
    ]);
  });
});

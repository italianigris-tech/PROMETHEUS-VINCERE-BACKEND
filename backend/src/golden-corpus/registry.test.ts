import {describe, expect, it} from "vitest";

import {
  filterGolden100Candidates,
  goldenCorpusRegistrySchema,
  referenceEditRegistryEntrySchema
} from "./registry";

describe("golden corpus registry", () => {
  it("distinguishes research-only YouTube references from production corpus assets", () => {
    const researchReference = referenceEditRegistryEntrySchema.parse({
      registryId: "ref_joseph_research_001",
      title: "Joseph research breakdown 001",
      source: {
        kind: "youtube_research",
        url: "https://www.youtube.com/watch?v=research001",
        provenanceNote: "Research-only style study reference."
      },
      license: {
        posture: "research_only",
        commercialUse: "blocked",
        evidence: "Public YouTube reference; no production reuse license."
      },
      creatorStyle: {
        creatorId: "joseph",
        styleLabel: "joseph",
        vehicle: "talking_head"
      },
      quality: {
        tier: "elite",
        sourceQuality: "high",
        compressionRisk: "medium"
      },
      curation: {
        status: "candidate",
        annotationStatus: "not_started",
        trajectoryStatus: "not_extracted"
      }
    });

    const licensedAsset = referenceEditRegistryEntrySchema.parse({
      registryId: "ref_joseph_licensed_001",
      title: "Licensed Joseph reference 001",
      source: {
        kind: "licensed_asset",
        assetId: "asset_licensed_001",
        storageUri: "r2://prometheus-corpus/licensed-001.mp4",
        provenanceNote: "Licensed production corpus asset."
      },
      license: {
        posture: "licensed_production",
        commercialUse: "allowed",
        evidence: "Creator license agreement LIC-001."
      },
      creatorStyle: {
        creatorId: "joseph",
        styleLabel: "joseph",
        vehicle: "talking_head"
      },
      quality: {
        tier: "elite",
        sourceQuality: "high",
        compressionRisk: "low"
      },
      curation: {
        status: "approved_golden_candidate",
        annotationStatus: "complete",
        trajectoryStatus: "validated"
      }
    });

    expect(researchReference.corpusEligibility.productionCorpus).toBe(false);
    expect(researchReference.corpusEligibility.researchOnly).toBe(true);
    expect(licensedAsset.corpusEligibility.productionCorpus).toBe(true);
    expect(licensedAsset.corpusEligibility.researchOnly).toBe(false);
  });

  it("filters only validated elite production assets into the Golden 100 candidate set", () => {
    const registry = goldenCorpusRegistrySchema.parse({
      schemaVersion: "golden-corpus-registry-v1",
      entries: [
        {
          registryId: "ref_research_only",
          title: "Research-only public reference",
          source: {
            kind: "youtube_research",
            url: "https://www.youtube.com/watch?v=research002",
            provenanceNote: "Style study only."
          },
          license: {
            posture: "research_only",
            commercialUse: "blocked",
            evidence: "No production license."
          },
          creatorStyle: {
            creatorId: "joseph",
            styleLabel: "joseph",
            vehicle: "talking_head"
          },
          quality: {
            tier: "elite",
            sourceQuality: "high",
            compressionRisk: "low"
          },
          curation: {
            status: "approved_golden_candidate",
            annotationStatus: "complete",
            trajectoryStatus: "validated"
          }
        },
        {
          registryId: "ref_weak_quality",
          title: "Weak licensed reference",
          source: {
            kind: "user_uploaded_asset",
            assetId: "asset_user_weak",
            storageUri: "file:///corpus/user-weak.mp4",
            uploaderId: "creator_1",
            provenanceNote: "User-uploaded with permission."
          },
          license: {
            posture: "user_uploaded_production",
            commercialUse: "allowed",
            evidence: "Uploader accepted production corpus terms."
          },
          creatorStyle: {
            creatorId: "joseph",
            styleLabel: "joseph",
            vehicle: "talking_head"
          },
          quality: {
            tier: "weak",
            sourceQuality: "high",
            compressionRisk: "low"
          },
          curation: {
            status: "approved_golden_candidate",
            annotationStatus: "complete",
            trajectoryStatus: "validated"
          }
        },
        {
          registryId: "ref_golden_ready",
          title: "Golden-ready licensed reference",
          source: {
            kind: "licensed_asset",
            assetId: "asset_gold_001",
            storageUri: "r2://prometheus-corpus/gold-001.mp4",
            provenanceNote: "Licensed production corpus asset."
          },
          license: {
            posture: "licensed_production",
            commercialUse: "allowed",
            evidence: "Creator license agreement LIC-002."
          },
          creatorStyle: {
            creatorId: "joseph",
            styleLabel: "joseph",
            vehicle: "talking_head"
          },
          quality: {
            tier: "elite",
            sourceQuality: "high",
            compressionRisk: "low"
          },
          curation: {
            status: "approved_golden_candidate",
            annotationStatus: "complete",
            trajectoryStatus: "validated"
          }
        }
      ]
    });

    expect(filterGolden100Candidates(registry).map((entry) => entry.registryId)).toEqual(["ref_golden_ready"]);
  });
});

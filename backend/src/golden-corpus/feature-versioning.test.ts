import {describe, expect, it} from "vitest";

import {evaluateFeatureVersionCompatibility} from "./feature-versioning";

const current = {
  featureVersion: "trajectory-features-v2",
  extractorVersion: "0.3.0",
  schemaVersion: "0.3.0"
};

const compatibleEntry = {
  registryId: "elite_001",
  trajectoryPath: "artifacts/golden/elite_001/trajectory.json",
  featureVersion: "trajectory-features-v2",
  extractorVersion: "0.3.0",
  schemaVersion: "0.3.0"
};

describe("feature version compatibility", () => {
  it("passes when every trajectory uses the current feature, extractor, and schema versions", () => {
    const report = evaluateFeatureVersionCompatibility({
      current,
      corpusEntries: [compatibleEntry],
      changedFeatures: []
    });

    expect(report.satisfied).toBe(true);
    expect(report.affectedCorpusEntries).toEqual([]);
    expect(report.blockReasons).toEqual([]);
  });

  it("fails training and lists changed features plus affected entries when versions drift without a plan", () => {
    const report = evaluateFeatureVersionCompatibility({
      current,
      changedFeatures: ["audio.beat_proximity", "transitions.has_audio_synced_cut"],
      corpusEntries: [
        compatibleEntry,
        {
          registryId: "elite_legacy",
          trajectoryPath: "artifacts/golden/elite_legacy/trajectory.json",
          featureVersion: "trajectory-features-v1",
          extractorVersion: "0.2.0",
          schemaVersion: "0.2.0"
        }
      ]
    });

    expect(report.satisfied).toBe(false);
    expect(report.blockReasons).toEqual(["unresolved_feature_version_mismatch"]);
    expect(report.changedFeatures).toEqual(["audio.beat_proximity", "transitions.has_audio_synced_cut"]);
    expect(report.affectedCorpusEntries).toEqual([
      {
        registryId: "elite_legacy",
        trajectoryPath: "artifacts/golden/elite_legacy/trajectory.json",
        observed: {
          featureVersion: "trajectory-features-v1",
          extractorVersion: "0.2.0",
          schemaVersion: "0.2.0"
        },
        expected: current,
        mismatchReasons: ["feature_version_mismatch", "extractor_version_mismatch", "schema_version_mismatch"],
        resolution: null
      }
    ]);
  });

  it("allows mixed versions only when a matching migration or re-extraction plan exists", () => {
    const report = evaluateFeatureVersionCompatibility({
      current,
      changedFeatures: ["audio.beat_proximity"],
      corpusEntries: [
        {
          registryId: "elite_migrate",
          trajectoryPath: "artifacts/golden/elite_migrate/trajectory.json",
          featureVersion: "trajectory-features-v1",
          extractorVersion: "0.2.0",
          schemaVersion: "0.2.0"
        },
        {
          registryId: "elite_reextract",
          trajectoryPath: "artifacts/golden/elite_reextract/trajectory.json",
          featureVersion: "trajectory-features-v1",
          extractorVersion: "0.2.0",
          schemaVersion: "0.2.0"
        }
      ],
      migrationPlans: [
        {
          planId: "migrate-audio-v1-v2",
          fromFeatureVersion: "trajectory-features-v1",
          toFeatureVersion: "trajectory-features-v2",
          owner: "feature-audit",
          changedFeatures: ["audio.beat_proximity"]
        }
      ],
      reExtractionPlans: [
        {
          planId: "reextract-elite-reextract",
          registryId: "elite_reextract",
          owner: "data-pipeline",
          reason: "Extractor version changed from 0.2.0 to 0.3.0."
        }
      ]
    });

    expect(report.satisfied).toBe(true);
    expect(report.blockReasons).toEqual([]);
    expect(report.affectedCorpusEntries.map((entry) => entry.resolution?.kind)).toEqual([
      "migration",
      "re_extraction"
    ]);
  });
});

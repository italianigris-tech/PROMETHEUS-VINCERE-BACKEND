import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {describe, expect, it} from "vitest";
import {
  buildJosephReviewArtifact,
  JOSEPH_FAILURE_TAXONOMY,
  matchJosephFailureTaxonomy,
  preserveJosephOversightReview,
  readJosephRegressionGallery,
} from "./joseph-oversight-review";

const basePackage = () => ({
  jobId: "job-oversight-1",
  variationKey: {
    sourceFingerprint: "source-a",
    promptFingerprint: "prompt-a",
    uploadInstanceId: "upload-1",
    retryIndex: 0,
    profile: "joseph_aggressive",
  },
  candidates: [{jobId: "candidate-a"}, {jobId: "candidate-b"}],
  selected: {
    jobId: "candidate-a",
    josephChoreography: {
      qualityAudit: {
        score: 0.7,
        failures: ["climax_overspend", "dead_zone"],
      },
    },
  },
  rejected: [{jobId: "candidate-b"}],
  verdict: {
    qualityScore: 0.66,
    similarityScore: 0.22,
    passedFloor: false,
    failureTags: ["text_below_safe_zone", "replay_similarity_veto"],
  },
  timestamp: "2026-06-27T00:00:00.000Z",
  candidateScoreSummary: {candidateScores: [1, 2]},
});

describe("Joseph oversight review", () => {
  it("defines the canonical Joseph failure taxonomy", () => {
    expect(JOSEPH_FAILURE_TAXONOMY.map((entry) => entry.id)).toEqual([
      "boring-under-editing",
      "chaotic-over-editing",
      "cheap-template-motion",
      "premium-restraint",
      "repetition-fatigue",
      "climax-overspend",
      "weak-concept-reduction",
      "asset-treatment-mismatch",
      "sequence-rhythm-collapse",
      "readability-sacrifice",
    ]);
  });

  it("maps raw verdict and manifest audit tags into taxonomy classes", () => {
    const matches = matchJosephFailureTaxonomy([
      "text_below_safe_zone",
      "replay_similarity_veto",
      "climax_overspend",
      "dead_zone",
    ]);

    expect(matches.map((match) => match.failureClass)).toEqual(
      expect.arrayContaining([
        "readability-sacrifice",
        "repetition-fatigue",
        "climax-overspend",
        "sequence-rhythm-collapse",
      ]),
    );
    expect(matches.find((match) => match.failureClass === "readability-sacrifice")).toMatchObject({
      severity: "editorial",
      affectedArtifacts: ["manifest", "render-preview", "review-surface"],
      fixIntent: "Move, simplify, or restyle text so the candidate remains readable without fighting subject focus.",
    });
  });

  it("builds review artifacts with revisitable manifests, verdicts, tags, and notes", () => {
    const artifact = buildJosephReviewArtifact(basePackage(), {
      candidatesPath: "candidates.json",
      selectedPath: "selected.json",
      verdictPath: "verdict.json",
      auditPath: "audit.json",
    });

    expect(artifact.version).toBe("joseph-oversight-review-v1");
    expect(artifact.candidateJobIds).toEqual(["candidate-a", "candidate-b"]);
    expect(artifact.rejectedJobIds).toEqual(["candidate-b"]);
    expect(artifact.reviewVerdict.classification).toBe("weak-example");
    expect(artifact.reviewVerdict.failureTaxonomy.map((match) => match.failureClass)).toEqual(
      expect.arrayContaining(["readability-sacrifice", "climax-overspend", "sequence-rhythm-collapse"]),
    );
    expect(artifact.reviewVerdict.fixIntents).toEqual(
      expect.arrayContaining([
        "Move, simplify, or restyle text so the candidate remains readable without fighting subject focus.",
        "Reserve peak energy for the strongest beat or CTA by reducing earlier high-intensity treatments.",
      ]),
    );
    expect(artifact.completionEvidence).toMatchObject({
      candidateManifestCount: 2,
      rejectedManifestCount: 1,
      hasCandidateScoreSummary: true,
      hasExplicitFailureTags: true,
      hasReviewNotes: true,
    });
  });

  it("writes an append-only review ledger and regression gallery", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "joseph-oversight-"));
    const jobDir = path.join(baseDir, "job-oversight-1");
    fs.mkdirSync(jobDir, {recursive: true});

    const paths = preserveJosephOversightReview({
      pkg: basePackage(),
      baseDir,
      jobDir,
      candidatesPath: path.join(jobDir, "candidates.json"),
      selectedPath: path.join(jobDir, "selected.json"),
      verdictPath: path.join(jobDir, "verdict.json"),
      auditPath: path.join(jobDir, "audit.json"),
    });

    expect(fs.existsSync(paths.reviewArtifactPath)).toBe(true);
    expect(fs.readFileSync(paths.reviewLedgerPath, "utf8").trim().split("\n")).toHaveLength(1);

    const gallery = readJosephRegressionGallery(paths.regressionGalleryPath);
    expect(gallery.weakExamples.map((example) => example.jobId)).toContain("job-oversight-1");
    expect(gallery.index.byFailureClass["readability-sacrifice"]).toContain("job-oversight-1");
    expect(gallery.index.byFailureClass["climax-overspend"]).toContain("job-oversight-1");
  });
});
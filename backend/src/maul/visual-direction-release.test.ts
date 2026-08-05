import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {evaluateVisualDirectionLaunchGate} from "./runtime-contracts.js";

describe("MAUL Visual Direction V1 release gate", () => {
  it("blocks launch when any candidate claims parity from a safe fallback", () => {
    const gate = evaluateVisualDirectionLaunchGate([
      {
        corpusCaseId: "case_01",
        sourceEvidenceStatus: "verified",
        placementOutcome: "SAFE_CAPTION_FALLBACK",
        referenceParityClaimed: true,
        minCompositionHoldMs: 900,
        finalFontVerified: true,
        perceptualStatus: "pass",
        blindedReview: {completed: true, candidateWon: true},
      },
    ]);

    expect(gate.launchEligible).toBe(false);
    expect(gate.blockers).toContain("fallback_reference_parity_claim");
  });

  it("requires all thirty verified cases and eighty-percent blinded preference", () => {
    const results = Array.from({length: 30}, (_, index) => ({
      corpusCaseId: `case_${String(index + 1).padStart(2, "0")}`,
      sourceEvidenceStatus: "verified" as const,
      placementOutcome: "ART_DIRECTED" as const,
      referenceParityClaimed: false,
      minCompositionHoldMs: 850,
      finalFontVerified: true,
      perceptualStatus: "pass" as const,
      blindedReview: {completed: true, candidateWon: index < 24},
    }));

    expect(evaluateVisualDirectionLaunchGate(results)).toMatchObject({
      launchEligible: true,
      blindedPreference: 0.8,
      blockers: [],
    });
  });

  it("keeps the pending corpus registry from masquerading as launch evidence", async () => {
    const registry = JSON.parse(await readFile(
      new URL("./fixtures/visual-direction-corpus.json", import.meta.url),
      "utf8",
    )) as {
      cases: Array<{caseId: string; sourceEvidenceStatus: "pending" | "verified" | "rejected"}>;
    };

    expect(registry.cases).toHaveLength(30);
    const gate = evaluateVisualDirectionLaunchGate(registry.cases.map((entry) => ({
      corpusCaseId: entry.caseId,
      sourceEvidenceStatus: entry.sourceEvidenceStatus,
      placementOutcome: "VISUAL_EVIDENCE_UNAVAILABLE" as const,
      referenceParityClaimed: false,
      minCompositionHoldMs: 0,
      finalFontVerified: false,
      perceptualStatus: "unavailable" as const,
      blindedReview: {completed: false, candidateWon: false},
    })));
    expect(gate).toMatchObject({
      launchEligible: false,
      blockers: expect.arrayContaining([
        "source_evidence_unverified",
        "blinded_review_incomplete",
      ]),
    });
  });
});

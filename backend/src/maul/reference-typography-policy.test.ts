import {createHash} from "node:crypto";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import {REFERENCE_TYPOGRAPHY_CORPUS} from "./reference-typography-corpus.js";
import {
  REFERENCE_TYPOGRAPHY_GRAMMARS,
  selectReferenceTypographyGrammar,
  validateReferenceTypographyTreatment,
} from "./reference-typography-policy.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const referenceDir = path.resolve(
  currentDir,
  "../../../Yuan Prometheus Screenshots/font pairing and placement",
);

describe("MAUL reference typography policy", () => {
  it("covers every supplied reference exactly once by filename and hash", () => {
    const suppliedFiles = readdirSync(referenceDir)
      .filter((filename) => filename.toLowerCase().endsWith(".png"))
      .sort((left, right) => left.localeCompare(right));
    const corpusFiles = REFERENCE_TYPOGRAPHY_CORPUS
      .map((entry) => entry.filename)
      .sort((left, right) => left.localeCompare(right));

    expect(REFERENCE_TYPOGRAPHY_CORPUS).toHaveLength(44);
    expect(new Set(corpusFiles).size).toBe(44);
    expect(corpusFiles).toEqual(suppliedFiles);
    for (const entry of REFERENCE_TYPOGRAPHY_CORPUS) {
      const digest = createHash("sha256")
        .update(readFileSync(path.join(referenceDir, entry.filename)))
        .digest("hex");
      expect(entry.sha256, entry.filename).toBe(digest);
      expect(REFERENCE_TYPOGRAPHY_GRAMMARS[entry.grammarId]).toBeDefined();
      expect(entry.foundationRole).not.toBe("");
      expect(entry.placementPattern).not.toBe("");
    }
  });

  it("selects an inline mixed-word grammar without forcing all caps", () => {
    const grammar = selectReferenceTypographyGrammar({
      tokenCount: 2,
      emphasisLevel: "key",
      traits: ["mixed_word_splice", "editorial_italic_hinge"],
      seed: "paragraph:portfolio",
    });

    expect(grammar.id).toBe("inline_mixed_word_splice");
    expect(grammar.caseMode).toBe("source_preserving");
  });

  it("selects deterministically for equivalent policy input", () => {
    const input = {
      tokenCount: 3,
      emphasisLevel: "hero" as const,
      traits: ["support_over_hero", "tight_stack"],
      seed: "paragraph:massive-goal",
    };

    expect(selectReferenceTypographyGrammar(input)).toEqual(
      selectReferenceTypographyGrammar(input),
    );
  });

  it("rejects a second annotation in a non-poster lockup", () => {
    expect(() => validateReferenceTypographyTreatment({
      grammarId: "inline_italic_hinge",
      foundationRole: "serif",
      annotations: ["underline", "circle"],
    })).toThrow(/one annotation/i);
  });

  it("rejects a treatment without a foundation role", () => {
    expect(() => validateReferenceTypographyTreatment({
      grammarId: "quiet_luxury",
      foundationRole: "",
      annotations: [],
    })).toThrow(/foundation role/i);
  });
});

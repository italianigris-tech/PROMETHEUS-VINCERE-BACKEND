import {describe, expect, it} from "vitest";

import {
  getTypographyPattern,
  selectTypographyTreatment,
  typographyTrainingExamples
} from "../typography-policy";

describe("typography policy", () => {
  it("selects a readable premium subtitle pattern for medium-energy subtitle copy", () => {
    const selection = selectTypographyTreatment({
      text: "This changes everything",
      role: "subtitle",
      contentEnergy: "medium",
      speechPacing: "medium",
      wordCount: 3,
      emphasisWordCount: 1
    });

    expect(selection.pattern.id).toBe("word-rise-blur-resolve");
    expect(selection.pattern.unit).toBe("word");
    expect(selection.combo?.id).toBe("subtitle-system");
  });

  it("selects a unified emotional phrase reveal for slow quote lines", () => {
    const selection = selectTypographyTreatment({
      text: "Sometimes the truth arrives quietly",
      role: "emotional-quote",
      contentEnergy: "low",
      speechPacing: "slow",
      wordCount: 5
    });

    expect(selection.pattern.id).toBe("phrase-inhale");
    expect(selection.pattern.mood).toBe("emotional");
    expect(selection.preferredUnit).toBe("phrase");
  });

  it("routes tech overlays toward clean system motion instead of risky defaults", () => {
    const selection = selectTypographyTreatment({
      text: "system workflow status sync ready",
      role: "tech-overlay",
      contentEnergy: "medium",
      speechPacing: "fast",
      wordCount: 5,
      allowRiskyPatterns: false
    });

    expect(selection.pattern.id).toBe("horizontal-mask-sweep");
    expect(selection.combo?.id).toBe("tech-data");
    expect(selection.pattern.risky).not.toBe(true);
  });

  it("keeps the example training rows aligned with real pattern ids", () => {
    const exampleIds = typographyTrainingExamples.map((example) => example.animation);

    expect(exampleIds.length).toBe(3);
    exampleIds.forEach((animationId) => {
      expect(getTypographyPattern(animationId)?.id).toBe(animationId);
    });
  });
});

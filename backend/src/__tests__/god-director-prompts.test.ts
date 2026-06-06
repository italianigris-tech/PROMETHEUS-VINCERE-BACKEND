import {describe, expect, it} from "vitest";

import {buildDirectorNotesPromptPack} from "../god/prompts";

describe("Director's Notes prompt architecture", () => {
  it("builds the required six-step motion reasoning prompt", () => {
    const promptPack = buildDirectorNotesPromptPack({
      transcript: "I want you to build premium systems.",
      brief: "Cinematic kinetic typography over a speaker matte.",
      durationMs: 2400,
      mood: "aggressive restraint"
    });

    expect(promptPack.temperature).toBe(0.7);
    expect(promptPack.systemPrompt).toContain("You are a Motion Design Director");
    expect(promptPack.userPrompt).toContain("STEP 1 - SEMANTIC ANALYSIS");
    expect(promptPack.userPrompt).toContain("STEP 6 - DIRECTOR'S NOTES JSON");
    expect(promptPack.userPrompt).toContain("DirectorNotes");
    expect(promptPack.userPrompt).toContain("why");
    expect(promptPack.userPrompt).toContain("Minimum 8 points");
  });
});

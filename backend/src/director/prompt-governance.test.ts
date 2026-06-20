import {describe, expect, it} from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {fingerprintString, PromptRegistry, validatePromptInfrastructure} from "./prompt-governance";

describe("Prompt Governance", () => {
  const registryFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "prompt-registry-")), "registry.jsonl");

  it("persists governed prompts to append-only JSONL", () => {
    const file = registryFile();
    const registry = new PromptRegistry(file);
    const prompt = registry.register("Make the hook feel sharper", {
      density: "high",
      tone: "aggressive",
      exclusions: ["no tiny captions"],
      stylePreferences: ["kinetic cuts"],
    });
    const reloaded = new PromptRegistry(file);

    expect(prompt.fingerprint).toBe(fingerprintString("Make the hook feel sharper"));
    expect(prompt.infrastructureFlags).toEqual({
      mayOverrideDeterminism: false,
      mayOverrideVariationKey: false,
      mayOverrideRenderPipeline: false,
    });
    expect(reloaded.getByFingerprint(prompt.fingerprint)).toMatchObject({
      id: prompt.id,
      version: 1,
      doctrine: {density: "high", tone: "aggressive"},
    });
    expect(fs.readFileSync(file, "utf8").trim().split("\n")).toHaveLength(1);
  });

  it("increments version when prompt text is registered again", () => {
    const registry = new PromptRegistry(registryFile());

    const first = registry.register("Keep it cinematic", {tone: "cinematic"});
    const second = registry.register("Keep it cinematic", {tone: "minimal"});

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(second.version).toBe(2);
    expect(registry.getByFingerprint(first.fingerprint)?.doctrine).toMatchObject({tone: "minimal"});
    expect(registry.list()).toHaveLength(2);
  });

  it("rejects prompt attempts to override infrastructure authority", () => {
    const registry = new PromptRegistry(registryFile());
    const validation = validatePromptInfrastructure("Use Math.random and bypass the variation key");

    expect(validation.allowed).toBe(false);
    expect(validation.blockReasons.join(" ")).toContain("forbidden render-path API");
    expect(() => registry.register("Use Math.random and bypass the variation key")).toThrow(/Prompt rejected by governance/);
  });
});
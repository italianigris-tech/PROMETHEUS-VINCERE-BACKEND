import {beforeAll, describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";

const targetPath = path.resolve(__dirname, "sequence-memory.ts");
const describeIfPresent = fs.existsSync(targetPath) ? describe : describe.skip;

describeIfPresent("Sequence Memory contract", () => {
  let createMemory: any;
  let updateMemory: any;
  let shouldBreathe: any;
  let canUseEffect: any;
  let useEffect: any;

  beforeAll(async () => {
    ({createMemory, updateMemory, shouldBreathe, canUseEffect, useEffect} = await import(new URL("./sequence-memory.ts", import.meta.url).href));
  });

  it("starts calm with full intensity budget", () => {
    const memory = createMemory();

    expect(memory.state).toBe("calm");
    expect(memory.intensityBudget).toBe(1);
  });

  it("walks the calm -> building -> saturated -> recovering state path deterministically", () => {
    let memory = createMemory();

    for (let frame = 0; frame < 600; frame += 1) {
      memory = updateMemory(memory, 0.8, frame, false);
    }
    expect(memory.state).toBe("building");

    for (let frame = 600; frame < 1200; frame += 1) {
      memory = updateMemory(memory, 0.9, frame, false);
    }
    expect(memory.state).toBe("saturated");
    expect(shouldBreathe(memory, 1200)).toBe(true);
    expect(memory.state).toBe("recovering");
  });

  it("blocks effect repetition for at least 15 seconds", () => {
    const memory = createMemory();

    expect(canUseEffect(memory, "zoom_blur", 0)).toBe(true);
    useEffect(memory, "zoom_blur", 0);
    expect(canUseEffect(memory, "zoom_blur", 100)).toBe(false);
    expect(canUseEffect(memory, "zoom_blur", 500)).toBe(true);
  });
});

import {describe, expect, it} from "vitest";
import * as fs from "fs";
import * as path from "path";
import {hashSeed, seededRandom} from "../src/index";

const repoRoot = path.resolve(__dirname, "../../..");

describe("v8.1 determinism primitives", () => {
  it("seededRandom returns the same stream for the same seed", () => {
    const left = seededRandom(12345);
    const right = seededRandom(12345);

    expect(Array.from({length: 12}, () => left())).toEqual(Array.from({length: 12}, () => right()));
  });

  it("hashSeed is stable and order-sensitive", () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1));
  });

  it("render compositions do not contain forbidden runtime APIs", () => {
    const compositionsDir = path.join(repoRoot, "remotion-app/src/compositions");
    const forbidden = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(|\brequestAnimationFrame\s*\(|\bsetInterval\s*\(|\bsetTimeout\s*\(|\bcrypto\.getRandomValues\s*\(|\bnew Date\s*\(|\bgsap\b/i;
    const violations: string[] = [];

    for (const file of fs.readdirSync(compositionsDir)) {
      if (!/\.(ts|tsx)$/.test(file)) {
        continue;
      }
      const content = fs.readFileSync(path.join(compositionsDir, file), "utf8");
      if (forbidden.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

import {evaluateJosephAnnotationHealth} from "./joseph-annotation-health";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Joseph annotation health (5 manual packets)", () => {
  it("reports discovery-healthy packets for all five Joseph references", () => {
    const report = evaluateJosephAnnotationHealth(repoRoot);

    expect(report.version).toBe("joseph-annotation-health-v1");
    expect(report.packetCount).toBe(5);
    expect(report.expectedPacketCount).toBe(5);
    expect(report.overallGoodNature).toBe(true);
    expect(report.packets.every((packet) => packet.goodNature)).toBe(true);
    expect(report.packets.every((packet) => packet.timedEventCount >= 8)).toBe(true);
    expect(report.irlImplications.some((line) => /trajectory/i.test(line))).toBe(true);
  });
});

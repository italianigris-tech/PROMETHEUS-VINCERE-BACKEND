import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

const rootSource = readFileSync(new URL("../../Root.tsx", import.meta.url), "utf8");
const maulShortSource = readFileSync(new URL("../MaulShort.tsx", import.meta.url), "utf8");
const architectureSource = readFileSync(
  new URL("../../../../docs/architecture/kinetic-causal-chain.md", import.meta.url),
  "utf8",
);

describe("MAUL production preview governance", () => {
  it("does not register the hardcoded luxury study as pipeline proof", () => {
    expect(rootSource).not.toContain("MaulLuxuryTraitShowcase");
    expect(rootSource).toContain('id="MaulShort"');
    expect(architectureSource).toContain(
      "not evidence of Font JSON provenance",
    );
  });

  it("requires production provenance and governed camera events", () => {
    expect(maulShortSource).toContain("requireTypographyProvenance: true");
    expect(maulShortSource).toContain("governedCameraEvents");
    expect(maulShortSource).toContain("manifest.plans.camera.events");
  });
});

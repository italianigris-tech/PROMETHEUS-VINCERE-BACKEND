import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {
  KINETIC_CAUSAL_PROOF_RECORD,
  KINETIC_CAUSAL_PROOF_TRACE,
} from "../KineticCausalChainProof";
import {MaulPlannedTextCard} from "../MaulPlannedTextLayer";

describe("kinetic causal-chain proof", () => {
  it("keeps semantic evidence, Font JSON authority, placement, trait, and renderer linked", () => {
    const program = KINETIC_CAUSAL_PROOF_RECORD.animationPrograms?.[0];
    const receipt = program?.kineticTreatment;

    expect(KINETIC_CAUSAL_PROOF_TRACE).toEqual([
      "semantic:currency",
      "typography:font-json",
      "placement:lower_or_center_9x16",
      "kinetic:trait_number_count_up",
      "renderer:maul-kinetic-number-count-up-v1",
    ]);
    expect(receipt?.evidence.sourceText).toBe("$10,000");
    expect(receipt?.typographyAuthority.profileId).toBe(KINETIC_CAUSAL_PROOF_RECORD.font.profileId);
    expect(receipt?.typographyAuthority.metricsFingerprint).toBe(KINETIC_CAUSAL_PROOF_RECORD.font.metricsFingerprint);
    expect(KINETIC_CAUSAL_PROOF_RECORD.boxPx.topPx).toBeGreaterThanOrEqual(960);
    expect(receipt?.renderContract.frameDeterministic).toBe(true);
  });

  it("renders the Font JSON amount at the deterministic halfway frame", () => {
    const markup = renderToStaticMarkup(
      <MaulPlannedTextCard
        record={KINETIC_CAUSAL_PROOF_RECORD}
        absoluteTimeMs={500}
        outputFrame={15}
        fps={30}
        textColor="#FFFFFF"
        accentColor="#FFD34E"
      />,
    );

    expect(markup).toContain("$9,375");
    expect(markup).toContain('data-maul-profile-typography="true"');
    expect(markup).toContain('data-maul-kinetic-trait="trait_number_count_up"');
  });
});

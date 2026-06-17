import {describe, expect, it} from "vitest";

import {textAnimationGrammarSchema} from "./text-grammar.js";

describe("textAnimationGrammarSchema", () => {
  it("describes word and letter choreography with rhythm sync and selective effects", () => {
    const grammar = textAnimationGrammarSchema.parse({
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "letter",
        delayMs: 50,
        order: "forward"
      },
      entrance: {
        type: "decode",
        durationMs: 420,
        from: {
          opacity: 0,
          y: 18,
          blur: 8
        }
      },
      hold: {
        durationMs: 900,
        breathingPulse: true
      },
      exit: {
        type: "scatter",
        durationMs: 280,
        to: {
          opacity: 0,
          y: -22
        }
      },
      sync: {
        mode: "toBeat",
        offsetMs: -30
      },
      selectiveEffects: [{
        selector: {
          text: "HELLO"
        },
        effects: {
          bloom: true,
          motionBlur: true,
          chromaticAberration: false
        }
      }]
    });

    expect(grammar.stagger.unit).toBe("letter");
    expect(grammar.entrance.type).toBe("decode");
    expect(grammar.sync.mode).toBe("toBeat");
    expect(grammar.selectiveEffects[0]?.effects.bloom).toBe(true);
  });

  it("rejects negative timing values before they reach the renderer", () => {
    const result = textAnimationGrammarSchema.safeParse({
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "word",
        delayMs: -1
      }
    });

    expect(result.success).toBe(false);
  });
});

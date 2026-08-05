# MAUL Visual Direction V1 Release Gate

MAUL Visual Direction V1 may classify a candidate as `ART_DIRECTED` only when one immutable lineage contains all of the following:

- measured scene evidence for the source composition hold;
- a rendered 540x960 preview and retained PNG frame samples;
- a Perceptual Truth pass from an invoked frame evaluator, citing retained frames;
- a Structural Quality Truth pass;
- an authenticated human approval for that same candidate, treatment, planning bundle, and Perceptual Truth; and
- a final render whose export artifact declares both truth layers as parents.

`SAFE_CAPTION_FALLBACK`, `PLACEMENT_UNRESOLVED`, and `VISUAL_EVIDENCE_UNAVAILABLE` are valid disclosed outcomes. They are never evidence of art direction, reference parity, or launch quality.

## Held-Out Corpus

`backend/src/maul/fixtures/visual-direction-corpus.json` is a registry of thirty required test slots. Every current entry is deliberately `pending`. It is not a corpus result and must not be used to support a release claim.

Before launch, each slot requires a rights-cleared raw source identifier, retained baseline and selected preview IDs, final font proof, Perceptual Truth artifact, named failure labels, and a blinded review record. The review compares baseline and selected output in randomized order without treatment identifiers.

## Acceptance

The launch gate in `evaluateVisualDirectionLaunchGate` requires:

- exactly thirty unique held-out cases;
- verified source evidence for every case;
- no fallback with a reference-parity claim;
- a minimum composition hold of 850 ms;
- verified final font rendering;
- Perceptual Truth for every `ART_DIRECTED` result;
- completed blinded review for every case; and
- at least 80% selected-candidate preference over the baseline.

The fixture suite validates the gate mechanics only. Production launch remains blocked until a controlled corpus run supplies real evidence for all thirty slots.

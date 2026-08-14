# MAUL Typography Profile Diversity Design

## Status

Approved for specification on 2026-08-14.

## Problem

Production calls the typography profile compiler with `scene_coherent` continuity. The compiler stores the first selected profile as `sceneProfile` and forces that profile whenever its consecutive-use penalty is below the hard threshold. After two uses, one alternate profile resets the consecutive counter, making the original profile immediately eligible again. A strong first match can therefore dominate an entire video.

This profile repetition also repeats its requested font families and colors. The reported run selected `Fan_Theories_Opinion_Editorial` for 9 of 13 chunks, which propagated Playfair Display and `#111111` through most profile bindings.

## Governing Constraints

- Font JSON remains authoritative for layer structure, family requests, hierarchy, spacing, static colors, and effects.
- Profile diversity may break ties only among candidates with equivalent count compatibility and viable execution.
- Background-aware contrast remains the responsibility of placement. Selection must not invent arbitrary accent colors.
- Selection remains deterministic and produces the same receipts for the same inputs and corpus.
- A sparse injected corpus must remain executable when no unused alternative exists.

## Selected Design

Remove first-profile scene pinning from the compiler. Scene coherence will continue to come from governed placement, motion, and transition stages rather than one typography specimen applied across unrelated semantic chunks.

Selection will retain bounded whole-video history:

1. Rank profiles by compatibility using the existing corpus ranker.
2. Prefer candidates used fewer than two times across the compilation when compatible alternatives exist.
3. Within the compatible candidate band, prefer a candidate whose primary requested font family differs from recent primary families.
4. Fall back to the best compatible candidate when the corpus is too small to satisfy either diversity preference.

The candidate band must preserve the selected ranking contract: minimum word distance first, then the existing close character-distance tolerance. Diversity cannot promote a structurally unsuitable profile.

No random selection, round-robin traversal of all 44 profiles, or arbitrary color palette will be added.

## Module Map

- `service.ts`: materializes semantic text chunks, selects foreground typography events, and invokes the compiler.
- `typography-event-policy.ts`: decides which materialized chunks receive foreground typography.
- `typography-profile-corpus.ts`: validates the 44 Font JSON observations and ranks compatible profiles.
- `typography-profile-compiler.ts`: selects one profile per governed chunk, resolves fonts, measures geometry, realizes layers, and emits binding receipts.
- `typography-profile-font-resolver.ts`: resolves each requested profile layer to deployed font assets.
- `typography-profile-realization.ts`: partitions stable transcript tokens into authoritative profile layers.
- `shorts-text-placement.ts` and `typography-profile-contrast.ts`: place measured realizations and apply static black-or-white contrast correction from observed video luminance.
- `MaulProfileTypographyGroup.tsx`: renders immutable profile realization and placement receipts.

## Tests

- Add a compiler regression reproducing the 13 spoken chunks with a controlled compatible corpus and prove no profile exceeds two uses while alternatives remain.
- Prove the original scene-profile bounce pattern cannot recur after one alternate.
- Prove recent primary-family diversity influences equivalent candidates.
- Preserve single-profile fallback behavior and deterministic replay.
- Run focused corpus/compiler tests, MAUL backend tests, and type checking.

## Acceptance Criteria

- `Fan_Theories_Opinion_Editorial` or any other profile cannot dominate a normal multi-profile compilation through scene pinning.
- No profile is selected more than twice when an equivalently compatible underused candidate exists.
- Equivalent candidates avoid repeated primary font families when possible.
- Profile selection never sacrifices word-count compatibility for cosmetic variety.
- Authored colors remain traceable; placement contrast overrides remain explicit.

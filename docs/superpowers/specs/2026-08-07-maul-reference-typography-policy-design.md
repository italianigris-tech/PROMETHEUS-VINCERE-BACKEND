# MAUL Reference Typography Policy Design

**Status:** Approved design direction; implementation pending

**Date:** 2026-08-07

**Goal:** Turn the 44 supplied Prometheus typography references into a governed MAUL typography, placement, animation, and source-treatment policy that produces high-quality editorial lockups for the supplied paragraph without defaulting to all caps, amber accents, or whole-segment movement.

## Context

The current MAUL path already has semantic typography roles, a local font registry, an animation registry, editorial lockups, and independent pixel observation. The Scene A proof exposed three gaps:

- Scene A pins `Almera` and `Leviathan Italic`; it does not rank the governed font registry.
- `buildMaulEditorialLockup` applies accent scale, offsets, overlap, and rotation after primary-only placement metrics are approved.
- `planning.ts` and `MaulPlannedTextLayer.tsx` allow segment-scoped motion and currently add reveal drift to the final word position. Registered treatment names are richer than the generic transform families that execute them.

The current visual finish is also partly incidental: the canonical renderer has a source filter and a bottom-density gradient, while the fixture carrier supplies a dark background. This design makes that finish explicit and testable without changing source pixels or inventing a new image asset.

## Reference Corpus

The supplied folder contains 44 PNG references. The observations below are visual-geometry observations, not OCR labels. Each observation records the dominant foundation, the contrast device, and the placement or mark that should be reusable.

| Ref | File | Extracted grammar |
|---:|---|---|
| 01 | `image (66).png` | Script headline over a quiet serif foundation; tight two-line stack. |
| 02 | `image (67).png` | Centered serif headline with small support line and generous whitespace. |
| 03 | `image (68).png` | Heavy sans foundation with italic color hinge touching the baseline. |
| 04 | `image (69).png` | Large display word, small support phrase, circle annotation, and soft green hierarchy. |
| 05 | `image (1).png` | Small italic setup above oversized serif hero; baseline overlap. |
| 06 | `image (10).png` | Small preposition over large serif noun; vertical scale contrast. |
| 07 | `image (11).png` | Oversized serif lead with small lower-case support and punctuation as a graphic stop. |
| 08 | `image (12).png` | Thin stacked support lines resolving into one heavy lower hero word. |
| 09 | `image (13).png` | Large script word crossing a large serif word; shared visual center. |
| 10 | `image (14).png` | Tall condensed foundation with script accent, micro-label, and blue baseline intervention. |
| 11 | `image (15).png` | Extreme crop of the same tall-foundation/script-overlap grammar; edge tension is intentional. |
| 12 | `image (16).png` | Dense poster stack; blue highlight blocks and red underline/circle mark semantic keywords. |
| 13 | `image (17).png` | Sentence-case serif phrase with italic final hinge; period completes the lockup. |
| 14 | `image (18).png` | Quiet thin support around one bold center word; hierarchy through weight, not color. |
| 15 | `image (19).png` | Serif sentence with one underlined word and a hand-drawn oval around the phrase. |
| 16 | `image (2).png` | Blue premium wordmark treatment; italic support is smaller and subordinate. |
| 17 | `image (20).png` | Small serif setup over oversized bold hero; corner color notch is secondary. |
| 18 | `image (21).png` | Small sentence above two-line bold serif block; counters and overlap create rhythm. |
| 19 | `image (22).png` | Inline serif phrase with one italic keyword; no extra decoration required. |
| 20 | `image (23).png` | Two-line serif stack with the lower line acting as the visual anchor. |
| 21 | `image (24).png` | Italic display lead behind a bold sans hook; color change separates roles. |
| 22 | `image (25).png` | Warm italic phrase over a smaller serif support; underline is local and loose. |
| 23 | `image (26).png` | Bold all-caps header plus small outlined/underlined support pill; compact spacing. |
| 24 | `image (27).png` | Mixed word styling inside `portfolio`: first segment is display, second is italic. |
| 25 | `image (28).png` | Three-line bold poster stack; final italic line provides the release. |
| 26 | `image (29).png` | Large serif stack with circled `don't`; annotation follows the word contour. |
| 27 | `image (3).png` | Heavy display name with delicate handwritten descriptor beneath. |
| 28 | `image (30).png` | Blue italic sentence with selective underlines and broad vertical stacking. |
| 29 | `image (31).png` | Serif phrase with circled `hate` and italicized final noun; emphasis is semantic. |
| 30 | `image (32).png` | Single italic keyword as a quiet hinge; large negative space is part of the composition. |
| 31 | `image (33).png` | Micro label above oversized italic/serif hero; crop intentionally lets the hero breathe past bounds. |
| 32 | `image (34).png` | Small italic `team` over bold `SYNC`; near-zero gap and shared left anchor. |
| 33 | `image (35).png` | Oversized numeric hero with compact stacked support; scale carries the message. |
| 34 | `image (36).png` | Condensed bold setup with italic `convert`; inline contrast, not a separate card. |
| 35 | `image (37).png` | Red/white two-word stack with strong baseline alignment and no movement implied. |
| 36 | `image (38).png` | Script support over large orange serif hero; color is role-specific. |
| 37 | `image (39).png` | Small support over a large red hero over an image; source and text share contrast. |
| 38 | `image (4).png` | Tall condensed display word with handwritten descriptor beneath. |
| 39 | `image (5).png` | Serif sentence, italic keyword, and red underline; line spacing is intentionally tight. |
| 40 | `image (6).png` | Lower-case script lead above tiny condensed support; quiet, luxury treatment. |
| 41 | `image (7).png` | Script `Old` interlocks with bold serif `Money`; shared anchor and overlap. |
| 42 | `image (8).png` | Large script word crossing bold condensed support; arrow annotation supplies direction. |
| 43 | `image (9).png` | Oversized serif/script weave; one composition, not independently drifting words. |
| 44 | `image.png` | Lower-case italic phrase with tiny support line; restrained, editorial, and whitespace-led. |

## Policy

### 1. Semantic roles

Every lockup must assign tokens to `foundation`, `support`, `accent`, or `annotation`. A lockup may use one foundation and at most one primary accent intervention. Support text may be small, but it must remain readable and geometrically accounted for. An annotation is attached to a token or token range; it is never a free-floating decoration.

The supplied paragraph is chunked at rhetorical boundaries, not every sentence into a uniform caption. Candidate phrases include `speed is everything`, `clear strategy`, `running in circles`, `true business growth`, `absolute focus`, `deepest pain points`, `eliminate the friction`, `align your team`, `massive goal`, `stop guessing`, and `build a system`. The planner may choose fewer or more chunks when timing evidence requires it, but it must preserve the source words and semantic emphasis.

### 2. Case and font pairing

Sentence case and mixed case are valid defaults. All caps are permitted only when the semantic role is display and the selected font has a measured uppercase rhythm that does not overwhelm the scene. A mixed-style word is represented as one semantic token with multiple glyph spans, so `PORT` + italic `folio` remains one anchored word.

Font selection searches the complete available registry, then filters to renderable, locally hydrated, license-cleared assets with required glyph coverage. The compatibility score must include role contrast, x-height/cap-height relationship, width rhythm, italic/script compatibility, weight contrast, and shaped sample geometry. The live checkout may expose only a hydrated subset; it must report that limitation instead of claiming the full 577-font corpus was rendered.

### 3. Placement and overlap

Placement is solved from the final rendered envelope. The envelope includes every selected font's shaped bounds, style scale, offsets, rotation, overlap, annotation, and the largest motion excursion before the hold. The renderer consumes the same compiled envelope. A placement mismatch is a hard quality failure; tolerance widening is prohibited.

Each word receives a normalized anchor and a local baseline. The anchor is invariant through the hold. Negative gaps are allowed only between explicitly related roles, only after glyph collision and subject-safe checks pass, and only when the overlap improves the hierarchy score. Rotation defaults to zero; non-zero rotation requires a reference-derived rationale and a bounded optical correction.

### 4. Color and source treatment

The default text palette is ivory/white plus scene-derived neutrals. An accent color is optional and must be justified by semantic emphasis or source contrast. Yellow/amber is not a default. Circle, underline, highlight, and strike-through marks are limited to one keyword or phrase per lockup unless the treatment explicitly declares a poster grammar.

The current subject treatment becomes `subject_focus_grade_v1`: preserve the immutable RGBA matte, use the existing source filter, apply the existing lower-frame density gradient, and add a governed edge falloff only when the scene evidence benefits from it. The grade is recorded in the declared composition and independently observable in the render; it does not change source identity or crop authority.

### 5. Motion

Segment-scoped movement is forbidden for editorial lockups. The segment may control opacity as a group, but word/letter choreography owns the reveal. The final transform for every word must be the planned transform exactly.

Allowed reveal primitives are mask reveal, opacity fade, local blur-to-sharp, tracking collapse, local scale settle, baseline settle, underline/circle draw-on, and letter/word stagger. A primitive may move a glyph within its local reveal envelope, but it may not translate the word's anchor across the frame or drift during hold. Each program declares its target scope, token IDs, local envelope, and final identity transform.

Animation selection uses role, word count, duration, and sequence cooldown. Adjacent lockups may not reuse the same treatment family unless a protected pause or rhetorical repetition explicitly justifies it. The system prefers readable holds and exits faster than entries.

## Architecture

Add a versioned `maul-reference-typography-policy` module behind the existing semantic typography and placement seams. It owns:

1. Reference observations and grammar tags.
2. Font-pair compatibility scoring and shortlist selection.
3. Lockup role assignment, case policy, annotations, and placement envelope inputs.
4. Word/letter animation admissibility and sequence cooldown.
5. Source-treatment profile selection.

The existing semantic typography tree remains the authority for source-grounded hierarchy. The placement planner remains the authority for scene-safe coordinates. `MaulEditorialLockup` carries the realized role and anchor contract. The Remotion layer executes the compiled contract and never invents fallback transforms.

## Verification

The implementation is complete only when:

- Reference observation tests cover all 44 source files by hash and stable grammar tags.
- Pair ranking tests prove the full available registry is searched and the hydrated/licensed limitation is explicit.
- Lockup tests reject missing roles, unmeasured accents, unbounded overlap, default arbitrary rotation, and mixed-style tokens split into separate anchors.
- Animation tests prove word anchors are identical at entry completion, hold samples, and exit start; no segment program translates a lockup.
- Source-treatment tests prove `subject_focus_grade_v1` is declared and rendered by the canonical `MaulShort` path.
- The supplied paragraph renders through the female matte fixture with independently observed line breaks, bounds, treatment visibility, and temporal stability.
- The final fidelity report has no hard failures and no placement mismatch.
- A blinded review package is retained for human aesthetic judgment; machine verification does not claim aesthetic parity by itself.

## Non-goals

- Brute-force rendering every font pair.
- Training a learned visual evaluator from these 44 images.
- Copying any reference's exact wording, identity, or layout as a preset.
- Changing source media, matte edges, or scene authority.
- Treating a successful Remotion render as proof of aesthetic quality without review evidence.

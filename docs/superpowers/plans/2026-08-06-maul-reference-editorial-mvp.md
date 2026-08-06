# MAUL Reference Editorial MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MAUL 9:16 shorts execute a governed, reference-derived editorial rhythm with renderer-verified dynamic typography instead of choosing disconnected preset animations or silently falling back to a baked-in font.

**Architecture:** An `Editorial Rhythm Program` is deterministically derived from approved abstract Reference Traits, the selected creative treatment, semantic chunks, and the sequence seed. It chooses one renderer-verified MAUL font system and a contrast-preserving sequence of phrase-level animation treatments. The program is recorded in the art-direction plan, informs measured typography and animation planning, and is consumed by the Remotion text layer, so every decision is traceable through the Unified Render Manifest to pixels.

**Tech Stack:** TypeScript, Zod shared contracts, Vitest, Fontkit measurements, Remotion, `@remotion/fonts`.

---

## Scope and Guardrails

- Analyze supplied references only into abstract traits: phrase-level hierarchy, editorial type contrast, deliberate holds, semantic-hinge emphasis, and cut-led rhythm. Do not copy creator identity, assets, wording, or exact timestamps.
- Zilliz is the production font-intelligence source. MAUL may use any live candidate only after it resolves to a license-cleared, locally hydrated browser asset whose exact SHA-256 is measured by Fontkit and persisted for Remotion. This checkout contains 20 hydrated font binaries, with 15 eligible after license filtering; the local Zilliz/Milvus endpoint is disabled and unavailable in this shell, so live deployment readiness remains unproven rather than silently claiming the full 577-font library is available.
- Extend the renderer catalog to represent the already-loaded Playfair italic asset. Never use family-name matching as evidence that the selected binary is loaded.
- The program must retain existing safe placement, protected pauses, source fidelity, and animation continuity constraints. It may vary presentation but cannot move a caption outside its planned geometry or rewrite source tokens.
- Audio choreography remains on the existing audio treatment path in this MVP; the rhythm program supplies only named semantic beat intent for it to consume later. No placeholder or silent SFX assets are introduced.

## File Structure

- Create: `backend/src/maul/reference-editorial-rhythm.ts` - derives a deterministic program and per-segment treatment sequence from traits, treatment, chunk roles, and seed.
- Create: `backend/src/maul/reference-editorial-rhythm.test.ts` - proves determinism, anti-repetition, protected-hold behavior, and unknown-trait fallback.
- Modify: `packages/shared-types/src/maul.ts` - adds the renderer-safe italic asset and the serializable art-direction rhythm-program contract, with a backward-compatible default.
- Modify: `packages/shared-types/src/maul.test.ts` - proves the new contract accepts only known systems and preserves old manifest fixtures.
- Modify: `backend/src/maul/creative-treatment-planner.ts` - constrains the treatment prompt to reference-derived editorial intent rather than a named visual preset.
- Modify: `backend/src/maul/typography-layout.ts` - resolves a selected system to exact browser paths and Fontkit binaries before layout measurement.
- Modify: `backend/src/maul/typography-layout.test.ts` - proves each chosen system is measured from an executable asset and unavailable systems cannot enter layout.
- Modify: `backend/src/maul/planning.ts` - accepts the program and compiles its segment treatments into the existing continuous text-animation plan.
- Modify: `backend/src/maul/planning.test.ts` - proves program choices survive planning and contrast across adjacent segments.
- Modify: `backend/src/maul/service.ts` - derives the program from approved Reference Corpus traits, passes it to typography and animation planning, and persists it in art direction.
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts` - proves an approved trait changes the artifact/manifest selection and remains renderable end-to-end.
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx` - resolves the planned primary and accent assets from the program; removes the hard-coded Playfair override; emits diagnostics for selected assets.
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.test.tsx` - proves the renderer uses planned systems and a program changes visible font/motion state.

### Task 1: Define the Render-Safe Editorial Program

**Files:**
- Create: `backend/src/maul/reference-editorial-rhythm.test.ts`
- Create: `backend/src/maul/reference-editorial-rhythm.ts`
- Modify: `packages/shared-types/src/maul.ts`
- Test: `packages/shared-types/src/maul.test.ts`

- [x] **Step 1: Write failing contract and derivation tests.**
  - Given the approved traits `phrase lockup`, `editorial type contrast`, and `deliberate hold`, assert the same seed yields the same font system and sequence.
  - Assert adjacent supporting segments never receive the same treatment when an alternative exists, a hero segment receives a distinct escalation treatment, and a protected-pause chunk selects a hold-preserving treatment.
  - Assert a system that names an unknown font asset is rejected by the shared schema.

- [x] **Step 2: Run the focused tests and record the expected RED failure.**
  - Run: `npm --workspace @prometheus/backend test -- src/maul/reference-editorial-rhythm.test.ts`.

- [x] **Step 3: Add the minimal serializable program contract and deterministic derivation.**
  - Use stable identifiers such as `grotesk_editorial_hinge`, `condensed_kinetic_hinge`, and `serif_editorial_hinge`, not raw arbitrary font names.
  - Choose from an intentionally small treatment set that has existing renderer behavior; do not add another generic animation catalog.
  - Include a rationale/trait receipt so output remains inspectable.

- [x] **Step 4: Re-run focused contract and derivation tests.**

### Task 2: Make Typography Selection Executable and Measured

**Files:**
- Modify: `backend/src/maul/typography-layout.ts`
- Modify: `backend/src/maul/typography-layout.test.ts`

- [x] **Step 1: Write failing tests for the selected font systems.**
  - Each system must resolve an exact local binary, browser URL, catalog asset ID, and Fontkit measurement.
  - Assert the unhydrated 577-font library cannot be selected even when a matching family appears in its JSON manifest.

- [x] **Step 2: Run the focused typography test and observe RED.**
  - Run: `npm --workspace @prometheus/backend test -- src/maul/typography-layout.test.ts`.

- [x] **Step 3: Implement system-aware measured typography.**
  - Extend the provider input with the selected system ID.
  - Resolve live Zilliz candidates only against exact hydrated assets, then retain the local renderer catalog as the explicit dev/recovery path.
  - Fail closed if the license receipt, exact binary, SHA-256, or renderer browser URL is absent.

- [x] **Step 4: Re-run the focused typography test.**

### Task 3: Compile Editorial Rhythm Through the Planning Bundle

**Files:**
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/planning.test.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`

- [x] **Step 1: Write failing animation-plan tests.**
  - Assert the program’s segment sequence, not a random preset pool, selects the animation treatment.
  - Assert animation phase continuity, minimum readable hold, protected pause preservation, and non-repetition remain valid.

- [x] **Step 2: Run the focused planning test and observe RED.**
  - Run: `npm --workspace @prometheus/backend test -- src/maul/planning.test.ts`.

- [x] **Step 3: Thread the program into service orchestration.**
  - Derive it from approved Reference Corpus traits only.
  - Persist it in `art_direction_plan`.
  - Pass its font system to measured typography and its treatment sequence to text animation planning.
  - Preserve governed safe-caption fallback, with an explicit rhythm-aware fallback receipt.

- [x] **Step 4: Run the focused planning and render-path tests.**
  - Run: `npm --workspace @prometheus/backend test -- src/maul/planning.test.ts src/__tests__/maul-short-render-path.test.ts`.

### Task 4: Make the Renderer Obey the Program

**Files:**
- Create: `remotion-app/src/compositions/MaulPlannedTextLayer.test.tsx`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`

- [x] **Step 1: Write a failing component test.**
  - Render a planned card with each system and assert the primary/active-accent elements expose the planned asset and family.
  - Assert `editorial_display` no longer forces Playfair when the plan chooses Bebas or DM Serif.
  - Assert two rhythm programs at a non-boundary frame produce different text transforms or type hierarchy.

- [x] **Step 2: Run the focused renderer test and observe RED.**
  - Run: `npm --prefix remotion-app test -- src/compositions/MaulPlannedTextLayer.test.tsx`.

- [x] **Step 3: Resolve text styles from the program.**
  - Reuse the existing `@remotion/fonts` loading path for only known local assets.
  - Render `record.font` as the authoritative primary face; resolve the accent from the selected system rather than a hard-coded family.
  - Add data attributes that expose the selected primary and accent asset IDs for render-contract diagnostics.

- [x] **Step 4: Re-run the focused renderer test.**

### Task 5: Verify the Vertical Slice

**Files:**
- Modify: `docs/superpowers/plans/2026-08-06-maul-reference-editorial-mvp.md` (mark executed steps during delivery)

- [x] **Step 1: Run shared contracts and all MAUL backend tests.**
  - Run: `npm --workspace @prometheus/shared-types test` and `npm --workspace @prometheus/backend test -- src/maul src/__tests__/maul-short-render-path.test.ts`.

- [x] **Step 2: Type-check both consumers.**
  - Run: `npm --workspace @prometheus/backend run typecheck` and `npm --prefix remotion-app run typecheck`.

- [x] **Step 3: Produce a small real render proof if the local renderer is available.**
  - Sample a frame before the program’s first hinge and one during it; prove pixel difference is driven by the planned font/motion state rather than a seed overlay.
  - If headless WebGL/Remotion is unavailable, preserve architecture and report the renderer-specific blocker with the unit/render-contract evidence that did run.

- [x] **Step 4: Inspect the diff against the plan and report any unimplemented item precisely.**

### Task 5A: Harden Reference-Level Editorial Lockups

- [x] Use duration-aware primary/accent hierarchy, deliberate overlap, and explicit semantic hinge receipts so script accents are never invented only in the renderer.
- [x] Preserve planned line boundaries with non-wrapping renderer layers, compose editorial transforms with word-reveal animation, and resolve root-relative font URLs through Remotion's static-file contract.
- [x] Infer italic/oblique style from hydrated font metadata, correct hydrated taxonomy roles, and use a governed Great Vibes accent receipt with the Fontkit-measured hydrated Almera primary in the native proof.
- [x] Widen subject-integrated composition geometry for phrase lockups while retaining safe placement and minimum-legibility constraints.

### Task 6: Make Live Font Resolution a Render Contract

- [x] **Step 1: Persist an exact font receipt.**
  - Record asset ID, CSS family, weight/style, renderer URL, local binary path, SHA-256, format, source, and license evidence in `fontResolution`.
  - Keep legacy manifests compatible by treating the receipt as optional only for the established bundled catalog.

- [x] **Step 2: Align Zilliz candidates, hydration, and Remotion.**
  - Query `FONT_INTELLIGENCE_MILVUS_COLLECTION` with its own embedding model/dimensions.
  - Select only candidates whose IDs have matching hydrated binaries and license receipts; reject missing or review-only assets.
  - Load the persisted browser URL in Remotion rather than resolving a font from a family name.

- [x] **Step 3: Make materialization immutable and renderer-visible.**
  - Write retrieved binaries below `remotion-app/public/fonts/retrieved/<sha256>/`.
  - Preserve the content-addressed cache at backend startup so persisted manifests remain valid.

- [ ] **Step 4: Prove the deployed live path.**
  - With production `ASSET_MILVUS_ENABLED`, `MILVUS_ADDRESS`, credentials, and hydrated binaries mounted, confirm `/health/zilliz` reports `healthy`, generate one MAUL plan with non-bundled `selectedAsset.source = "hydrated_library"`, and render that manifest in Remotion.

## Delivery Record

- Shared contracts: `npm --workspace @prometheus/shared-types test` passed, 116 tests.
- MAUL backend: `npm --workspace @prometheus/backend test -- src/maul src/__tests__/maul-short-render-path.test.ts` passed, 123 tests.
- Remotion composition tests: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx src/compositions/__tests__/MaulShort.test.ts` passed, 40 tests on a standalone rerun.
- All three typechecks passed: `@prometheus/shared-types`, `@prometheus/backend`, and `remotion-app`; `git diff --check` also passed.
- The registered `MaulShort` composition rendered the native 1080x1920 proof `/tmp/maul-native-editorial-proof-final2.mp4` (3.328 seconds, SHA-256 `b057cf169434d6b7a34a7d1f1c916d65a1d063b43ef661aced66486ae59fcd2e`). Browser inspection decoded the same output at 540x960; the explicit first-frame capture is `/tmp/maul-browser-t0.png`, and existing 1s/2s/3s captures show the governed lockup, script hinge, and forward word reveal.
- The proof's primary receipt is the Fontkit-measured hydrated Almera binary (`font_almera_baa51ed42a1d`) paired with the exact Great Vibes accent receipt; no renderer-only font invention remains in the proven path.
- The render engine itself requires `ffmpeg` only for preview-frame extraction. This environment lacks that binary, so the still proof used Remotion's native renderer. The normal render path is otherwise validated to composition render, and the existing preview-extraction dependency remains a separate environment requirement.
- Zilliz-backed dynamic font resolution now selects only candidates whose exact IDs map to hydrated, license-cleared renderer binaries. Materialized fonts are immutable SHA-256 paths under Remotion's public directory, and their cache is preserved at backend startup. The six local fonts remain a dev/recovery path when live retrieval is disabled; when Zilliz is enabled, a missing hydrated binary blocks planning with an explicit diagnostic. This checkout's hydrated library is present locally, but `ASSET_MILVUS_ENABLED=false`, no local listener is available, and no token is configured, so the deployed live path remains unproven until the enabled runtime returns candidates and a real dynamic-font render completes.

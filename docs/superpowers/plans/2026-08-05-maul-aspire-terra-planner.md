# MAUL Aspire Terra Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route a bounded Terra LLM treatment planner into MAUL's existing 9:16 art-direction lineage and make its reference-shaped decisions observable in the rendered typography path.

**Architecture:** Add a small OpenAI-compatible provider in `backend/src/maul/creative-treatment-planner.ts`. Its validated output is attached to the existing `art_direction_plan`, while deterministic scene evidence, placement, font loading, render preview, Perceptual Truth, and human review remain gates. Configure the test credential only in ignored `backend/.env.local`.

**Tech Stack:** TypeScript, Zod, Fastify service injection, Vitest, existing OpenAI-compatible Chat Completions endpoint, existing Remotion MAUL manifest adapter.

---

### Task 1: Lock the treatment provider contract

**Files:**
- Create: `backend/src/maul/creative-treatment-planner.ts`
- Test: `backend/src/maul/creative-treatment-planner.test.ts`
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] Write a failing test asserting an invoked Terra response returns a validated `aspire_visual_hook` treatment, receipt, and request hash.
- [ ] Run `npm.cmd test -- --run src/maul/creative-treatment-planner.test.ts` and observe the missing-module failure.
- [ ] Add the minimal Zod contract and provider interface with fields for `compositionDirection`, `primaryRole`, `accentRole`, `palette`, `textDensity`, `emphasisMode`, `motionMode`, `rationale`, and receipt status.
- [ ] Add tests for missing key, HTTP failure, invalid JSON, and invalid treatment output producing deterministic fallback receipts.
- [ ] Implement the bounded client with `model`, `reasoning_effort: "high"`, `temperature: 0.2`, JSON response mode, response-size limit, and no raw response logging.
- [ ] Run the focused test and verify all provider cases pass.

### Task 2: Route Terra into MAUL planning

**Files:**
- Modify: `backend/src/config.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/planner-audit.ts`
- Test: `backend/src/maul/planning.test.ts`
- Test: `backend/src/__tests__/maul-planner-authority-scope.test.ts`

- [ ] Add `MAUL_CREATIVE_PLANNER_BASE_URL`, `MAUL_CREATIVE_PLANNER_PATH`, `MAUL_CREATIVE_PLANNER_API_KEY`, `MAUL_CREATIVE_PLANNER_MODEL`, `MAUL_CREATIVE_PLANNER_REASONING_EFFORT`, `MAUL_CREATIVE_PLANNER_TEMPERATURE`, and bounded timeout/output settings with Terra defaults.
- [ ] Add the provider as an injected `MaulProjectService` dependency, defaulting to the configured adapter.
- [ ] Call it after the Joseph direction and scene evidence summary are available, using transcript facts, treatment identity, source mode, and reference traits only.
- [ ] Attach the validated result and receipt to `art_direction_plan`; preserve explicit fallback status.
- [ ] Update planner audit to report the actual creative-planner invocation instead of leaving the visual authority entirely unavailable when the provider ran.
- [ ] Add a planning test proving the treatment receipt is a parent-linked, replay-visible part of the planning bundle.
- [ ] Run the MAUL planning and authority tests.

### Task 3: Make the treatment render-visible

**Files:**
- Modify: `backend/src/maul/composition-candidates.ts`
- Modify: `backend/src/maul/scene-evidence.ts`
- Modify: `backend/src/maul/shorts-text-placement.ts`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`
- Tests: existing composition, placement, and Remotion MAUL tests

- [ ] Add a preferred-direction score boost and reference-safe treatment metadata without allowing the model to supply coordinates.
- [ ] Use the model's hierarchy and accent mode to select the existing display/grotesk roles and phrase-level emphasis path.
- [ ] Render the chosen treatment with explicit data attributes for model, composition direction, type roles, accent mode, and motion mode.
- [ ] Add assertions that the rendered MAUL layer exposes these values and that fallback output remains labeled as fallback.
- [ ] Run backend placement and Remotion focused tests.

### Task 4: Configure and smoke-test the test credential

**Files:**
- Create locally, ignored: `backend/.env.local`
- Do not commit or print the credential.

- [ ] Write the supplied key into `MAUL_CREATIVE_PLANNER_API_KEY` and `MAUL_CHUNKING_LLM_API_KEY` in `backend/.env.local`, using `gpt-5.6-terra` and high reasoning for the creative planner.
- [ ] Verify only boolean presence, never the key value.
- [ ] Run a live synthetic planner request against the configured provider; send no user video, source asset, or secret to logs.
- [ ] Confirm the response receipt reports `invoked` or capture the provider failure and ensure deterministic fallback remains valid.

### Task 5: Full verification

- [ ] Build `packages/shared-types` so backend imports current generated contracts.
- [ ] Run focused backend MAUL tests.
- [ ] Run the backend typecheck.
- [ ] Run the Remotion focused MAUL tests and typecheck where dependencies permit.
- [ ] Run `git diff --check` and confirm no secret-bearing tracked files are present.
- [ ] Report exact live-provider and render limitations; do not claim reference parity without a real rendered sample and review evidence.

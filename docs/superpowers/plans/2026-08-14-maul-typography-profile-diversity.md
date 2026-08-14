# MAUL Typography Profile Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop one Font JSON profile and primary font family from dominating a multi-chunk MAUL video while preserving deterministic count compatibility and authored styling.

**Architecture:** Keep compatibility and diversity ordering in `typography-profile-corpus.ts`, where profiles are already ranked. Replace consecutive-only history with whole-compilation profile counts, add resolved-primary-family history from the deployed font resolver, remove compiler scene pinning, and let sparse corpora fall back deterministically.

**Tech Stack:** TypeScript, Vitest, Zod-validated Font JSON corpus, npm workspaces.

## Global Constraints

- Font JSON remains authoritative for layer structure, family requests, hierarchy, spacing, static colors, and effects.
- Diversity may affect only candidates in the best word-distance, aspect, and close-character compatibility tier.
- Selection remains deterministic.
- No random profile rotation or invented color palette.
- Sparse corpora remain executable when every compatible profile reached its diversity limit.

---

### Task 1: Compatibility-Gated Diversity Ranking

**Files:**
- Modify: `backend/src/maul/typography-profile-corpus.ts`
- Test: `backend/src/maul/typography-profile-corpus.test.ts`

**Interfaces:**
- Consumes: `TypographyProfileObservation`, full `recentlyUsedProfileNames`, and full `recentlyUsedPrimaryFontFamilies` history.
- Produces: `primaryTypographyLayer(profile)`, `typographyProfilePrimaryFamilyKey(profile)`, and ranked candidates with profile/family reuse penalties applied after compatibility gates. Compiler may supply a resolved-family key callback.

- [ ] **Step 1: Write failing ranking tests**

Add tests proving an `A, A, B` history still blocks `A`, a used family loses to an equivalent unused family, and a closer word-count profile beats an unused but incompatible profile.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm --workspace @prometheus/backend test -- src/maul/typography-profile-corpus.test.ts
```

Expected: new whole-history and family-diversity assertions fail against consecutive-only ranking.

- [ ] **Step 3: Implement ranking policy**

Export one primary-layer helper using existing visual-scale ordering. Count total profile uses and normalized resolved primary-family uses. Sort by word distance, aspect penalty, close-character tier, profile reuse, family reuse, semantic score, expressiveness, exact character distance, then source identity. Use a large penalty at two uses, but retain candidates so sparse corpora still return a result.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run same Vitest command. Expected: all corpus tests pass.

### Task 2: Remove Scene Magnet And Reproduce Reported Run

**Files:**
- Modify: `backend/src/maul/typography-profile-compiler.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`
- Test: `backend/src/maul/typography-profile-compiler.test.ts`

**Interfaces:**
- Consumes: enhanced `rankTypographyProfiles` and `typographyProfilePrimaryFamilyKey`.
- Produces: `TypographyProfileCompiler.compile()` without `continuityMode`; each chunk contributes full profile and primary-family history to subsequent selections.

- [ ] **Step 1: Write failing 13-chunk regression**

Compile the reported spoken chunks against the real corpus. Assert no profile exceeds two total uses, `Fan_Theories_Opinion_Editorial` does not bounce back after reaching its cap, and no requested primary-family key dominates through scene pinning.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm --workspace @prometheus/backend test -- src/maul/typography-profile-compiler.test.ts
```

Expected: current `sceneProfile` selection exceeds whole-video cap.

- [ ] **Step 3: Implement minimal compiler change**

Delete `sceneProfile`, `sceneCandidate`, `continuityMode`, and eight-entry history truncation. Select `ranked[0]`, retain full profile history, and append `typographyProfilePrimaryFamilyKey(selected.profile)` after each selection. Remove production/test callers' `continuityMode` property.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run compiler and corpus test files together. Expected: all pass.

- [ ] **Step 5: Verify integration and types**

Run:

```bash
npm run test:maul
npm run typecheck:maul
```

Expected: zero failed tests and zero type errors.

- [ ] **Step 6: Inspect final diff and commit**

Run `git diff --check`, confirm only planned files changed, then commit implementation and regression tests.

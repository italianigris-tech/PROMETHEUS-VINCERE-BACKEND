# MAUL Authoritative Typography Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every materialized MAUL text chunk select, measure, place, persist, prove, and render an authoritative JSON typography profile with exact or closest-compatible deployed font receipts.

**Architecture:** Add a deep `TypographyProfileCompiler` module after chunk materialization. It loads the 44 observed profiles, ranks them by chunk counts, resolves each layer through the 577-font intelligence catalog filtered by deployed assets, and returns chunk-indexed bindings. Placement, editorial lockups, typography motion, Quality Truth, and the Remotion adapter consume the same bindings while legacy plan-level typography remains an explicit adapter.

**Tech Stack:** TypeScript, Zod, Fontkit, Vitest, Remotion, existing MAUL plan schemas, existing font taxonomy/hydration manifests.

## Global Constraints

- New MAUL jobs use per-chunk typography bindings; legacy plan-level jobs remain readable.
- The 577-font taxonomy defines similarity, but only exact `MaulResolvedFontAsset` receipts may render.
- Missing requested families retain the selected JSON profile and produce explicit substitution receipts.
- MediaPipe, annotations, media-aware color correction, and animation-corpus expansion are outside this plan.
- No production code is written before its failing test is observed.
- Unrelated artifact deletions in the dirty worktree are never staged or reverted.

---

### Task 1: Shared Chunk Typography Contract

**Files:**
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/index.ts` only if the existing export surface requires it
- Test: `packages/shared-types/src/maul.test.ts`

**Interfaces:**
- Produces: `maulChunkTypographyBindingSchema`, `MaulChunkTypographyBinding`, and optional `chunkTypographyBindings` on every typography-motion-plan version.
- Consumes: `maulResolvedFontAssetSchema` and `maulTypographyCompatibilityProfileSchema`.

- [ ] **Step 1: Write the failing shared-schema tests**

Add fixtures proving that a binding carries `chunkId`, profile provenance, count distances, layer substitution receipts, exact assets, compatibility profile, measured layout, binding hash, and timing. Add failures for duplicate chunk IDs, invalid hashes, and a selected layer whose asset receipt does not match its selected family/weight/style.

```ts
expect(maulTypographyMotionPlanV3PayloadSchema.parse({
  ...validV3,
  chunkTypographyBindings: [bindingA, bindingB],
}).chunkTypographyBindings).toHaveLength(2);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm --prefix packages/shared-types test -- src/maul.test.ts`

Expected: fail because `chunkTypographyBindings` and its schema do not exist.

- [ ] **Step 3: Implement the schema**

Use a strict shape equivalent to:

```ts
const maulTypographyLayerBindingSchema = z.object({
  layerName: idSchema,
  role: idSchema,
  requestedFamilies: z.array(idSchema).min(1),
  requestedWeight: z.number().int().min(1).max(1000),
  requestedStyle: z.enum(["normal", "italic", "oblique"]),
  requestedColor: z.string().trim().min(1),
  requestedRelativeScale: z.number().positive(),
  requestedLineHeight: z.number().positive(),
  resolution: z.enum(["exact", "closest_catalog", "governed_fallback"]),
  selectedCatalogFontId: idSchema,
  selectedAsset: maulResolvedFontAssetSchema,
  similarityScore: z.number().finite(),
  reason: idSchema,
}).strict();
```

Add `chunkTypographyBindings: z.array(maulChunkTypographyBindingSchema).default([])` to the common typography motion shape and reject duplicate chunk IDs.

- [ ] **Step 4: Run shared tests and build**

Run: `npm --prefix packages/shared-types test -- src/maul.test.ts`

Run: `npm --prefix packages/shared-types run build`

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/maul.ts packages/shared-types/src/maul.test.ts packages/shared-types/src/index.ts
git commit -m "feat: define MAUL chunk typography bindings"
```

### Task 2: Corpus Loader And Deterministic Profile Selection

**Files:**
- Create: `backend/src/maul/typography-profile-corpus.ts`
- Create: `backend/src/maul/typography-profile-corpus.test.ts`

**Interfaces:**
- Produces: `loadTypographyProfileCorpus(options?)`, `countTypographyCharacters(text)`, and `rankTypographyProfiles(input)`.
- Consumes: JSON files from `Yuan Prometheus Screenshots/font JSON`.

- [ ] **Step 1: Write failing corpus tests**

Tests must load all 44 repository files, verify declared totals and per-word counts, count non-whitespace Unicode code points, prefer exact word and character counts, prefer exact `9:16` only after count fit, and produce a stable filename/SHA tie-break.

```ts
expect(countTypographyCharacters("brain power! ")).toBe(11);
expect(loadTypographyProfileCorpus()).toHaveLength(44);
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm --prefix backend test -- src/maul/typography-profile-corpus.test.ts`

- [ ] **Step 3: Implement loading and ranking**

Use `readdirSync`, `readFileSync`, `JSON.parse`, Zod validation, and SHA-256. Count characters with `[...text].filter((character) => !/\s/u.test(character)).length`. Return immutable normalized observations containing source provenance, metadata, layout rules, and layers. Throw filename-specific errors for malformed counts and duplicates.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix backend test -- src/maul/typography-profile-corpus.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/maul/typography-profile-corpus.ts backend/src/maul/typography-profile-corpus.test.ts
git commit -m "feat: load and rank MAUL typography profiles"
```

### Task 3: Governed 577-Font Similarity Resolver

**Files:**
- Create: `backend/src/maul/typography-profile-font-resolver.ts`
- Create: `backend/src/maul/typography-profile-font-resolver.test.ts`
- Modify: `backend/src/maul/zilliz-font-assets.ts`
- Modify: `backend/src/maul/zilliz-font-assets.test.ts`

**Interfaces:**
- Produces: `resolveTypographyProfileLayer(input): Promise<MaulTypographyLayerBinding>` and an exported loader for the complete executable asset catalog.
- Consumes: 577-entry taxonomy, optional Zilliz ranking, hydrated font manifest, and six bundled MAUL fonts.

- [ ] **Step 1: Write failing resolver tests**

Prove exact normalized family/style wins, nearest weight is recorded, unavailable requested families resolve to the closest deployed taxonomy candidate, an unhydrated higher-scoring catalog entry cannot win, primary/accent exclusions preserve contrast, and the result always has a valid local/public receipt.

```ts
expect(result.resolution).toBe("closest_catalog");
expect(result.requestedFamilies).toContain("Inter");
expect(result.selectedAsset.browserUrl).toMatch(/^\//);
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm --prefix backend test -- src/maul/typography-profile-font-resolver.test.ts src/maul/zilliz-font-assets.test.ts`

- [ ] **Step 3: Export the executable catalog**

Refactor the six bundled receipts into `loadBundledMaulFontAssets()` in `typography-layout.ts` or a focused catalog file. Combine those receipts with `loadHydratedMaulFontAssets()` and deduplicate by asset ID and hash.

- [ ] **Step 4: Implement deterministic local similarity**

Normalize requested family/style tokens, map layer roles and classifications to taxonomy roles, and score only deployed assets:

```ts
score = exactFamily * 1000
  + familyTokenSimilarity * 120
  + roleOverlap * 80
  + styleMatch * 60
  - weightDistance / 20
  + readability * 10
  + expressiveness * 10;
```

Use stable `assetId` ordering as the final tie-break. If the existing Zilliz adapter returns ranked catalog IDs, intersect them with deployed receipts before local scoring.

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix backend test -- src/maul/typography-profile-font-resolver.test.ts src/maul/zilliz-font-assets.test.ts`

- [ ] **Step 6: Commit**

```bash
git add backend/src/maul/typography-profile-font-resolver.ts backend/src/maul/typography-profile-font-resolver.test.ts backend/src/maul/zilliz-font-assets.ts backend/src/maul/zilliz-font-assets.test.ts backend/src/maul/typography-layout.ts
git commit -m "feat: resolve profile fonts through governed catalog"
```

### Task 4: Typography Profile Compiler

**Files:**
- Create: `backend/src/maul/typography-profile-compiler.ts`
- Create: `backend/src/maul/typography-profile-compiler.test.ts`
- Modify: `backend/src/maul/typography-layout.ts`

**Interfaces:**
- Produces: `TypographyProfileCompiler.compile({chunks, target, maximumLineWidthPx})` returning bindings, layouts, compatibility profiles, evidence IDs, summary resolution, and timing.
- Consumes: corpus ranking, layer resolver, Fontkit measurement, and legacy provider fallback.

- [ ] **Step 1: Write failing compiler tests**

Prove two chunks can select different profiles/assets, selected profiles survive font substitution, measured layouts use the selected primary asset, binding hashes are stable, timing fields are present, and a completely unresolved layer delegates to the governed fallback without claiming the requested family rendered.

- [ ] **Step 2: Run and confirm RED**

Run: `npm --prefix backend test -- src/maul/typography-profile-compiler.test.ts`

- [ ] **Step 3: Implement the deep compiler**

For each chunk, rank profiles, resolve primary and optional accent layers, construct `createResolvedMaulTypographyProvider({primary, accent})`, measure only that chunk, and build the binding hash from every authoritative field except timing. Cache corpus, catalog, and Fontkit providers by hashes/asset IDs.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix backend test -- src/maul/typography-profile-compiler.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/maul/typography-profile-compiler.ts backend/src/maul/typography-profile-compiler.test.ts backend/src/maul/typography-layout.ts
git commit -m "feat: compile authoritative chunk typography"
```

### Task 5: Chunk-Indexed Placement And Editorial Lockups

**Files:**
- Modify: `backend/src/maul/shorts-text-placement.ts`
- Modify: `backend/src/maul/shorts-text-placement.test.ts`
- Modify: `backend/src/maul/editorial-lockup.ts`
- Modify: `backend/src/maul/editorial-lockup.test.ts`

**Interfaces:**
- Produces: placement with one deduplicated compatibility profile set and per-segment profile selection derived from its chunk binding.
- Consumes: compiler output keyed by chunk ID.

- [ ] **Step 1: Write failing placement tests**

Add two chunks with different compatibility profiles and assert each segment references the correct profile/fingerprint. Assert a missing chunk binding blocks candidate creation. Add editorial-lockup tests proving each segment uses its chunk's primary/accent receipts.

- [ ] **Step 2: Run and confirm RED**

Run: `npm --prefix backend test -- src/maul/shorts-text-placement.test.ts src/maul/editorial-lockup.test.ts`

- [ ] **Step 3: Implement chunk-indexed typography**

Change `MaulPlacementTypography` to accept `byChunkId` while retaining the old `{profile, layouts}` shape as an adapter. Resolve the binding in `buildCandidate`, deduplicate all used profiles in the output, and hash the sorted profile set. Change `applyMaulEditorialLockups` to accept a font-pair resolver keyed by chunk ID.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix backend test -- src/maul/shorts-text-placement.test.ts src/maul/editorial-lockup.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/maul/shorts-text-placement.ts backend/src/maul/shorts-text-placement.test.ts backend/src/maul/editorial-lockup.ts backend/src/maul/editorial-lockup.test.ts
git commit -m "feat: place text with chunk typography bindings"
```

### Task 6: Planning And Service Integration

**Files:**
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/planning.test.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`

**Interfaces:**
- Produces: persisted `chunkTypographyBindings` in typography motion and compiler invocation immediately after V2 chunk materialization.
- Consumes: `TypographyProfileCompiler`.

- [ ] **Step 1: Write failing planning/integration tests**

Assert the planning payload preserves bindings byte-for-byte, all binding chunk IDs match the text chunk plan, mixed assets do not get collapsed into a false single-font claim, and the compiler is invoked after chunk materialization but before placement.

- [ ] **Step 2: Run and confirm RED**

Run: `npm --prefix backend test -- src/maul/planning.test.ts src/__tests__/maul-short-render-path.test.ts`

- [ ] **Step 3: Wire the compiler**

Inject the compiler into `MaulProjectService`, compile `textChunkCore.chunks`, pass `byChunkId` to placement and lockups, and pass bindings through `MaulTypographyPlanningResolution`. Preserve the old provider path only when the compiler returns governed fallback bindings.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix backend test -- src/maul/planning.test.ts src/__tests__/maul-short-render-path.test.ts`

- [ ] **Step 5: Commit**

```bash
git add backend/src/maul/planning.ts backend/src/maul/planning.test.ts backend/src/maul/service.ts backend/src/__tests__/maul-short-render-path.test.ts
git commit -m "feat: wire chunk typography into MAUL planning"
```

### Task 7: Remotion Adapter And Runtime Proof

**Files:**
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `backend/src/maul/quality-truth.ts`
- Modify: `backend/src/maul/quality-truth.test.ts`

**Interfaces:**
- Produces: per-segment planned text records and Quality Truth font evidence for every selected asset.
- Consumes: `chunkTypographyBindings` and placement segment chunk IDs.

- [ ] **Step 1: Write failing renderer and proof tests**

Prove two segments receive different exact browser URLs, missing/duplicate/mismatched bindings throw, legacy plans still render, and Quality Truth validates the font asset associated with each placement segment rather than the plan-level summary.

- [ ] **Step 2: Run and confirm RED**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

Run: `npm --prefix backend test -- src/maul/quality-truth.test.ts`

- [ ] **Step 3: Implement adapter lookup and proof assets**

Resolve bindings by `segment.chunkId`, validate the binding/profile/asset chain, and write the selected primary/accent receipts to `MaulPlannedTextRecord`. Extend `fontRuntime` with a defaulted `assets` array and make Quality Truth compare every planned segment asset against loaded runtime evidence while retaining the singular legacy fields.

- [ ] **Step 4: Run focused tests and typechecks**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

Run: `npm --prefix backend test -- src/maul/quality-truth.test.ts`

Run: `npm --prefix packages/shared-types run build`

Run: `npm --prefix backend run typecheck`

Run: `npm --prefix remotion-app run typecheck`

- [ ] **Step 5: Commit**

```bash
git add remotion-app/src/compositions/maul-short-manifest-adapter.ts remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx packages/shared-types/src/maul.ts backend/src/maul/quality-truth.ts backend/src/maul/quality-truth.test.ts
git commit -m "feat: render and prove chunk typography assets"
```

### Task 8: End-To-End Causal Verification

**Files:**
- Create or modify: `backend/src/__tests__/maul-short-render-path.test.ts`
- Modify: `docs/superpowers/specs/2026-08-09-maul-authoritative-typography-profiles-design.md` only if verification exposes a contract correction

**Interfaces:**
- Produces: a regression proof of the complete causal chain.
- Consumes: all previous tasks.

- [ ] **Step 1: Add the failing end-to-end assertion before final integration adjustments**

Trace one chunk through stable chunk ID, profile source/hash, count receipt, requested/resolved font, measured profile, placement segment, typography motion binding, and planned Remotion record.

- [ ] **Step 2: Run the focused end-to-end test and confirm RED**

Run: `npm --prefix backend test -- src/__tests__/maul-short-render-path.test.ts`

- [ ] **Step 3: Make only the integration corrections required by the test**

Do not add MediaPipe, annotation, color, or animation-corpus behavior.

- [ ] **Step 4: Run final verification**

Run: `npm --prefix packages/shared-types run build`

Run: `npm --prefix backend test -- src/maul/typography-profile-corpus.test.ts src/maul/typography-profile-font-resolver.test.ts src/maul/typography-profile-compiler.test.ts src/maul/shorts-text-placement.test.ts src/maul/editorial-lockup.test.ts src/maul/planning.test.ts src/maul/quality-truth.test.ts src/__tests__/maul-short-render-path.test.ts`

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx src/compositions/__tests__/maul-font-asset-resolver.test.ts`

Run: `npm --prefix backend run typecheck`

Run: `npm --prefix remotion-app run typecheck`

Run: `npm --prefix remotion-app exec remotion compositions src/index.ts` only when the browser binary and disk capacity are available; otherwise report the exact environmental blocker without claiming a render smoke pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/__tests__/maul-short-render-path.test.ts docs/superpowers/specs/2026-08-09-maul-authoritative-typography-profiles-design.md
git commit -m "test: prove authoritative MAUL typography pipeline"
```

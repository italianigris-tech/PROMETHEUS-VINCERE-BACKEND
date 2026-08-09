# MAUL Remotion Font Asset Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make each MAUL font receipt resolve to one verified local binary and one Remotion public asset, with deterministic pre-render failures instead of late font substitution or loading errors.

**Architecture:** Keep `MaulResolvedFontAsset` as the existing cross-stage receipt. Add a backend validation module at the local/public filesystem seam and a Remotion-only URL resolver at the `staticFile()` seam. The renderer keeps legacy catalog metadata for old manifests, but complete receipts take authority.

**Tech Stack:** TypeScript, Node `fs`/`path`/`crypto`, Zod shared types, Vitest, Remotion `staticFile()` and `@remotion/fonts`.

## Global Constraints

- Do not modify LLM chunking, reference-profile selection, placement, MediaPipe observation, or animation behavior.
- Do not remove V1/V2/V3 manifests or legacy adapters.
- Do not persist or derive browser URLs from developer-specific absolute filesystem paths.
- Use test-first red-green-refactor cycles for every behavior change.
- Preserve existing user font JSON files and unrelated worktree changes.

### Task 1: Add backend font receipt validation

**Files:**
- Create: `backend/src/maul/font-asset-resolution.ts`
- Create: `backend/src/maul/font-asset-resolution.test.ts`
- Modify: `backend/src/maul/zilliz-font-assets.ts:184-237`

**Interfaces:**
- Consumes: `MaulResolvedFontAsset`, a configured Remotion public root, and Node filesystem dependencies.
- Produces: `resolveMaulFontReceipt(asset, {remotionPublicDir})` returning the normalized asset with verified `localFileSha256`; `assertMaulFontReceiptsRenderable(assets, {remotionPublicDir})` returning `void` or throwing an asset-specific error.

- [ ] **Step 1: Write the failing tests**

  Add a temporary public root with a small real font fixture copied from `remotion-app/public/fonts/maul/dm-sans-700.woff2`. Assert that a valid receipt resolves and preserves its root-relative browser URL. Add separate tests for protocol URLs, absolute browser paths, `..` traversal, missing files, unsupported extensions, and hash mismatch. Assert errors include the `assetId` and failure reason. Add a catalog integration test that resolves at least one real hydrated entry against the repository public root.

- [ ] **Step 2: Run the backend tests and verify they fail for the missing module/behavior**

  Run:

  ```bash
  npm --prefix backend test -- src/maul/font-asset-resolution.test.ts --run
  ```

  Expected: FAIL because `font-asset-resolution.ts` and its exported functions do not exist yet.

- [ ] **Step 3: Implement the minimal validator**

  Normalize a public URL by removing one leading slash only after checking it is non-empty, root-relative, protocol-free, query/fragment-free, and contains no `.` or `..` path segment. Resolve the normalized path under `remotionPublicDir`, verify containment using `path.relative`, require a regular non-empty file, check the declared format against `ttf|otf|woff|woff2`, hash the file with SHA-256, and compare against the receipt hash. Return the receipt with the measured lowercase hash. Keep errors typed as ordinary `Error` messages containing the asset ID.

  Update `loadHydratedMaulFontAssets()` to call the validator for each candidate after its existing license/renderability filters. Invalid candidates should continue to be filtered out as they are today, while direct validator callers receive the detailed error.

- [ ] **Step 4: Run focused backend tests and the existing MAUL catalog tests**

  Run:

  ```bash
  npm --prefix backend test -- src/maul/font-asset-resolution.test.ts src/maul/zilliz-font-assets.test.ts --run
  ```

  Expected: PASS with zero failures.

- [ ] **Step 5: Commit the backend seam**

  ```bash
  git add backend/src/maul/font-asset-resolution.ts backend/src/maul/font-asset-resolution.test.ts backend/src/maul/zilliz-font-assets.ts
  git commit -m "feat: validate MAUL font receipts against Remotion assets"
  ```

### Task 2: Make Remotion use receipt-owned public font URLs

**Files:**
- Create: `remotion-app/src/compositions/maul-font-asset-resolver.ts`
- Create: `remotion-app/src/compositions/maul-font-asset-resolver.test.ts`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx:1-215`
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx:275-292`

**Interfaces:**
- Consumes: `browserUrl: string` and an injectable static asset resolver.
- Produces: `resolveMaulFontAssetUrl(browserUrl, resolveStaticAsset = staticFile): string`.

- [ ] **Step 1: Write the failing Remotion resolver tests**

  Move the current URL assertions into the new resolver test and add rejection cases for `//cdn.example`, `file:///...`, `C:/...`, `/fonts/../secret.woff2`, query strings, fragments, and empty paths. Assert that `/fonts/maul/a.woff2` is passed to the injected resolver as `fonts/maul/a.woff2`.

- [ ] **Step 2: Run the test and verify the new import/export fails**

  ```bash
  npm --prefix remotion-app test -- src/compositions/maul-font-asset-resolver.test.ts --run
  ```

  Expected: FAIL because the new module does not exist.

- [ ] **Step 3: Implement the resolver and wire the text layer**

  Implement the pure validation/normalization helper, then import it into `MaulPlannedTextLayer.tsx`. Replace the local `resolveMaulFontBrowserUrl` implementation with a compatibility re-export or wrapper so existing callers remain source-compatible. Ensure `ensurePlannedFontLoaded()` uses the receipt’s `browserUrl` whenever present; only the legacy six-font metadata path may provide a fallback for old records without a URL.

- [ ] **Step 4: Run Remotion composition tests**

  ```bash
  npm --prefix remotion-app test -- src/compositions/maul-font-asset-resolver.test.ts src/compositions/__tests__/MaulPlannedTextLayer.test.tsx --run
  ```

  Expected: PASS with zero failures.

- [ ] **Step 5: Commit the Remotion seam**

  ```bash
  git add remotion-app/src/compositions/maul-font-asset-resolver.ts remotion-app/src/compositions/maul-font-asset-resolver.test.ts remotion-app/src/compositions/MaulPlannedTextLayer.tsx remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx
  git commit -m "feat: resolve MAUL fonts through Remotion public assets"
  ```

### Task 3: Validate planned receipts before invoking Remotion

**Files:**
- Modify: `backend/src/maul/render-engine.ts:169-270`
- Modify: `backend/src/maul/render-engine.test.ts`
- Create: `backend/src/maul/render-font-preflight.ts`
- Create: `backend/src/maul/render-font-preflight.test.ts`

**Interfaces:**
- Consumes: a planned MAUL manifest and the current repository/public root.
- Produces: `validateMaulRenderFontReceipts(manifest, {remotionPublicDir}): void`.

- [ ] **Step 1: Write failing preflight tests**

  Build the smallest manifest fixture containing one primary and one accent receipt. Assert valid receipts pass. Assert a changed local binary, a missing public file, and a planned receipt whose URL is absent from the public root throw before the render command is reached.

- [ ] **Step 2: Run the test and verify it fails**

  ```bash
  npm --prefix backend test -- src/maul/render-font-preflight.test.ts --run
  ```

  Expected: FAIL because the preflight module does not exist.

- [ ] **Step 3: Implement preflight and insert it before staging/CLI execution**

  Extract unique selected and accent receipts from V2/V3 planned text records, validate each against the public root, and throw a message naming the asset and manifest location. Call it at the beginning of `renderMaulShortLocally` after resolving `remotionRoot` but before creating or invoking the Remotion process. Do not alter legacy V1 behavior when no exact receipts are present.

- [ ] **Step 4: Run render-engine, preflight, typography, and composition tests**

  ```bash
  npm --prefix backend test -- src/maul/render-font-preflight.test.ts src/maul/render-engine.test.ts src/maul/typography-layout.test.ts --run
  npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx --run
  ```

  Expected: PASS with zero failures.

- [ ] **Step 5: Commit the preflight seam**

  ```bash
  git add backend/src/maul/render-font-preflight.ts backend/src/maul/render-font-preflight.test.ts backend/src/maul/render-engine.ts backend/src/maul/render-engine.test.ts
  git commit -m "feat: preflight MAUL font receipts before render"
  ```

### Task 4: Run repository verification and render smoke

**Files:**
- Modify: none unless verification exposes a scoped regression.

- [ ] **Step 1: Typecheck shared types, backend, and Remotion**

  ```bash
  npm --prefix packages/shared-types run build
  npm --prefix backend run typecheck
  npm --prefix remotion-app run typecheck
  ```

- [ ] **Step 2: Run focused regression suites**

  ```bash
  npm --prefix backend test -- src/maul --run
  npm --prefix remotion-app test -- src/compositions --run
  ```

- [ ] **Step 3: Run a one-font local Remotion smoke render**

  Use the existing MAUL render fixture/worker command with a manifest referencing `font_google_dm_sans_700`, retain one frame sample, and verify the output is a non-empty MP4 and the sample PNG is non-empty. If the fixture requires unavailable external media, report that exact blocker rather than claiming the smoke render passed.

- [ ] **Step 4: Inspect final diff and status**

  ```bash
  git diff --check
  git status --short
  git log --oneline -5
  ```

  Confirm only the resolver implementation, tests, and related wiring changed.


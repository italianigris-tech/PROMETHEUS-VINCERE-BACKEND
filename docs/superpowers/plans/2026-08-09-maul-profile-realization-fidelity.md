# MAUL Profile Realization Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every selected typography JSON as an independently measured, full-scale layer composition whose only 9:16 adaptations are one uniform group scale and one scene-selected translation.

**Architecture:** Extend each chunk typography binding with a hashed realization containing ordered layer token spans and exact style/font receipts. A focused compiler measures those layers independently; placement fits the complete intrinsic group into scene candidates and persists one group transform; a dedicated Remotion component renders the layer graph without caption recoloring or generic lockups.

**Tech Stack:** TypeScript, Zod, Fontkit, Vitest, React, Remotion, existing MAUL V3 planning and manifest contracts.

## Global Constraints

- Every selected JSON layer renders independently.
- Remotion may apply only one uniform group scale and one whole-group translation.
- Exact requested family/style wins; the deployed 577-font catalog is used only when the exact asset is absent.
- Profile color, casing, relative scale, line height, letter spacing, vertical margin, and shadow remain authoritative.
- Active tokens never inherit caption `accentColor` merely because they are active.
- Profile placement uses measured group geometry, not the fixed `0.32` editorial box or a lower-right default.
- A layer-count mismatch, clipping candidate, or receipt mismatch fails explicitly instead of silently producing a generic caption.
- Circles, highlights, MediaPipe execution, and the new animation corpus remain outside this batch.
- Legacy manifests without realizations continue through the existing compatibility adapter.
- Existing unrelated `artifacts/` deletions are never staged, restored, or modified.
- Every production change starts with a focused failing test.

---

### Task 1: Shared Realization And Placement Contracts

**Files:**
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/maul-text-placement.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/maul.test.ts`
- Test: `packages/shared-types/src/maul-text-placement.test.ts`

**Interfaces:**
- Consumes: `maulResolvedFontAssetSchema`, `maulChunkTypographyBindingSchema`, and `maulTextPlacementSegmentSchema`.
- Produces: `maulProfileTypographyLayerSchema`, `maulProfileTypographyRealizationSchema`, `MaulProfileTypographyRealization`, and optional `profileTransform` on placement segments.

- [ ] **Step 1: Write failing schema tests**

Add a chunk binding with two realized layers and a placement segment with a uniform transform. Reject duplicate layer/token IDs, a realization layer that does not match its binding layer asset, non-positive dimensions, and non-positive scale. Exact coverage against the complete chunk token list is enforced in Task 6, where that list is available.

```ts
const realization = {
  adaptation: "uniform_fit_9_16" as const,
  horizontalAlignment: "left" as const,
  maxWidthPercent: 85,
  intrinsicSizePx: {width: 512, height: 184},
  layers: [prefixLayer, heroLayer],
};
expect(maulChunkTypographyBindingSchema.parse({...binding, realization}).realization)
  .toEqual(realization);
expect(maulTextPlacementSegmentSchema.parse({
  ...segment,
  profileTransform: {
    uniformScale: 2.1,
    intrinsicWidthPx: 512,
    intrinsicHeightPx: 184,
    finalWidthPx: 1075.2,
    finalHeightPx: 386.4,
  },
}).profileTransform?.uniformScale).toBe(2.1);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm --prefix packages/shared-types test -- src/maul.test.ts src/maul-text-placement.test.ts`

Expected: failures because `realization` and `profileTransform` are not defined.

- [ ] **Step 3: Implement strict schemas**

```ts
export const maulProfileTypographyLayerSchema = z.object({
  layerName: idSchema,
  tokenIds: z.array(idSchema).min(1),
  text: z.string().trim().min(1),
  selectedAsset: maulResolvedFontAssetSchema,
  fontSizePx: z.number().positive(),
  measuredWidthPx: z.number().positive(),
  measuredHeightPx: z.number().positive(),
  lineHeight: z.number().positive(),
  letterSpacingEm: z.number().finite(),
  casing: z.enum(["normal", "lowercase", "uppercase", "title_case"]),
  color: z.string().trim().min(1),
  marginTopPx: z.number().finite(),
  shadow: z.object({
    xOffset: z.number().finite(),
    yOffset: z.number().finite(),
    blurRadius: z.number().nonnegative(),
    color: z.string().trim().min(1),
  }).strict(),
  measurementId: idSchema,
}).strict();
```

Add a strict realization schema containing `adaptation`, `horizontalAlignment`, `maxWidthPercent`, `intrinsicSizePx`, and `layers`. Add it as optional on legacy-compatible bindings. In the binding refinement, require unique realization layer/token IDs, require realization layer names to match binding layer names, and require every realization asset ID/hash to match its corresponding resolved binding asset. Add optional `profileTransform` with positive intrinsic/final dimensions and `uniformScale`; validate final dimensions equal intrinsic dimensions times scale within `0.01` px.

- [ ] **Step 4: Run tests and build**

Run: `npm --prefix packages/shared-types test -- src/maul.test.ts src/maul-text-placement.test.ts`

Run: `npm --prefix packages/shared-types run build`

Expected: focused tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/maul.ts packages/shared-types/src/maul-text-placement.ts packages/shared-types/src/index.ts packages/shared-types/src/maul.test.ts packages/shared-types/src/maul-text-placement.test.ts
git commit -m "feat: define MAUL profile realization contracts"
```

### Task 2: Exact-Count Corpus Selection

**Files:**
- Modify: `backend/src/maul/typography-profile-corpus.ts`
- Test: `backend/src/maul/typography-profile-corpus.test.ts`

**Interfaces:**
- Consumes: normalized corpus profiles and chunk word/character/semantic metadata.
- Produces: exact-word-count `rankTypographyProfiles(input)` results with a final stable recent-profile reuse tie-break.

- [ ] **Step 1: Write failing ranking tests**

```ts
const ranked = rankTypographyProfiles({
  profiles,
  chunk: {wordCount: 5, characterCount: 20, semanticRole: "claim", emphasisLevel: "hero"},
  targetAspectRatio: "9:16",
  recentlyUsedProfileNames: [],
});
expect(ranked.every((candidate) => candidate.profile.metadata.totalWordCount === 5)).toBe(true);
expect(ranked[0]?.profile.sourceFilename).toBe("image (17).json");
```

Also prove reuse affects order only when character distance, aspect penalty, and semantic score tie.

- [ ] **Step 2: Run the corpus test and confirm RED**

Run: `npm --prefix backend test -- src/maul/typography-profile-corpus.test.ts`

Expected: current results include non-exact word-count profiles and accept no reuse input.

- [ ] **Step 3: Implement exact filtering and stable sorting**

Filter to `profile.metadata.totalWordCount === chunk.wordCount`. Sort by character distance, aspect penalty, semantic score descending, recent reuse penalty, filename, and source hash. Return `[]` when no exact-count profile exists.

```ts
const recent = new Set(recentlyUsedProfileNames ?? []);
const recentProfileReusePenalty = recent.has(profile.profileName) ? 1 : 0;
```

- [ ] **Step 4: Run corpus/compiler tests**

Run: `npm --prefix backend test -- src/maul/typography-profile-corpus.test.ts src/maul/typography-profile-compiler.test.ts`

Expected: focused tests pass with exact-count fixtures.

- [ ] **Step 5: Commit**

```bash
git add backend/src/maul/typography-profile-corpus.ts backend/src/maul/typography-profile-corpus.test.ts backend/src/maul/typography-profile-compiler.test.ts
git commit -m "fix: select exact-count typography profiles"
```

### Task 3: Independent Layer Realization Compiler

**Files:**
- Create: `backend/src/maul/typography-profile-realization.ts`
- Create: `backend/src/maul/typography-profile-realization.test.ts`
- Modify: `backend/src/maul/typography-profile-compiler.ts`
- Modify: `backend/src/maul/typography-profile-compiler.test.ts`
- Modify: `backend/src/maul/typography-layout.ts`

**Interfaces:**
- Consumes: ordered stable chunk tokens, selected `TypographyProfileObservation`, resolved layer bindings, and exact Fontkit assets.
- Produces: `compileTypographyProfileRealization(input): MaulProfileTypographyRealization` and `binding.realization`.

- [ ] **Step 1: Write failing layer tests**

Use JSON 31's `2/2/1` allocation, JSON 21's `3/1` allocation, and JSON 17's single five-word layer. Assert ordered token spans, actual chunk text, exact layer fonts, casing, color, scale, spacing, margins, and shadow.

```ts
expect(result.layers.map((layer) => layer.tokenIds)).toEqual([
  [tokens[0].tokenId, tokens[1].tokenId],
  [tokens[2].tokenId, tokens[3].tokenId],
  [tokens[4].tokenId],
]);
expect(result.layers[2]).toMatchObject({
  casing: "lowercase",
  color: "#111111",
  lineHeight: 1,
  marginTopPx: 2,
  selectedAsset: expect.objectContaining({style: "italic"}),
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm --prefix backend test -- src/maul/typography-profile-realization.test.ts`

Expected: module does not exist.

- [ ] **Step 3: Implement exact partitioning and measurement**

```ts
export const compileTypographyProfileRealization = ({
  tokens,
  profile,
  bindingsByLayerName,
  measureToken,
}: {
  tokens: readonly {tokenId: string; text: string}[];
  profile: TypographyProfileObservation;
  bindingsByLayerName: ReadonlyMap<string, MaulTypographyLayerBinding>;
  measureToken: MaulEditorialTokenMeasure;
}): MaulProfileTypographyRealization => { /* exact ordered realization */ };
```

Consume exactly `layer.wordCount` tokens per layer, join with `joinShortsTextTokens`, apply casing before measuring, and calculate `fontSizePx = sizePxBase * relativeScale`. Measure using each layer's resolved asset. Derive `measurementId` deterministically from the selected asset hash, rendered text, font size, letter spacing, measured width, and measured height. Intrinsic width is the widest layer; intrinsic height is the sum of measured heights and vertical margins. Reject leftover or missing tokens.

- [ ] **Step 4: Supply stable tokens from the main compiler**

Extend `TypographyProfileCompilerChunk` with `tokens: readonly {tokenId: string; text: string}[]`. Resolve all layers as today, compile the realization, hash it in the binding, and add all layer measurement IDs to evidence.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm --prefix backend test -- src/maul/typography-profile-realization.test.ts src/maul/typography-profile-compiler.test.ts`

Run: `npm --prefix backend run typecheck`

Expected: tests pass and every compiler call supplies stable tokens.

- [ ] **Step 6: Commit**

```bash
git add backend/src/maul/typography-profile-realization.ts backend/src/maul/typography-profile-realization.test.ts backend/src/maul/typography-profile-compiler.ts backend/src/maul/typography-profile-compiler.test.ts backend/src/maul/typography-layout.ts
git commit -m "feat: compile independent typography profile layers"
```

### Task 4: Full-Group Scene Placement

**Files:**
- Create: `backend/src/maul/typography-profile-placement.ts`
- Create: `backend/src/maul/typography-profile-placement.test.ts`
- Modify: `backend/src/maul/shorts-text-placement.ts`
- Modify: `backend/src/maul/shorts-text-placement.test.ts`

**Interfaces:**
- Consumes: intrinsic `MaulProfileTypographyRealization`, output size, platform safe region, composition interaction evidence, and subject observation.
- Produces: `buildTypographyProfilePlacementCandidates(input)` returning tight group boxes and `profileTransform` receipts.

- [ ] **Step 1: Write failing fit/candidate tests**

```ts
const candidates = buildTypographyProfilePlacementCandidates({
  realization,
  output: {width: 1080, height: 1920},
  safeRegion: {x: 0.06, y: 0.08, width: 0.88, height: 0.82},
  subjectBox,
  subjectInteraction: {policy: "controlled_overlap", faceInterference: 0},
});
expect(candidates.some((candidate) => candidate.anchor === "center_hero")).toBe(true);
expect(Math.max(...candidates.map((candidate) => candidate.box.width))).toBeGreaterThan(0.6);
expect(candidates.every((candidate) => candidate.profileTransform.uniformScale > 0)).toBe(true);
```

Also assert unauthorized face collisions are rejected and every final box stays inside the safe region.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm --prefix backend test -- src/maul/typography-profile-placement.test.ts src/maul/shorts-text-placement.test.ts`

Expected: profile placement module does not exist and current editorial geometry is fixed.

- [ ] **Step 3: Implement deterministic group candidates**

Create `center_hero`, `upper_display`, `lower_display`, `left_stage`, and `right_stage` regions from the platform safe region. Compute the largest uniform scale with:

```ts
const maximumWidthPx = Math.min(
  region.width * output.width,
  output.width * realization.maxWidthPercent / 100,
);
const uniformScale = Math.min(
  maximumWidthPx / realization.intrinsicSizePx.width,
  region.height * output.height / realization.intrinsicSizePx.height,
);
```

Return a tight aligned box, maximum envelope, anchor ID, and transform. Reject non-positive scales, out-of-safe-region boxes, and subject collisions without explicit controlled-overlap evidence.

- [ ] **Step 4: Integrate profile candidates into placement**

When `binding.realization` exists, build candidates from the new module instead of `geometryForFamily()` or `composition.textAnchor.box`. Score all valid candidates and persist the winner's `profileTransform`. Preserve `segment.lines` only as exact token-order audit data; do not repartition the realized layers. Use `{kind: "none"}` for profile-backed legibility so generic plates/outlines cannot restyle the profile.

- [ ] **Step 5: Run placement tests**

Run: `npm --prefix backend test -- src/maul/typography-profile-placement.test.ts src/maul/shorts-text-placement.test.ts src/maul/editorial-lockup.test.ts`

Expected: profile segments carry a measured transform and no generic legibility primitive; legacy segments retain current behavior.

- [ ] **Step 6: Commit**

```bash
git add backend/src/maul/typography-profile-placement.ts backend/src/maul/typography-profile-placement.test.ts backend/src/maul/shorts-text-placement.ts backend/src/maul/shorts-text-placement.test.ts backend/src/maul/editorial-lockup.test.ts
git commit -m "feat: place complete typography profile groups"
```

### Task 5: Dedicated Remotion Profile Renderer

**Files:**
- Create: `remotion-app/src/compositions/MaulProfileTypographyGroup.tsx`
- Create: `remotion-app/src/compositions/__tests__/MaulProfileTypographyGroup.test.tsx`
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

**Interfaces:**
- Consumes: `MaulProfileTypographyRealization`, placement `profileTransform`, root-relative font receipts, and existing animation programs.
- Produces: optional `profileRealization`/`profileTransform` fields on `MaulPlannedTextRecord` and an independent-layer `MaulProfileTypographyGroup`.

- [ ] **Step 1: Write failing adapter/renderer tests**

```tsx
const html = renderToStaticMarkup(
  <MaulProfileTypographyGroup
    record={profileRecord}
    absoluteTimeMs={700}
    outputFrame={21}
    fps={30}
  />,
);
expect(html).toContain('data-maul-profile-layer="prefix"');
expect(html).toContain('color:#111111');
expect(html).toContain('transform:scale(2.1)');
expect(html).not.toContain('color:#00d7ff');
```

Assert separate families/sizes/casing/spacing/margins/shadows, one parent scale, and adapter failures for missing transforms or mismatched asset receipts.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulProfileTypographyGroup.test.tsx src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

Expected: component and record fields do not exist.

- [ ] **Step 3: Extend the planned record and adapter**

```ts
profileRealization?: MaulProfileTypographyRealization;
profileTransform?: NonNullable<MaulTextPlacementSegment["profileTransform"]>;
```

When a binding has a realization, require its segment transform, verify exact token coverage and selected asset IDs/hashes, and pass both receipts unchanged. Legacy records omit both.

- [ ] **Step 4: Implement independent layer rendering**

Position one parent at `record.boxPx.leftPx/topPx`, give it the intrinsic group dimensions, and apply only `scale(profileTransform.uniformScale)` with top-left origin. Render layer blocks in source order with exact font URL/family/weight/style, measured size, casing, color, line height, spacing, margin, alignment, and shadow. Keep governed tokens addressable for existing opacity/transform animations without changing static style.

- [ ] **Step 5: Route profile records before caption rendering**

In `MaulPlannedTextCard`, render `MaulProfileTypographyGroup` when both profile fields exist. Do not pass `textColor` or `accentColor` into it. Legacy records retain the existing caption/editorial renderer.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulProfileTypographyGroup.test.tsx src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

Run: `npm --prefix remotion-app run typecheck`

Expected: profile and legacy rendering tests pass.

- [ ] **Step 7: Commit**

```bash
git add remotion-app/src/compositions/MaulProfileTypographyGroup.tsx remotion-app/src/compositions/__tests__/MaulProfileTypographyGroup.test.tsx remotion-app/src/compositions/maul-short-manifest-adapter.ts remotion-app/src/compositions/MaulPlannedTextLayer.tsx remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx
git commit -m "feat: render independent MAUL typography layers"
```

### Task 6: Service, Lockup, Manifest, And Quality Enforcement

**Files:**
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/maul/editorial-lockup.ts`
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/quality-truth.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`
- Modify: `backend/src/maul/quality-truth.test.ts`

**Interfaces:**
- Consumes: stable V2 chunk tokens, compiler realizations, placement transforms, and V3 manifest compilation.
- Produces: causal lineage from stable tokens to hashed realization to group placement to Remotion.

- [ ] **Step 1: Write failing integration tests**

```ts
expect(binding.realization?.layers.flatMap((layer) => layer.tokenIds))
  .toEqual(chunk.tokenIds);
expect(segment.editorialLockup).toBeUndefined();
expect(segment.profileTransform).toBeDefined();
```

Assert Quality Truth reports missing or mismatched realization/transform receipts.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm --prefix backend test -- src/__tests__/maul-short-render-path.test.ts src/maul/quality-truth.test.ts`

Expected: compiler input lacks token records and profile segments still receive generic lockups.

- [ ] **Step 3: Wire stable tokens into profile compilation**

Map each chunk token ID to its exact V2 token record and pass ordered tokens into `TypographyProfileCompiler.compile`. Reject missing or reordered tokens before compilation.

- [ ] **Step 4: Restrict generic lockups to legacy segments**

Pass the binding map into `applyMaulEditorialLockups`. Return profile-backed segments without an editorial lockup; run the existing reference grammar only when no realization exists.

- [ ] **Step 5: Enforce causal receipts**

Require profile-backed bindings/segments to agree on chunk ID, exact token coverage, intrinsic dimensions, asset hashes, and transform scale. Add failure IDs `profile_realization_missing`, `profile_realization_token_mismatch`, `profile_transform_missing`, and `profile_asset_receipt_mismatch`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm --prefix backend test -- src/__tests__/maul-short-render-path.test.ts src/maul/quality-truth.test.ts src/maul/planning.test.ts`

Run: `npm --prefix backend run typecheck`

Expected: valid profile-backed V3 manifests pass and malformed lineage fails.

- [ ] **Step 7: Commit**

```bash
git add backend/src/maul/service.ts backend/src/maul/editorial-lockup.ts backend/src/maul/planning.ts backend/src/maul/quality-truth.ts backend/src/__tests__/maul-short-render-path.test.ts backend/src/maul/quality-truth.test.ts
git commit -m "feat: enforce MAUL profile realization lineage"
```

### Task 7: End-To-End Visual Proof

**Files:**
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts` only if a reusable fixture export is needed
- Create: `remotion-app/public/dev-fixtures/maul-profile-realization-props.json` only if fixture generation requires a stable input
- Output: `/home/ec2-user/maul-profile-realization-verified.mp4`
- Output: `/home/ec2-user/maul-profile-realization-props.json`
- Output: `/home/ec2-user/maul-profile-realization-frame-a.png`
- Output: `/home/ec2-user/maul-profile-realization-frame-b.png`

**Interfaces:**
- Consumes: compiled authoritative V3 manifest and the `MaulShort` composition.
- Produces: accessible 1080x1920 output demonstrating distinct, full-scale JSON layer compositions.

- [ ] **Step 1: Run complete focused verification**

```bash
npm --prefix packages/shared-types test -- src/maul.test.ts src/maul-text-placement.test.ts
npm --prefix backend test -- src/maul/typography-profile-corpus.test.ts src/maul/typography-profile-realization.test.ts src/maul/typography-profile-compiler.test.ts src/maul/typography-profile-placement.test.ts src/maul/shorts-text-placement.test.ts src/maul/editorial-lockup.test.ts src/maul/planning.test.ts src/maul/quality-truth.test.ts src/__tests__/maul-short-render-path.test.ts
npm --prefix remotion-app test -- src/compositions/__tests__/MaulProfileTypographyGroup.test.tsx src/compositions/__tests__/MaulPlannedTextLayer.test.tsx
npm --prefix packages/shared-types run build
npm --prefix backend run typecheck
npm --prefix remotion-app run typecheck
```

Expected: zero failures.

- [ ] **Step 2: Compile and inspect a real V3 fixture**

Compile one five-word and one four-word chunk. Confirm every binding has a realization, every layer has an independent asset/style receipt, and every placement segment has a profile transform.

- [ ] **Step 3: Render the authoritative composition**

```bash
npx remotion render src/index.ts MaulShort /home/ec2-user/maul-profile-realization-verified.mp4 --props=/home/ec2-user/maul-profile-realization-props.json --codec=h264
```

Run from `remotion-app`. Keep Remotion's browser cache on a filesystem with sufficient free space.

- [ ] **Step 4: Inspect representative frames and metadata**

Extract one frame per chunk. Verify H.264, 1080x1920, 30 fps, nonzero duration, no clipping, static profile colors, visibly different layer structures, and no persistent lower-right bias.

```bash
node_modules/@remotion/compositor-linux-x64-gnu/ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration,size -of json /home/ec2-user/maul-profile-realization-verified.mp4
```

- [ ] **Step 5: Run hygiene checks**

```bash
git diff --check
git status --short -- . ':(exclude)artifacts/**'
sha256sum /home/ec2-user/maul-profile-realization-verified.mp4
```

Expected: no unintended tracked changes and a recorded output checksum.

- [ ] **Step 6: Commit only reusable proof fixtures**

Do not commit generated MP4/PNG files. If a reusable JSON fixture was required:

```bash
git add remotion-app/public/dev-fixtures/maul-profile-realization-props.json backend/src/__tests__/maul-short-render-path.test.ts
git commit -m "test: prove MAUL profile realization render path"
```

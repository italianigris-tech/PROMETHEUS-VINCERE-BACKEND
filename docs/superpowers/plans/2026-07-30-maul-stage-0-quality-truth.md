# MAUL Stage 0 Quality Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an enforceable pre-render Quality Truth gate that rejects the known thin MAUL baseline for specific human-visible failures and audits every decision.

**Architecture:** Shared Zod contracts describe runtime proof and gate results. A pure backend evaluator compares proof with the compiled Unified Short Render Manifest. `MaulProjectService` obtains proof through an injectable provider, audits the result, and refuses to call Remotion when any critical failure exists.

**Tech Stack:** TypeScript, Zod, Fastify service layer, Vitest, file-backed MAUL audit log.

---

## File Map

- Modify `packages/shared-types/src/maul.ts`: proof/result schemas, audit event type, exported inferred types.
- Modify `packages/shared-types/src/maul.test.ts`: contract rejection tests.
- Create `backend/src/maul/quality-truth.ts`: pure evaluator and fail-closed default proof provider.
- Create `backend/src/maul/quality-truth.test.ts`: one regression per Stage 0 failure class plus passing case.
- Modify `backend/src/maul/service.ts`: evaluate after manifest registration, audit, block renderer.
- Modify `backend/src/app.ts`: injectable proof provider for tests/future runtime bridge.
- Modify `backend/src/__tests__/maul-short-render-path.test.ts`: passing-proof render path and default-baseline rejection.
- Modify `MAUL Basics.md`: compact Stage 0 status and evidence links.

### Task 1: Shared Quality Truth Contracts

**Files:**
- Modify: `packages/shared-types/src/maul.ts`
- Test: `packages/shared-types/src/maul.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests proving valid proof/result parsing, proof replay-key binding, required evidence IDs for verified states, and the `quality_truth_evaluated` audit event type.

```ts
expect(() => maulQualityTruthProofSchema.parse({
  ...validProof,
  manifestReplayKey: "0".repeat(64),
  fontRuntime: {...validProof.fontRuntime, status: "eligible_loaded", evidenceId: null},
})).toThrow(/evidence/i);

expect(maulQualityTruthResultSchema.parse({
  schemaVersion: "maul-quality-truth-result/v1",
  manifestReplayKey: validProof.manifestReplayKey,
  status: "blocked",
  failures: [{
    code: "font_fallback_forbidden",
    field: "plans.typographyMotion.fontResolution",
    outputStartMs: null,
    outputEndMs: null,
    message: "System font fallback cannot enter the MAUL renderer.",
    evidenceId: null,
  }],
})).toMatchObject({status: "blocked"});
```

- [ ] **Step 2: Run shared contract test; verify RED**

Run: `npm test -- src/maul.test.ts` from `packages/shared-types`.

Expected: FAIL because quality truth schemas are not exported.

- [ ] **Step 3: Add schemas and inferred types**

Add these contract shapes to `packages/shared-types/src/maul.ts`:

```ts
export const maulQualityTruthFailureCodeSchema = z.enum([
  "proof_manifest_mismatch",
  "caption_bounds_unverified",
  "caption_outside_safe_region",
  "font_fallback_forbidden",
  "font_load_unverified",
  "crop_or_mask_unverified",
  "crop_outside_source",
  "camera_zoom_restart",
  "camera_continuity_unverified",
  "capability_unsupported",
  "capability_evidence_missing",
  "silent_fallback",
]);

const evidenceIdSchema = idSchema.nullable();

export const maulQualityTruthProofSchema = z.object({
  schemaVersion: z.literal("maul-quality-truth-proof/v1"),
  manifestReplayKey: z.string().regex(/^[a-f0-9]{64}$/i),
  captionLayout: z.object({
    status: z.enum(["verified", "unverified"]),
    evidenceId: evidenceIdSchema,
    boxes: z.array(z.object({
      captionIndex: z.number().int().nonnegative(),
      leftPx: z.number().nonnegative(),
      topPx: z.number().nonnegative(),
      rightPx: z.number().nonnegative(),
      bottomPx: z.number().nonnegative(),
    })),
  }),
  fontRuntime: z.object({
    status: z.enum(["eligible_loaded", "fallback", "unverified"]),
    family: z.string().trim().min(1),
    assetId: evidenceIdSchema,
    evidenceId: evidenceIdSchema,
  }),
  cropAndMask: z.object({
    status: z.enum(["verified", "unsafe", "unverified"]),
    evidenceId: evidenceIdSchema,
    maskingRequired: z.boolean(),
    maskingStatus: z.enum(["not_required", "verified", "unverified"]),
    crops: z.array(z.object({
      outputStartMs: z.number().int().nonnegative(),
      outputEndMs: z.number().int().positive(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    })),
  }),
  cameraContinuity: z.object({
    status: z.enum(["verified_continuous", "restart_detected", "unverified"]),
    evidenceId: evidenceIdSchema,
    resetOutputMs: z.array(z.number().int().nonnegative()),
  }),
  capabilities: z.array(z.object({
    capabilityId: idSchema,
    status: z.enum(["native_render_safe", "unsupported", "unverified"]),
    evidenceId: evidenceIdSchema,
  })),
  fallbacks: z.array(z.object({
    planType: idSchema,
    selected: z.literal(true),
    evidenceId: evidenceIdSchema,
  })),
}).superRefine((proof, ctx) => {
  const verifiedWithoutEvidence =
    (proof.captionLayout.status === "verified" && !proof.captionLayout.evidenceId) ||
    (proof.fontRuntime.status === "eligible_loaded" && (!proof.fontRuntime.assetId || !proof.fontRuntime.evidenceId)) ||
    (proof.cropAndMask.status === "verified" && !proof.cropAndMask.evidenceId) ||
    (proof.cameraContinuity.status === "verified_continuous" && !proof.cameraContinuity.evidenceId);
  if (verifiedWithoutEvidence) ctx.addIssue({code: z.ZodIssueCode.custom, message: "Verified Quality Truth proof requires evidence IDs."});
});

export const maulQualityTruthResultSchema = z.object({
  schemaVersion: z.literal("maul-quality-truth-result/v1"),
  manifestReplayKey: z.string().regex(/^[a-f0-9]{64}$/i),
  status: z.enum(["pass", "blocked"]),
  failures: z.array(z.object({
    code: maulQualityTruthFailureCodeSchema,
    field: z.string().trim().min(1),
    outputStartMs: z.number().int().nonnegative().nullable(),
    outputEndMs: z.number().int().nonnegative().nullable(),
    message: z.string().trim().min(1),
    evidenceId: evidenceIdSchema,
  })),
}).superRefine((result, ctx) => {
  if ((result.status === "pass") !== (result.failures.length === 0)) {
    ctx.addIssue({code: z.ZodIssueCode.custom, message: "Quality Truth pass requires zero failures; blocked requires failures."});
  }
});
```

Extend `maulAuditEventSchema.type` with `"quality_truth_evaluated"`; export `MaulQualityTruthProof` and `MaulQualityTruthResult` inferred types.

- [ ] **Step 4: Run shared tests; verify GREEN**

Run: `npm test -- src/maul.test.ts` from `packages/shared-types`.

Expected: PASS.

- [ ] **Step 5: Commit contract**

```bash
git add packages/shared-types/src/maul.ts packages/shared-types/src/maul.test.ts
git commit -m "feat: define MAUL quality truth contracts"
```

### Task 2: Pure Quality Truth Evaluator

**Files:**
- Create: `backend/src/maul/quality-truth.ts`
- Create: `backend/src/maul/quality-truth.test.ts`

- [ ] **Step 1: Write one failing test per defect**

Build one valid manifest/proof fixture. Mutate one field per test and assert exact codes:

```ts
expect(codes({...proof, captionLayout: {...proof.captionLayout, status: "unverified", evidenceId: null}}))
  .toContain("caption_bounds_unverified");
expect(codes({...proof, fontRuntime: {...proof.fontRuntime, status: "fallback"}}))
  .toContain("font_fallback_forbidden");
expect(codes({...proof, cropAndMask: {...proof.cropAndMask, status: "unsafe"}}))
  .toContain("crop_or_mask_unverified");
expect(codes({...proof, cameraContinuity: {...proof.cameraContinuity, status: "restart_detected", resetOutputMs: [1400]}}))
  .toContain("camera_zoom_restart");
expect(codes({...proof, capabilities: [{capabilityId: "maul_caption_page_spring", status: "unsupported", evidenceId: null}]}))
  .toContain("capability_unsupported");
expect(codes({...proof, fallbacks: []}))
  .toContain("silent_fallback");
expect(evaluateMaulQualityTruth(validManifest, validProof)).toMatchObject({status: "pass", failures: []});
```

Also test caption boxes outside adapter safe region, replay-key mismatch, crop boxes outside normalized source bounds, missing evidence for selected capabilities, and aggregation of multiple failures.

- [ ] **Step 2: Run evaluator tests; verify RED**

Run: `npm test -- src/maul/quality-truth.test.ts` from `backend`.

Expected: FAIL because evaluator module does not exist.

- [ ] **Step 3: Implement evaluator and default fail-closed provider**

Implement exports:

```ts
export type MaulQualityTruthProofProvider = (
  manifest: MaulUnifiedShortRenderManifest,
) => Promise<MaulQualityTruthProof>;

export const evaluateMaulQualityTruth = (
  manifest: MaulUnifiedShortRenderManifest,
  proofInput: MaulQualityTruthProof,
): MaulQualityTruthResult => {
  const proof = maulQualityTruthProofSchema.parse(proofInput);
  const failures: MaulQualityTruthResult["failures"] = [];
  const fail = (
    code: MaulQualityTruthResult["failures"][number]["code"],
    field: string,
    message: string,
    evidenceId: string | null = null,
    outputStartMs: number | null = null,
    outputEndMs: number | null = null,
  ) => failures.push({code, field, message, evidenceId, outputStartMs, outputEndMs});

  if (proof.manifestReplayKey !== manifest.replayKey) {
    fail("proof_manifest_mismatch", "manifestReplayKey", "Runtime proof does not belong to this compiled manifest.");
  }

  const safe = manifest.plans.adapterDecision.safeRegion;
  const captionBoxesComplete =
    proof.captionLayout.boxes.length === manifest.captions.length &&
    new Set(proof.captionLayout.boxes.map((box) => box.captionIndex)).size === manifest.captions.length;
  if (proof.captionLayout.status !== "verified" || !captionBoxesComplete) {
    fail("caption_bounds_unverified", "captions", "Every caption requires measured final-pixel bounds.", proof.captionLayout.evidenceId);
  } else {
    for (const box of proof.captionLayout.boxes) {
      if (
        box.leftPx < safe.leftPx || box.topPx < safe.topPx ||
        box.rightPx > manifest.output.width - safe.rightPx ||
        box.bottomPx > manifest.output.height - safe.bottomPx ||
        box.rightPx <= box.leftPx || box.bottomPx <= box.topPx
      ) {
        const caption = manifest.captions[box.captionIndex];
        fail("caption_outside_safe_region", `captions.${box.captionIndex}`, "Measured caption bounds leave the governed portrait safe region.", proof.captionLayout.evidenceId, caption?.startMs ?? null, caption?.endMs ?? null);
      }
    }
  }

  const plannedFamily = manifest.plans.typographyMotion.fontResolution.selectedFamily;
  if (proof.fontRuntime.status === "fallback") {
    fail("font_fallback_forbidden", "plans.typographyMotion.fontResolution", "System font fallback cannot enter the MAUL renderer.", proof.fontRuntime.evidenceId);
  } else if (proof.fontRuntime.status !== "eligible_loaded" || proof.fontRuntime.family !== plannedFamily) {
    fail("font_load_unverified", "plans.typographyMotion.fontResolution", "Selected typography lacks matching loaded-font proof.", proof.fontRuntime.evidenceId);
  }

  if (
    proof.cropAndMask.status !== "verified" ||
    (proof.cropAndMask.maskingRequired && proof.cropAndMask.maskingStatus !== "verified")
  ) {
    fail("crop_or_mask_unverified", "timeline.speakerCropTracks", "Crop and required masking need runtime evidence.", proof.cropAndMask.evidenceId);
  }
  for (const crop of proof.cropAndMask.crops) {
    if (crop.x + crop.width > 1 || crop.y + crop.height > 1 || crop.outputEndMs <= crop.outputStartMs || crop.outputEndMs > manifest.timeline.outputDurationMs) {
      fail("crop_outside_source", "timeline.speakerCropTracks", "Crop leaves normalized source bounds or the authoritative output timeline.", proof.cropAndMask.evidenceId, crop.outputStartMs, crop.outputEndMs);
    }
  }

  if (proof.cameraContinuity.status === "restart_detected") {
    for (const outputMs of proof.cameraContinuity.resetOutputMs) {
      fail("camera_zoom_restart", "plans.camera.events", "Camera scale restarts at an implementation boundary.", proof.cameraContinuity.evidenceId, outputMs, outputMs);
    }
  } else if (proof.cameraContinuity.status !== "verified_continuous") {
    fail("camera_continuity_unverified", "plans.camera.events", "Continuous camera state lacks runtime proof.", proof.cameraContinuity.evidenceId);
  }

  const selectedCapabilityIds = new Set([
    ...manifest.plans.capabilitySelection.selections.filter((entry) => entry.selected).map((entry) => entry.capabilityId),
    ...manifest.plans.typographyMotion.motionPrograms.map((entry) => entry.capabilityId),
  ]);
  for (const capabilityId of selectedCapabilityIds) {
    const capability = proof.capabilities.find((entry) => entry.capabilityId === capabilityId);
    if (capability?.status === "unsupported") {
      fail("capability_unsupported", `capabilities.${capabilityId}`, "Selected capability is not native-render-safe.", capability.evidenceId);
    } else if (capability?.status !== "native_render_safe" || !capability.evidenceId) {
      fail("capability_evidence_missing", `capabilities.${capabilityId}`, "Selected capability lacks native branch evidence.", capability?.evidenceId ?? null);
    }
  }

  for (const execution of manifest.planExecution.filter((entry) => entry.executionStatus === "governed_fallback")) {
    const fallback = proof.fallbacks.find((entry) => entry.planType === execution.planType);
    if (!fallback?.evidenceId) {
      fail("silent_fallback", `planExecution.${execution.planType}`, "Selected governed fallback lacks observable evidence.");
    }
  }

  return maulQualityTruthResultSchema.parse({
    schemaVersion: "maul-quality-truth-result/v1",
    manifestReplayKey: manifest.replayKey,
    status: failures.length === 0 ? "pass" : "blocked",
    failures,
  });
};

export const buildUnverifiedMaulQualityTruthProof = (
  manifest: MaulUnifiedShortRenderManifest,
): MaulQualityTruthProof => maulQualityTruthProofSchema.parse({
  schemaVersion: "maul-quality-truth-proof/v1",
  manifestReplayKey: manifest.replayKey,
  captionLayout: {status: "unverified", evidenceId: null, boxes: []},
  fontRuntime: {status: "fallback", family: manifest.plans.typographyMotion.fontResolution.selectedFamily, assetId: null, evidenceId: null},
  cropAndMask: {
    status: "unverified",
    evidenceId: null,
    maskingRequired: false,
    maskingStatus: "not_required",
    crops: manifest.timeline.speakerCropTracks.map((track) => ({
      outputStartMs: track.outputStartMs,
      outputEndMs: track.outputEndMs,
      ...track.crop,
    })),
  },
  cameraContinuity: {status: "unverified", evidenceId: null, resetOutputMs: []},
  capabilities: manifest.plans.capabilitySelection.selections.filter((item) => item.selected).map((item) => ({capabilityId: item.capabilityId, status: "unverified", evidenceId: null})),
  fallbacks: [],
});
```

Code comments may describe intent, but every check must be executable code with exact failure fields/messages.

- [ ] **Step 4: Run evaluator tests; verify GREEN**

Run: `npm test -- src/maul/quality-truth.test.ts` from `backend`.

Expected: PASS.

- [ ] **Step 5: Commit evaluator**

```bash
git add backend/src/maul/quality-truth.ts backend/src/maul/quality-truth.test.ts
git commit -m "feat: evaluate MAUL quality truth before render"
```

### Task 3: Enforce and Audit Gate in Render Service

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`

- [ ] **Step 1: Add failing integration assertions**

Keep existing successful technical-render test by injecting a valid proof provider. Add a default-provider case asserting:

```ts
expect(renderResponse.statusCode).toBe(409);
expect(renderResponse.json().error).toMatch(/quality truth/i);
expect(renderEngine).not.toHaveBeenCalled();

const audit = await context.app.inject({
  method: "GET",
  url: `/api/maul/v1/projects/${project.id}/audit`,
  headers: {"x-maul-tenant-id": project.tenantId, "x-maul-creator-id": project.creatorId},
});
expect(audit.json().events).toEqual(expect.arrayContaining([
  expect.objectContaining({
    type: "quality_truth_evaluated",
    detail: expect.objectContaining({
      status: "blocked",
      failures: expect.arrayContaining([
        expect.objectContaining({code: "font_fallback_forbidden"}),
        expect.objectContaining({code: "caption_bounds_unverified"}),
      ]),
    }),
  }),
]));
```

- [ ] **Step 2: Run integration test; verify RED**

Run: `npm test -- src/__tests__/maul-short-render-path.test.ts` from `backend`.

Expected: FAIL because no proof dependency, audit type, or enforcement exists.

- [ ] **Step 3: Add proof-provider dependency**

In `BackendDependencies`, add:

```ts
maulQualityTruthProofProvider?: MaulQualityTruthProofProvider;
```

Pass it to `MaulProjectService`. Add constructor dependency after `renderEngine`, defaulting to:

```ts
async (manifest) => buildUnverifiedMaulQualityTruthProof(manifest)
```

- [ ] **Step 4: Enforce gate and append audit event**

Immediately after registering `render_manifest`, before `this.renderEngine(...)`:

```ts
const proof = await this.qualityTruthProofProvider(renderManifestResult.artifact.payload);
const qualityTruth = evaluateMaulQualityTruth(renderManifestResult.artifact.payload, proof);
const audit = await this.store.readAudit(project.id);
await this.store.appendAuditEvent(this.auditEvent({
  project: renderManifestResult.project,
  sequence: audit.length + 1,
  type: "quality_truth_evaluated",
  artifactId: renderManifestResult.artifact.artifactId,
  detail: qualityTruth,
}));
if (qualityTruth.status === "blocked") {
  throw new MaulLineageConflictError(
    `MAUL Quality Truth gate blocked render: ${qualityTruth.failures.map((failure) => `${failure.code}: ${failure.message}`).join("; ")}`,
  );
}
```

- [ ] **Step 5: Run integration test; verify GREEN**

Run: `npm test -- src/__tests__/maul-short-render-path.test.ts` from `backend`.

Expected: PASS; default baseline never invokes renderer, valid injected proof preserves technical-render test.

- [ ] **Step 6: Commit enforcement**

```bash
git add backend/src/app.ts backend/src/maul/service.ts backend/src/__tests__/maul-short-render-path.test.ts
git commit -m "feat: block MAUL renders on quality truth failures"
```

### Task 4: Evidence Tracking and Full Verification

**Files:**
- Modify: `MAUL Basics.md`

- [ ] **Step 1: Add compact Stage 0 evidence entry**

Under `### 0. Quality truth`, add:

```md
**Status:** complete (2026-07-30).
**Evidence:** `backend/src/maul/quality-truth.ts`; `backend/src/maul/quality-truth.test.ts`; `backend/src/__tests__/maul-short-render-path.test.ts`; shared schemas in `packages/shared-types/src/maul.ts`. Default thin/Arial baseline is blocked before Remotion and audited with named failures.
```

- [ ] **Step 2: Run focused tests**

Run from `packages/shared-types`:

```bash
npm test -- src/maul.test.ts
npm run typecheck
```

Run from `backend`:

```bash
npm test -- src/maul/quality-truth.test.ts src/__tests__/maul-short-render-path.test.ts src/__tests__/maul-planner-authority-scope.test.ts
npm run typecheck
```

Expected: all PASS, zero TypeScript errors.

- [ ] **Step 3: Run worktree checks**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Existing unrelated user changes remain present and untouched.

- [ ] **Step 4: Commit evidence entry**

```bash
git add "MAUL Basics.md"
git commit -m "docs: record MAUL stage 0 evidence"
```

- [ ] **Step 5: Completion audit**

Confirm each design requirement has direct evidence:

- pure gate exists between compiler and renderer;
- every named Stage 0 regression has a focused test and failure code;
- missing proof fails closed;
- multiple failures aggregate;
- blocked result skips Remotion;
- audit contains result and evidence pointers;
- technical render success remains distinct from post-render quality and human approval;
- supplied reference images remain reference-only and absent from manifest/export inputs;
- `MAUL Basics.md` links concise evidence.

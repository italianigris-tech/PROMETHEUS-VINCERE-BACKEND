# RVM Matte Integration

Issue #71 wires RVM matte output into the Joseph render path as a governed render asset.

## Implemented Path

1. `UnifiedRenderManifest.source.matteUrl` carries the browser-safe matte URL used by Remotion.
2. `UnifiedRenderManifest.matte.filePath` carries the absolute FFmpeg-safe matte path for final render workers.
3. `backend/src/director/joseph-director.ts` emits both references when the Joseph input includes RVM output.
4. `backend/src/director/orchestrator.ts` preserves the references through candidate generation, selected manifest, and evidence.
5. `remotion-app/src/compositions/VideoPlane.tsx` uses the matte video as the source plane `alphaMap`, so matte luma changes source pixel alpha.

## Fallback Behavior

Missing or unsafe matte URLs resolve to a governed flat-PiP downgrade:

```ts
compiler_matte_unavailable
```

The fallback contract lives in `remotion-app/src/compositions/matte-render-contract.ts` and is exercised by `remotion-app/src/compositions/__tests__/joseph-render-contract.test.ts`.

## Executable Proof

The issue fixture is now executable, not just documented:

- `packages/shared-types/src/unified-render-manifest.test.ts` proves browser-safe `source.matteUrl` and FFmpeg-safe `matte.filePath` validation.
- `backend/src/director/joseph-director.test.ts` proves direct Joseph manifest generation carries RVM matte references.
- `backend/src/director/orchestrator.test.ts` proves the production orchestrator path preserves the selected matte references into evidence.
- `remotion-app/src/compositions/__tests__/joseph-render-contract.test.ts` proves missing matte emits `compiler_matte_unavailable` and matte luma changes rendered source alpha pixels.

## Boundary

This completes the product render-path contract for #71. The broader depth-aware PiP compositor work remains #72: typography clearance, protected subject zones, frame chrome, background layers, and handoff motion as a complete composed system.
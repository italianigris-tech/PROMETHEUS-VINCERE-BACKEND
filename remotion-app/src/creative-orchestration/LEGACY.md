# Legacy Browser-Preview Orchestration

This subtree is a legacy browser-preview and demo orchestration stack. It is not the Joseph production spine.

Joseph production planning, judgment, manifest compilation, evidence, and render-contract authority now live in `backend/src/director` and flow through `UnifiedRenderManifest` into `remotion-app/src/compositions/JosephEdit.tsx`.

The surviving files here are intentionally retained only for older browser-preview surfaces, demos, and archived reference behavior. They must not be imported by backend Joseph planning, the worker Joseph render path, `joseph-entry.tsx`, `JosephEdit.tsx`, `VideoPlane.tsx`, or `joseph-render-contract.ts`.

Use these names precisely:

- Candidate Score Summary is the backend-owned flat scoring artifact attached to Joseph evidence.
- Planner Audit is reserved for a rich planner trace artifact and is not the backend scoring summary.

Useful algorithms from this subtree have been grafted into the live backend path with focused tests: sequence discipline, Sequence Objective ranking, diversity-cell pressure, Candidate Score Summary evidence, Manifest Compiler handoff, and renderer contract coverage.

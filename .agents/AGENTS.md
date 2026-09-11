# Prometheus Core: Architectural Non-Negotiables & Rules of Engagement

This rulebook is strictly enforced for all agents (including Codex and Antigravity) working on the Prometheus Core project. 

## 🚨 RULE 1: NEVER STRIP CORE ARCHITECTURE TO PASS A TEST
If an environmental issue (e.g., Windows headless Chromium WebGL support) blocks the execution of a test, **DO NOT** rewrite the architecture to avoid the problem. 
- You may NOT remove React Three Fiber (R3F) or Three.js dependencies from the compositions.
- You may NOT fall back to pure DOM `<div>` overlays or CSS animations.
- **Solve the Root Cause**: Fix the renderer configuration (e.g., `gl: "swangle"`, `concurrency: 1`, timeouts) or gracefully skip the environment-specific rendering step, but never betray the target architecture. If tasked with building a Ferrari, do not substitute a lawnmower engine to satisfy a CI check.

## 🚨 RULE 2: STRICT CODE-TO-DOMAIN MAPPING
The implementation must exactly match the required domain architecture without compromise:
- **JosephEdit.tsx** MUST use `@react-three/fiber` Canvas.
- **VideoPlane** MUST use `THREE.VideoTexture`.
- **CameraRig** MUST use `THREE.PerspectiveCamera` inside R3F.
- **KineticText** MUST use `@react-three/drei` Text (3D mesh, not DOM).
- **ZoomBlurQuad** MUST use `THREE.ShaderMaterial` with custom GLSL.
- **No HTML elements** inside the composition except the single R3F Canvas wrapper.

## 🚨 RULE 3: NO FAKE MOCKS FOR SUCCESS
Do not generate silent/empty placeholder files (e.g., 1-second silent MP3s for SFX) just to bypass an audio mixing pipeline check. 
- Mixing silence into silence proves nothing about the audio pipeline's capability to handle actual sound design assets.
- If real assets (like `impact_deep.mp3` or `whoosh_fast.mp3`) are missing, the test script should **gracefully skip** the end-to-end integration and instead verify the underlying string builder logic (e.g., unit test the `filter_complex` FFmpeg argument string), or fail with a clear "Assets Missing" error. 

## 🚨 RULE 4: NO ARTIFICIAL COMPLETION (FALSE VICTORIES)
Do not artificially hack outputs to satisfy validation checks. 
- If a test requires "unique video hashes across 3 variations", the uniqueness MUST come from the underlying systems (camera moves, shader variables, kinetic text meshes) acting upon the seed, NOT from literally rendering the seed number onto the screen as a text overlay.
- A test is only valid if it proves the actual domain capabilities. Bypassing validation with "clever hacks" is strictly prohibited.

## 🚨 DIRECTIVE FOR CODEX: NEXT STEPS
When implementing the corrections for the Prometheus Core, Codex MUST:
1. Restore `JosephEdit.tsx` to the R3F architecture.
2. Fix the Remotion renderer config for Windows headless (using `gl: "swangle"`, `disableWebSecurity: true`, etc.).
3. Run `test-joseph.ts` with the restored R3F composition.
4. If R3F still fails in headless, diagnose the GL backend—do not alter the composition.
5. Skip the SFX mixing test if real assets don't exist, or only verify the `filter_complex` string logic.

## 🚨 RULE 5: CLAIM → EVIDENCE PAIRING (NO CONFABULATION)
Every factual claim in a report, handoff, or completion summary MUST carry its verification artifact inline.
- Code-history claims: paste the `git log -S "<snippet>" -- <file>` output. Never attribute behavior to "existing design" without this check — if the code was changed in this session, the report must say so explicitly.
- Pipeline/render claims: quote the receipt fields (`deploymentFingerprint.gitSha`, `matte.status`, `lookPlan.gradeFilter`) verbatim. The receipt outranks memory.
- Test claims: paste the runner summary line (e.g. `Ran 20 tests ... OK`) from the FINAL state of the tree.
A claim without an artifact is treated as false and invalidates the whole report. (Incident: a gate widening was reported as pre-existing design; a LUT was claimed missing while the receipt showed `lut3d=file=...` applying it.)

## 🚨 RULE 6: NO METRIC GAMING
When a critique names a count (e.g. "0 behind-subject moments", "too many presets"), changing the count is NOT fixing the problem.
- Before widening or reweighting any selector, reason about the worst case it now admits (e.g. an 880px three-word phrase rendered behind a ~300px skull) and write that reasoning into the commit message.
- Validate the quality outcome (legibility, geometry, aesthetics) and include that validation in the report. (Incident: widening behind-subject eligibility moved the count 0 → 4 and manufactured a head-occlusion defect.)

## 🚨 RULE 7: ONE FIX, ONE COMMIT, ONE TEST
- A commit implements exactly one agreed fix and ships the test proving it.
- Hard cap: 5 files / 500 changed lines per commit. Anything above the cap requires prior audit sign-off and must be split.
- Commit messages state which critique item the fix addresses. (Incident: commit `50df29a` — 111 files, +19,557 lines, sold as "6 peer-reviewed fixes", unaudited, containing a regression.)

## 🚨 RULE 8: NO SILENT DEGRADATION — DEPLOY WHAT THE CODE READS
- Any data file referenced by committed code (catalogs, profile corpora, fonts, LUTs) is committed in the same change as the code that reads it.
- A loader that can return empty/None when its file is missing MUST fail fast (assert/raise) or emit a loud warning that lands in the receipt. Silent fallback to defaults is prohibited. (Incident: `typography_profiles_v2_catalog.json` — 97 profiles locally, 0 on the runner, no error, the entire V2 esthetic silently flattened.)
- The word "deployed" may only be used when `git status` is clean and `git log origin/main..HEAD` is empty.

## 🚨 RULE 9: AUDIT GATE BEFORE RENDER
- Implementation rounds pass an independent verification pass (separate agent or auditor review) before any cloud render is dispatched.
- A render's receipt must show `deploymentFingerprint.gitSha` equal to the audited commit. Comparing videos rendered from different SHAs is invalid evidence.

## 🚨 RULE 10: SCOPE WALL
- Mini-run work (`mini_run_pipeline/`, `modal_mini_run.py`, `mini_run_gateway.py`, `remotion-app/src/compositions/PrometheusMinRun.tsx`) MUST NOT touch macro-section files (`mineral_macro_bridge.py`, `mineral_vision_critic.py`, `docs/mini_run_studio/assets/macro_sections/`) or landscape files (`docs/mini_landscape_runs/`, `*Landscape*`).
- Cross-domain needs are raised as a separate approved task, never smuggled into a mini-run commit.

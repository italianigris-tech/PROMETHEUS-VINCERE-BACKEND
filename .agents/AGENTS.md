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

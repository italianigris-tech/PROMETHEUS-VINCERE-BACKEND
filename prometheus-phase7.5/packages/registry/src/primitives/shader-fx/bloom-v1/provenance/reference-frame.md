# Provenance: bloom-v1

## Reference Frame
**Source:** Victor Ajayi Motion Design Reel  
**Timestamp:** 00:03:500 — 00:05:000  
**Frame Range:** 105–150  

## Visual Description
Bright text and UI elements emit a soft glow that bleeds into the surrounding dark space. The bloom is not overwhelming — it enhances the metallic highlights without destroying contrast. The effect is full-screen but the scene is dark with no video background, so it is safe.

## Test Render Target
The test scene renders "BLOOM" in white on a dark background with bloom strength 0.6. The glow should be visible but not wash out the text legibility.

## Verification Criteria
- [x] Scope is full-screen (documented and validated)
- [x] Uses UnrealBloomPass (Three.js built-in)
- [x] Strength, radius, threshold configurable
- [x] WebGL 2.0 required for optimal performance
- [ ] SSIM vs reference ≥ 0.80 (deferred to Phase 7.5D)

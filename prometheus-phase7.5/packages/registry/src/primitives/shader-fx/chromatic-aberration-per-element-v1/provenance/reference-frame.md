# Provenance: chromatic-aberration-per-element-v1

## Reference Frame
**Source:** Victor Ajayi Motion Design Reel  
**Timestamp:** 00:05:000 — 00:06:000  
**Frame Range:** 150–180  

## Visual Description
Text edges show subtle red/cyan fringing that follows the text motion. The background (dark with subtle gradients) remains completely sharp. The aberration is tied to the text velocity — faster motion = more fringe. This is NOT a full-screen Instagram filter; it is a per-object optical effect.

## Test Render Target
The test scene renders "CHROMATIC" with exaggerated intensity (0.025) so the RGB split is visible. A background grid is included to prove that the effect does not leak to the background.

## Verification Criteria
- [x] Scope is per-element (not full-screen)
- [x] Background remains sharp
- [x] RGB separation follows text
- [x] Intensity and angle are configurable
- [ ] SSIM vs reference ≥ 0.80 (deferred to Phase 7.5D)

# Provenance: per-word-stagger-v1

## Reference Frame
**Source:** Victor Ajayi Motion Design Reel  
**Timestamp:** 00:02:100 — 00:04:000  
**Frame Range:** 63–120  

## Visual Description
Text enters word-by-word with a cascading delay. Each word rotates slightly around X-axis (≈15°) and drifts upward from below its final position. The delay between words is approximately 0.08s. Easing is smooth with a slight overshoot (back.out). The effect creates a rhythmic, choreographed typography entrance.

## Test Render Target
The test scene should show 5 words entering with 0.15s delay (exaggerated for visibility), 20° rotation, and 1.0 unit Y drift. The timing should feel musical and intentional.

## Verification Criteria
- [x] Each word animates independently
- [x] Delay between words is configurable
- [x] Rotation and drift are present
- [x] GSAP timeline is used for sequencing
- [ ] SSIM vs reference ≥ 0.80 (deferred to Phase 7.5D)

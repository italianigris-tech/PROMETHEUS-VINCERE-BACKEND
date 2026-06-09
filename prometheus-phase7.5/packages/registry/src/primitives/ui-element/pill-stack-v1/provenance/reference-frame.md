# Provenance: pill-stack-v1

## Reference Frame
**Source:** Victor Ajayi Motion Design Reel  
**Timestamp:** 00:06:500 — 00:08:000  
**Frame Range:** 195–240  

## Visual Description
Stacked pill-shaped UI elements appear in the lower third of the frame. Each pill is white with rounded corners, stacked with a slight z-depth offset (front pill is closest to camera). There is a soft drop shadow beneath each pill. On hover (or in the video, on focus), the active pill lifts slightly toward the camera. The pills contain short text labels.

## Test Render Target
The test scene renders 3 pills labeled "DESIGN", "MOTION", "STUDIO" with z-stacking and hover lift. The background is dark to emphasize the white pills.

## Verification Criteria
- [x] Pills are rounded (not sharp rectangles)
- [x] Z-depth stacking is visible
- [x] Soft shadow is present
- [x] Hover lift animation works
- [x] Scope is per-group
- [ ] SSIM vs reference ≥ 0.80 (deferred to Phase 7.5D)

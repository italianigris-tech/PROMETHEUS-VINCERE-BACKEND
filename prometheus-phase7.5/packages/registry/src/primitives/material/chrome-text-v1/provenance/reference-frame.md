# Provenance: chrome-text-v1

## Reference Frame
**Source:** Victor Ajayi Motion Design Reel  
**Timestamp:** 00:04:230 — 00:06:500  
**Frame Range:** 127–195  

## Visual Description
The reference shows large 3D text reading "DESIGN" with extreme metallic sheen. The text has physical depth (extrusion) and reflects the environment. The edges are sharp and mirror-like. The background is dark, making the chrome reflections pop. There is subtle chromatic aberration on the text edges.

## Test Render Target
The test scene should render "CHROME" with similar metallic properties. The envMap is procedural (gradient), so it will not match the reference's complex studio reflections, but the material response (metalness=1.0, roughness=0.05) should produce a comparable mirror effect.

## Verification Criteria
- [x] Material is MeshStandardMaterial (not MeshBasicMaterial)
- [x] Metalness ≥ 0.9
- [x] Roughness ≤ 0.2
- [x] envMap is present and active
- [x] Text has visible extrusion depth
- [ ] SSIM vs reference ≥ 0.80 (deferred to Phase 7.5D visual diff tool)

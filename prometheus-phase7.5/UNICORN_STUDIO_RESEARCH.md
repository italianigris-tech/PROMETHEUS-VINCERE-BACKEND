
# UNICORN STUDIO EFFECT TAXONOMY (Extracted from unicorn.studio)
# This informs the Prometheus Primitive Registry expansion

## Core Effect Categories (75+ effects)

### 1. LIGHTING & GLOW
- Bloom (soft glow around bright areas)
- God Rays (volumetric light shafts)
- Vignette (edge darkening)
- Gradient Map (color remapping)
- Light Trail (motion streaks)

### 2. DISTORTION & DEFORMATION
- Slice (layered displacement)
- Noise Distort (perlin-based warping)
- Water Caustics (underwater refraction)
- FBM Distort (fractal Brownian motion)
- Retro CRT (scanline + pixelation)

### 3. COLOR & OPTICS
- Chromatic Aberration (RGB separation)
- Spatial Projection (3D mapping)
- Gradient Map (color grading)

### 4. PARTICLES & ATMOSPHERE
- FBM Distort (cloud-like noise)
- Wisp Group (particle wisps)
- Projection (texture projection)

### 5. INTERACTION TRIGGERS
- Appear (entrance animation)
- Scroll (scroll-driven)
- Hover (mouse hover)
- Mousemove (continuous tracking)
- Time-based (auto-play)

## UI Architecture Patterns

### Layer System
- Each effect is a LAYER in the stack
- Layers have: Position, Scale, Warp, Skew, Repeat, Speed
- Interactivity: Track mouse, Momentum
- Mask support for selective application

### Parameter Panel (Right Sidebar)
- Design tab: visual parameters
- Events tab: trigger conditions
- Position: X/Y percentage
- Scale: percentage
- Warp: deformation amount
- Skew: angular distortion
- Repeat: tiling mode
- Speed: animation velocity
- Interactivity: Track mouse (0-100%), Momentum (0-100%)

### Timeline / Keyframe System
- Y Position: 146% → 50% over 1000ms
- Scale: 0% → 50% over 1000ms
- Amplitude: 0% → 26% over 1000ms
- Multi-property animation with staggered starts

### Performance Pipeline
- FXAA (anti-aliasing)
- 3D Strip (geometry optimization)
- God Rays (volumetric pass)
- Vignette (post-process)
- Render metrics: Initial render, Draws/frame, Complexity score, FPS, Frame time, Frame budget, Dropped frames, Memory (Textures, Geometries, Framebuffers)

### Export / Embed
- Framer integration
- Webflow integration
- Figma integration
- npm: unicornstudio-react
- JSON export (for programmatic use)
- Video exports (WebM/MP4)

## KEY INSIGHTS FOR PROMETHEUS 7.5

1. **Effect-as-Layer**: Unicorn treats every effect as a composable layer.
   → Prometheus Primitive = Unicorn Layer. Same paradigm.

2. **Parameter Panel**: Every effect exposes typed, bounded parameters.
   → Prometheus ParameterSchema = Unicorn Parameter Panel.

3. **Mask Support**: Effects can be masked to specific regions.
   → Prometheus Scope (per-element/layer/full-screen) = Unicorn Mask.

4. **Interactivity**: Mouse tracking + momentum.
   → Prometheus can add interactivity primitives (Phase 8).

5. **Performance Pipeline**: Explicit render passes with metrics.
   → Prometheus PerformanceProfile = Unicorn Pipeline metrics.

6. **Timeline Keyframes**: Multi-property animation with timing.
   → Prometheus TimelineSegment = Unicorn Timeline.

7. **Remix / Publish**: Community sharing of scenes.
   → Prometheus SceneArchetype + Remix = Unicorn Publish/Remix.

8. **JSON Export**: Programmatic access to scenes.
   → Prometheus CompositionManifest = Unicorn JSON Export.

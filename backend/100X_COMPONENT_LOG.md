# 🚀 Elon 100X: Visual Dominance Component Log
**Objective:** Transition from 2D SVG Typography to Lusion-grade Spatial Motion & Neural Rendering.

## 🏗️ Architectural Evolution
| Component | Status | Description |
|-----------|--------|-------------|
| **Spatial Depth Map Resolver** | 🗒️ Draft | Extracts depth-data from video matting to allow text-subject occlusion. |
| **Physics-Based Spring Engine** | 🗒️ Draft | Replaces standard GSAP easing with momentum-based physics (Inertia, Flutter). |
| **Light-Wrap Shader Pipeline** | 🗒️ Draft | WebGL fragment shader to blend video lighting into text edges. |
| **Spectral Motion Synchronizer** | 🗒️ Draft | Modulates motion stagger based on audio frequency spectrum (FFT). |
| **Neural Camera Shake Emulator** | 🗒️ Draft | Synthetic camera movement that reacts to speech intensity. |

| **Hybrid Surface Bridge** | 🗒️ Draft | Maps DOM-based GSAP state to WebGL texture quads for GPU rendering. |

## 📐 Research: WebGL vs. DOM
*Current Analysis:*
- **DOM (Current):** Great for accessibility and quick SVG filters. Horrible for 3D depth, sub-pixel lighting, and 10,000+ particle interactions.
- **WebGL/Canvas (100X):** Mandatory for Lusion-grade depth. Allows per-pixel manipulation (chromatic aberration, light wraps) and real 3D vertex displacement.

## 🏁 The "Hybrid" Decision
**Verdict:** Do not switch 100%. Use **DOM for State, WebGL for Surface**.
1. Use GSAP to drive "Virtual Transforms" in a hidden DOM.
2. Sync those transforms to a WebGL `<canvas>` overlaid on the video.
3. Apply fragment shaders for light-wrap, motion blur, and depth-occlusion.

---
*Log initialized by Sherlock Audit.*

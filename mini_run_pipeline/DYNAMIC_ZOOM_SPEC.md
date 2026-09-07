# Prometheus Mini-Run: Dynamic Zoom-In Engine Architectural Specification

> **Directory**: `mini_run_pipeline/`  
> **Target Scope**: Mini-Run Portrait 9:16 Video Engine  

---

## Target Implementation Files (Strictly within Mini-Run)

All implementation for this zoom engine is strictly contained within these specific files:

1. **`mini_run_pipeline/orchestration.py`**
   - **`ZOOM_KINDS`**: Definitions for all 9 professional zoom archetypes (`joseph_edit`, `smooth_zoom_in`, `zoom_out_snap`, `twist_zoom`, `hitchcock_dolly`, `slow_creep`, `punch_zoom`, `3d_zoom_parallax`, `match_cut_zoom`).
   - **`plan_zoom_ins`**: Ingests `prompt` and `brand_preferences`. Calculates dynamic eye-line `anchorPoint: {xPercent, yPercent}` from subject tracking observation.
   - **Peak-Velocity SFX**: Synchronizes sound design cues (`whoosh_fast_bupu`, `shutter_snap_bupu`, `click_bupu`, `charge_riser_bupu`) to the moment of maximum acceleration.
   - **`govern_camera_moves`**: Enforces causal integrity, scale bounds ($\le 1.22\times$), rotation bounds ($\le \pm 45^\circ$), and snap exceptions.

2. **`remotion-app/src/compositions/PrometheusMinRun.tsx`**
   - **`MiniRunOrchestration["cameraMoves"]`**: Enriched schema supporting `anchorPoint`, `rotationDeg`, `cutbackAtEnd`, and `dollyParallax`.
   - **`resolveSceneVisualState`**: Computes dynamic camera scale, rotation angle, and the Joseph Edit instantaneous $1.00\times$ cut-back.
   - **`resolvePanScanMediaStyle`**: Applies eye-line `transformOrigin: "${anchorX}% ${anchorY}%"` and `rotate(${rotation}deg)`.
   - **Multi-Plane Separation**: Differential scaling between `MiniRunSourceStage` (Z:1) and the foreground matte cutout (Z:50).

3. **`mini_run_pipeline/test_orchestration_zooms.py`**
   - Unit tests validating all 9 zoom archetypes, cut-back mechanics, eye anchoring, prompt ingestion, and causal governance.

---

## The 9 Dynamic Zoom Archetypes

| Archetype | Category | Scale Vector | Kinematics & Duration | Visual / Audio Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `joseph_edit` | Cinematic | $1.00\times \rightarrow 1.10\times \rightarrow \mathbf{1.00\times}$ | 2400–4800ms linear push; **0ms hard cut-back** | Slow creep, snaps to $1.00\times$ at cut; micro flash transition + shutter snap SFX |
| `smooth_zoom_in` | High-Energy | $1.00\times \rightarrow 1.14\times$ | 650–850ms, Cubic Out `[0.22, 1, 0.36, 1]` | Fast focus push into eyes/detail; `whoosh_fast_bupu` |
| `zoom_out_snap` | High-Energy | $1.16\times \rightarrow 1.00\times$ | 450–650ms, Exponential Out `[0.16, 1, 0.3, 1]` | Rapid snap pull-back to wide frame; `whoosh_3_bupu` |
| `twist_zoom` | High-Energy | $1.00\times \rightarrow 1.15\times$, Rot: $\pm 12^\circ \rightarrow 0^\circ$ | 500–750ms Bezier roll | Angular twist during zoom burst; whip whoosh SFX |
| `hitchcock_dolly` | Cinematic | BG $1.22\times$, Matte $1.02\times$ | 2200–3800ms differential | Background warps while speaker stays locked; `charge_riser_bupu` |
| `slow_creep` | Cinematic | $1.00\times \rightarrow 1.055\times$ | 6000–12000ms ultra-slow linear | Imperceptible tension build across multi-chunk monologue |
| `punch_zoom` | Social / Jolt | $1.00\times \rightarrow \mathbf{1.15\times}$ (instant) | 0ms step function | 1-frame jump-cut on emphatic word; `tap_punch_bupu` |
| `3d_zoom_parallax`| Social / Pro | Subject $1.08\times$, BG $1.03\times$ | 1500–2500ms multi-plane | Foreground subject & background move at different rates |
| `match_cut_zoom` | Continuity | Outgoing $1.15\times \rightarrow$ Incoming $1.15\times \rightarrow 1.00\times$ | Cross-scene boundary ease-out | Preserves scale continuity across scene cut |

---

## Eye-Line Anchoring Formula

In 9:16 portrait video (1080x1920), human faces sit at $35\%-45\%$ vertical height ($Y$).  
Scaling from the default frame center ($50\% X, 50\% Y$) truncates the subject's head.

**Dynamic Transformation Origin**:
$$\text{transformOrigin} = \left(x_\text{focal}\%,\, y_\text{focal}\%\right)$$
Where:
- $x_\text{focal}$ is derived from the speaker tracking observation (default $50.0\%$).
- $y_\text{focal}$ is anchored to the eye-line (default $40.0\%$, bounded $[25\%, 65\%]$).

# Backend Asset & Font Ingestion Protocol

This document establishes the mandatory protocol for agents and engineers when configuring, deploying, or migrating backend rendering instances (Modal, Docker containers, Kubernetes, AWS ECS, or bare metal workers).

---

## The Core Rule: Assets Do Not Self-Ingest

Backend servers and remote rendering containers operate in **isolated environments**. When deploying code or switching backend providers, typography specifications, font binaries, sound effects, and design exemplar JSONs **will never automatically synchronize** unless explicitly mapped in the deployment contract.

### The Danger of Silent Fallback
* **Fonts**: Headless Chromium does **not crash** when a requested font is missing. It silently falls back to standard system fonts (Times New Roman, Arial, DejaVu Sans), producing visually degraded outputs that appear to have succeeded in pipeline logs.
* **Exemplars**: Python will fall back to basic 1-layer unstyled captions if the font JSON directory is not mounted.
* **Audio**: FFmpeg will fail with complex filter errors or produce silent audio beds if SFX files are missing.

---

## The 4 Pillars of Backend Ingestion

Every operational backend server must mount or copy these 4 pillars into its filesystem:

| Pillar | Local Repository Path | Container / Server Target Path | Required For |
| :--- | :--- | :--- | :--- |
| **1. Font JSON Exemplars** | `Yuan Prometheus Screenshots/font JSON/` | `/opt/prometheus/Yuan Prometheus Screenshots/font JSON/` | Python chunk compilation, layer count, positioning rules, drop shadows, gradients |
| **2. Font Binaries** | `remotion-app/public/fonts/` | `/opt/prometheus/remotion-app/public/fonts/` | Chromium canvas rendering of `.otf`, `.ttf`, `.woff2` files |
| **3. Font CSS Registry** | `remotion-app/public/all_fonts_dynamic.css` | `/opt/prometheus/remotion-app/public/all_fonts_dynamic.css` | Maps CSS `@font-face` names to binary files |
| **4. Sound Effects (SFX)** | `SOUND FX/` | `/opt/prometheus/SOUND FX/` | FFmpeg audio mixing pipeline (`audio.py`) |

---

## 4-Step Protocol: Introducing or Modifying Assets

Whenever an agent or engineer adds or updates a font, text treatment, or audio effect, all four steps must be executed sequentially:

### Step 1: Disk Binary Placement
* Place `.otf` or `.ttf` font binaries into `remotion-app/public/fonts/`.
* Place audio files (`.mp3`, `.wav`) into `SOUND FX/`.

### Step 2: Font-Face Declaration
* In `remotion-app/public/all_fonts_dynamic.css`, declare the `@font-face` rule:
  ```css
  @font-face {
    font-family: 'Exmouth';
    src: url('/fonts/Exmouth.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
  }
  ```

### Step 3: Python Decision Engine Mapping
* In `mini_run_pipeline/typography.py`, register the family in `FONT_FAMILY_REGISTRY`:
  ```python
  "exmouth": {
      "family": "Exmouth",
      "category": "script",
      "weights": [400],
      "roles": ["accent_top_overlay", "flourish", "script_callout"],
  },
  ```

### Step 4: Font JSON Exemplar Specification
* Create or update the corresponding exemplar in `Yuan Prometheus Screenshots/font JSON/image (X).json`:
  * Explicit layer counts and word allocations.
  * Explicit typography styling (`textFillColor`, `vertical_gradient`, `drop_shadow`, `textTransform`).
  * Explicit spatial hierarchy (`is_overlay_atop`, `is_underlapping`, `z_index`).

---

## Backend Deployment Checklist (New Instance / Migration)

When provisioning a new backend container (e.g. `modal_mini_run.py`, `Dockerfile`, or VM setup script):

1. **Verify Mount Directives**:
   Ensure the definition includes all 4 pillars:
   ```python
   # In Modal image definition:
   .add_local_dir(local("mini_run_pipeline"), f"{APP_ROOT}/mini_run_pipeline", copy=True)
   .add_local_dir(local("remotion-app"), f"{APP_ROOT}/remotion-app", copy=True)
   .add_local_dir(local("SOUND FX"), f"{APP_ROOT / 'SOUND FX'}", copy=True)
   .add_local_dir(local("Yuan Prometheus Screenshots"), f"{APP_ROOT / 'Yuan Prometheus Screenshots'}", copy=True)
   ```
2. **Re-bundle Remotion**:
   Ensure `remotion-app` bundles `src/index.ts` so Chromium can access `/public/fonts` and `/public/all_fonts_dynamic.css`:
   ```bash
   cd remotion-app && npx remotion bundle src/index.ts --out-dir /opt/prometheus/remotion-bundle
   ```
3. **Run Pre-flight Asset Integrity Audit**:
   Execute `python scripts/verify_backend_assets.py` to ensure zero missing files across the entire chain before initiating production renders.

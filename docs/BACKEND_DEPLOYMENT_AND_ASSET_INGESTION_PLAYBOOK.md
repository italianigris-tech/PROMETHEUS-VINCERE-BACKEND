# Prometheus Core: Master Backend Deployment & Asset Ingestion Playbook

> **Audience**: Autonomous Agents (Antigravity, Codex, etc.) and Core Platform Engineers.  
> **Scope**: The definitive single source of truth for packaging, verifying, uploading, and deploying the Prometheus backend and rendering pipeline across any backend environment (Modal, Docker, Kubernetes, AWS ECS, RunPod, or bare-metal Linux).

---

## 1. Executive Summary & The Golden Rule

```
               🚨 THE GOLDEN RULE OF BACKEND INGESTION 🚨
Remote backend servers and cloud containers operate inside isolated filesystems.
Assets and specifications NEVER self-ingest or magically copy across servers.
Every font binary, sound effect, CSS rule, and design exemplar MUST be explicitly
mapped, verified, and bundled into the target environment.
```

### The Silent Degradation Trap
Unlike code compilation which fails loud and breaks the build when a module is missing, media assets fail **silently**:
* **Missing Font Binaries**: Headless Chromium does **not** throw an error. It renders captions using generic Linux fallback fonts (Times New Roman, Arial, or DejaVu Sans). The render exits with status 0, but the video looks amateur and broken.
* **Missing Font JSON Exemplars**: Python chunk compilation falls back to a basic single-layer white text layout without crashing.
* **Missing CSS `@font-face` Declarations**: Even if the font binary is on disk, if Chromium does not have an active `@font-face` rule mapping the family name, it will not apply it.
* **Missing Sound FX**: Audio mixing pipelines will either fail complex filter graphs or emit silent audio tracks.

---

## 2. The 4 Asset & Specification Pillars

Any operational backend server must mount or copy these four fundamental pillars:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             PROMETHEUS ASSET PILLARS                             │
├───────────────────────────────┬──────────────────────────────────────────────────┤
│ PILLAR                        │ REPOSITORY PATH                                  │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 1. Font JSON Exemplars        │ Yuan Prometheus Screenshots/font JSON/          │
│ 2. Physical Font Binaries     │ remotion-app/public/fonts/                       │
│ 3. Dynamic CSS Font Bridge    │ remotion-app/public/all_fonts_dynamic.css        │
│ 4. Sound FX Library           │ SOUND FX/                                        │
└───────────────────────────────┴──────────────────────────────────────────────────┘
```

### Pillar 1: Font JSON Exemplars (`Yuan Prometheus Screenshots/font JSON/`)
* **What it contains**: 150+ reference design exemplars (`image (1).json` through `image (154).json`).
* **What it controls**:
  * Exact layer counts (e.g. 2-layer, 3-layer layouts).
  * Word allocations per layer (e.g. Layer 0 = 1 word, Layer 1 = 2 words).
  * Font family selections (`Playfair Display`, `Bromello`, `Cinzel Bold`, `Exmouth`).
  * Text treatments (`vertical_gradient`, `drop_shadow`, `textFillColor`, `glow`).
  * Spatial relationships (`is_overlay_atop`, `is_underlapping`, `z_index`, `margin_top`).
* **Target Container Path**: `/opt/prometheus/Yuan Prometheus Screenshots/font JSON/`

### Pillar 2: Physical Font Binaries (`remotion-app/public/fonts/`)
* **What it contains**: 800+ `.otf`, `.ttf`, and `.woff2` font files organized into subdirectories (`fonts/library/`, `fonts/hero/`, `fonts/studio/`, `fonts/maul/`).
* **Target Container Path**: `/opt/prometheus/remotion-app/public/fonts/`

### Pillar 3: Dynamic CSS Font Bridge (`remotion-app/public/all_fonts_dynamic.css`)
* **What it contains**: 140+ `@font-face` CSS declarations mapping exact family names to font file relative paths.
* **Format**:
  ```css
  @font-face {
    font-family: "Exmouth";
    src: url("./fonts/library/exmouth/Exmouth.otf") format("opentype");
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
  ```
* **Critical Rule**: The `font-family` string in CSS must **strictly match** the output of `mini_run_pipeline/typography.py` (case-sensitive and space-sensitive).
* **Target Container Path**: `/opt/prometheus/remotion-app/public/all_fonts_dynamic.css`

### Pillar 4: Sound FX Library (`SOUND FX/`)
* **What it contains**: 200+ curated `.mp3` and `.wav` sound effects arranged by category (`IMPACT HITS/`, `SWOOSHES/`, `MECHANICAL CLICKS/`, `TEXT/`, etc.).
* **Target Container Path**: `/opt/prometheus/SOUND FX/`

---

## 3. The 4-Step Protocol for Introducing or Modifying Assets

Whenever introducing a new font, text treatment, or audio effect, follow this 4-step chain:

```
[Step 1: Disk Binary] ──> [Step 2: CSS Declaration] ──> [Step 3: Python Registry] ──> [Step 4: Font JSON]
```

1. **Step 1: Place Binary on Disk**:
   * Fonts: Copy `.otf` / `.ttf` into `remotion-app/public/fonts/library/<font-name>/`.
   * SFX: Copy `.mp3` / `.wav` into the appropriate subfolder of `SOUND FX/`.
2. **Step 2: Declare in CSS**:
   * Add `@font-face` block to `remotion-app/public/all_fonts_dynamic.css`.
3. **Step 3: Register in Python Decision Engine**:
   * In `mini_run_pipeline/typography.py`, add mapping to `FONT_FAMILY_REGISTRY`:
     ```python
     "my font": "My Font",
     ```
   * If it requires local bundling, add it to `REGISTRY_NEEDS_LOAD`.
4. **Step 4: Specify in Font JSON**:
   * In `Yuan Prometheus Screenshots/font JSON/image (X).json`, set `"fontFamily": "My Font"`, define layer roles, colors, shadows, and gradients.

---

## 4. Automated Pre-Flight Asset Verification

Before deploying to ANY server or launching a render, you must run the pre-flight verification script:

```bash
python scripts/verify_backend_assets.py
```

### What this script checks:
1. **Pillar 1**: Confirms `font JSON/` directory exists and has valid `.json` files.
2. **Pillar 2**: Confirms `remotion-app/public/fonts/` contains physical `.otf`/`.ttf` binaries.
3. **Pillar 3**: Parses `all_fonts_dynamic.css` and verifies that **every single font family** in `typography.py`'s `FONT_FAMILY_REGISTRY` either has an active `@font-face` declaration or is a valid webfont.
4. **Pillar 4**: Confirms `SOUND FX/` contains valid `.mp3`/`.wav` files.

If any asset is missing or unlinked, the script **fails with exit code 1** and lists the exact missing files.

---

## 5. Deployment Procedures

### A. Deploying to Modal (`prometheus-mini-run-studio`)

#### Windows Environment Tripwires & Mandatory Flags
When deploying from a Windows host to Modal, standard PowerShell settings can cause two catastrophic build failures:
1. **NTFS Junction Timestamp Jitter**: Modal detects local directory mtimes shifting during the build if junctions point to external folders.
   * **Fix**: Set `$env:MODAL_BUILD_VALIDATION="ignore"`.
2. **Charmap Unicode Output Crash**: Remotion bundling outputs Unicode status characters (e.g. checkmarks `✔`, spinners) that crash Python's `charmap` (cp1252) stdout encoding on Windows.
   * **Fix**: Set `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`, `$env:PYTHONIOENCODING="utf-8"`, and `$env:PYTHONUTF8="1"`.

#### The Golden Deploy Command (PowerShell):
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; `
$env:PYTHONIOENCODING="utf-8"; `
$env:PYTHONUTF8="1"; `
$env:MODAL_BUILD_VALIDATION="ignore"; `
modal deploy modal_mini_run.py
```

#### How `modal_mini_run.py` Packages the Pillars:
Ensure the `modal.Image` definition in `modal_mini_run.py` includes all local directories:
```python
image = (
    modal.Image.debian_slim(python_version="3.11")
    # System dependencies: ffmpeg, node, chromium dependencies
    .apt_install("ffmpeg", "nodejs", "npm", ...)
    # Pillar 1 & 4 mounts
    .add_local_dir(local("Yuan Prometheus Screenshots"), f"{APP_ROOT / 'Yuan Prometheus Screenshots'}", copy=True)
    .add_local_dir(local("SOUND FX"), f"{APP_ROOT / 'SOUND FX'}", copy=True)
    # Core pipeline & app mounts
    .add_local_dir(local("mini_run_pipeline"), f"{APP_ROOT}/mini_run_pipeline", copy=True, ignore=source_ignore)
    .add_local_dir(local("remotion-app"), f"{APP_ROOT}/remotion-app", copy=True, ignore=source_ignore)
    .add_local_dir(local("packages"), f"{APP_ROOT}/packages", copy=True, ignore=source_ignore)
    # Remotion bundle step (Pillars 2 & 3 bundled into web root)
    .run_commands(
        f"cd {APP_ROOT} && npm install --legacy-peer-deps",
        f"cd {APP_ROOT}/remotion-app && npm ci --legacy-peer-deps",
        f"cd {APP_ROOT} && npm --workspace @prometheus/shared-types run build",
        f"cd {APP_ROOT}/remotion-app && npx remotion browser ensure",
        f"cd {APP_ROOT}/remotion-app && npx remotion bundle src/index.ts --out-dir {BUNDLE_ROOT}",
    )
)
```

---

### B. Migrating to Docker / Kubernetes / AWS ECS / RunPod

If shifting the backend away from Modal to a Docker container or Kubernetes cluster, use this standard Dockerfile architecture:

```dockerfile
FROM node:20-bookworm-slim AS remotion-builder
WORKDIR /app

# Install build dependencies & ffmpeg
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip

# Copy package descriptors
COPY package.json package-lock.json ./
COPY remotion-app/package.json ./remotion-app/
COPY packages/ ./packages/

# Install dependencies and build shared types
RUN npm install --legacy-peer-deps
RUN npm --workspace @prometheus/shared-types run build

# Copy Remotion app including fonts (Pillars 2 & 3)
COPY remotion-app/ ./remotion-app/

# Ensure Chromium headless shell & bundle Remotion
RUN cd remotion-app && npx remotion browser ensure
RUN cd remotion-app && npx remotion bundle src/index.ts --out-dir /app/remotion-bundle

# Final Runtime Image
FROM python:3.11-slim-bookworm
WORKDIR /opt/prometheus

# Install runtime libraries for Chromium & MediaPipe
RUN apt-get update && apt-get install -y ffmpeg libglib2.0-0 libnss3 libatk1.0-0 libcups2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2

# Copy Python requirements & install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy All 4 Asset Pillars
COPY ["Yuan Prometheus Screenshots", "/opt/prometheus/Yuan Prometheus Screenshots"]
COPY ["SOUND FX", "/opt/prometheus/SOUND FX"]
COPY mini_run_pipeline/ /opt/prometheus/mini_run_pipeline/
COPY --from=remotion-builder /app/remotion-bundle /opt/prometheus/remotion-bundle
COPY --from=remotion-builder /root/.cache/remotion /root/.cache/remotion

ENV BUNDLE_PATH="/opt/prometheus/remotion-bundle"
CMD ["python", "mini_run_gateway.py"]
```

---

## 6. End-to-End Verification: Running Concurrent Mini-Runs

Once deployed, you must verify the deployment with live concurrent renders:

```bash
python run_modal_rectification_proof.py
```

### What this script does:
1. Spawns concurrent Modal runs on two gold-standard reference videos:
   * `FEMALE PODCAST TALKING HEAD` (`female_podcast`)
   * `MONEY TALK TALKING HEAD` (`money_talk`)
2. Polls both jobs simultaneously until completion.
3. Downloads the master MP4 videos and manifest JSONs to `output/`:
   * `output/rectify_female_podcast_master.mp4`
   * `output/rectify_female_podcast_manifest.json`
   * `output/rectify_money_talk_master.mp4`
   * `output/rectify_money_talk_manifest.json`
4. Automatically audits the manifest against all 6 Rectification Rules:
   * **R1 (No Banned FX)**: Zero instances of banned legacy effects (`syllabic_split_word`, `hook_rgb_chromatic_split_glitch`).
   * **R2 (Lead Sync)**: Kinetic text entry leads $\le 130\text{ms}$.
   * **R3 (Signature Presence)**: Blue-lantern magnetic & Gaussian sweep presence verified.
   * **R4 (Glass Opacity)**: Glass letterforms carry opaque readable fills.
   * **R5 (Placement Stamping)**: Layout zones stamped directly from `font JSON` rules.
   * **R6 (Layer Depth)**: Underlapping layers use gradient fades; overlay atop layers carry drop shadows and elevated z-index.
5. Emits an audit report JSON and prints the PASS/FAIL verdict table.

---

## 7. Troubleshooting & War Room Diagnostics

| Symptom | Probable Cause | Immediate Corrective Action |
| :--- | :--- | :--- |
| **Captions render in Times New Roman / Arial** | Missing `.otf`/`.ttf` file in `remotion-app/public/fonts/` OR missing `@font-face` in `all_fonts_dynamic.css`. | Run `python scripts/verify_backend_assets.py`. Add binary or add `@font-face` rule. Re-bundle Remotion and redeploy. |
| **Modal deploy fails: `file was modified during build process`** | Windows junction timestamp race condition. | Prepend `$env:MODAL_BUILD_VALIDATION="ignore";` to the deploy command. |
| **Modal deploy fails: `'charmap' codec can't encode characters`** | Windows PowerShell stdout default encoding is cp1252. | Prepend `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1";` |
| **Text layers overlap with ugly clipping** | Missing `isOverlayAtop` or `isUnderlapping` flags in `typography.py`. | Verify `resolve_layer_gradient_and_glow` handles vertical gradients and inter-layer zIndex hierarchy. |
| **Audio mix errors during render** | Missing files in `SOUND FX/` or missing FFmpeg in container. | Confirm `SOUND FX/` is copied in deploy definition and `verify_backend_assets.py` passes Pillar 4. |

---

*Keep this playbook updated whenever new fonts, sound effects, or backend deployment targets are added.*

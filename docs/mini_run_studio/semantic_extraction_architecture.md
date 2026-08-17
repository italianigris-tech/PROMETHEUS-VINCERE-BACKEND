# Semantic Extraction & Background Asset Architecture

**Version**: 7.0.0  
**Location**: `docs/mini_run_studio/semantic_extraction_architecture.md`  
**Domain**: Macro & Micro High-Tier Semantic Asset Extraction & Motion Graphics Engine  

---

## 1. Accountability & Root-Cause Analysis Report

### 1.1 Highlight Card Behavior Defect
* **Diagnosis**: In previous passes, highlight cards were statically wrapped around text, causing the card to pop in as a static box rather than an active highlight sweep.
* **Resolution**: Re-engineered as a **Delayed Left-to-Right Highlight Card Sweep**. Text lands at $t=0s$. At $t=0.25s$, the colored card background sweeps smoothly from left to right behind the text. Cards and text sit at $Z\text{-Index}: 10$ **BEHIND THE SPEAKER SUBJECT** (Zone A $y:18.5\%$) for tactile 3D depth.

### 1.2 Top-Packing & Loss of Cinematic Vibe
* **Diagnosis**: Top-packing all text at $y:12\%$ squished typography into the top margin, destroying spatial balance.
* **Resolution**: Restored true **Cinematic 3D Layer Hierarchy**:
  - **Zone A: Head Contact Zone ($y:18.5\%$, $Z:10$)**: Tactile head contact behind speaker head.
  - **Zone B: Chest Zone ($y:56.5\%$, $Z:30$)**: In front of chest lower third.

### 1.3 Chunk 20 White Background Artifact Defect
* **Diagnosis**: The stage background was set to a light white linear gradient, which created a stark white rectangular box artifact behind the black circle contrast inversion mask and dark SVG assets.
* **Resolution**: Converted stage background to a clean dark slate canvas (`linear-gradient(180deg, #070913 0%, #0F172A 100%)`) and removed all solid black background rects from SVG vector generators. The circle mask now glows in electric cyan with 100% clean contrast inversion.

---

## 2. Mandatory Rules & Governance Policies

### 2.1 Delayed Highlight Card Sweep Policy (`delayed_highlight_sweep`)
* **Rule**: Highlight cards MUST NOT pop in as static text wrappers. Text lands FIRST at $t=0s$. The colored highlight card sweeps from left to right behind the text at $t=0.25s$, positioned at $Z\text{-Index}: 10$ **BEHIND THE SUBJECT**.

### 2.2 Kinetic Animation Variance Governance Policy (`kinetic_variance_policy`)
* **Rule**: The system must dynamically rotate through signature kinetic animation treatments:
  1. **Delayed Left-to-Right Highlight Card Sweep** (Ref Image #2)
  2. **Circle Contrast Inversion Mask** (Ref Images #0 & #1)
  3. **Defocus Aperture Snap Dissolve** (Ref Image #4)
  4. **Chromatic Character Displace Glitch** (Ref Image #5)
  5. **3D Cascade & Keynote Focal Scale Punch**

---

## 3. Transcript #2 Signature Kinetic Animation Mapping

| Chunk & Timestamp | Transcript Phrase | 100% Unique Matted Asset ($Z:10$) | Signature Kinetic Animation Treatment Applied |
| :--- | :--- | :--- | :--- |
| **Chunk 3 (00:04–00:06)** | *"a growth problem."* | — | **Neon Yellow Delayed Highlight Card Sweep** ($Z:10$ Behind Head) |
| **Chunk 5 (00:08–00:10)** | *"a consistency problem."* | **Unique Cyberpunk Metronome Cutout** | **Circle Contrast Inversion Mask** (Dark Stage Clean Inversion) |
| **Chunk 8 (00:14–00:16)** | *"Keeping the machine running"* | **Unique Cyberpunk Robotic Arm Cutout** | **Kinetic Slot Bounce + Bezier Spin** |
| **Chunk 12 (00:22–00:24)** | *"most founders struggle."* | — | **Cyan Delayed Highlight Card Sweep** ($Z:10$ Behind Head) |
| **Chunk 16 (00:30–00:32)** | *"the business can't scale."* | — | **Red Warning Delayed Highlight Card Sweep** ($Z:10$ Behind Head) |
| **Chunk 20 (00:38–00:40)** | *"That's how businesses scale."* | **Unique Cyberpunk Rocket Launch Cutout** | **Ghost Typewriter Engine** ($Z:30$ Chest) |

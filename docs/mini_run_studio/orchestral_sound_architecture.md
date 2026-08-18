# Prometheus — Spatio-Temporal Orchestral Sound System Architecture & Failure Diagnosis

**Directory**: `docs/mini_run_studio/`  
**Version**: 3.0.0 (Orchestral Spatio-Temporal Sound Engine)  
**Authoritative Reference**: Mini-Run Kinetic Typography Studio & Backend Sound Engine

---

## 1. 🔍 Root-Cause Diagnosis: Why the Previous Audio & SFX System Failed

The previous audio and sound effects design in the video marketing pipeline suffered from severe architectural flaws that prevented high-fidelity production:

### 1.1 Complete Absence of Spatio-Temporal Understanding
* **Spatial Blindness**: Audio cues were rendered as flat 1D mono or static center stereo. When kinetic typography or matted semantic assets (Eiffel Tower, robotic arm, gears) moved across the screen (left-to-right) or occupied 3D depth planes (Z:10 behind the speaker vs Z:30 in front of the chest), the audio had **zero spatial awareness**. There was no stereo panning corresponding to on-screen visual coordinates, and no acoustic high-frequency attenuation / distance roll-off reflecting physical depth.
* **Temporal Disconnect & Playback Latency**: Audio triggers were bound to crude, high-level chunk start boundaries (`startMs`) rather than the exact sub-millisecond visual animation keyframes (e.g., the precise frame a typewriter letter strikes, a numeric counter rolls, or a camera zoom-blur slams). This created noticeable latency and perceptual disconnect between eye and ear.

### 1.2 Betrayal of Core Architecture: Fake Placeholders & Silent Mocks
* In violation of **RULE 3 (NO FAKE MOCKS FOR SUCCESS)**, earlier testing passes generated silent placeholders or trivial 0.35s tone beeps to bypass pipeline tests instead of orchestrating the 27-category high-fidelity `SOUND FX` catalog (`BRAAAMS`, `CINEMATIC HITS`, `ATMOS`, `SWEEPS`, `RISERS`, `DATA TELEMETRY`, `MECHANICAL CLICKS`, etc.).

### 1.3 Sound World Collision & Lack of Acoustic Interaction
* In a real acoustic environment, sounds interact dynamically. The previous system lacked:
  - **Dynamic Voice-Band Sidechain Ducking**: Music and sound effects competed directly with speaker vocals in the 300Hz–3,000Hz speech frequency corridor, causing muddiness and cognitive fatigue (FT-026: Audio Pumping).
  - **Spectral Unmasking & Handoffs**: Risers cut abruptly instead of cleanly handing off acoustic energy into braaams/impact slams (FT-025, FT-027).
  - **Polyphonic Prioritization**: Multiple overlapping cues caused acoustic clutter and clipping.

### 1.4 Beat Desynchronization (FT-023)
* Audio cues fired asynchronously at arbitrary time offsets without locking to a musical beat grid or rhythmic cadence (Blazer / SSR pulse), destroying the rhythmic groove, pulse, and kinetic momentum of the video.

---

## 2. 🎼 The 5-Layer Spatio-Temporal Orchestral Sound Design Architecture

To permanently solve these failures, the new **Orchestral Sound System** establishes a 5-layer acoustic pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       5-LAYER ORCHESTRAL AUDIO ENGINE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 1: RHYTHMIC BEAT GRID & BLAZER/SSR PULSE                              │
│   • 120 BPM Orchestral Tempo Clock (0.500s Beat Grid, 2.000s Bar Cycle)     │
│   • Downbeat & Upbeat Synchronized Percussive Pulse                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2: SPATIO-TEMPORAL KINETIC TYPOGRAPHY SFX                             │
│   • Micro-Keystroke Mechanical Clicks (Typed per-character on onset)        │
│   • 3D Film Roll-Up Ratchet Clicks (Calibrated to numeric counters)         │
│   • Heavy Cinematic Braaams & Sub-Bass Slams (Inflection/tension payoff)    │
│   • Band-Pass Riser Sweeps (Pre-roll crescendo landing on Beat 1)           │
│   • Cyberpunk / Telemetry Chirps (Secondary cards & matted background UI)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 3: 3D SPATIAL DIMENSIONING & DEPTH FILTERING                          │
│   • Screen X-Axis Stereo Panning: [-1.0 (Left) to +1.0 (Right)]              │
│   • Z-Axis Acoustic Depth Roll-Off:                                         │
│       - Z:10 (Behind Speaker Head): Low-Pass 1,400 Hz + Reverb Diffusion    │
│       - Z:30 (Foreground Hero Text): Crisp 18,000 Hz + Punchy Transients     │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 4: ZERO-LATENCY SUB-MILLISECOND HARDWARE SCHEDULING                   │
│   • Web Audio API AudioContext.currentTime Hardware Clock                   │
│   • Sub-frame sample-accurate scheduling (Zero timer drift)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 5: ACOUSTIC CARVING, VOICE DUCKING & DYNAMIC MASTERING                │
│   • 300Hz–3kHz Voice Band Sidechain Ducking (-8 dB during spoken words)     │
│   • Soft-Knee Dynamic Limiter & ITU-R BS.1770 Mastering (-16 LUFS Target)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 📐 Mathematical Formulas & Coordinate Mappings

### 3.1 Screen Coordinate to Stereo Panning
For any on-screen element positioned at horizontal coordinate $X_{percent} \in [0, 100]$:
$$\text{Pan} = \text{clamp}\left( \frac{X_{percent} - 50}{40}, -1.0, 1.0 \right)$$
* Center ($X = 50\%$): $\text{Pan} = 0.0$ (Center)
* Left Card ($X = 20\%$): $\text{Pan} = -0.75$ (Hard Left)
* Right Card ($X = 80\%$): $\text{Pan} = +0.75$ (Hard Right)

### 3.2 Depth Plane to Acoustic Low-Pass Filter
For elements on depth plane $Z \in \{10, 20, 30\}$:
$$F_{\text{cutoff}}(Z) = \begin{cases}
1,400\text{ Hz} & \text{for } Z = 10 \text{ (Behind Matted Speaker)} \\
6,500\text{ Hz} & \text{for } Z = 20 \text{ (Speaker Plane)} \\
18,500\text{ Hz} & \text{for } Z = 30 \text{ (Foreground Kinetic Hero Text)}
\end{cases}$$

### 3.3 Dynamic Sidechain Voice Ducking Envelope
When dialogue is active at time $t$:
$$\text{Gain}_{\text{music}}(t) = G_{\text{bed}} \cdot \left( 1 - D_{\text{duck}} \cdot \text{Envelope}(t, t_{\text{start}}, t_{\text{end}}, \tau_{\text{attack}}, \tau_{\text{release}}) \right)$$
Where $D_{\text{duck}} = 0.60$ ($-8\text{ dB}$ reduction), $\tau_{\text{attack}} = 40\text{ ms}$, $\tau_{\text{release}} = 220\text{ ms}$.

---

## 4. 🎹 Complete 20-Chunk Spatio-Temporal Audio Choreography

| Chunk # | Timestamp | Spoken Text & Emphasis | Musical / SFX Layer | Spatial Pan | Depth Plane & Cutoff |
| :---: | :---: | :--- | :--- | :---: | :---: |
| **01** | 00:00 — 00:02 | *"You can make"* (Context) | Ambient Drone + Soft Overlap In | `0.0` | Z:10 (3.2 kHz) |
| **02** | 00:02 — 00:04 | *"$50,000 a month"* (Hero Metric) | **3D Roll-Up Ratchet Clicks + Cash Chime** | `+0.35` | Z:30 (18.5 kHz) |
| **03** | 00:04 — 00:06 | *"and still"* (Transition) | Whoosh Low Sweep + Beat Accents | `-0.20` | Z:30 (14.0 kHz) |
| **04** | 00:06 — 00:08 | *"have a broken business."* (Tension) | **Cinematic Braaam 01 + Sub-Bass Drop** | `0.0` | Z:30 (18.5 kHz) |
| **05** | 00:08 — 00:10 | *"Because revenue"* (Context) | Metronome Pulse + Soft Typewriter Ticks | `-0.15` | Z:10 (4.5 kHz) |
| **06** | 00:10 — 00:12 | *"doesn't automatically mean"* (Clause) | Glitch Matrix Chirp + Filter Sink | `+0.25` | Z:30 (12.0 kHz) |
| **07** | 00:12 — 00:14 | *"you're building scalable."* (Hero Concept) | **Riser Crescendo -> Heavy Impact Hit** | `0.0` | Z:30 (18.5 kHz) |
| **08** | 00:14 — 00:16 | *"I've seen founders"* (Founders Trio) | Vintage Telemetry Blip + Atmospheric Texture | `-0.45` | Z:10 (1.4 kHz) |
| **09** | 00:16 — 00:18 | *"make serious money"* (Key Point) | Dual Mechanical Keystrokes + Bass Pulse | `+0.30` | Z:30 (16.0 kHz) |
| **10** | 00:18 — 00:20 | *"while working"* (Transition) | Fast Whoosh Swish + Percussive Snare | `-0.25` | Z:30 (15.0 kHz) |
| **11** | 00:20 — 00:22 | *"seventy hours every week."* (Hero Metric) | **Ratchet Clock Ticking + High-Ring Accent** | `+0.40` | Z:30 (18.5 kHz) |
| **12** | 00:22 — 00:24 | *"That's not freedom."* (Tension) | **Sub-Bass Thud + Lowpass Tremolo Hit** | `0.0` | Z:30 (18.5 kHz) |
| **13** | 00:24 — 00:26 | *"That's a"* (Transition) | Soft Acoustic Pop + Camera Shutter | `-0.10` | Z:30 (14.0 kHz) |
| **14** | 00:26 — 00:28 | *"very expensive job."* (Hero Concept) | **Metallic Heavy Impact + Reverb Throw** | `+0.20` | Z:30 (18.5 kHz) |
| **15** | 00:28 — 00:30 | *"The real goal"* (Context) | Acoustic Flywheel Pulse + Telemetry Blip | `-0.35` | Z:10 (2.2 kHz) |
| **16** | 00:30 — 00:32 | *"isn't just making money."* (Contrast) | Low Drone Modulation + Typewriter Burst | `+0.15` | Z:30 (15.0 kHz) |
| **17** | 00:32 — 00:34 | *"It's building systems"* (Solution) | **Robotic Arm Servo Servo-Whoosh + Chord** | `-0.40` | Z:10 (1.8 kHz) |
| **18** | 00:34 — 00:36 | *"producing results"* (Key Point) | Industrial Gear Mesh Click + Harmonic Lift | `+0.35` | Z:10 (2.0 kHz) |
| **19** | 00:36 — 00:38 | *"without requiring you"* (Clause) | High-Pass Sub Riser Pre-Roll | `-0.15` | Z:30 (16.0 kHz) |
| **20** | 00:38 — 00:40 | *"every single time."* (Payoff Climax) | **Master Orchestral Climax + Sub-Drop** | `0.0` | Z:30 (18.5 kHz) |

---

## 5. 🛠️ Execution & Verification Commands

```bash
# 1. Run Autonomous Spatio-Temporal Sound System Test Suite
npx tsx docs/mini_run_studio/test_orchestral_sound_system.ts

# 2. Compile Presentation Studio with Live Spatial Audio Engine
npx tsx docs/mini_run_studio/build_male_sequence_presentation.ts

# 3. Verify Full Pipeline Readiness & Node Coverage
npx tsx docs/mini_run_studio/verify_presentation_node_coverage.ts
```

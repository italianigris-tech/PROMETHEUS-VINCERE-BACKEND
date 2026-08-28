# Curated Cinematic SFX Catalog — Mini-Run Sound Orchestration

> Inventory and curation of the **high-tech cinematic sound effects** available to the
> mini-run sound orchestrating engine. Generated from the authoritative sources:
>
> - Recorded library: `PROMETHEUS-CORE-BACKEND/SOUND FX/` (227 audio files across 27 folders)
> - Engine sound families: `docs/mini_run_studio/sfx_governance_schema.ts` (`AUTHORITATIVE_SFX_FAMILIES`)
> - Deployed cue set: `docs/mini_run_studio/authoritative_sound_treatment.json` (32 treated visual events)

---

## 1. "High-tech cinematic" recorded library (what we physically own)

### 🖱️ Clicks / Tactile UI (the core "blue / subtle" layer)
| File | Category |
|---|---|
| `freesound_community-ui-click-43196.mp3` | UI INTERFACE |
| `Generdyn - GUI - 01.wav`, `Generdyn - GUI - 02.wav` | UI INTERFACE |
| `camera-shutter-18399.mp3` | MECHANICAL CLICKS |
| `camera-shutter-6305.mp3` (freesound) | TRANSITIONS |
| `irinairinafomicheva-camera-13695.mp3` | TRANSITIONS |

### ⌨️ Typesetting / Terminal Typing
| File | Category |
|---|---|
| `dragon-studio-typing-with-keyboard-435489.mp3` | TEXT |
| `matthewvakaliuk73627-computer-keyboard-typing-290582.mp3` | TEXT |
| `type-writing-6834.mp3` | TEXT |
| `virtualzero-keyboard-typing-fast-371229.mp3` | TEXT |
| `Typewriter Style Sound - Foley_Humans.wav` | FOLEY HUMANS |
### 💨 Whooshes / Swooshes / Air (camera motion + transitions)
**WHOOSHES (22):** `Deep`, `Fireball 1/2/3`, `Formula 1`, `Hi End`, `Hi Pass`, `Light`,
`Low`, `Low Passed`, `One`, `Sci Fi`, `Soft Rain`, `Sub Bass`, `Whip`, `dragon-studio-epic-whoosh-478371`,
`dragon-studio-simple-whoosh-02/-03`, `soundreality-whoosh-large-sub-384631`, `whoosh-6316` — all `Nikko Hunt's S.D.Essentials`.
**SWOOSHES:** `ES_Jump Swish - SFX Producer.mp3`, `swoosh-sound-effect-for-fight-scenes-or-transitions-2-149890.mp3`

### ⬆️ Risers (cinematic lift / build)
`Generdyn - RISER - 01..06.wav`, `Dirty`, `Eerie With Sub Hit`, `Sci Fi`, `Tremelo Horror`,
`White Noise` (Risers, Nikko Hunt), plus `creatorshome-long-riser-336262`, `impact-riser-01-6908`,
`lucadialessandro-cinematic-riser-boom-466922`, `riser-7-130957`, `soundreality-riser-hole/-somewhere`.

### 🎯 Cinematic Hits / Impacts / Sub-Bass
- **BRAAAMS:** `Generdyn - BRAMS - 01..07.wav`
- **IMPACT HITS:** `Generdyn - HITS - 01..14.wav`, `lucadialessandro-cinematic-impact-464937`,
  `universfield-cinematic-impact-hit-352702`, `universfield-impact-cinematic-boom-05-352465`
- **CINEMATIC HITS:** `Cinematic`, `Drum`, `Eerie`, `Gaming`, `Kick`, `Lowpass Tremelo`, `Metallic`,
  `Rumble and Smash`, `Shell Shock High Ring`, `Sub 1`, `Sub 2`, `White Noise` hits, `hit-brutal-puncher-cinematic-trailer`
- **METALLIC IMPACTS:** `rolling-metal-29916.mp3`

### 🔔 Cymbals / Sweeps (Nikko Hunt's S.D.Essentials)
- `Cymbal - Sweeps`, `Reverse Cymbal - Sweeps` (explicit cymbal)
- Full SWEEPS bank (26): `Airy`, `Bass Hit`, `Bowed`, `Dry`, `Engine Start Up`, `Gentle`, `Grater`,
  `KILLA`, `Long Sub`, `Low Sweep`, `Mega Death With Hit`, `Mellow`, `Phaser`, `Scary String`,
  `Sci Fi`, `Sci Fi 2`, `Scream`, `Siren`, `Sub`, `Sub 2`, `Suuuub`, `Ventilator`, `White Noise`

### 💻 Digital Glitch / Telemetry / Data
- **GLITCHES:** `Alien V.S Nikko`, `Data Processing`, `El Sweep`, `Melodic`, `White Noise Flicker`, `tv-glitch-6245`
- **DATA TELEMETRY:** `Digital counting`, `Display Digits 1`, `data-reveal-sound-6460`, `zap-127476`
- **GLITCH TRANSITIONS:** `soulfuljamtracks-glitch-fx-transitions-7/8/9`

### 🔩 Gears / Clocks / Mechanical
- **CLOCK:** `dragon-studio-clock-ticking-down-376897`, `dragon-studio-clock-ticking-sfx-467486`,
  `u_mx4xkr2bzy-slow-cinematic-clock-ticking-tension-2-323078`
- **Mechanical gears** exist **only as synthesized engine presets** (see §2) — no recorded gear files.

### 👻 Ghost / Drone / Tension / Atmosphere
- **SOUNDSCAPES:** `Ghost Talk`, `Dark Waves`, `Deep Fluctuating Rumbles`, `Deep Rumble`, `Heavy Tension`,
  `ReStructured Psyche`, `Ripple Bass`, `Spiritual Awakening`, `Tension Loop`, `The Abyss`,
  `The Sound Of Space`, `Voices In Your Head Not Mine`, `Volcanic Eruption`, `Water Rumble + Vader`
- **DRONES:** `dragon-studio-deep-haunting-drone-482880`, `idoberg-dark-drone-pad-467271`, `samuelfjohanns-weird-drones-12540`
- **ATMOS:** `Generdyn - ATMOS - 01..11.wav`

### 📸 Camera / Snap / Foley (physical transients)
- **Camera:** `camera-shutter-18399`, `camera-shutter-6305`, `irinairinafomicheva-camera-13695`
- **SNAP:** `shidenbeatsmusic-finger-snap-with-reverb-113861`, `soundreality-finger-snap-reverb-423222`, `canvas-dropcloth-snap-1-98862`
- **POPS:** `cork-85200.mp3`

### 🔥 Fire / Nature
- `NATURE/fire-sound-efftect-21991.mp3`, `WHOOSHES/Fireball 1/2/3`, plus full NATURE bank (18)

---

## 2. Engine SFX families (synthesized, deterministic)

Defined in `sfx_governance_schema.ts`. **8 families × 4 nephew variants = 32 presets.** These are
synthesized (not recorded), so `gear`, `deep glow`, `gritty`, etc. can be generated on demand.

| Family | Variants (v1 → v4) | Trigger |
|---|---|---|
| `text_click_family` | Optical Micro-Switch Crisp · Damped Silent · High-Precision Micro-Click · Glass Trackpad Haptic | standard kinetic text reveal |
| `text_typing_family` | Mechanical Cherry Strike · Tactile Brown Keystroke · Retro VT100 Terminal Tick · Low-Travel Laptop Tap | mono / terminal / typewriter glyphs |
| `text_glitch_family` | Binary Cyber Stutter · Resonant Comb-Filter Buzz · Decimated Bitcrush Crunch · Chromatic Vector Glitch | chromatic / acid letter displacement |
| `lengthy_text_gear_family` | Rotary Gear Ratchet · Chronometer Escapement · Micro-Stepper Motor Pulse · Heavy Sprocket Turn | chunk length ≥ 5 words |
| `camera_motion_whoosh_family` | Slow Motion Air Glide · Medium Cinematic Glide · Fast Whip-Pan Air Cut · Subtle Viewport Rescale Swoosh | camera zoom / pan / rescale (speed-consonant) |
| `transition_action_family` | Organic Bone Articulation Snap · Mechanical Camera Shutter Snap · Heavy Latch Gate Engagement · Frame-Whip Transient Pop | hard cuts / scene transitions |
| `sub_bass_tension_family` | Deep Analog Brass Braaam · Sub-Frequency Tension Impact · Filtered Tension Sweep · Damped Sub Rumble | breaks / climax hits |
| `telemetry_arpeggio_family` | ANIMA Vector Laser Arpeggio · Telemetry Milestone Ping · Harmonic Grid Sweep · Tactile Optic Blip | ANIMA charts / metrics |

---

## 3. Currently deployed mini-run cue set (from `authoritative_sound_treatment.json`)

The 32 treated events draw exclusively from **7 categories**: `TEXT`, `WHOOSHES`, `SWOOSHES`,
`TRANSITIONS`, `UI INTERFACE`, `DATA TELEMETRY`, `MECHANICAL CLICKS`.
Actual files used:
- `DATA TELEMETRY/Display Digits 1.wav`, `data-reveal-sound-6460.mp3`
- `MECHANICAL CLICKS/camera-shutter-18399.mp3`
- `SWOOSHES/ES_Jump Swish - SFX Producer.mp3`
- `TEXT/dragon-studio-typing-with-keyboard-435489.mp3`, `type-writing-6834.mp3`, `virtualzero-keyboard-typing-fast-371229.mp3`
- `TRANSITIONS/dragon-studio-cinematic-flashback-transition-463199.mp3`
- `UI INTERFACE/Generdyn - GUI - 01.wav`, `freesound_community-ui-click-43196.mp3`
- `WHOOSHES/Hi End - Whoosh.wav`, `dragon-studio-simple-whoosh-02-433006.mp3`

---

## 4. Cross-reference: requested names → reality check

| Requested | Have? | Where / note |
|---|---|---|
| Clicks / variants of clicks | ✅ plenty | UI INTERFACE, MECHANICAL CLICKS, TRANSITIONS camera-shutter, GUI clicks |
| Keyboard typing / "writers on deck" | ✅ | TEXT folder (4 files) + `Typewriter Style Sound` Foley |
| Riser | ✅ 18 files | RISERS bank (Generdyn + Cinematic + Sci Fi + horror) |
| Wind Whoosh | ✅ plentiful | WHOOSHES (22) + SWOOSHES (2) + engine whoosh family |
| Cymbals | ✅ | `SWEEPS/Cymbal`, `SWEEPS/Reverse Cymbal` |
| Fire / "Firebase" sound effect | ⚠️ partial | `NATURE/fire-sound-efftect-21991.mp3`, `WHOOSHES/Fireball 1/2/3` — no literal "Firebase" file |
| Vintage Camera Ghost | ⚠️ partial | Camera: `camera-shutter-18399/-6305`, `irinairinafomicheva-camera-13695`; Ghost: `SOUNDSCAPES/Ghost Talk` — not a single combined file |
| Camera On / Camera Shutter / Camera Base | ⚠️ partial (shutter ✅) | Shutter clicks exist (2); no "Camera On" or "Camera Base" file |
| Power Rise | ⚠️ partial | Closest = RISER bank + engine `braaam_sub_impact` / whoosh family |
| Airy | ✅ | `SWEEPS/Airy - Sweeps.wav` |
| Small Gears / Gears / "Gears Absolutely" / "Gears Effects" | ⚠️ synthesized only | Engine `lengthy_text_gear_family` (4 presets) — no recorded gear file |
| Deep Sleep / Fast / Deep Glow / Gritty Effects | ❌ no literal files | Nearest substitutes: `Drone` pads (deep), `Fast` = whoosh family fast bracket, `Glow` none, `Gritty` = glitch family |
| Apple Magic | ❌ no literal file | — |
| Lux | ❌ no literal file | — |

### Legend
- ✅ **Have** — physical recorded file(s) in `SOUND FX/`
- ⚠️ **Partial / substitute** — related material exists under a different name, or only synthesized
- ❌ **Missing** — we do not own a literal matching sound; would need to be sourced

---

## 5. Recommended curated "starter" set (minimal / subtle / understated)

A restrained **blue / cool, quiet, high-tech** starting palette that leverages the most polished,
low-spill transients we already own:

1. **UI Micro Click** — `UI INTERFACE/freesound_community-ui-click-43196.mp3` (the workhorse)
2. **Modern GUI Pop** — `UI INTERFACE/Generdyn - GUI - 01.wav` (damped, soft)
3. **Display Digit Blip** — `DATA TELEMETRY/Display Digits 1.wav` (telemetry micro-click)
4. **Data Reveal** — `DATA TELEMETRY/data-reveal-sound-6460.mp3`
5. **Retro Terminal Tick** — `TEXT/virtualzero-keyboard-typing-fast-371229.mp3`
6. **Mechanical Shutter Accent** — `MECHANICAL CLICKS/camera-shutter-18399.mp3` (transition/shutter)
7. **Subtle Rescale Swoosh** — `WHOOSHES/dragon-studio-simple-whoosh-02-433006.mp3` (air, non-aggressive)
8. **Hi End Whoosh** — `WHOOSHES/Hi End - Whoosh.wav` (clean hi-frequency air)
9. **Cinematic Jump Swoosh** — `SWOOSHES/ES_Jump Swish - SFX Producer.mp3`
10. **Airy Sweep** — `SWEEPS/Airy - Sweeps.wav`

These are all short, zero-spill transients suited to frequent, subtle cueing — match the
"small curated set first" direction.


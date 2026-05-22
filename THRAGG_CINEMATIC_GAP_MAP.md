# Thragg Cinematic Gap Map

This file records what was strengthened in the current pass and what still separates the project from a truthful "100%" cinematic system.

## Verified In This Pass

- HyperFrames style authority now records whether premium motion and typography materially reached the composition output.
- Audio planning can now chain multiple render-safe tracks to cover a preview window that outlasts a single song.
- Audio rendering now emits evidence when ducking and SFX were actually mixed into the preview render.
- Edit-session preview startup no longer deadlocks when metadata probing fails for a video-like local source.
- Backend test suite is green.
- Backend typecheck is green.
- Focused remotion preview/authority tests are green.
- Remotion typecheck is green.

## Remaining Delimiters From A Truthful 100%

### 1. Premium Font Assets Are Not Yet Guaranteed

The code now detects when premium typography was requested but not embedded. That is honest, but not the same as shipping guaranteed luxury typography.

What remains:

- Ensure the ingested font catalog really contains the premium families the system requests.
- Ensure preview and render lanes use the same canonical premium pairing policy.
- Add a hard-fail or policy-based downgrade mode once the font catalog is fully curated.

### 2. Heavy Audio Analysis Is Still Placeholder-Backed

The current analyzer layer still uses placeholder beat grids, waveform summaries, and section detection.

What remains:

- Add a Python-side analysis bridge for `librosa`, `Essentia`, `pyrubberband`, and `Pedalboard`.
- Persist analysis artifacts per track so renders do not recompute analysis every time.
- Replace placeholder BPM/section inference with artifact-backed analysis contracts.

### 3. DJ Intelligence Is Stronger, But Not Yet State-Of-The-Art

The planner can now cover longer windows with chained tracks, but it is not yet a full adaptive remix engine.

What remains:

- Phrase-aware or bar-aware transition placement from real beat/downbeat analysis.
- Key compatibility, energy-curve compatibility, and section-role matching between adjacent tracks.
- Optional bridge assets and re-time/stretch policy for undersized tracks.
- Advanced crossfade and stem-aware transitions inspired by external remix systems.

### 4. Browser Premium Output Still Does Not Equal Final Baked Master

The HTML composition is the premium truth surface today. Final video export parity is not yet absolute.

What remains:

- Browser-executed GSAP and premium typography need a deterministic render-to-video path for final masters.
- Diagnostics should stay tied to the actual artifact lane that reached the user.

### 5. Style Policy Is Still Split Across Some Historical Defaults

There are still historical traces of multiple long-form house styles in the repo.

What remains:

- Decide whether `longform_svg_typography_v1` or `longform_eve_typography_v1` is the single primary house style.
- Align all tests, sample data, docs, and fallback aliases to that final decision.

## Recommended Next Pass

1. Build the Python analyzer bridge contract and fixture-driven tests first.
2. Curate and validate the premium font catalog second.
3. Push preview-to-master parity after those foundations are stable.

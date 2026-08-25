# Mini-Run Generative Typography Design

## Goal

Make mini-run typography selection generative, prompt-configurable, and inspectable across the full portrait font corpus without phrase-specific animation or font rules.

## Scope

Only the mini-run pipeline, its Remotion composition, its gateway contract, its Modal image, and the 30-second mini-run fixture change. Macro and landscape systems are out of scope.

## Inputs

`design` accepts optional controls:

- `seed`: stable variation key. Omitted values derive from source transcript content.
- `creativity`: `reserved`, `balanced` (default), or `expressive`.
- `pacing`: `slow`, `adaptive` (default), or `fast`.
- `motionStyle`: `editorial`, `cinematic` (default), or `kinetic`.
- `typographyBias`: `mixed`, `serif`, `display`, or `script`.
- `avoidPresets`: a list of animation IDs excluded from selection.

All controls are optional and are validated to safe defaults. Unknown values do not fail a render.

## Selection Model

The selector receives the complete portrait profile pool on every run. It derives a chunk score from transcript timing, word count, content-word density, punctuation, layer role, and prior run state. Profile and animation candidates are weighted by compatibility and penalized for recent use, rather than selected through phrase matching or static IDs.

Each hero layer gets a primary entrance. High-salience layers may receive one compatible overlay. Companion layers receive a restrained independent entrance. Pre-roll comes from pacing, cadence, role, and motion family. The selection engine never inspects literal phrase text to choose an effect.

The output manifest stores selection evidence: candidate counts, selected profile and animation IDs, pacing bucket, lead time, overlay choice, and prompt controls. The same seed produces the same output; changing the seed changes the selection trajectory while preserving constraints.

## Animation Catalog

The Anima typography catalog is represented in the mini-run selector as supported runtime animation families, with a descriptive source label. Effects are selected by family and rendered by the dedicated Remotion composition. Catalog-only HTML/CSS demonstrations are not treated as directly executable in Remotion.

## Safety and Quality Constraints

- All 63 portrait profiles remain eligible; landscape profiles are excluded.
- No hardcoded phrase, token, or profile-to-effect mappings.
- No immediate repeat of a profile, font pair, primary animation, or overlay inside a recent window.
- Prompt controls bias eligible candidates but do not bypass timing, legibility, or layout safeguards.
- Every primary effect has a runtime implementation; unsupported catalog entries are not emitted.

## Verification

Tests prove that literal phrase changes do not determine animation, different seeds create different valid selections, prompt controls constrain selection, all loaded portrait profiles are eligible, and generated manifests include selection evidence. A deployed `prometheus-mini-run-studio` render must return the evidence fields and replace the local master only after stream validation.

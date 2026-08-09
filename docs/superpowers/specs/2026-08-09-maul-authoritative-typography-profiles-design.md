# MAUL Authoritative Typography Profiles Design

## Goal

Make the 44 extracted typography JSON profiles an authoritative executable stage between the materialized LLM text chunks and text placement. A selected profile must change the exact font assets, measured geometry, token hierarchy, and final Remotion text record for its chunk. A profile that cannot be executed must never be reported as selected.

## Scope

This batch implements:

- validated loading of the repository typography JSON corpus;
- deterministic per-chunk selection using word count and non-whitespace character count;
- exact primary and accent font-asset resolution;
- per-chunk font measurement and compatibility profiles;
- chunk-indexed typography input to placement;
- persisted per-chunk typography receipts in the typography motion plan;
- Remotion adapter enforcement and rendering of the selected receipts;
- explicit fallback and blocking evidence.

This batch does not implement MediaPipe observation, new placement families, background-aware color correction, annotations such as circles or highlights, or a new animation corpus. Those stages consume the output of this batch later.

## Considered Approaches

### One Profile Per Video

Select one profile from aggregate transcript counts and use it for every chunk. This is easy to fit into the current plan-level font resolution, but it ignores the user's required chunk-by-chunk count matching and would produce repetitive results. Rejected.

### Authoritative Per-Chunk Bindings Through Existing Plans

Select and measure a profile for each materialized chunk, pass a chunk-indexed typography map into placement, persist the same bindings in the typography motion plan, and make the Remotion adapter verify and consume them. Keep the existing plan-level font resolution as an explicit legacy/fallback summary. Selected.

### New Manifest Version and Renderer Path

Create a new typography artifact, placement schema, unified manifest version, and renderer branch immediately. This gives a clean break but increases migration and launch risk without adding visible capability beyond the per-chunk bindings. Deferred until the existing manifest needs a genuinely incompatible feature.

## Architecture

The new deep module is `TypographyProfileCompiler`. Its interface accepts materialized chunks, the target output profile, the observed JSON corpus, and the exact executable font catalog. It returns either a complete chunk-indexed typography plan or a governed failure. Callers do not rank profiles, normalize names, inspect files, calculate counts, or substitute fonts.

The compiler hides five responsibilities:

1. Parse and validate observed profile JSON with source filename and SHA-256 provenance.
2. Calculate chunk word count and Unicode code-point count excluding whitespace.
3. Rank profiles deterministically by word-count distance, character-count distance, aspect-ratio preference, semantic role, emphasis, and a stable tie-break key.
4. Bind the profile's primary and accent layers to exact local/public font receipts.
5. Measure the selected fonts and return placement-compatible layouts and metric envelopes.

The existing `MaulTypographyProvider` remains as the compatibility adapter for legacy jobs and as the explicit fallback. New jobs first call the profile compiler. They use the legacy provider only when no corpus profile can be executed, and the resulting receipt must say `governed_fallback`.

## Corpus Contract

Every JSON file must contain:

- a non-empty `profile_name` and `version`;
- metadata with `target_aspect_ratio`, `total_word_count`, `total_character_count`, and `per_word_character_counts`;
- at least one typography layer;
- each layer's role, font candidates, weight, style, color, base size, and relative scale;
- internally consistent word and character counts.

Invalid files fail corpus loading with a filename-specific error. Duplicate profile names or duplicate normalized source identities also fail loading. The corpus loader does not silently discard malformed profiles.

The source corpus is observational. Its absolute pixel positions are not executable placement commands. A `16:9` source profile remains eligible as a typography reference for `9:16`, but its receipt records `normalized_to_9_16`. An exact `9:16` source profile receives a ranking preference.

## Count Matching

For each materialized chunk:

- `wordCount` is the number of stable chunk tokens;
- `characterCount` is the number of Unicode code points in the chunk text after removing whitespace;
- exact word-count matches rank before non-exact matches;
- within the same word-count distance, the smallest character-count distance ranks first;
- semantic and emphasis compatibility break near ties;
- the source filename and SHA-256 provide the final deterministic tie-break.

Count matching chooses among executable profiles only. It cannot make an unavailable font executable.

## Exact Font Resolution

Font matching is case-insensitive and punctuation-insensitive, and it understands candidate suffixes such as `Italic`, `Black`, and `ExtraBold`. The compiler resolves each selected layer to a `MaulResolvedFontAsset` containing the exact local file, root-relative browser URL, hash, format, weight, style, source, and license receipt.

Requested style must match exactly. Requested weight may use the nearest available weight within the same normalized family and style because many reference JSON values describe visual weight rather than a specific shipped binary. The receipt records requested and selected weights. It never changes to an unrelated family.

A profile is executable when its primary layer resolves. An accent layer is executable only when its font resolves; a profile that structurally requires an accent layer is skipped when that asset is unavailable. Single-layer profiles remain valid without an accent.

If no profile can execute for a chunk, the existing measured provider supplies the governed fallback. The chunk receipt records the failure reasons considered and cannot claim the observed profile's name or style.

## Per-Chunk Typography Plan

Each successful chunk binding contains:

- `chunkId` and a stable binding hash;
- selected profile name, version, source filename, and source SHA-256;
- observed and target aspect ratios plus adaptation status;
- actual and observed word/character counts and their distances;
- primary and optional accent layer roles;
- requested style values used by the renderer in this batch: casing, relative scale, line height, font weight, and font style;
- exact primary and optional accent `MaulResolvedFontAsset` receipts;
- the measured compatibility profile and measured line layout;
- selection status and reason.

Color remains recorded as observed metadata but is not authoritative in this batch. The future media-aware color module must choose a contrast-safe final color using scene evidence. The renderer continues using its governed text and accent colors until that module exists.

## Placement Integration

`buildMaulTextPlacementPlan` gains a chunk-indexed typography interface. Each layout node uses the compatibility profile and measured layout for its chunk. The output already supports multiple compatibility profiles; the planner will deduplicate them by profile ID and bind every segment to the profile used during its measurement.

The existing single-profile typography input remains accepted only as a compatibility adapter. New MAUL planning calls use the chunk-indexed interface.

Editorial lockup creation also receives the selected primary/accent pair for each chunk. Existing emphasis tokens decide which token receives the accent layer. Circles, highlights, and other annotations remain empty in this batch.

## Manifest And Remotion Contract

The typography motion plan persists `chunkTypographyBindings`. The existing plan-level `fontResolution` remains as a summary for compatibility and reflects the first binding only when all chunks share one pair; otherwise it records a mixed-profile summary without pretending that one asset governs every segment.

The Remotion adapter resolves a binding by `segment.chunkId`, then verifies:

- the chunk ID exists exactly once;
- the binding's compatibility profile matches the placement segment;
- the selected asset exists in that profile;
- the resolved asset receipt matches family, asset ID, style, and measured weight;
- the binding hash and source profile receipt are present;
- accent token styles match the accent receipt when an accent exists.

After validation, the adapter writes the binding's font data into that segment's `MaulPlannedTextRecord`. `MaulPlannedTextLayer` therefore loads and renders the actual selected asset rather than a plan-level substitute.

## Failure Handling

Failures are divided into three classes:

- `corpus_invalid`: malformed or internally inconsistent JSON blocks the profile compiler at startup or planning time;
- `profile_unexecutable`: missing font binaries or incompatible style/weight skip that profile and continue deterministic ranking;
- `chunk_unresolved`: no executable profile remains, so the existing measured provider supplies a governed fallback for that chunk.

A selected profile that later fails font measurement is treated as unexecutable and the compiler tries the next ranked profile. A renderer receipt mismatch is a hard error, not a fallback, because it indicates corrupted causality between planning and rendering.

No stage silently substitutes by CSS family name, system font, or environment-specific absolute path.

## Performance

The corpus and font catalog are loaded and validated once per process and cached by source hashes. Font binaries are opened once per asset and reused for measurements. Selection is an in-memory ranking over 44 profiles per chunk; it is not expected to be a material contributor to render latency.

The implementation must expose timing counters for corpus load, selection, and measurement so later performance work can distinguish planning cost from Remotion compositing cost.

## Verification

Tests must prove:

- all 44 repository JSON files parse and their declared counts are consistent;
- non-whitespace Unicode character counting is stable;
- exact count matches beat near matches deterministically;
- an unresolvable top-ranked profile is skipped for the next executable profile;
- single-layer and primary/accent profiles resolve exact font receipts;
- placement uses the measured profile for each chunk;
- the typography motion plan preserves every binding and its hashes;
- the Remotion adapter rejects missing, duplicated, or mismatched bindings;
- two chunks with different selected fonts create two planned text records with different exact browser URLs;
- legacy plans without chunk bindings still use the existing compatibility path;
- backend and Remotion typechecks pass.

A lightweight Remotion composition smoke test should bundle the updated code and inspect planned record output. Full Chrome rendering remains a separate environment verification when sufficient disk and the browser binary are available.

## Launch Criteria

This batch is complete only when a real materialized chunk can be traced through:

`LLM chunk receipt -> stable chunk ID -> profile source/hash -> count score -> exact font receipts -> measured layout/profile -> placement segment -> typography motion binding -> Remotion planned text record`.

Any missing link is a blocking defect, not a future recommendation.

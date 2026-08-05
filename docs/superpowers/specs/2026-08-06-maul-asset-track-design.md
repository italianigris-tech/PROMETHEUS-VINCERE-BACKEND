# MAUL Asset Track Design

## Goal

Make MAUL produce production-quality 9:16 source-led shorts with approved B-roll, evidence imagery, product cards, and controlled graphic inserts. Repair the shared-types runtime release mismatch that currently blocks the end-to-end MAUL render path.

## Scope

MAUL receives a licensed, project-scoped asset pack alongside its Canonical Source Asset. The planner may select an asset only when it has a declared editorial purpose, beat interval, provenance, and rights receipt. The renderer executes those selected visual intervals with source cuts, planned framing, text, and audio.

The first release supports:

- `speaker_hero`: canonical source video with planned crop and camera movement.
- `b_roll`: approved video coverage for a named beat.
- `evidence_image`: approved still image, product visual, or chart.
- `split_proof`: source speaker plus an approved evidence asset.
- `editorial_graphic`: source-grounded card or diagram constructed from manifest data.
- `quiet_hold`: source or evidence stillness where extra motion reduces clarity.

Generated image or video providers are explicitly out of scope. They will enter later through a separate governed provider contract, never as an implicit fallback.

## Contract

Each visual asset records a project-local ID, media kind, storage path, SHA-256, dimensions, duration when applicable, rights status, provenance, and permitted editorial roles. A Visual Plan is an ordered list of non-overlapping intervals. Every interval names its visual mode, output time range, selected asset or source, crop, transition, purpose, and evidence rationale.

The Manifest Compiler emits the Visual Plan into the Unified Render Manifest. It rejects missing assets, unverified rights, incompatible media kinds, overlapping intervals, unbounded crops, and reference-corpus media. MAUL's current speaker-only plan remains a valid fallback only when no approved asset can clarify the beat.

## Renderer

`MaulShort` replaces its source-only sequence map with an ordered visual-track layer. Source and B-roll video use the same timing/crop primitives. Still evidence renders through Remotion `Img`; editorial graphics are rendered from governed manifest data, not arbitrary HTML or prompt output. `split_proof` uses fixed portrait-safe regions. Hard cuts remain default; short fades and directional reveals require an interval transition receipt.

Typography, audio, and platform safe zones remain over the visual track. Text placement must be recomputed or rejected when an insert cannot preserve legibility and source truth.

## Quality Gates

- Asset rights, provenance, hash, and project lineage must verify before planning and render.
- Each interval must name a source-grounded editorial purpose; decorative inserts are rejected.
- Frame samples must verify caption geometry, selected asset identity, crop continuity, and no reference pixels.
- A short may claim `ART_DIRECTED` only after a rendered-frame Perceptual Truth pass and human approval.

## Release Integrity

`@prometheus/shared-types` is consumed from `dist/index.js`. CI and local MAUL commands must rebuild the package before backend or renderer tests, and a parity test must prove newly exported runtime schemas are available from the package entry point. This prevents source-only contracts from reaching MAUL with an undefined runtime export.

## Acceptance Proofs

1. The existing reference-editorial typography short renders through the backend without an undefined shared-schema export.
2. A talking-head fixture renders source-led editorial typography with no visual asset interval.
3. A product/proof fixture renders an approved evidence image and split proof interval.
4. A cinematic fixture alternates speaker, approved B-roll, evidence image, and quiet hold with no timing or caption overlap failures.
5. All proofs are 1080x1920 H.264/AAC and retain inspectable visual, audio, and quality evidence.

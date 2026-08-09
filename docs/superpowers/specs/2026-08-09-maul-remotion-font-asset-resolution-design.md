# MAUL Remotion Font Asset Resolution

## Status

Design approved in conversation; implementation pending written-spec review.

## Problem

The canonical MAUL render runs the local Remotion CLI from `remotion-app`, while
the backend measures fonts with `fontkit`. A resolved MAUL font receipt already
contains both addresses for a font:

- `localFilePath`: the absolute file used by backend measurement and hash checks.
- `browserUrl`: the public-root-relative path used by Remotion and browser preview.

Those addresses are currently validated by separate modules. The Remotion text
layer also has a hardcoded six-font catalog that can silently substitute a
family when a planned receipt is incomplete. That allows a render to reach
compositing with a missing, unsafe, or mismatched font asset.

## Goal

Make the resolved font receipt the authoritative asset contract for MAUL. A
font may enter planning or rendering only when its local binary and public URL
are proven to refer to the same permitted file. Remotion must resolve only the
receipt's public path through `staticFile()`.

## Non-goals

- Selecting typography profiles or integrating the 44 reference JSON files.
- Changing LLM chunking, placement, MediaPipe observation, animation grammar,
  or composition geometry.
- Adding Lambda/cloud rendering. The contract must be portable to those
  environments, but this change targets the current local Remotion CLI path.
- Removing V1/V2/V3 manifests or legacy adapters.

## Current causal path

```text
font manifest + public directory
  -> loadHydratedMaulFontAssets()
  -> MaulResolvedFontAsset (localFilePath + browserUrl + hash)
  -> fontkit measurement / placement
  -> typography and placement manifest
  -> Remotion adapter
  -> MaulPlannedTextLayer
  -> staticFile(browserUrl) + @remotion/fonts
```

The missing seam is the validation and lookup between the resolved receipt and
the Remotion loader. The hardcoded renderer catalog is an alternative source
of truth and must become a legacy fallback only for receipts that predate the
asset fields.

## Design

### 1. Backend asset contract

Add a focused backend module that accepts a `MaulResolvedFontAsset` and a
Remotion public root. It will:

1. Require `browserUrl` to be a single-root-relative path with no protocol,
   query/fragment, or `..` traversal.
2. Resolve the URL path against the public root and require the resulting path
   to remain inside that root.
3. Require the file to exist, be non-empty, have an allowed font format, and
   match `localFileSha256`.
4. Return a normalized record containing the asset ID, public path, absolute
   local path, and measured hash.

The module will not derive a browser URL from an arbitrary absolute path. This
keeps developer machine paths out of persisted manifests.

`loadHydratedMaulFontAssets()` will use this module for its existing entries,
preserving its current filtering of non-renderable or restricted assets.

### 2. Remotion asset resolver

Add a small Remotion-side resolver with one interface:

```ts
resolveMaulFontAssetUrl(
  browserUrl: string,
  resolveStaticAsset?: (assetPath: string) => string,
): string
```

It normalizes exactly one leading slash, rejects remote URLs, filesystem paths,
empty paths, and traversal, then calls `staticFile()` with the public-root-
relative path. `MaulPlannedTextLayer` will call this helper for every planned
font receipt.

The existing six bundled IDs remain available as compatibility metadata for
old manifests, but they will no longer override a receipt that includes
`browserUrl`, `cssFamily`, weight, and style.

### 3. Pre-render validation

Before the Remotion CLI is invoked, the render path will validate all primary
and accent font receipts referenced by the planned text records. Failure is
terminal for that render and includes the asset ID, public URL, local path, and
specific reason. No fallback font will be substituted after validation fails.

This gives the caller a causal error at the asset seam instead of a late
browser/font-loading or visually incorrect render.

### 4. Deployment behavior

The logical public path remains stable across environments. Each render worker
supplies its own public root and local filesystem root:

- local development/current production worker: `remotion-app/public`;
- future container or cloud worker: the deployed Remotion public bundle root.

Only the worker-local absolute path changes. The receipt's public path and hash
must remain the same. A browser-only preview uses the public path and does not
need to access `localFilePath`.

## Error handling

The resolver reports distinct failures for:

- missing receipt fields;
- non-root-relative or remote URL;
- traversal or public-root escape;
- missing/empty local file;
- unsupported font format;
- local hash mismatch;
- a planned asset ID absent from the receipt.

No silent fallback is allowed for a receipt that claims an exact asset. Legacy
manifests without asset fields retain the existing compatibility behavior until
their parity tests are retired.

## Testing

Tests will be written before implementation and must demonstrate a red failure
first. The focused suite will cover:

- valid public/local pair resolution;
- remote, absolute, traversal, missing, empty, unsupported, and hash-mismatch
  rejection;
- hydrated catalog entries resolving against the actual `remotion-app/public`
  tree;
- Remotion `staticFile()` normalization and rejection behavior;
- a planned primary/accent receipt reaching the loader without hardcoded
  catalog substitution;
- a local one-font Remotion render smoke test when the repository render
  prerequisites are available.

Existing MAUL manifest, typography, and Remotion composition tests must remain
green.

## Rollout and compatibility

This is an additive seam. Existing manifest versions and explicit adapters stay
in place. The first rollout validates receipts and uses the new resolver in the
canonical MAUL path. Legacy hardcoded IDs are retained only to deserialize old
records. Removal requires render-parity and font-fidelity evidence.


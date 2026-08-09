# MAUL Profile Realization Fidelity Design

## Goal

Render the selected typography JSON as authored display typography over the video. A profile must remain visibly recognizable: its layer count, word partition, font pairing, casing, color, relative scale, line height, spacing, vertical offsets, and declared shadow treatment must survive the compiler-to-Remotion path.

The only adaptations permitted for a 9:16 output are:

1. A single uniform scale applied to the complete profile group so it fits the available frame envelope.
2. Translation of that complete group to the scene placement selected by the placement planner.

The renderer must not convert the profile into a caption, recolor active words, choose a generic editorial lockup, or independently shrink/rewrite layers.

## Current Failure

The first authoritative wiring batch selects and resolves profile layers, but the visual realization is still shallow:

- `TypographyProfileCompiler` measures one primary font against the complete chunk rather than measuring each profile layer.
- `applyMaulEditorialLockups` creates one generic `script_tag_overlap` grammar and does not consume the selected JSON layer styles.
- `MaulPlannedTextRecord` carries one primary font and one optional accent font, not an executable layer graph.
- `MaulPlannedTextLayer` uses the caption `textColor`/`accentColor` contract and colors active tokens with `accentColor`.
- The placement family reserves a narrow fixed editorial box, so a full display lockup is reduced to a small lower-side treatment.

This is why different JSON profiles currently converge on nearly identical output even though their source observations differ.

## Non-Negotiable Fidelity Contract

For a profile-backed chunk, the following values come from the selected JSON and are authoritative:

- profile identity and source hash;
- layer order and layer names;
- layer-to-token word spans;
- requested font families, with exact deployed family/style preferred;
- requested weight and style, with an explicit nearest deployed weight/style receipt only when the requested asset is unavailable;
- requested color;
- casing strategy;
- base size and relative scale;
- letter spacing and line height;
- vertical margin between layers;
- declared drop shadow values;
- profile horizontal alignment and maximum width.

The JSON `vertical_position` and `bottom_margin_percent` remain source observations and placement preferences, not absolute output coordinates. The scene placement planner owns the complete group's final frame position, as established by the separate placement stage.

No small profile-family allowlist is introduced. Every valid corpus profile with the chunk's exact word count remains eligible. Character distance ranks those candidates first; aspect compatibility and semantic fit follow. A stable recent-profile reuse penalty may break a tie only when word count, character distance, aspect penalty, and semantic score are equal. It may not replace a closer count match with an arbitrary style.

The JSON `font_classification` or mood text is observational only unless it has an executable field. Circles, underlines, highlights, and other annotations are not invented from prose descriptions in this batch. They remain a separate treatment stage until their geometry and animation are explicitly represented.

## Architecture

### Profile Realization Envelope

The compiler adds a profile realization payload to each successful chunk binding. The existing binding schema remains readable for legacy manifests; new compiler output always includes the realization payload.

The payload contains:

```ts
type MaulProfileRealization = {
  adaptation: "uniform_fit_9_16";
  intrinsicSizePx: {width: number; height: number};
  maxWidthPercent: number;
  layers: Array<{
    layerName: string;
    tokenIds: string[];
    text: string;
    font: MaulResolvedFontAsset;
    fontSizePx: number;
    lineHeight: number;
    letterSpacingEm: number;
    casing: "normal" | "lowercase" | "uppercase" | "title_case";
    color: string;
    marginTopPx: number;
    shadow: {
      xOffset: number;
      yOffset: number;
      blurRadius: number;
      color: string;
    };
  }>;
};
```

The concrete shared-types schema may use the repository's existing naming conventions, but it must preserve this information and hash it as part of the binding. A renderer cannot claim profile-backed execution without this receipt.

### Compiler Flow

For each materialized chunk:

1. Filter the complete corpus to profiles with the chunk's exact word count, then rank by character distance, aspect compatibility, semantic fit, stable recent-profile reuse, filename, and source hash. If the corpus has no exact word-count profile, block profile-backed realization rather than altering a layer's declared word allocation.
2. Resolve every selected layer's font independently. Exact requested family and style win first; the deployed 577-font catalog is consulted only for an explicit closest fallback.
3. Partition the actual chunk tokens in order according to the selected layers' declared `word_count` values. The total must match the chunk count. This preserves structures such as `I hate` / `being an` / `influencer!` and `She's got the` / `LOOK`.
4. Measure each layer using its resolved font, requested base size, relative scale, casing, letter spacing, and line height.
5. Stack or otherwise arrange the measured layers in source order using their declared vertical margins. The profile's horizontal alignment defines the internal group layout.
6. Emit the intrinsic realization envelope, `max_width_percent`, and measured group bounds to placement. The compiler does not choose final output coordinates or a scene-dependent scale.

If the selected profile's declared layer counts cannot be mapped to the actual chunk despite an exact total word count, the compiler must reject that profile and try the next ranked exact-count profile. It must never silently merge the layers into one line.

### Placement Flow

Placement receives the complete group envelope rather than a single caption-sized box. It is responsible for translating the group as a unit and choosing among scene-aware candidates.

- The candidate envelope is derived from measured group width and height, not the fixed `0.32` editorial box.
- Profile horizontal alignment is preserved inside the group. Source vertical-position and bottom-margin observations may influence candidate scoring but do not override scene-aware placement.
- For each candidate, placement computes the largest single uniform scale that fits the profile's maximum width, platform safe region, and candidate envelope. The selected segment persists that scale, translation, and final group bounds.
- Candidate generation must include center, left, right, upper, and lower display regions where the measured scene evidence permits them. Lower-right is not a default.
- Controlled overlap with a subject remains legal when the scene evidence explicitly passes the face/interference gate. The planner may move the complete group over a person; it may not reduce the typography to a tiny safe caption solely to avoid overlap.
- If no candidate can contain the complete group, the profile-backed segment is blocked with evidence. It is not silently downgraded to the legacy caption fallback.

### Remotion Rendering

The adapter converts the realization envelope into one render node per profile layer. Each node uses its own resolved font asset and static style. The complete group receives only the selected placement segment's uniform scale and translation.

The renderer must remove the caption-era active-word color rule. `active` may control timing/visibility only; it must never replace a profile layer's declared color. There is no global `accentColor` override for profile-backed records.

The current animation program can target the independently rendered layer tokens, but animation is limited to the existing reveal/transform interface in this batch. A later animation-corpus stage may add cinematic primitives without changing the static profile realization contract.

## Failure Handling

- **Invalid profile:** reject with filename and field-level validation evidence.
- **Layer count mismatch:** skip the profile and rank the next profile; never merge or drop layers.
- **Missing exact font:** use the closest deployed 577-catalog asset and record requested versus selected family/style/weight.
- **Measurement overflow:** uniformly fit the complete group; preserve every layer ratio. If it still cannot fit the candidate envelope, reject that candidate rather than clipping.
- **Placement collision:** evaluate another scene candidate. Do not mutate profile colors or collapse to a caption-sized box.
- **Renderer asset mismatch:** hard-fail the manifest because it breaks causal lineage.

## Verification

Tests must prove:

- JSON profiles 14, 17, 21, and representative 3-, 4-, 5-, and multi-layer profiles retain their exact layer count and ordered token spans.
- The realization receipt preserves each layer's font family receipt, static color, casing, relative scale, line height, spacing, margin, and shadow.
- A five-word chunk renders as the selected profile's declared multi-layer structure rather than one generic line.
- Active-token animation does not recolor text away from the profile's declared color.
- Group scale is uniform across layers and expands to the largest non-clipping fit available.
- Placement candidates are not hardcoded to the lower-right quadrant and can pass a centered or subject-integrated candidate.
- Missing exact assets use the closest deployed fallback without replacing the selected JSON profile.
- The authoritative V3 Remotion smoke render visibly shows distinct layer styles and remains 1080x1920 without clipping.
- Legacy manifests continue using the explicit compatibility adapter.

## Scope Boundary

This correction does not add circle/highlight geometry, dynamic color correction, MediaPipe model execution, or a new animation corpus. It makes the static typography profile truthful and gives the next animation stage independent layer targets. Those later features must consume this realization envelope rather than bypass it.

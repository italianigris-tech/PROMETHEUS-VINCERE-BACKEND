# Mini-Run Difference Typography Design

## Goal

Add a rare split-color typography treatment that uses CSS `mix-blend-mode: difference` to invert foreground hero text against the completed video frame. The treatment should add variety without replacing the existing font, gradient, and kinetic systems.

## Selection

- Select only foreground chunks that contain at least one hero layer.
- Use one treatment in runs of 15 chunks or fewer and at most two in longer runs.
- Keep selected chunks at least five chunk positions apart.
- Prefer visually salient chunks; use the manifest's seeded random source to break ties so seeded runs remain reproducible.
- Never apply the treatment to behind-subject typography, glass/see-through profiles, or 3D extrusion profiles.

## Manifest Contract

Eligible hero layers receive `blendMode: "difference"`. Other layers omit the field. The selection remains layer-scoped so companion text can preserve the selected font profile's original color treatment.

When difference mode is selected, the generator emits solid white paint with no gradient, glow, or text shadow. This is necessary because white is the source color for exact RGB inversion and decorative paint effects would create halos or partially blended colors.

## Rendering

The Remotion layer renderer resolves paint through one exported, testable helper. For difference layers it emits:

- `mixBlendMode: "difference"`
- solid white text
- no background gradient, clipped text fill, filter, or text shadow

Kinetic transforms and opacity animation continue unchanged. The treatment is foreground-only so it composites against the source video and any foreground matte as one finished visual frame.

## Verification

- Python tests verify count limits, cooldown, foreground/hero eligibility, and deterministic seeded selection.
- TypeScript tests verify the exact CSS paint contract and unchanged normal paint behavior.
- Run focused Python and Vitest suites, TypeScript type checking, and a representative Remotion frame render for visual confirmation.

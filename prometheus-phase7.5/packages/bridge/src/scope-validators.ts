// packages/bridge/src/scope-validators.ts
// Standalone scope validation utilities — extracted for testability

import type { EffectScope, Primitive, Layer, CompositionManifest, ValidationError } from "@prometheus/registry";

export const SCOPE_COMPATIBILITY_MATRIX: Record<EffectScope, EffectScope[]> = {
  "per-element": ["per-element", "per-group", "layer", "full-screen"],
  "per-group": ["per-group", "layer", "full-screen"],
  "layer": ["layer", "full-screen"],
  "full-screen": ["full-screen"],
};

export function isScopeCompatible(defaultScope: EffectScope, override: EffectScope): boolean {
  return SCOPE_COMPATIBILITY_MATRIX[defaultScope].includes(override);
}

export function canTargetLayer(primitive: Primitive, layerType: string): boolean {
  const { scope, targetType } = primitive;

  // per-element must target text, mesh, or asset
  if (scope === "per-element" && !["text", "mesh", "asset"].includes(layerType)) {
    return false;
  }

  // per-group must target text, ui, or mesh groups
  if (scope === "per-group" && !["text", "ui", "mesh"].includes(layerType)) {
    return false;
  }

  // full-screen post-process cannot target background with video
  if (scope === "full-screen" && targetType === "post-process" && layerType === "background") {
    return false;
  }

  return true;
}

export function hasVideoBackground(manifest: CompositionManifest): boolean {
  return manifest.layers.some(
    (l) => l.type === "background" && (l.content as any)?.type === "video"
  );
}

export function hasImageBackground(manifest: CompositionManifest): boolean {
  return manifest.layers.some(
    (l) => l.type === "background" && (l.content as any)?.type === "image"
  );
}

export function validateFullScreenSafety(
  manifest: CompositionManifest,
  primitive: Primitive
): ValidationError | null {
  if (primitive.scope !== "full-screen") return null;

  if (hasVideoBackground(manifest)) {
    return {
      path: "global.postProcess",
      message: `Full-screen primitive ${primitive.id} cannot be used with video backgrounds. The video will be blurred/destroyed.`,
      code: "full-screen-video-block",
    };
  }

  if (hasImageBackground(manifest)) {
    return {
      path: "global.postProcess",
      message: `Full-screen primitive ${primitive.id} cannot be used with image backgrounds. The image will be blurred/destroyed.`,
      code: "full-screen-image-block",
    };
  }

  return null;
}

export function getScopeNarrowingError(
  primitive: Primitive,
  layer: Layer,
  scopeOverride?: EffectScope
): ValidationError | null {
  const effectiveScope = scopeOverride ?? primitive.scope;

  if (effectiveScope === "per-element" && layer.type === "background") {
    return {
      path: `layers.${layer.id}`,
      message: `Primitive ${primitive.id} (scope: per-element) cannot target background layer ${layer.id}. Per-element effects must target text, mesh, or asset layers.`,
      code: "scope-per-element-background",
    };
  }

  if (effectiveScope === "per-element" && !["text", "mesh", "asset"].includes(layer.type)) {
    return {
      path: `layers.${layer.id}`,
      message: `Primitive ${primitive.id} (scope: per-element) cannot target layer type "${layer.type}".`,
      code: "scope-per-element-type",
    };
  }

  if (effectiveScope === "per-group" && !["text", "ui", "mesh"].includes(layer.type)) {
    return {
      path: `layers.${layer.id}`,
      message: `Primitive ${primitive.id} (scope: per-group) cannot target layer type "${layer.type}".`,
      code: "scope-per-group-type",
    };
  }

  return null;
}

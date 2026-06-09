// packages/bridge/src/composition-engine.ts
// Composition Engine: Validates and compiles CompositionManifests into executable scenes

import type {
  CompositionManifest,
  Primitive,
  PrimitiveApplication,
  Layer,
  ValidationResult,
  ValidationError,
  CompiledScene,
  EffectScope,
  PostProcessPass,
} from "@prometheus/registry";
import { Registry } from "@prometheus/registry";

export class CompositionEngine {
  private registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
  }

  /**
   * Main entry: validate a manifest, then compile it.
   */
  async compile(manifest: CompositionManifest): Promise<CompiledScene> {
    const validation = this.validate(manifest);
    if (!validation.valid) {
      throw new CompositionError("Manifest validation failed", validation.errors);
    }

    // Build the scene
    const scene = await this.buildScene(manifest);
    const timeline = await this.buildTimeline(manifest);
    const perf = this.estimatePerformance(manifest);

    return {
      component: scene,
      timeline,
      performanceEstimate: perf,
    };
  }

  /**
   * VALIDATION: The most critical phase. Catches Qwen's failures before they happen.
   */
  validate(manifest: CompositionManifest): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Validate all primitive IDs exist
    for (const layer of manifest.layers) {
      for (const app of layer.primitives) {
        const primitive = this.registry.getPrimitive(app.primitiveId);
        if (!primitive) {
          errors.push({
            path: `layers.${layer.id}.primitives.${app.primitiveId}`,
            message: `Primitive ${app.primitiveId} not found in registry`,
            code: "primitive-not-found",
          });
          continue;
        }

        // 2. Validate parameter schemas
        const paramErrors = this.validateParameters(primitive, app.parameters);
        errors.push(...paramErrors.map((e) => ({ ...e, path: `layers.${layer.id}.primitives.${app.primitiveId}.${e.path}` })));

        // 3. SCOPE VALIDATION (CRITICAL — Anti-Pattern #1)
        const scopeError = this.validateScope(primitive, app, layer, manifest);
        if (scopeError) errors.push(scopeError);

        // 4. Conflict detection (Anti-Pattern #5)
        const conflictErrors = this.detectConflicts(layer, app, primitive);
        errors.push(...conflictErrors.map((e) => ({ ...e, path: `layers.${layer.id}.primitives.${app.primitiveId}` })));
      }
    }

    // 5. Post-process validation (Anti-Pattern #5: no full-screen effects on video backgrounds)
    const ppErrors = this.validatePostProcess(manifest);
    errors.push(...ppErrors);

    // 6. Dependency resolution
    const depErrors = this.validateDependencies(manifest);
    errors.push(...depErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateParameters(primitive: Primitive, params: Record<string, unknown>): ValidationError[] {
    const errors: ValidationError[] = [];
    const schema = primitive.parameterSchema;

    for (const def of schema.parameters) {
      const value = params[def.key];
      if (value === undefined) continue; // Use default

      // Type checking
      if (def.type === "number" && typeof value !== "number") {
        errors.push({ path: def.key, message: `Expected number, got ${typeof value}`, code: "type-mismatch" });
      }
      if (def.type === "boolean" && typeof value !== "boolean") {
        errors.push({ path: def.key, message: `Expected boolean, got ${typeof value}`, code: "type-mismatch" });
      }
      if (def.type === "color" && typeof value !== "string") {
        errors.push({ path: def.key, message: `Expected color string, got ${typeof value}`, code: "type-mismatch" });
      }
      if (def.type === "enum" && def.options && !def.options.includes(String(value))) {
        errors.push({ path: def.key, message: `Invalid enum value: ${value}`, code: "invalid-enum" });
      }

      // Bounds checking
      if (def.type === "number" && typeof value === "number") {
        if (def.min !== undefined && value < def.min) {
          errors.push({ path: def.key, message: `Value ${value} below minimum ${def.min}`, code: "out-of-bounds" });
        }
        if (def.max !== undefined && value > def.max) {
          errors.push({ path: def.key, message: `Value ${value} above maximum ${def.max}`, code: "out-of-bounds" });
        }
      }
    }

    return errors;
  }

  /**
   * SCOPE VALIDATION — The heart of Phase 7.5's fix for Qwen's spatial blindness.
   *
   * Rules:
   * - per-element: Can only target text/mesh layers. Cannot target background.
   * - per-group: Can target text groups or UI layers.
   * - layer: Can target any layer.
   * - full-screen: Cannot be used if any layer has a video/image background.
   *                (Anti-Pattern #5: no full-screen blur on video backgrounds)
   */
  private validateScope(
    primitive: Primitive,
    app: PrimitiveApplication,
    layer: Layer,
    manifest: CompositionManifest
  ): ValidationError | null {
    const scope = app.scopeOverride ?? primitive.scope;

    // Rule 1: per-element cannot target background layers
    if (scope === "per-element" && layer.type === "background") {
      return {
        path: `layers.${layer.id}`,
        message: `Primitive ${primitive.id} has scope "per-element" but layer ${layer.id} is a background. Per-element effects cannot target backgrounds.`,
        code: "scope-background-mismatch",
      };
    }

    // Rule 2: per-element must target text or mesh
    if (scope === "per-element" && layer.type !== "text" && layer.type !== "mesh" && layer.type !== "asset") {
      return {
        path: `layers.${layer.id}`,
        message: `Primitive ${primitive.id} has scope "per-element" but layer ${layer.id} is type "${layer.type}". Per-element effects must target text, mesh, or asset layers.`,
        code: "scope-type-mismatch",
      };
    }

    // Rule 3: full-screen post-process + video background = BLOCKED
    if (scope === "full-screen" && layer.type === "background") {
      const bgContent = layer.content as any;
      if (bgContent?.type === "video" || bgContent?.type === "image") {
        return {
          path: `layers.${layer.id}`,
          message: `Primitive ${primitive.id} has scope "full-screen" but background layer contains a video/image. Full-screen effects destroy video backgrounds. Use a per-element or layer-scoped alternative.`,
          code: "full-screen-video-conflict",
        };
      }
    }

    // Rule 4: scopeOverride must be compatible with primitive's default scope
    if (app.scopeOverride) {
      const compatible = this.isScopeCompatible(primitive.scope, app.scopeOverride);
      if (!compatible) {
        return {
          path: `layers.${layer.id}.primitives.${app.primitiveId}`,
          message: `Scope override "${app.scopeOverride}" is not compatible with primitive's default scope "${primitive.scope}".`,
          code: "scope-override-incompatible",
        };
      }
    }

    return null;
  }

  private isScopeCompatible(defaultScope: EffectScope, override: EffectScope): boolean {
    // Compatibility matrix:
    // per-element can be overridden to per-group (broader)
    // per-group can be overridden to layer (broader)
    // layer can be overridden to full-screen (broader)
    // But NOT the reverse (narrowing is dangerous)
    const order: EffectScope[] = ["per-element", "per-group", "layer", "full-screen"];
    const defaultIdx = order.indexOf(defaultScope);
    const overrideIdx = order.indexOf(override);
    return overrideIdx >= defaultIdx;
  }

  private detectConflicts(layer: Layer, app: PrimitiveApplication, primitive: Primitive): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const otherApp of layer.primitives) {
      if (otherApp.primitiveId === app.primitiveId) continue;
      const otherPrimitive = this.registry.getPrimitive(otherApp.primitiveId);
      if (!otherPrimitive) continue;

      // Check if primitives conflict
      if (primitive.conflicts.includes(otherPrimitive.id) || otherPrimitive.conflicts.includes(primitive.id)) {
        errors.push({
          path: `layers.${layer.id}`,
          message: `Primitive ${primitive.id} conflicts with ${otherPrimitive.id} in the same layer.`,
          code: "primitive-conflict",
        });
      }
    }

    return errors;
  }

  private validatePostProcess(manifest: CompositionManifest): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!manifest.global.postProcess.enabled) return errors;

    // Check for video backgrounds
    const hasVideoBackground = manifest.layers.some(
      (l) => l.type === "background" && (l.content as any)?.type === "video"
    );

    for (const pass of manifest.global.postProcess.passes) {
      const primitive = this.registry.getPrimitive(pass.primitiveId);
      if (!primitive) {
        errors.push({
          path: `global.postProcess.passes.${pass.primitiveId}`,
          message: `Post-process primitive ${pass.primitiveId} not found`,
          code: "post-process-not-found",
        });
        continue;
      }

      if (hasVideoBackground && primitive.scope === "full-screen") {
        errors.push({
          path: `global.postProcess.passes.${pass.primitiveId}`,
          message: `Post-process ${pass.primitiveId} is full-screen but the scene has a video background. This will blur/destroy the video. Use a per-element alternative or remove the video background.`,
          code: "post-process-video-conflict",
        });
      }
    }

    return errors;
  }

  private validateDependencies(manifest: CompositionManifest): ValidationError[] {
    const errors: ValidationError[] = [];
    const usedPrimitives = new Set<string>();

    for (const layer of manifest.layers) {
      for (const app of layer.primitives) {
        usedPrimitives.add(app.primitiveId);
      }
    }
    for (const pass of manifest.global.postProcess.passes) {
      usedPrimitives.add(pass.primitiveId);
    }

    for (const pid of usedPrimitives) {
      const primitive = this.registry.getPrimitive(pid);
      if (!primitive) continue;

      for (const req of primitive.requires) {
        if (!usedPrimitives.has(req)) {
          errors.push({
            path: `global`,
            message: `Primitive ${pid} requires ${req} but it is not present in the composition.`,
            code: "missing-dependency",
          });
        }
      }
    }

    return errors;
  }

  // ─── BUILD PHASE ───

  private async buildScene(manifest: CompositionManifest): Promise<any> {
    // This will be implemented in Phase 7.5B integration with R3F
    // For now, return a placeholder that the Worker will consume
    return {
      type: "scene",
      manifest,
      layers: manifest.layers.map((layer) => this.buildLayer(layer)),
    };
  }

  private buildLayer(layer: Layer): any {
    return {
      id: layer.id,
      type: layer.type,
      zIndex: layer.zIndex,
      content: layer.content,
      primitives: layer.primitives.map((app) => ({
        primitiveId: app.primitiveId,
        parameters: app.parameters,
        startAt: app.startAt,
        duration: app.duration,
        easing: app.easing,
      })),
    };
  }

  private async buildTimeline(manifest: CompositionManifest): Promise<any> {
    // GSAP timeline construction will be implemented in the Worker
    return {
      type: "timeline",
      segments: manifest.timeline,
    };
  }

  private estimatePerformance(manifest: CompositionManifest): any {
    let totalVram = 0;
    let totalDrawCalls = 0;
    let maxGpuCost = "negligible";
    const costOrder = ["negligible", "low", "medium", "high", "extreme"];

    const allPrimitives = [
      ...manifest.layers.flatMap((l) => l.primitives.map((p) => p.primitiveId)),
      ...manifest.global.postProcess.passes.map((p) => p.primitiveId),
    ];

    for (const pid of allPrimitives) {
      const p = this.registry.getPrimitive(pid);
      if (!p) continue;
      totalVram += p.performanceProfile.vramMB;
      totalDrawCalls += p.performanceProfile.drawCallOverhead;
      if (costOrder.indexOf(p.performanceProfile.gpuCost) > costOrder.indexOf(maxGpuCost)) {
        maxGpuCost = p.performanceProfile.gpuCost;
      }
    }

    return {
      gpuCost: maxGpuCost,
      vramMB: totalVram,
      drawCallOverhead: totalDrawCalls,
      estimatedFps30: Math.max(15, 30 - allPrimitives.length * 2),
    };
  }
}

export class CompositionError extends Error {
  errors: ValidationError[];
  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = "CompositionError";
    this.errors = errors;
  }
}

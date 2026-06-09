// packages/learning/src/novelty-detector.ts
// Determines if a detected technique is novel or matches an existing primitive

import type { DetectedTechnique, NoveltyAssessment, Primitive, PrimitiveRegistry } from "@prometheus/registry";
import { Registry } from "@prometheus/registry";

export class NoveltyDetector {
  private registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
  }

  /**
   * Assess whether a detected technique is novel or matches an existing primitive.
   * 
   * HARD RULES:
   * 1. If scope differs, it is ALWAYS novel (per-element vs full-screen are fundamentally different)
   * 2. If category differs, it is likely novel
   * 3. If parameter space overlaps >80%, it may be an extension
   * 4. Visual signature embedding comparison (semantic similarity)
   */
  assess(detected: DetectedTechnique): NoveltyAssessment {
    const candidates = this.registry.search(detected.techniqueName);

    if (candidates.length === 0) {
      return {
        isNovel: true,
        differentiation: "No existing primitive matches this technique name",
        recommendation: "create-new",
      };
    }

    // Check for exact scope match first
    const sameScope = candidates.filter((p) => p.scope === detected.scope);
    if (sameScope.length === 0) {
      return {
        isNovel: true,
        existingPrimitiveId: candidates[0].id,
        differentiation: `Existing primitive ${candidates[0].id} has scope "${candidates[0].scope}" but detected technique has scope "${detected.scope}". Different scope = different primitive.`,
        recommendation: "create-new",
      };
    }

    // Check parameter space overlap
    const bestMatch = sameScope[0];
    const paramOverlap = this.calculateParamOverlap(bestMatch, detected);

    if (paramOverlap > 0.8) {
      return {
        isNovel: false,
        existingPrimitiveId: bestMatch.id,
        differentiation: `Parameter space overlap is ${(paramOverlap * 100).toFixed(0)}%. Consider extending existing primitive.`,
        recommendation: "extend-existing",
      };
    }

    return {
      isNovel: true,
      existingPrimitiveId: bestMatch.id,
      differentiation: `Parameter space overlap is only ${(paramOverlap * 100).toFixed(0)}%. Significant differences detected.`,
      recommendation: "create-new",
    };
  }

  private calculateParamOverlap(primitive: Primitive, detected: DetectedTechnique): number {
    const schemaKeys = primitive.parameterSchema.parameters.map((p) => p.key);
    const detectedKeys = Object.keys(detected.parameters);

    if (schemaKeys.length === 0 || detectedKeys.length === 0) return 0;

    const intersection = schemaKeys.filter((k) => detectedKeys.includes(k));
    return intersection.length / Math.max(schemaKeys.length, detectedKeys.length);
  }
}

export default NoveltyDetector;

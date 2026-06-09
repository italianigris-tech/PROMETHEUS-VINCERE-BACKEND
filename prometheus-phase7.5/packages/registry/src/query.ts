// packages/registry/src/query.ts
// Advanced query builder for the Primitive Registry

import type { Primitive, RegistryQuery, RegistryQueryResult } from "./types";
import { Registry } from "./registry";

export function queryRegistry(registry: Registry, q: RegistryQuery): RegistryQueryResult {
  let results = registry.getAllPrimitives();

  if (q.category) {
    results = results.filter((p) => p.category === q.category);
  }

  if (q.targetType) {
    results = results.filter((p) => p.targetType === q.targetType);
  }

  if (q.scope) {
    results = results.filter((p) => p.scope === q.scope);
  }

  if (q.tags && q.tags.length > 0) {
    results = results.filter((p) => q.tags!.every((tag) => p.tags.includes(tag)));
  }

  if (q.minConfidence !== undefined) {
    results = results.filter((p) => p.confidence.overall >= q.minConfidence!);
  }

  if (q.search) {
    const s = q.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.id.toLowerCase().includes(s) ||
        p.name.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s)
    );
  }

  return {
    primitives: results,
    total: results.length,
    page: 1,
    pageSize: results.length,
  };
}

export function findByVisualSignature(registry: Registry, signature: string): Primitive[] {
  const s = signature.toLowerCase();
  return registry
    .getAllPrimitives()
    .filter((p) => p.visualSignature.toLowerCase().includes(s));
}

export function findByProvenance(registry: Registry, videoId: string): Primitive[] {
  return registry
    .getAllPrimitives()
    .filter((p) => p.provenance.sourceVideo.includes(videoId));
}

export function getHighConfidencePrimitives(registry: Registry, threshold = 0.8): Primitive[] {
  return registry.getAllPrimitives().filter((p) => p.confidence.overall >= threshold);
}

export function getPrimitivesByPerformance(
  registry: Registry,
  maxGpuCost: "negligible" | "low" | "medium" | "high" | "extreme"
): Primitive[] {
  const costOrder = ["negligible", "low", "medium", "high", "extreme"];
  const maxIdx = costOrder.indexOf(maxGpuCost);
  return registry
    .getAllPrimitives()
    .filter((p) => costOrder.indexOf(p.performanceProfile.gpuCost) <= maxIdx);
}

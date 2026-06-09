// packages/registry/src/registry.ts
// In-memory registry with JSON persistence

import type {
  Primitive,
  PrimitiveRegistry,
  SceneArchetype,
  ProvenanceEntry,
  ValidationResult,
} from "./types";
import { validatePrimitive } from "./validators";

export class Registry {
  private data: PrimitiveRegistry;
  private indexByCategory: Map<string, Primitive[]> = new Map();
  private indexByTag: Map<string, Primitive[]> = new Map();
  private indexByScope: Map<string, Primitive[]> = new Map();
  private indexByTarget: Map<string, Primitive[]> = new Map();

  constructor(initial: PrimitiveRegistry) {
    this.data = initial;
    this.rebuildIndexes();
  }

  static fromPrimitives(primitives: Primitive[]): Registry {
    return new Registry({
      version: "7.5.0",
      lastUpdated: new Date().toISOString(),
      primitives,
      archetypes: [],
      provenanceIndex: [],
    });
  }

  private rebuildIndexes(): void {
    this.indexByCategory.clear();
    this.indexByTag.clear();
    this.indexByScope.clear();
    this.indexByTarget.clear();

    for (const p of this.data.primitives) {
      this.addToIndex(this.indexByCategory, p.category, p);
      this.addToIndex(this.indexByScope, p.scope, p);
      this.addToIndex(this.indexByTarget, p.targetType, p);
      for (const tag of p.tags) {
        this.addToIndex(this.indexByTag, tag, p);
      }
    }
  }

  private addToIndex(map: Map<string, Primitive[]>, key: string, p: Primitive): void {
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }

  getPrimitive(id: string): Primitive | undefined {
    return this.data.primitives.find((p) => p.id === id);
  }

  getAllPrimitives(): Primitive[] {
    return [...this.data.primitives];
  }

  getByCategory(category: string): Primitive[] {
    return [...(this.indexByCategory.get(category) ?? [])];
  }

  getByScope(scope: string): Primitive[] {
    return [...(this.indexByScope.get(scope) ?? [])];
  }

  getByTarget(target: string): Primitive[] {
    return [...(this.indexByTarget.get(target) ?? [])];
  }

  getByTag(tag: string): Primitive[] {
    return [...(this.indexByTag.get(tag) ?? [])];
  }

  search(query: string): Primitive[] {
    const q = query.toLowerCase();
    return this.data.primitives.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.visualSignature.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  findCompatible(primitiveId: string): Primitive[] {
    const target = this.getPrimitive(primitiveId);
    if (!target) return [];

    return this.data.primitives.filter((p) => {
      if (p.id === primitiveId) return false;
      if (target.conflicts.includes(p.id)) return false;
      if (p.conflicts.includes(target.id)) return false;
      // Same target type and compatible scope are good signals
      if (p.targetType === target.targetType) return true;
      if (p.targetType === "scene" || target.targetType === "scene") return true;
      return false;
    });
  }

  addPrimitive(primitive: Primitive): ValidationResult {
    const parsed = validatePrimitive(primitive);
    if (!parsed.success) {
      return {
        valid: false,
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      };
    }

    if (this.getPrimitive(primitive.id)) {
      return {
        valid: false,
        errors: [{ path: "id", message: `Primitive ${primitive.id} already exists`, code: "duplicate" }],
      };
    }

    this.data.primitives.push(primitive);
    this.data.lastUpdated = new Date().toISOString();
    this.rebuildIndexes();

    return { valid: true, errors: [] };
  }

  removePrimitive(id: string): boolean {
    const idx = this.data.primitives.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.data.primitives.splice(idx, 1);
    this.data.lastUpdated = new Date().toISOString();
    this.rebuildIndexes();
    return true;
  }

  getArchetype(id: string): SceneArchetype | undefined {
    return this.data.archetypes.find((a) => a.id === id);
  }

  addArchetype(archetype: SceneArchetype): void {
    this.data.archetypes.push(archetype);
    this.data.lastUpdated = new Date().toISOString();
  }

  addProvenance(entry: ProvenanceEntry): void {
    this.data.provenanceIndex.push(entry);
  }

  toJSON(): PrimitiveRegistry {
    return JSON.parse(JSON.stringify(this.data));
  }

  getStats(): {
    totalPrimitives: number;
    totalArchetypes: number;
    byCategory: Record<string, number>;
    byScope: Record<string, number>;
    avgConfidence: number;
  } {
    const byCategory: Record<string, number> = {};
    const byScope: Record<string, number> = {};
    let totalConfidence = 0;

    for (const p of this.data.primitives) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
      byScope[p.scope] = (byScope[p.scope] ?? 0) + 1;
      totalConfidence += p.confidence.overall;
    }

    return {
      totalPrimitives: this.data.primitives.length,
      totalArchetypes: this.data.archetypes.length,
      byCategory,
      byScope,
      avgConfidence: this.data.primitives.length > 0 ? totalConfidence / this.data.primitives.length : 0,
    };
  }
}

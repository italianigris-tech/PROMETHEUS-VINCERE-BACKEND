// packages/registry/src/primitives/ui-element/pill-stack-v1/test/unit.test.ts
import { describe, it, expect } from "vitest";
import { createPillGeometry, createPillShape } from "../src/geometry";
import { ExtrudeGeometry, Shape } from "three";

describe("pill-stack-v1", () => {
  it("should create a pill shape", () => {
    const shape = createPillShape(3, 0.8, 0.2);
    expect(shape).toBeInstanceOf(Shape);
  });

  it("should create an extruded pill geometry", () => {
    const geom = createPillGeometry({ width: 3, height: 0.8, depth: 0.2 });
    expect(geom).toBeInstanceOf(ExtrudeGeometry);
  });

  it("should have parameter schema with 7 parameters", () => {
    const manifest = require("../manifest.json");
    expect(manifest.parameterSchema.parameters).toHaveLength(7);
  });

  it("should declare scope as per-group", () => {
    const manifest = require("../manifest.json");
    expect(manifest.scope).toBe("per-group");
  });

  it("should target ui elements", () => {
    const manifest = require("../manifest.json");
    expect(manifest.targetType).toBe("ui");
  });
});

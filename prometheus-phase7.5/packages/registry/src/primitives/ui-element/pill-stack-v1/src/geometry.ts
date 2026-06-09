// packages/registry/src/primitives/ui-element/pill-stack-v1/src/geometry.ts
import { Shape, ExtrudeGeometry, Vector2 } from "three";

export interface PillGeometryParams {
  width: number;
  height: number;
  depth: number;
  cornerRadius?: number;
}

export function createPillShape(width: number, height: number, cornerRadius: number): Shape {
  const shape = new Shape();
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(cornerRadius, w, h);

  shape.moveTo(-w + r, h);
  shape.lineTo(w - r, h);
  shape.quadraticCurveTo(w, h, w, h - r);
  shape.lineTo(w, -h + r);
  shape.quadraticCurveTo(w, -h, w - r, -h);
  shape.lineTo(-w + r, -h);
  shape.quadraticCurveTo(-w, -h, -w, -h + r);
  shape.lineTo(-w, h - r);
  shape.quadraticCurveTo(-w, h, -w + r, h);
  shape.closePath();

  return shape;
}

export function createPillGeometry(params: PillGeometryParams): ExtrudeGeometry {
  const { width, height, depth, cornerRadius = height * 0.25 } = params;
  const shape = createPillShape(width, height, cornerRadius);
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
  });
  // Center the geometry
  geometry.center();
  return geometry;
}

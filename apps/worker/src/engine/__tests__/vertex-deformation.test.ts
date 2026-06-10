import {describe, expect, it} from "vitest";
import * as THREE from "three";

import {
  getDeformationState,
  injectVertexDeformation,
  updateDeformationTime,
  type DeformationShader,
  type DeformationType
} from "../vertex-deformation.js";

describe("injectVertexDeformation", () => {
  const compileMaterial = (material: THREE.MeshBasicMaterial): DeformationShader => {
    const shader: DeformationShader = {
      vertexShader: "void main() {\n#include <begin_vertex>\n}",
      fragmentShader: "void main() {}",
      uniforms: {}
    };
    const compile = material.onBeforeCompile as (
      shader: DeformationShader,
      renderer: THREE.WebGLRenderer
    ) => void;
    compile(shader, {} as THREE.WebGLRenderer);
    return shader;
  };

  it("injects uniforms and instance-aware shader source", () => {
    const material = new THREE.MeshBasicMaterial();
    injectVertexDeformation(material, {type: "wave", intensity: 0.5});

    expect(material.onBeforeCompile).toBeTypeOf("function");

    const shader = compileMaterial(material);

    expect(material.userData.shader).toBe(shader);
    expect(shader.vertexShader).toContain("gl_InstanceID");
    expect(shader.vertexShader).toContain("uTime");
  });

  it("injects GLSL declarations before main and deformation calls inside main", () => {
    const material = new THREE.MeshBasicMaterial();
    injectVertexDeformation(material, {type: "explode", intensity: 0.5});

    const shader = compileMaterial(material);
    const mainIndex = shader.vertexShader.indexOf("void main()");
    const uniformIndex = shader.vertexShader.indexOf("uniform float uTime");
    const functionIndex = shader.vertexShader.indexOf("vec3 applyGlyphLocalDeformation");
    const callIndex = shader.vertexShader.indexOf("applyGlyphLocalDeformation(transformed, normal, float(gl_InstanceID))");

    expect(uniformIndex).toBeGreaterThanOrEqual(0);
    expect(functionIndex).toBeGreaterThanOrEqual(0);
    expect(mainIndex).toBeGreaterThanOrEqual(0);
    expect(uniformIndex).toBeLessThan(mainIndex);
    expect(functionIndex).toBeLessThan(mainIndex);
    expect(callIndex).toBeGreaterThan(mainIndex);
  });

  it.each([
    ["explode", 1],
    ["wave", 2],
    ["ripple", 3],
    ["shatter", 4]
  ] satisfies Array<[DeformationType, number]>)("maps %s deformation to the shader uniform", (type, expected) => {
    const material = new THREE.MeshBasicMaterial();
    injectVertexDeformation(material, {type, intensity: 0.5});

    const shader = compileMaterial(material);

    expect(shader.uniforms.uDeformType?.value).toBe(expected);
  });

  it("clamps intensity and updates deformation time after compile", () => {
    const material = new THREE.MeshBasicMaterial();
    injectVertexDeformation(material, {type: "shatter", intensity: 2});
    compileMaterial(material);

    updateDeformationTime(material, 1.25);

    expect(getDeformationState(material)).toEqual({
      type: "shatter",
      uTime: 1.25,
      uIntensity: 1,
      uSpeed: 1,
      uFrequency: 1,
      uSeed: 0
    });
  });
});

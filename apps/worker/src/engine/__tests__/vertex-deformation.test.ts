import {describe, expect, it} from "vitest";
import * as THREE from "three";

import {injectVertexDeformation} from "../vertex-deformation.js";

describe("injectVertexDeformation", () => {
  it("injects uniforms and instance-aware shader source", () => {
    const material = new THREE.MeshBasicMaterial();
    injectVertexDeformation(material, {type: "wave", intensity: 0.5});

    expect(material.onBeforeCompile).toBeTypeOf("function");

    const shader = {
      vertexShader: "void main() {\n#include <begin_vertex>\n}",
      fragmentShader: "void main() {}",
      uniforms: {}
    };
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(material.userData.shader).toBe(shader);
    expect(shader.vertexShader).toContain("gl_InstanceID");
    expect(shader.vertexShader).toContain("uTime");
  });
});

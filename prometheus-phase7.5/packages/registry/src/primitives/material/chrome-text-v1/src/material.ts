// packages/registry/src/primitives/material/chrome-text-v1/src/material.ts
import { MeshStandardMaterial, Color, CubeTexture, DataTexture, RGBAFormat, UnsignedByteType, PMREMGenerator, Texture, EquirectangularReflectionMapping } from "three";

export interface ChromeTextParams {
  extrudeDepth: number;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  color: string;
}

export const defaultChromeParams: ChromeTextParams = {
  extrudeDepth: 0.4,
  metalness: 1.0,
  roughness: 0.1,
  envMapIntensity: 1.5,
  color: "#FFFFFF",
};

/**
 * Generate a simple procedural environment map for chrome text.
 * Creates a PMREM from a synthetic equirectangular gradient.
 * This allows chrome text to work without external HDR assets.
 */
export function generateProceduralEnvMap(renderer: any): Texture {
  const size = 512;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Simple gradient: bright top, dark bottom, with some variation
      const ny = y / size;
      const nx = x / size;
      const brightness = Math.max(0.1, 1.0 - ny * 0.8 + Math.sin(nx * Math.PI * 2) * 0.1);
      data[i] = Math.min(255, brightness * 255);
      data[i + 1] = Math.min(255, brightness * 240);
      data[i + 2] = Math.min(255, brightness * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.needsUpdate = true;

  const pmrem = new PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose();
  texture.dispose();

  return envMap;
}

export function createChromeMaterial(params: Partial<ChromeTextParams>, envMap?: Texture): MeshStandardMaterial {
  const p = { ...defaultChromeParams, ...params };
  const mat = new MeshStandardMaterial({
    color: new Color(p.color),
    metalness: p.metalness,
    roughness: p.roughness,
    envMapIntensity: p.envMapIntensity,
  });
  if (envMap) {
    mat.envMap = envMap;
  }
  return mat;
}

// packages/registry/src/index.ts
// Public API exports

export * from "./types";
export * from "./validators";
export { Registry } from "./registry";
export {
  queryRegistry,
  findByVisualSignature,
  findByProvenance,
  getHighConfidencePrimitives,
  getPrimitivesByPerformance,
} from "./query";

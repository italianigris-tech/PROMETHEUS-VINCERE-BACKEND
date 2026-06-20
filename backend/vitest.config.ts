import path from "path";
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false
  },
  resolve: {
    alias: {
      "@prometheus/shared-types": path.resolve(__dirname, "../packages/shared-types/src/index.ts")
    },
    conditions: ["import", "node", "default"]
  }
});
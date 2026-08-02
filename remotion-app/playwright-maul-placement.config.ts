import {defineConfig} from "@playwright/test";

export default defineConfig({
  testMatch: ["**/playwright-maul-placement.spec.ts"],
  timeout: 180_000,
  expect: {timeout: 30_000},
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3012",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3012",
    url: "http://127.0.0.1:3012/maul/placement-tracer",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

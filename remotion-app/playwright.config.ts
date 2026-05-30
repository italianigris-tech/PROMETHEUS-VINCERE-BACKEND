import {defineConfig} from "@playwright/test";

export default defineConfig({
  testMatch: ["**/playwright-sandbox.spec.ts"],
  timeout: 120_000,
  expect: {
    timeout: 20_000
  },
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3010/sandbox",
    reuseExistingServer: true,
    timeout: 120_000
  }
});

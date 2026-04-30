import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3014",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node ./scripts/start-standalone-e2e.mjs",
    url: "http://127.0.0.1:3014/signup",
    env: {
      HOSTNAME: "127.0.0.1",
      PORT: "3014",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

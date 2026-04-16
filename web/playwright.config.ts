import { defineConfig } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  expect: {
    timeout: 5_000
  },
  timeout: 10_000,
  testDir: "./tests",
  globalSetup: "./tests/e2e.global-setup",
  globalTeardown: "./tests/e2e.global-teardown",
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["list"], ["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:5051",
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    defaultBrowserType: "firefox",
    testIdAttribute: "data-pw",
    viewport: { width: 2560, height: 1440 }
  },

  projects: [
    // Perform initial setup (isolated on port 5051)
    {
      name: "initial-setup",
      testMatch: "**/initial-setup.spec.ts",
      use: {
        baseURL: "http://localhost:5051"
      }
    },
    // Perform regular usage tests
    {
      name: "user",
      dependencies: ["initial-setup"],
      testMatch: "**/user.*.spec.ts",
      fullyParallel: true,
      use: {
        baseURL: "http://localhost:5051",
        storageState: "playwright/.auth/user.json"
      }
    },
    // Perform tests with disruptive side-effects (eg. add/remove collection directories)
    {
      name: "admin",
      dependencies: ["user"],
      testMatch: "**/admin.spec.ts",
      fullyParallel: true,
      use: {
        baseURL: "http://localhost:5051",
        storageState: "playwright/.auth/user.json"
      }
    }
  ]
});

import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against `wrangler dev` with a throwaway D1/R2 state, so they never touch
// .wrangler/state. The invite code is injected with --var, independent of .dev.vars.
const port = 8788;
const state = ".wrangler/e2e-state";
export const INVITE_CODE = "e2e-invite";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${port}/projects/dungeon-manager/`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: [
      `rm -rf ${state}`,
      `npx wrangler d1 migrations apply dungeon-manager --local --persist-to ${state}`,
      "npx vite build",
      `npx wrangler dev --port ${port} --persist-to ${state} --var REGISTRATION_SECRET:${INVITE_CODE} --show-interactive-dev-session=false`,
    ].join(" && "),
    url: `http://localhost:${port}/projects/dungeon-manager/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

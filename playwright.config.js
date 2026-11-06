// Playwright E2E (ADR-FE-18): Chromium, Firefox and WebKit against the built CLI (`pnpm build` first).
import { defineConfig, devices } from '@playwright/test';

const isPerf = process.argv.some((arg) => arg.includes('perf'));
// K9.5: KumiCraft against copies of real projects, only through `pnpm test:real`.
const isReal = process.argv.some((arg) => arg.includes('e2e/real'));
const isNetwork = process.env.RC_E2E_NETWORK === '1';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  testIgnore: [...(isPerf ? [] : ['**/perf/**']), ...(isReal ? [] : ['**/real/**'])],
  grep: isNetwork ? /@network/ : undefined,
  grepInvert: isNetwork ? /@perf/ : /(@network|@perf)/,
  fullyParallel: true,
  // Each test starts its own CLI server and browser; more workers than this overload a dev machine
  // and make slow steps (WebKit typing, Firefox screenshots) time out.
  workers: process.env.CI ? 2 : 4,
  // Waiting time of the harness, not a budget (budgets are measured by `pnpm bench:ui`): Canvas
  // tests start a server and a browser each, and WebKit on Windows is slow under that load.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // The Studio picks Vietnamese for vi browsers (ADR-FE-16); tests switch to English themselves.
    locale: 'vi-VN',
    // A click or a fill on a missing element fails after 15 s instead of the whole test timeout.
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
  },
  projects: [
    // SPEC-06 2.2: the E2E suite is a regression check on Chromium only, run at the end of a phase.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-en',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
      grep: isNetwork ? /(?=.*\[AC-)(?=.*@network)/ : /\[AC-/,
      grepInvert: isNetwork ? /@perf/ : /(@network|@perf)/,
    },
  ],
});

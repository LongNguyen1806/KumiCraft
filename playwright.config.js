// Playwright E2E (ADR-FE-18): Chromium, Firefox and WebKit against the built CLI (`pnpm build` first).
import { defineConfig, devices } from '@playwright/test';

const isPerf = process.argv.some((arg) => arg.includes('perf'));

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  testIgnore: isPerf ? [] : ['**/perf/**'],
  fullyParallel: true,
  // Each test starts its own CLI server and browser; more workers than this overload a dev machine
  // and make slow steps (WebKit typing, Firefox screenshots) time out.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // The Studio picks Vietnamese for vi browsers (ADR-FE-16); tests switch to English themselves.
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // The engine of Safari, the default browser of macOS users.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});

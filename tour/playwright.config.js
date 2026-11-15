// The real-use tour (tour/PLAN.md): one browser, one batch at a time, never part of `pnpm test:e2e`.
// Every step is recorded in tour/out/<batch>/report.md with a screenshot; failures do not stop it.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.tour.ts',
  workers: 1,
  retries: 0,
  timeout: 6 * 60_000,
  expect: { timeout: 10_000 },
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'vi-VN',
    actionTimeout: 8_000,
    trace: 'off',
  },
});

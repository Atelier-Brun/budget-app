import { defineConfig, devices } from '@playwright/test';

// Tests de parcours complets sur un iPhone 15 simulé (moteur WebKit, celui de Safari).
// L'app est testée dans sa version compilée (comme en ligne), servie localement.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/budget-app/',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'iPhone 15', use: { ...devices['iPhone 15'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/budget-app/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

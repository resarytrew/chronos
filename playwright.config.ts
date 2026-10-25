import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173/chronos/', headless: true, viewport: {width: 1366, height: 768} },
  webServer: {command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/chronos/', reuseExistingServer: true},
});

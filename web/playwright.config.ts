import { defineConfig } from '@playwright/test';

process.env.NO_PROXY = '127.0.0.1,localhost';
process.env.no_proxy = '127.0.0.1,localhost';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  use: { baseURL, browserName: 'chromium' },
  webServer: baseURL.startsWith('http://127.0.0.1:') ? { command: "pnpm dev --host 127.0.0.1 && node -e 'setInterval(() => {}, 1000000)'", url: 'http://127.0.0.1:4321/', reuseExistingServer: true, timeout: 30_000 } : undefined,
});

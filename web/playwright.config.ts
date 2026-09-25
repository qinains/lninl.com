import { defineConfig } from '@playwright/test';

process.env.NO_PROXY = '127.0.0.1,localhost';
process.env.no_proxy = '127.0.0.1,localhost';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4321';
const localPort = baseURL.startsWith('http://127.0.0.1:') ? new URL(baseURL).port : null;

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  use: { baseURL, browserName: 'chromium' },
  webServer: localPort ? { command: `pnpm dev --host 127.0.0.1 --port ${localPort} && node -e 'setInterval(() => {}, 1000000)'`, url: `${baseURL}/`, reuseExistingServer: true, timeout: 30_000 } : undefined,
});

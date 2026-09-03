import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.test for test configuration
const envPath = fs.existsSync(path.resolve(__dirname, '.env.test'))
  ? path.resolve(__dirname, '.env.test')
  : path.resolve(__dirname, 'backend', '.env.test');

dotenv.config({ path: envPath, override: true });

const BACKEND_PORT = process.env.PORT || '5001';
const FRONTEND_PORT = process.env.FRONTEND_PORT || '5174';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }],
  ],
  globalSetup: path.resolve(__dirname, 'e2e/support/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, 'e2e/support/global-teardown.ts'),
  use: {
    baseURL: FRONTEND_URL,
    extraHTTPHeaders: {
      Origin: FRONTEND_URL,
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run isolated test backend and frontend servers before tests execute
  webServer: [
    {
      command: 'bun run dev:test',
      cwd: path.resolve(__dirname, 'backend'),
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'bun run dev:test',
      cwd: path.resolve(__dirname, 'frontend'),
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        VITE_API_TARGET: BACKEND_URL,
      },
    },
  ],
});

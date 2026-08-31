import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.test for test configuration
const envPath = fs.existsSync(path.resolve(__dirname, '.env.test'))
  ? path.resolve(__dirname, '.env.test')
  : path.resolve(__dirname, 'backend', '.env.test');

dotenv.config({ path: envPath, override: true });

const BACKEND_PORT = process.env.PORT || '5000';
const FRONTEND_PORT = '5173';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  globalSetup: path.resolve(__dirname, 'e2e/support/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, 'e2e/support/global-teardown.ts'),
  use: {
    baseURL: FRONTEND_URL,
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
      command: 'bun run dev',
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

import { FullConfig } from '@playwright/test';
import { setupTestDatabase } from '../../backend/scripts/setup-test-db.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

export default async function globalSetup(config: FullConfig) {
  console.log('\n🚀 [Playwright Global Setup] Starting test environment initialization...');

  // Ensure .env.test is loaded
  const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.test'))
    ? path.resolve(process.cwd(), '.env.test')
    : path.resolve(process.cwd(), 'backend', '.env.test');

  dotenv.config({ path: envPath, override: true });

  // Initialize and seed the isolated test database
  try {
    await setupTestDatabase({ reset: false, seed: true });
    console.log('✅ [Playwright Global Setup] Test database initialized successfully.\n');
  } catch (error) {
    console.error('❌ [Playwright Global Setup] Failed to initialize test database:', error);
    throw error;
  }
}

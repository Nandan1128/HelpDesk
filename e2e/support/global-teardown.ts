import { FullConfig } from '@playwright/test';
import { disconnectTestDatabase } from './db.js';

export default async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 [Playwright Global Teardown] Cleaning up test resources...');
  try {
    await disconnectTestDatabase();
    console.log('✅ [Playwright Global Teardown] Cleanup complete.\n');
  } catch (error) {
    console.error('⚠️ [Playwright Global Teardown] Error during cleanup:', error);
  }
}

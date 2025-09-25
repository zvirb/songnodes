import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 SongNodes E2E Test Teardown...');

  // Clean up any test data if needed
  // For now, we'll keep screenshots and reports for debugging

  console.log('✅ SongNodes E2E Test Teardown Complete');
}

export default globalTeardown;
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the Vite dev server pointed at the Firebase emulators
 * (started by `npm run test:e2e`, which also seeds the emulator owner).
 * Tests share emulator state, so they run serially.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_FIREBASE_API_KEY: 'fake-emulator-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'personal-budget-demo.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'personal-budget-demo',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_OWNER_UID: 'emulator-owner-uid',
      VITE_ENABLE_APP_CHECK: 'false',
      VITE_USE_FIREBASE_EMULATORS: 'true',
    },
  },
});

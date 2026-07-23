import { defineConfig } from 'vitest/config';

/** Firestore rules tests run in node against the emulator (see npm run test:rules). */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});

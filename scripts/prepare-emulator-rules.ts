import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Rules and E2E tests run against the emulator with a known owner UID.
 * This swaps the production placeholder for it, into a gitignored copy.
 */
const EMULATOR_OWNER_UID = 'emulator-owner-uid';

const rules = readFileSync('firestore.rules', 'utf8');
if (!rules.includes('YOUR_FIREBASE_OWNER_UID')) {
  console.warn('firestore.rules has no YOUR_FIREBASE_OWNER_UID placeholder — copying as-is.');
}
writeFileSync(
  'firestore.emulator.rules',
  rules.replaceAll('YOUR_FIREBASE_OWNER_UID', EMULATOR_OWNER_UID),
);
console.log(`Wrote firestore.emulator.rules (owner: ${EMULATOR_OWNER_UID})`);

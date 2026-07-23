import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Rules and E2E tests run against the emulator with a known owner UID.
 * This swaps the owner literal — whether it's still the YOUR_FIREBASE_OWNER_UID
 * placeholder or an already-configured real UID — into a gitignored copy.
 */
const EMULATOR_OWNER_UID = 'emulator-owner-uid';

const rules = readFileSync('firestore.rules', 'utf8');
const ownerLiteral = /request\.auth\.uid == "[^"]+"/;
if (!ownerLiteral.test(rules)) {
  throw new Error(
    'firestore.rules has no `request.auth.uid == "<owner>"` check — refusing to write emulator rules.',
  );
}
writeFileSync(
  'firestore.emulator.rules',
  rules.replace(ownerLiteral, `request.auth.uid == "${EMULATOR_OWNER_UID}"`),
);
console.log(`Wrote firestore.emulator.rules (owner: ${EMULATOR_OWNER_UID})`);

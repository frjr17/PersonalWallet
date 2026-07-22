# Security

- Replace `YOUR_FIREBASE_OWNER_UID` in `firestore.rules` before deployment.
- Set the same UID in `VITE_FIREBASE_OWNER_UID`. Client checking improves UX; rules provide enforcement.
- Keep deny-by-default rules, Google-only production authentication, and Firebase App Check enabled in production.
- Firebase web configuration is public metadata, but never commit service-account keys, tokens, `.env`, or financial backup files.
- Offline persistence stores readable financial data in the browser profile. Enable it only on a trusted, encrypted device and sign out before sharing the browser profile.
- Backups contain the entire ledger. Store them encrypted and test recovery periodically.
- Keep credit limits positive and remember that credit-card debt is stored as a negative signed balance. Firestore rules allow liability balances but continue to require positive transaction amounts and positive optional credit limits.

## Emulator rule isolation

`npm run test:rules` and `npm run test:e2e` first generate `.firebase/firestore.test.rules` from the production source and run with `firebase.test.json` against `personal-budget-demo`. Only the generated, ignored copy receives the deterministic emulator owner placeholder; `firestore.rules` is never edited by the test scripts. Rules unit tests additionally substitute their `owner-test` UID in memory.

Do not deploy with `firebase.test.json`, the demo project ID, or `.firebase/firestore.test.rules`. Production deployment must continue to use `firebase.json` and the explicitly configured owner UID in `firestore.rules`.

App Check reduces abuse but does not replace Authentication or Security Rules. This client-only architecture cannot protect data from malware or another person who controls an already unlocked owner device.

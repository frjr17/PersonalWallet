# Personal Ledger

A private, responsive personal-budget PWA for accounts, income, expenses, transfers, category budgets, recurring entries, reports, CSV import, and versioned backups. It is a static React application designed for Firebase's free Spark plan—there is no custom backend, bank connection, Cloud Function, Storage dependency, or paid API.

## Architecture and stack

React, Vite, strict TypeScript, React Router, Tailwind/shadcn-style primitives, React Hook Form, Zod, Recharts, date-fns, Firebase Auth/Firestore/App Check/Hosting, vite-plugin-pwa, Vitest, Testing Library, Playwright, and the Firebase Emulator Suite. See [ARCHITECTURE.md](./ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md).

Money is stored as integer minor units. Transactions and linked two-leg transfers change account balances with atomic Firestore batches. Reports exclude transfers. Monthly screens share one bounded transaction query. Recurring entries are never posted automatically: due occurrences must be confirmed or skipped.

## Everyday workflows

The entry screen is designed for quick direct input. Expense, income, and transfer are visible choices; accounts and categories are selectable cards rather than dropdowns. Categories show their complete nested path and can be searched. The amount control includes a keypad calculator with exact addition, subtraction, multiplication, division, and decimal arithmetic, so a calculation can be completed before the final amount is saved. Transfer is unavailable until at least two active accounts exist, and the source account cannot also be selected as its destination.

Categories have their own management screen. Income and expense trees can be created, renamed, moved beneath another category, nested to any depth, archived, and restored. Parent validation prevents cross-type parenting and cycles. Archiving a parent hides its entire subtree from new-entry choices while every category remains available to historical records.

Accounts can be created and edited. Savings is an asset account, while a credit card is a liability: an opening amount owed is stored as a negative balance, expenses increase the debt, and a transfer into the card is a payment. Credit cards may also have a positive credit limit; available credit is the limit plus the signed current balance. The interface presents these as “Amount owed,” “Available,” and “Credit limit” instead of showing liability storage details. An account's type is fixed after creation so existing balance history cannot be reinterpreted accidentally.

Theme controls in Settings offer light, dark, and system modes. Dark mode uses a true near-black base, follows operating-system changes when set to system, and remembers the preference on the device to avoid a mismatched first frame.

## Fedora setup

Install Node.js 20.19+ and Java 21 (needed by Firestore Emulator), then:

```bash
sudo dnf install java-21-openjdk
npm install
cp .env.example .env.local
npm run dev
```

Useful commands:

```bash
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:rules
npm run test:e2e
npx firebase-tools login
npx firebase-tools emulators:start
npx firebase-tools deploy
```

## Firebase project setup

1. Create a Firebase project and choose the no-cost Spark plan.
2. Add a Web app. Copy its public configuration values into `.env.local`; do not commit that file.
3. In Authentication, enable Google only. Add local and production Hosting domains under authorized domains. There is no registration page.
4. Create Firestore in production mode in the region closest to you.
5. Sign in once or inspect Authentication users to retrieve your Google account UID.
6. Replace every `YOUR_FIREBASE_OWNER_UID` in `firestore.rules` with that UID, retaining the quotes. Set the same UID as `VITE_FIREBASE_OWNER_UID`.
7. Deploy Firestore configuration with `npx firebase-tools deploy --only firestore`. The checked-in index manifest intentionally contains no composite indexes: every current query needs only Firestore's automatic single-field indexes.
8. Build and deploy static Hosting with `npm run deploy` or `npx firebase-tools deploy --only hosting` after `npm run build`.

Required environment variables are documented in `.env.example`. Firebase web values are not server secrets, but production project configuration is intentionally not committed. `VITE_USE_FIREBASE_EMULATORS=true` must never be used for a production build.

## Local emulators and demo data

Start emulators in one terminal:

```bash
npx firebase-tools emulators:start
```

Set these local values and restart Vite:

```dotenv
VITE_FIREBASE_PROJECT_ID=personal-budget-demo
VITE_FIREBASE_OWNER_UID=YOUR_FIREBASE_OWNER_UID
VITE_USE_FIREBASE_EMULATORS=true
```

Then seed only the emulators:

```bash
npm run seed:emulator
```

The development-only login is `owner@example.test` / `local-ledger-owner`, exposed as an emulator button. Its UID intentionally matches the undeployed rules placeholder. It is unavailable when emulator mode is false. The seed script never targets production and creates cash, checking, savings, and credit-card accounts, a nested category example, a budget, and recurring income/expense templates.

## App Check

Create a reCAPTCHA Enterprise provider for the web app in Firebase Console, register the production domain, set `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, and set `VITE_ENABLE_APP_CHECK=true` only in production. Use Firebase's documented App Check debug token workflow for local testing if necessary; normal emulator development leaves App Check disabled. Enable enforcement only after production requests show valid tokens. App Check complements—never replaces—rules.

## Offline and PWA behavior

The app initially uses memory-only Firestore caching. After sign-in, enable persistent caching in Settings only on a trusted device; the app reloads and uses multi-tab persistence. The service worker caches static assets and navigation only, not Firestore responses. A status chip indicates offline use and Firestore queues supported writes. Balance recalculation and destructive restore require a connection.

Install the app from the browser's install action. When a new build is available, the in-app update prompt reloads it. The supplied SVG is a functional maskable icon; replace it with branded PNG sizes if an app store requires raster assets.

## Tests

`npm test` runs pure domain and component tests. `npm run test:rules` starts Firestore Emulator around owner/denial/validation tests. `npm run test:e2e` starts and seeds Auth and Firestore emulators automatically; install browsers once with `npx playwright install chromium`.

Both emulator commands run `npm run prepare:test-rules` first. That command derives `.firebase/firestore.test.rules` from the committed production rules, substitutes only the emulator owner placeholder, and uses the isolated `firebase.test.json` configuration with the demo project. It never rewrites `firestore.rules`. Rules unit tests perform their own in-memory owner substitution as an additional isolation boundary. Always run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before deployment.

## Backups and recovery

Settings → Backup and restore downloads schema-version-1 JSON. Backups contain sensitive financial data; encrypt them outside the app. Restore validates the schema and previews counts. Merge updates matching IDs after confirmation. Replace automatically downloads the current ledger first, then deletes and restores in batches of 400. Because large Firestore restores cannot be globally atomic, keep the automatic pre-restore file until the ledger is verified.

CSV import parses locally, maps date/description/amount columns, validates rows, computes deterministic fingerprints, flags probable duplicates, and lets you exclude rows. Imports use batches below Firestore's 500-operation limit and record metadata without uploading the source file.

## Spark-plan considerations

Hosting serves static files; all calculations run in the browser. Dashboard queries are bounded by month and reused across cards. There are no real-time unbounded transaction listeners or derived report documents. Full collection reads occur only for explicit backup, restore, duplicate review, and balance maintenance. Monitor Firestore usage in Firebase Console and avoid excessively broad report/export ranges.

## Troubleshooting

- **Permission denied:** the signed-in UID, `VITE_FIREBASE_OWNER_UID`, and rules literal must match; deploy the updated rules.
- **`this index is not necessary` during deploy:** use the checked-in empty `firestore.indexes.json` and redeploy. The removed transaction definitions duplicated automatic single-field indexes and caused Firestore's HTTP 400 response.
- **A future query reports a missing index:** use the generated Firebase Console link to add only that query's required composite index, commit the exported manifest, and deploy again.
- **Google popup blocked:** allow popups and confirm the current host is an authorized domain.
- **Emulator login fails:** start Auth and Firestore emulators, run the seed script, and restart Vite with emulator variables.
- **Offline cache unavailable:** another tab or browser mode may prevent IndexedDB; close private tabs and reload.
- **App Check rejected:** disable enforcement while validating registration, domain, site key, and debug-token setup.
- **Rules/E2E tests fail to start:** verify Java 21, ports 8080/9099, and installed Playwright Chromium.

## Known limitations

This is a single-currency MVP even though the currency setting and account field are configurable; currency conversion is intentionally absent. Search is local to the selected bounded month. Skipped recurring occurrences are not retained as a separate audit log. Restore batches report failures but cannot offer server-side transactional rollback. Client-side protection cannot secure an already compromised owner device.

Linked transfers must be deleted and recreated to change them. The rollover calculation primitive is tested, but the budget screen does not yet fetch and apply the preceding month's unused amount. Reports use the shared selected month rather than an arbitrary custom range. CSV mapping currently focuses on date, description, and a single signed amount column. “Clear local application data” clears app preferences and signs out; clearing an already-created Firestore IndexedDB cache may also require clearing this site's storage in the browser.

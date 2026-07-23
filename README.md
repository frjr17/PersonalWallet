# Pocket Ledger

A private, offline-ready personal budgeting PWA for exactly one person: you. Accounts,
income/expense/transfer tracking, categories, monthly budgets, recurring transactions,
reports, CSV import, and JSON backups — all on Firebase's free Spark plan, with no
backend servers, no bank connections, and no third-party data sharing.

Built with React 19, Vite 7, TypeScript (strict), Tailwind CSS v4, shadcn/ui,
React Hook Form + Zod, Recharts, date-fns, and the Firebase Web SDK.

## Contents

1. [Product overview](#product-overview)
2. [Architecture](#architecture)
3. [Technology stack](#technology-stack)
4. [Fedora setup](#fedora-setup)
5. [Create the Firebase project](#create-the-firebase-project)
6. [Configure Google Authentication](#configure-google-authentication)
7. [Create the Firestore database](#create-the-firestore-database)
8. [Find your owner UID](#find-your-owner-uid)
9. [Put the owner UID into the Firestore rules](#put-the-owner-uid-into-the-firestore-rules)
10. [Environment variables](#environment-variables)
11. [Emulator Suite](#emulator-suite)
12. [Local development](#local-development)
13. [Running tests](#running-tests)
14. [Building](#building)
15. [Deploying to Firebase Hosting](#deploying-to-firebase-hosting)
16. [App Check](#app-check)
17. [Deploying Firestore indexes](#deploying-firestore-indexes)
18. [Backup and recovery](#backup-and-recovery)
19. [Spark-plan cost notes](#spark-plan-cost-notes)
20. [Security limitations](#security-limitations)
21. [Troubleshooting](#troubleshooting)

## Product overview

- **Accounts** — cash, checking, savings, credit cards, investments, loans. Archive
  instead of delete; balances always derive from an opening balance plus history.
- **Transactions** — income, expenses, and transfers (two linked documents, one shared
  `transferId`). Every write that moves money commits the transaction document and the
  account balance update in one atomic batch.
- **Categories** — seeded with sensible defaults on first sign-in; income and expense
  types are enforced (an expense can never use an income category).
- **Budgets** — monthly per-category limits with warning (default 80%) and exceeded
  states.
- **Recurring** — templates surface as _due_ items you confirm or skip; nothing posts
  automatically (no Cloud Functions on the Spark plan). Month-end dates stay anchored:
  Jan 31 → Feb 28 → Mar 31.
- **Reports** — cash flow, category breakdowns, trends, budget performance, savings
  rate; filtered CSV export.
- **CSV import** — local parsing, column mapping, date-format choice, validation,
  fingerprint-based duplicate review, batched import.
- **Backup** — versioned JSON export; validated restore with merge/replace modes and an
  automatic safety backup before any replace.
- **Offline** — Firestore persistent cache (multi-tab); writes queue while offline and
  sync on reconnect. Installable PWA with an update prompt.
- **Money** — every amount is an integer in minor units (1250 = $12.50). Binary floats
  never touch stored money.

## Architecture

```
src/
├── app/            App, router, providers, DataProvider (bounded live queries)
├── components/     charts, layout, ui (shadcn), Money, CategoryIcon
├── features/       authentication, accounts, transactions, categories, budgets,
│                   recurring, dashboard, reports, imports, backups, settings
├── lib/            firebase.ts, money.ts, dates.ts, ledger.ts (pure balance math),
│                   validation.ts (env), errors.ts, theme.tsx, categories.ts
├── services/       repositories.ts (all Firestore I/O), finance.ts (atomic ledger ops),
│                   budgets.ts, reports.ts, csv.ts, backup.ts
└── types/          domain models + Zod schemas
```

Key rules:

- **All Firestore access lives in `src/services/`.** Components never contain Firestore
  logic; they call services and read from the `DataProvider` context.
- **One bounded listener per collection** for the selected month. Dashboard, budgets,
  and reports derive everything in memory from that snapshot — no per-card queries.
- **Balance math is pure** (`src/lib/ledger.ts`) and unit-tested; `services/finance.ts`
  turns delta maps into atomic `writeBatch` commits with `increment()`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture and
[SECURITY.md](SECURITY.md) for the security model.

## Technology stack

React 19 · Vite 7 · TypeScript 5.8 (strict) · React Router 7 · Tailwind CSS 4 ·
shadcn/ui (vendored) · React Hook Form 7 · Zod 4 · Recharts 3 · date-fns 4 ·
Firebase JS SDK 12 (Auth, Firestore, App Check) · vite-plugin-pwa · PapaParse ·
Vitest 3 · React Testing Library · Playwright · Firebase Emulator Suite ·
firebase-tools.

## Fedora setup

```bash
# Node.js 20.19+ (Node 22/24 also fine)
sudo dnf install nodejs

# Java is required by the Firebase emulators
sudo dnf install java-21-openjdk-headless

git clone <your-repo-url> wallet && cd wallet
npm install
npx playwright install chromium   # for E2E tests
```

## Create the Firebase project

1. Open <https://console.firebase.google.com> → **Add project**.
2. Name it (e.g. `pocket-ledger`). Analytics is not needed — disable it.
3. In **Project settings → Your apps**, add a **Web app** (`</>` icon). Skip Hosting
   setup here; the CLI handles it.
4. Copy the config values shown (`apiKey`, `authDomain`, `projectId`, `appId`,
   `messagingSenderId`) — you need them for `.env.local`.
5. Put your project id in `.firebaserc` (replace `personal-budget-demo`).

## Configure Google Authentication

1. Console → **Authentication → Get started**.
2. **Sign-in method** → enable **Google**. Set a support email.
3. That's the only provider. The app has no registration flow — the login screen offers
   "Continue with Google" and nothing else.

## Create the Firestore database

1. Console → **Firestore Database → Create database**.
2. Choose **Production mode** (rules deny everything until you deploy yours).
3. Pick a region near you (e.g. `us-east1`). This cannot be changed later.

## Find your owner UID

1. Fill `.env.local` (next section) with a temporary `VITE_FIREBASE_OWNER_UID=pending`.
2. `npm run dev`, sign in with your Google account once. The app will sign you out
   (you're not the owner yet) — that's expected.
3. Console → **Authentication → Users** → copy the **User UID** of your account.

## Put the owner UID into the Firestore rules

`firestore.rules` hardcodes the owner because rules cannot read environment variables:

```
&& request.auth.uid == "YOUR_FIREBASE_OWNER_UID";
```

Replace `YOUR_FIREBASE_OWNER_UID` with your real UID **before deploying rules**, and put
the same UID in `.env.local` as `VITE_FIREBASE_OWNER_UID`. Do not commit the real UID —
keep the placeholder in git and patch it at deploy time (or keep a local uncommitted
change).

Deploy the rules:

```bash
npx firebase-tools deploy --only firestore:rules
```

The client-side check is a courtesy; **the rules are the enforcement**. Never rely on
client-side protection alone.

## Environment variables

```bash
cp .env.example .env.local
```

| Variable                                                      | Purpose                                          |
| ------------------------------------------------------------- | ------------------------------------------------ |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_MESSAGING_SENDER_ID` | Web app config from the console                  |
| `VITE_FIREBASE_OWNER_UID`                                     | Your Auth UID; the client refuses other accounts |
| `VITE_ENABLE_APP_CHECK`                                       | `true` to enable App Check (see below)           |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`                          | reCAPTCHA Enterprise key for App Check           |
| `VITE_USE_FIREBASE_EMULATORS`                                 | `true` to point the app at local emulators       |

`.env*` files are gitignored. Firebase web config values are not server secrets, but
don't commit them anyway.

## Emulator Suite

```bash
npx firebase-tools login          # once
npm run emulators                 # Auth + Firestore + Hosting + UI on :4000
```

For a fully local sandbox (no real Firebase project needed):

```bash
# .env.local
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_OWNER_UID=emulator-owner-uid
VITE_FIREBASE_PROJECT_ID=personal-budget-demo
# any non-empty values for the rest

npm run emulators        # terminal 1
npm run seed:emulator    # terminal 2 — creates the emulator owner + sample data
npm run dev              # terminal 2
```

The login screen shows an extra **"Emulator owner (local only)"** button when
`VITE_USE_FIREBASE_EMULATORS=true` (credentials created by the seed script). The seed
script refuses to run against production — it hardcodes emulator hosts.

## Local development

```bash
npm run dev          # http://localhost:5173
npm run lint
npm run typecheck
npm run format
```

## Running tests

```bash
npm run test         # unit + component tests (Vitest, no emulator needed)
npm run test:watch
npm run test:rules   # Firestore security rules tests (starts the emulator itself)
npm run test:e2e     # Playwright E2E (starts emulators + seeds + dev server itself)
```

`test:rules` and `test:e2e` generate `firestore.emulator.rules` (the placeholder swapped
for the emulator owner UID) — that file is gitignored.

## Building

```bash
npm run build        # tsc -b && vite build → dist/
npm run preview      # serve the production build locally
```

## Deploying to Firebase Hosting

```bash
npm run build
npx firebase-tools login
npx firebase-tools deploy        # hosting + firestore rules + indexes
```

Hosting serves `dist/` with SPA rewrites to `index.html`, immutable caching for hashed
assets, and no-cache for `index.html` and `sw.js` (so PWA updates arrive promptly).

Remember: the deployed `firestore.rules` must contain your real owner UID, not the
placeholder.

## App Check

App Check adds device attestation on top of the rules (it complements them, never
replaces them).

1. Console → **App Check** → register your web app with **reCAPTCHA Enterprise**
   (create the key in Google Cloud → Security → reCAPTCHA, type "website", your hosting
   domain).
2. Set `VITE_ENABLE_APP_CHECK=true` and `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<key>`.
3. Start with **monitoring** (unenforced), confirm traffic is verified, then click
   **Enforce** for Firestore.

Local development: with App Check enabled in dev, the app sets
`FIREBASE_APPCHECK_DEBUG_TOKEN = true`; the browser console prints a debug token —
register it under App Check → Apps → Manage debug tokens. Leaving
`VITE_ENABLE_APP_CHECK=false` locally also works and breaks nothing.

## Deploying Firestore indexes

The composite index (`transactions`: `accountId ASC, occurredAt DESC`) ships in
`firestore.indexes.json`:

```bash
npx firebase-tools deploy --only firestore:indexes
```

If you ever see a Firestore "index required" error with a console link, add the index
to `firestore.indexes.json` (keep it in git) rather than only clicking the link.

## Backup and recovery

- **Export**: Settings → Backup → _Download backup_. One JSON file containing settings,
  accounts, categories, transactions, budgets, and recurring templates
  (`schemaVersion: 1`). Store it privately — it is your full financial history.
- **Restore**: pick the file → the app validates it with Zod (wrong versions and
  malformed files are rejected) → review the counts → choose:
  - **Merge** — upsert by document id, keep everything else.
  - **Replace** — deletes current data first. Requires explicit confirmation and
    automatically downloads a safety backup of the current data before deleting.
- Restores run in batched writes below Firestore's limit; a failure stops with a clear
  count of what was written — nothing is silently overwritten.
- After odd interruptions you can run Settings → _Recalculate balances_ to recompute
  every account from its opening balance + history (with a preview before applying).
- Suggested habit: export a backup monthly and after large imports.

## Spark-plan cost notes

Everything here fits the free Spark plan: Hosting (10 GB storage / 360 MB/day),
Firestore (1 GiB storage, 50k reads / 20k writes / 20k deletes per day), Auth, App
Check. A single user recording even dozens of transactions a day stays far below these
quotas. The app is deliberately read-frugal: one bounded query set per month view,
paged history lists, no unbounded listeners, no derived-report documents. There are no
Cloud Functions, no Cloud Storage, no paid APIs.

If you ever see quota warnings, check for a tab left open on the Reports page with a
very wide custom range.

## Security limitations

Read [SECURITY.md](SECURITY.md). The short version:

- Firestore rules restrict every read/write to your UID — that is the real boundary.
- The client-side owner check is UX, not security.
- Offline persistence stores your financial data unencrypted in the browser's
  IndexedDB. Use trusted devices, OS-level disk encryption, and Settings → _Clear local
  data_ before disposing of a device.
- Anyone who can sign in to your Google account can open your ledger — protect it with
  2FA.
- Backups are plaintext JSON. Encrypt them at rest if you store them in the cloud.

## Troubleshooting

| Symptom                                         | Fix                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Invalid Firebase configuration (…)` on startup | `.env.local` missing or incomplete — copy `.env.example` and fill it in                                  |
| Signed in, immediately signed out               | Your UID ≠ `VITE_FIREBASE_OWNER_UID` (or ≠ the UID in deployed rules)                                    |
| `permission-denied` from Firestore              | Deployed rules still contain the placeholder, or UID mismatch                                            |
| Emulator UI never starts                        | Java missing: `sudo dnf install java-21-openjdk-headless`                                                |
| "Emulator owner" button does nothing            | Run `npm run seed:emulator` first (the user must exist)                                                  |
| Firestore "requires an index" error             | `npx firebase-tools deploy --only firestore:indexes`                                                     |
| Offline changes didn't sync                     | Check the Online/Offline pill in the shell; reconnect and leave the app open briefly                     |
| PWA shows stale version                         | The update toast appears when a new SW is ready; click **Update** (index.html/sw.js are served no-cache) |
| E2E tests can't start the web server            | Port 5173 in use — stop the other dev server                                                             |

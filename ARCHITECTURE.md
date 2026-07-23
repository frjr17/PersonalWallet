# Architecture

Single-user budgeting PWA. React SPA + Firestore, no backend of our own. The design
optimizes for three things: **balance integrity**, **offline correctness**, and
**staying inside Spark-plan quotas**.

## Layers

```
Pages (features/*)          UI only — forms, lists, charts
   │  read via context / call services
DataProvider (app/)         bounded live queries for the selected month
Services (services/*)       every Firestore read/write; atomic ledger operations
Pure libs (lib/*)           money, dates, balance deltas — no Firebase imports
Firebase (lib/firebase.ts)  app init, auth, Firestore w/ persistent cache, App Check
```

- Components never touch Firestore directly. They call `services/*` or read the
  `DataProvider` context.
- `lib/ledger.ts` is the single source of truth for how transactions move balances.
  It is pure (importable without Firebase) and unit-tested; `services/finance.ts`
  converts its delta maps into `writeBatch` + `increment()` commits.

## Data model (Firestore)

```
users/{uid}
├── settings/profile          currency, locale, timeZone, weekStartsOn, flags
├── accounts/{id}             opening + current balance in integer minor units
├── categories/{id}           income|expense, icon, optional parent, archived
├── transactions/{id}         income|expense|transfer docs; occurredAt Timestamp
├── budgets/{period_catId}    deterministic id → one budget per category per month
├── recurringTransactions/{id} template + nextOccurrence + anchorDay
└── imports/{id}              CSV import metadata
```

### Transfers

A transfer is **two documents sharing a `transferId`**:

- outgoing leg: `accountId = source`, `destinationAccountId = destination`
- incoming leg: `accountId = destination`, no `destinationAccountId`

The leg's effect on its own account is derived from that shape (`legEffect`). Account
history is a single equality query per account; edits/deletes load the pair by
`transferId` and commit both legs + both balance updates in one batch. Transfers are
excluded from every income/expense aggregate.

### Money

All amounts are integers in minor units. Parsing goes string → integer without ever
using binary floats (`lib/money.ts`). Display uses `Intl.NumberFormat` via the `Money`
component (passbook style: small raised cents, red/green bookkeeping ink, sr-only full
text for screen readers).

## Balance integrity

Every mutation that moves money is one atomic batch:

| Operation                   | Batch contents                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| create entry                | set txn doc + increment(account, ±amount)                                                            |
| edit entry                  | update doc + increment(reverse original) + increment(apply new) — collapsed to one write per account |
| delete                      | delete doc(s) + reversing increments                                                                 |
| transfer create/edit/delete | both legs + both account increments                                                                  |
| recurring confirm           | set txn + increment + advance `nextOccurrence`                                                       |
| CSV import                  | ≤400 ops per batch, each chunk carries its own balance increment                                     |

Validation (positive integer amounts, existing non-archived accounts, category-type
match, distinct transfer accounts) runs against the in-memory context **before** the
batch, so writes work offline (Firestore queues batches; `runTransaction` would not).

The Settings → "Recalculate balances" action recomputes every account from opening
balance + full history, shows a preview, and only then writes corrections.

## Query strategy (Spark frugality)

`DataProvider` holds exactly six listeners: settings, accounts, categories, month's
transactions (`occurredAt` range), month's budgets (`period ==`), recurring. Dashboard,
budgets and the month views derive everything in memory. Other screens use bounded
ad-hoc queries:

- Transactions/account history: `orderBy occurredAt desc, limit(page × 50)` with
  optional date-range clauses (live via `onSnapshot`, bounded by the limit).
- Reports: one `getDocs` range fetch (range start → today, so balance trends can walk
  backward from current balances), plus one budgets range query on the `period` string.
- Composite index: `transactions (accountId ASC, occurredAt DESC)` — everything else
  rides single-field indexes.

No collection-wide listeners, no per-card queries, no derived report documents.

## Recurring without Cloud Functions

Templates store `frequency`, `interval`, `nextOccurrence`, and `anchorDay` (the
intended day-of-month). Due items (`nextOccurrence <= now`) surface on the dashboard
and Recurring page; the user confirms (creates the real transaction atomically) or
skips. Advancement uses date-fns and re-anchors monthly schedules so Jan 31 → Feb 28 →
Mar 31 instead of drifting to the 28th. When `endDate` passes, the template
deactivates itself.

## Offline & PWA

- Firestore `persistentLocalCache` with `persistentMultipleTabManager` — data and
  queued writes live in IndexedDB; the SDK owns sync.
- The service worker (vite-plugin-pwa, `generateSW`) precaches the app shell only.
  Firestore traffic is never cached by the SW.
- `registerType: 'prompt'` + a toast with an **Update** action when a new version is
  waiting.
- Online/offline indicator (`navigator.onLine`), first-use warning about on-device
  storage, and a "Clear local data" action (terminates Firestore, clears IndexedDB
  persistence and localStorage, reloads).

## State management

React context only: `AuthProvider` (owner-gated Firebase auth), `ThemeProvider`
(light/dark/system in localStorage), and `DataProvider` (settings + ledger month
data). No Redux, no TanStack Query — Firestore's listeners already are the cache.

## Testing

- **Unit (Vitest)** — money parsing/formatting, date/recurrence math, balance delta
  maps (create/edit/delete/transfer), budget status, report aggregations, CSV
  normalization + fingerprints, backup validation. All pure modules, no emulator.
- **Component (RTL)** — login screen, transaction form (type switching, validation,
  minor-unit parsing) with mocked services.
- **Rules (@firebase/rules-unit-testing)** — deny unauthenticated/strangers/foreign
  paths, allow owner, reject invalid documents. Runs inside `firebase emulators:exec`.
- **E2E (Playwright)** — sign-in, account/expense/income/transfer creation, edit +
  delete with balance assertions, budget creation, backup download. Runs against
  emulators with a seeded owner; serial (tests share state).

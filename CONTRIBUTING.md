# Contributing

Personal project, but future-me counts as a contributor. House rules:

## Workflow

```bash
npm install
npm run dev            # develop against emulators (see README → Emulator Suite)
npm run typecheck && npm run lint && npm run test   # before every commit
npm run test:rules     # whenever firestore.rules changes
npm run test:e2e       # before releases / risky refactors
npm run format         # prettier writes; CI-equivalent is format:check
```

## Code rules

- TypeScript strict; no `any` unless technically unavoidable — and then commented.
- Money is integer minor units everywhere. New money math goes through `lib/money.ts`
  / `lib/ledger.ts`; never introduce float arithmetic on amounts.
- All Firestore access lives in `src/services/`. Components stay I/O-free.
- Every write that moves money must be one atomic batch (see `services/finance.ts`).
  If you add a mutation, add its delta function to `lib/ledger.ts` and a unit test.
- Zod-validate anything that crosses a boundary: forms, Firestore docs, CSV rows,
  backup files, env vars.
- Keep queries bounded (range + limit). New composite indexes go into
  `firestore.indexes.json`, not just the console.
- UI: semantic HTML, labeled controls, keyboard focus visible, works in light and
  dark, empty/loading/error states for every screen.
- No new dependencies for what a few lines can do. No dead code, no commented-out
  code.

## Commits

Small, focused, present-tense messages ("add budget rollover badge"). Run the check
trio first. Never commit `.env*` (except `.env.example`), backups, or a real owner
UID (the rules file keeps the `YOUR_FIREBASE_OWNER_UID` placeholder in git).

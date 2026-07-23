# Security model

This is a single-owner application holding personal financial data. The design goal:
even with the client fully compromised or modified, **only the configured owner UID can
read or write anything**.

## Layers

1. **Firestore Security Rules (the real boundary).** Deny-by-default. Every rule
   requires `request.auth != null`, `request.auth.uid == {uid}` (the path segment), and
   `request.auth.uid == "<owner uid>"` (hardcoded — rules cannot read env vars). Any
   other path is matched by a final `allow read, write: if false`. The rules also
   validate document shapes: enum fields, integer money, positive amounts, budget
   thresholds in [0, 1]. Tested in `tests/rules/`.
2. **Client-side owner gate (UX only).** `AuthProvider` signs out any UID that doesn't
   match `VITE_FIREBASE_OWNER_UID` and the popup flow surfaces a clear message. This
   prevents confusion, not attacks.
3. **Google-only sign-in.** No password database, no registration flow, no email
   enumeration surface. Protect the Google account itself with 2FA — anyone in your
   Google account is in your ledger.
4. **App Check (optional).** reCAPTCHA Enterprise attestation for requests, feature-
   flagged via env. It raises the bar against abusive scripted traffic; it does not
   replace rules.

## Data at rest

- **Firestore**: encrypted at rest by Google; access constrained by the rules above.
- **This device**: offline persistence keeps a copy of your data in IndexedDB,
  unencrypted at the app layer (standard for Firestore web persistence). Mitigations:
  the first-use warning, the Settings → "Clear local data" action, and the
  documentation stance that the app belongs on trusted, disk-encrypted, locked
  devices only.
- **Backups**: plaintext JSON by design (they must survive the app). Store them like
  bank statements; encrypt if kept in cloud storage.

## What is deliberately out of scope

- Multi-user sharing, roles, or delegation — one UID, period.
- Server-side secrets — there is no server; the Firebase web config is public by
  design and safe to expose (the rules are the boundary).
- End-to-end encryption — would break Firestore queries this app relies on; the
  threat model is "stranger on the internet", not "malicious cloud provider".

## Operational rules

- Never commit: `.env.local`, real owner UIDs, service-account keys, auth tokens, or
  backup files (`*.backup.json` is gitignored).
- Never log: tokens, credentials, full backups, or note contents (`lib/errors.ts`
  keeps logging scoped).
- Rules changes require running `npm run test:rules` before deploying.

## Reporting

This is a personal project for a single user. If you fork it and find a security
problem, fix it in your fork and consider opening an issue on the source repository.

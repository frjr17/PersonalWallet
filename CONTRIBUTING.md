# Contributing

Use Node 20.19 or newer and npm. Keep strict TypeScript, repository-based Firebase access, integer minor-unit money, bounded queries, accessible labels, and owner-only rules.

Before submitting changes run:

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

Run emulator and Playwright suites for changes involving Firebase or user workflows. Never add production credentials or real financial exports to fixtures.

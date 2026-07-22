# Architecture

Personal Ledger is a static React PWA. Firebase Authentication establishes identity; Firestore rules independently enforce the single configured owner. All records live beneath `users/{uid}`.

UI routes consume focused authentication and monthly-data contexts. Feature components call repository operations rather than Firestore directly. Repositories use atomic batches and integer balance increments. Pure domain services calculate money, dates, budgets, reports, fingerprints, CSV normalization, and backups.

Transaction entry uses direct-choice controls for type, account, and category rather than coordinating raw values through dropdowns. A local calculator evaluates decimal expressions exactly and exposes only a completed positive amount to form validation. Transfer selection is disabled when fewer than two active accounts are available. Repository validation still enforces distinct, active source and destination accounts, matching currencies, and atomic two-leg balance effects.

Categories form arbitrary-depth income and expense trees through `parentCategoryId`. Domain helpers flatten those trees with stable full paths for entry, budgets, and recurring templates. Category icons persist as semantic IDs from the `CATEGORY_ICON_IDS` allowlist rather than component names or arbitrary text; missing and legacy emoji values normalize to `general` at read and restore boundaries. The editor offers only same-type active parents; repository validation prevents missing or archived parents, self-parenting, and descendant cycles, and revalidates type when an existing category is moved. Editing, reparenting, archiving, and restoring remain repository actions. An archived ancestor makes its subtree unavailable to new entries, while historical transactions continue to resolve every archived category ID and full path.

Account balances use one signed integer representation, with presentation adapted to account type. Cash, checking, savings, and investment balances represent assets. A credit-card opening amount owed and subsequent debt are negative; card expenses reduce the signed balance, while incoming transfers increase it as payments. An optional positive `creditLimitMinor` produces available credit as `creditLimitMinor + currentBalanceMinor`. UI/domain view helpers translate this into amount owed, credit balance, available credit, and credit-limit labels without changing transaction balance rules. Account type is immutable after creation because reclassifying historical signed balances would change their financial meaning.

Dashboard reads are bounded to one selected-month transaction query. Accounts, categories, budgets, and recurring templates are small owned collections. Transaction history uses date bounds; explicit import, backup, restore, and recalculation operations may read full collections.

The service worker caches only the static app shell. Firestore owns financial-data persistence and enables it only after trusted-device consent.

Theme preference is mirrored locally so light, true-black dark, or system mode can be applied before React paints. System mode listens for operating-system changes, and the saved preference is synchronized across tabs.

Production and emulator rule configurations are deliberately separate. `firestore.rules` remains the deployment source. `scripts/prepare-emulator-rules.ts` derives the ignored `.firebase/firestore.test.rules`, replacing the configured owner only in that generated copy; `firebase.test.json` points emulator suites at the copy and the demo project. Test setup therefore never mutates or deploys production rules.

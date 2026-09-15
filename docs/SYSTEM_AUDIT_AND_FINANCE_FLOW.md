# LifeDesk system audit and finance flow

Date: 2026-08-24

## Purpose

This audit records the current product structure, the problems found, the decisions made, and the cleanup performed while simplifying LifeDesk. The main goal is to make common financial actions obvious without risking existing on-device records.

## What was confusing

### Split ownership of money

- The Wallet tab showed balances and lists, but its gear opened `/life`.
- `/life` mixed unrelated Work and Money tabs.
- All useful money forms lived under Life → Money, while Wallet, Activity, Investments, and Plans were mostly read-only.
- The result was a hidden flow for adding income, expenses, BTC/VOO holdings, salary schedules, bills, recurring investments, budgets, and manual prices.

### Duplicate project surfaces

- Life → Work listed projects and created projects.
- `/projects` listed projects again.
- Tasks → Projects listed active projects a third time.
- These surfaces used different visual systems and different empty-state instructions.

### Legacy navigation

- A custom bottom navigation component still treated `/life` as the Wallet destination.
- `/items` duplicated much of the Tasks tab and still used the retired “Quests” name.
- Root-level legacy screens manually recreated bottom navigation instead of belonging to the tab that owned their content.

### Data semantics

- Wallet cash is a ledger balance: income minus expenses and investment contributions. There is no separate editable “wallet total” field.
- A starting cash amount therefore needs to be recorded as income/opening balance.
- Investment current value needs both an owned quantity and a market quote. The recorded amount alone is the cost/contribution, not the current value.
- A transfer type existed even though there is only one wallet/account, so a transfer had no effect on the balance and was misleading as a primary action.

## Product decisions

### Clear domain ownership

- **Wallet** is the only financial home.
- **Activity** owns income and expense entry plus financial history.
- **Investments** owns BTC/VOO purchases, quantities, live refresh, and manual prices.
- **Plans and budgets** owns salary schedules, bills, recurring investments, and category budgets.
- **Tasks → Projects** owns project creation and active project access.
- The mixed Life screen is removed.

### New financial entry flow

From Wallet, frequent actions are visible without opening settings:

1. Add income — including a starting/opening cash balance.
2. Record expense.
3. Add investment — asset, actual quantity, amount paid, and date.
4. Plan month — salary, bills, recurring BTC/VOO contributions, and budgets.

Each action opens the page that owns that record and presents a labeled form. The destination page remains useful after the form closes.

### Automation behavior

- A monthly rule accepts one or more calendar days, such as `15, 30`.
- Day 30 or 31 becomes the last valid day in shorter months.
- Due rules post once when the app opens on or after the scheduled date.
- Pausing or deleting a rule keeps already-posted history.
- Recurring investments require an explicit BTC quantity or VOO share quantity. LifeDesk does not invent a purchase quantity from a changing quote.

### Investment value behavior

- Recorded contribution = amount paid plus fees.
- Estimated current value = owned quantity multiplied by the latest saved quote.
- Twelve Data remains behind the existing backend to protect the API key and conserve the free-tier quota.
- Manual prices remain available if the provider is unavailable.

## Data safety decisions

- Existing SQLite financial records are not deleted by this cleanup.
- No seeded salary, wallet, investment, bill, grocery, task, or project records remain in the application source; a fresh install starts clean.
- Database migrations are retained because existing installations need the complete migration chain.
- The legacy `brain-dump.db` filename is retained. Renaming it without a native file migration would make an existing installation appear empty.
- Preference keys are namespaced `lifedesk.*`, migrated on first read from the older `mewmo.*` keys and then removed, so an upgrade keeps existing settings.
- Deleting a financial activity record is an explicit user action with confirmation. If it represents an investment purchase, its linked lot and cash movement are removed together.

## Cleanup inventory

### Removed after reference checks

- `/life` mixed Work/Money route.
- `/projects` duplicate project list.
- `/items` duplicate legacy Quests list.
- Dead `RecordingRow`, `SectionHeader`, and `VoiceCapture` components.
- Unused default and retired mascot assets.
- Duplicate Expo Router `+api` routes and their unused server adapter; the active Vercel `api/[...path].mjs` adapter and local Node server remain the single backend implementation.

### Intentionally retained

- Voice processing, review, results, item detail, recording detail, and project detail routes.
- Search and timeline remain available inside Tasks, where the real tab bar stays visible.
- Pixel-cat atlas assets currently rendered by `PixelCat`.
- Current app icon asset, despite its legacy filename, because it is referenced by the native and web app configuration.
- Historical database migrations and legacy import marker.

### Implementation notes

- Every main tab press now returns to that tab's overview instead of reopening an old nested detail screen.
- Financial forms hide the assistant button while editing so it cannot cover an amount or date field.
- Web persistence now uses Expo SQLite's supported non-exclusive transaction API; native keeps the exclusive writer transaction.
- A failed database initialization can be retried instead of leaving the current app session permanently stuck.

## Target route map

```text
Home
Wallet
  Activity (add income/expense, review/delete records)
  Investments (add BTC/VOO, refresh/manual prices)
  Plans and budgets (add/edit/pause/delete automations and budgets)
Capture
Tasks
  Focus / Upcoming / Projects / Inbox
Tools
  Image tools / Currency / Units / Translator
```

## Verification record

- [x] TypeScript typecheck
- [x] Unit and server tests (27 passed)
- [x] Expo dependency/configuration check (21/21 passed)
- [x] Web bundle/export check
- [x] Rendered narrow-screen Wallet and financial-entry flows at 390 × 844
- [x] Forms stay scrollable inside the app's keyboard-avoiding screen, and the tab bar hides while the keyboard is open
- [x] Browser persistence exercised with opening balance, salary automation, budget, and BTC purchase records
- [x] Create, edit, pause/delete confirmation, and linked financial cleanup paths reviewed
- [x] Route/reference scan confirms removed files are unreachable
- [x] Final diff review confirms no user records, database file, or migration code was removed

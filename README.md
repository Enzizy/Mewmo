# LifeDesk

LifeDesk is an Android-first, local-first personal command center built with Expo SDK 57. Speak naturally, review what Gemini understood, then confirm tasks, reminders, ideas, notes, projects, money records, or BTC/VOO contributions. The pixel black cat provides state feedback while the underlying records stay practical and explicit.

## What is implemented

- Conversational AI assistant with typed questions and voice transcription you can edit before sending
- Pixel cat states, Pixelify Sans display type, and portfolio-inspired white/black/blue UI
- Versioned SQLite storage with automatic migration of legacy local tasks and recordings
- Today priorities, projects with handoff notes, activity-based XP, and optional rewards
- Integer-centavo money ledger and decimal-safe BTC/VOO quantity calculations
- Recorded investment cost kept separate from manually timestamped estimated value
- Custom monthly salary, bill, and BTC/VOO schedules with duplicate-safe automatic posting
- Monthly category budgets such as Groceries
- Gemini answers general questions and uses confirmed personal records for questions about your life
- Assistant proposes tasks, reminders, projects, income, expenses, and completed investment records; review and confirm before saving
- Optional server-side Twelve Data refresh for BTC and VOO values in both PHP and USD
- Android home-screen overview widget and launcher shortcuts for capture, expenses, tasks, and reminders
- Notification actions for completing tasks or snoozing tasks and reminders
- Light and dark themes that follow the device or stay pinned, from Profile → Appearance
- Local JSON export and restore from Profile

## One-time setup

1. Install dependencies: `npm install`
2. Copy the environment template: `Copy-Item .env.example .env`
3. Create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` in `.env`.
   To enable automatic BTC/VOO prices, create a free Twelve Data Basic key and set `TWELVE_DATA_API_KEY`. The server requests BTC/USD, VOO, and USD/PHP, then caches the combined response for 15 minutes to conserve credits. Manual PHP price entry remains available without it.
4. Run `ipconfig` and find the IPv4 address for the computer's active Wi-Fi adapter.
5. Set the mobile API address in `.env`, for example:

   ```text
   EXPO_PUBLIC_LIFEDESK_API_URL=http://192.168.1.25:8787
   ```

Do not use `localhost`: from a physical phone, localhost refers to the phone. The former `EXPO_PUBLIC_BRAIN_DUMP_API_URL` and `EXPO_PUBLIC_GATHER_API_URL` names remain accepted so existing local setups continue to work.

## Run on an Android phone with Expo Go

Keep the computer and phone on the same Wi-Fi network, then open two terminals in this folder.

Terminal 1 — private Gemini backend:

```powershell
npm run server
```

Terminal 2 — Expo development server:

```powershell
npx expo start --clear
```

Open the latest Expo Go app and scan the QR code shown by Expo. Grant microphone permission when prompted. If Windows Firewall asks, allow Node.js on private networks so the phone can reach port 8787. Profile shows the current Gemini connection state.

Expo Go can run the app UI, but it cannot load LifeDesk's notifications, custom Android widget, or AR modules. Install a new APK/development build to test those native features. After installing and opening LifeDesk once, long-press the Android home screen, choose **Widgets**, then add **LifeDesk Overview**. Long-pressing the LifeDesk launcher icon also exposes quick actions. Widget balances are hidden by default and can be enabled under Profile → Android widget.

## Data and finance behavior

- App records live in an on-device SQLite database; small preferences use local storage.
- Audio files stay in the app's local file system. The backend sends a recording to Gemini for processing and requests deletion of the temporary Gemini file afterward.
- Gemini suggestions do not become durable records until the review screen is confirmed.
- Peso values use integer centavos. Investment quantities use fixed eight-decimal arithmetic.
- An investment and its linked cash movement are committed atomically and are not double-counted as ordinary spending.
- Market values are estimates from a manually entered or Twelve Data quote and always show the source time. LifeDesk is not financial advice or a brokerage.
- Recurring rules post locally when due or on the next app open. Pausing or deleting a rule never deletes its historical transactions.
- Investment automation requires both the cash amount and actual quantity; market quotes are never used to invent a purchase lot.
- The personal assistant sends the question and a bounded summary of confirmed records to Gemini. Audio files and voice transcripts are excluded.
- Use Profile → Export data archive to create a portable JSON backup, and Profile → Restore from backup to load one. A restore replaces every local record in a single transaction: either the whole archive lands or nothing changes. Records the archive cannot represent are skipped and counted rather than silently dropped.
- A backup carries transcripts but not audio files, so restored voice notes keep their text and lose their recordings. Restored reminders are rescheduled from scratch if notifications are enabled.

`GEMINI_API_KEY` is backend-only and must never use an `EXPO_PUBLIC_` prefix. Gemini free-tier data-use terms may be unsuitable for sensitive personal information; use an appropriate paid tier before submitting private data if needed.

## Verification

```powershell
npm run typecheck
npm run test
npm run server:check
npx expo-doctor
npx expo export --platform android --output-dir .codex-export-check
```

The installed app still needs a reachable hosted HTTPS backend before it can work away from the development computer's network.

## Migrating an existing install

The Android package changed from `com.enzizy.mewmo` to `com.enzizy.lifedesk`. Android treats the new package as a different app, so the old install's SQLite database does not carry over. Before replacing an installed build:

1. Open the **old** app and use Profile → Export data archive. Save the JSON somewhere off the device.
2. Install the new build. It starts with an empty database.
3. Open Profile → Restore from backup and choose that file.

The on-device database file name is deliberately unchanged, so reinstalling the *same* package never needs a restore.

## Building on EAS

This app has local Android native modules (`modules/ar-measure`, `modules/lifedesk-widget`), so the widget, notifications, and AR only work in a real build — never in Expo Go.

The Expo slug is `lifedesk` and `app.json` carries no `extra.eas.projectId`, so the first `eas init` provisions a fresh EAS project.

```powershell
npm install -g eas-cli
npx eas login
npx eas init          # creates the project and writes a new projectId
npx eas build --platform android --profile preview
```

`preview` produces a sideloadable APK. `development` produces a dev client that keeps Metro hot reload with the native modules available. Let EAS generate and manage the Android keystore on the first build.

### Build-time environment variables

`.env` is gitignored, so EAS never uploads it. Set these per environment at expo.dev → project → Environment variables, matching the `environment` named by each profile in `eas.json`:

| Name | Visibility | Value |
| --- | --- | --- |
| `EXPO_PUBLIC_LIFEDESK_API_URL` | Plain text | public HTTPS backend, including the `/api` suffix |
| `EXPO_PUBLIC_LIFEDESK_CLIENT_TOKEN` | Sensitive | the same long random value the server expects |

Never add `GEMINI_API_KEY` or `TWELVE_DATA_API_KEY` to an EAS build. They are backend-only, and every `EXPO_PUBLIC_*` value is readable inside the installed app.

### Hosted backend

An installed build cannot reach the LAN address used for local development. Deploy the backend first — `api/[...path].mjs` and `vercel.json` are already set up for Vercel:

```powershell
npx vercel deploy --prod
```

Set `GEMINI_API_KEY`, `LIFEDESK_CLIENT_TOKEN`, `TWELVE_DATA_API_KEY`, and `ALLOWED_ORIGIN` on the host, then point `EXPO_PUBLIC_LIFEDESK_API_URL` at `https://<project>.vercel.app/api`. The `/api` suffix matters: the handler strips that prefix before routing.

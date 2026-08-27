# LifeDesk

LifeDesk is an Android-first, local-first personal command center built with Expo SDK 57. Speak naturally, review what Gemini understood, then confirm tasks, reminders, ideas, notes, projects, money records, or BTC/VOO contributions. The pixel black cat provides state feedback while the underlying records stay practical and explicit.

## What is implemented

- Voice capture with recoverable processing and review before commit
- Pixel cat states, Pixelify Sans display type, and portfolio-inspired white/black/blue UI
- Versioned SQLite storage with automatic migration of legacy local tasks and recordings
- Today priorities, projects with handoff notes, activity-based XP, and optional rewards
- Integer-centavo money ledger and decimal-safe BTC/VOO quantity calculations
- Recorded investment cost kept separate from manually timestamped estimated value
- Custom monthly salary, bill, and BTC/VOO schedules with duplicate-safe automatic posting
- Monthly category budgets such as Groceries
- Grounded Gemini chat for questions about confirmed personal records
- Optional server-side Twelve Data refresh for BTC and VOO values in both PHP and USD
- Local JSON export from Profile

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

Open the latest Expo Go app and scan the QR code shown by Expo. Grant microphone and notification permission when prompted. If Windows Firewall asks, allow Node.js on private networks so the phone can reach port 8787. Profile shows the current Gemini connection state.

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
- Use Profile → Export local data to create a portable JSON backup.

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

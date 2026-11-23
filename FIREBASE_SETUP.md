# Firebase setup — Offline Notes AI (free tier only)

This guide needs a **browser** (Firebase console + Chrome). No payment method, no KYC, no quota-increase form is required — everything below uses the free tier.

## 1. Create a free Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project** (or **Create a project**), name it e.g. `offline-notes-ai`, and continue.
3. Google Analytics: optional — you can leave it **off**.
4. Wait for the project to be created, then open it.

## 2. Register a Web app and copy the config

1. In the project overview click the **Web (`</>`)** icon to add a Web app.
2. Nickname: `offline-notes-ai-web`. (Firebase Hosting: not needed for local dev.)
3. Click **Register app**. Firebase shows a `firebaseConfig` object.
4. In this repo, copy `.env.example` to `.env` and fill in the values:
   - `VITE_FIREBASE_API_KEY` ← `apiKey`
   - `VITE_FIREBASE_AUTH_DOMAIN` ← `authDomain`
   - `VITE_FIREBASE_PROJECT_ID` ← `projectId`
   - `VITE_FIREBASE_STORAGE_BUCKET` ← `storageBucket`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` ← `messagingSenderId`
   - `VITE_FIREBASE_APP_ID` ← `appId`
5. `.env` is git-ignored. **Never commit it.** The repo ships with placeholder values in `src/firebase-config.js` so it runs in demo mode without any config.

## 3. Enable Firebase AI Logic (Gemini Developer API)

1. In the Firebase console go to **Build → Firebase AI Logic** (or search "AI Logic").
2. Click **Get started** and choose the **Gemini Developer API** backend (free tier, no billing needed for text inference within the free quota).
3. No API key of your own is needed — Firebase AI Logic manages access through your Firebase project and App Check.

## 4. App Check (recommended; debug token accepted for judging)

1. In the console go to **Build → App Check → Apps**, select your Web app.
2. For local development / hackathon judging, a **debug token** is accepted:
   - In the browser, before loading the app, open DevTools Console and run `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`, then reload. The console prints a debug token.
   - Register that token in **App Check → Apps → Manage debug tokens**.
3. For production, register a reCAPTCHA v3 site key and set `VITE_RECAPTCHA_SITE_KEY` in `.env`. The app enables App Check only when that variable is set; without it the app still works (App Check is best-effort).

## 5. Enable on-device Gemini Nano in Chrome (desktop)

On-device inference works in **Chrome 139+ on desktop**:

1. Update Chrome (chrome://settings/help).
2. Enable the flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → **Enabled**, then relaunch Chrome.
3. Open DevTools → Console and run `await LanguageModel.availability()`. It should return `"available"` (or `"downloadable"`/`"downloading"` the first time).
4. In the app, click **⬇ Download Gemini Nano** if the banner offers it — the download is a few hundred MB, one time only. (The app calls `model.initializeDeviceModel()` from the Firebase AI Logic SDK; if Firebase is not configured it creates a `LanguageModel` session directly, which triggers the same download.)
5. If the model is unavailable, the app automatically uses cloud Gemini (for long notes) or the built-in offline summarizer — the badge in the UI always says which path answered. The **Environment check** panel in the app explains exactly what works in the current browser and why.

> **Cloud model:** the app uses `gemini-3.6-flash` for the cloud leg. `gemini-2.0-flash` was shut down by Google on 2026-06-01; `gemini-3.6-flash` is Google's recommended replacement (https://ai.google.dev/gemini-api/docs/deprecations). No model change is needed on your side.

## 6. Run

```bash
npm install
npm run dev
```

The header chip changes from "Demo mode (no Firebase config)" to "Firebase connected". Summarize the short sample note → 🟢 on-device badge. Summarize the long sample note → ☁️ cloud badge.

## 7. Deploy (free static hosting)

See **[DEPLOY.md](DEPLOY.md)** — step-by-step for GitHub Pages, Netlify, and Vercel (all free tier), plus Firebase Hosting:

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist
firebase deploy
```

## 8. Testing the offline path (no Wi-Fi needed)

- **Simulate Offline Mode (🧪 button in the header):** forces every AI call to the built-in local summarizer with zero network calls, without disconnecting Wi-Fi. A banner shows while it is on. Use it to demo/test the offline path in the video.
- **Real offline test:** turn off Wi-Fi (or DevTools → Network → Offline) and summarize the short sample note — it still works via Gemini Nano (if downloaded) or the local fallback.

## Troubleshooting

- **"Demo mode" chip stays on** — check `.env` values (no quotes needed) and restart `npm run dev` (Vite only reads `.env` at startup).
- **Summaries show the local-fallback badge** — Firebase is not configured, or the AI call failed (offline / model not downloaded). The app degrades gracefully by design.
- **Gemini Nano shows "unavailable"** — wrong Chrome version, wrong OS (desktop Chrome only), or the flag above is not enabled.
- **"Environment check" panel** — open it in the app; it lists browser, Prompt API, Nano, Firebase, and network status plus what works right now, so you never have to guess why a badge says what it says.
- **Quota errors from the cloud model** — the free tier has usage limits; short notes prefer on-device precisely to avoid this.

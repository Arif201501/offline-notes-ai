# #BuildHybridAI 2026 — submission notes (draft, for the parent agent)

**Hackathon:** #BuildHybridAI 2026 — https://firebasehybridaihackathon.devpost.com/
**Deadline:** 30 Nov 2026, 14:00 PT = 1 Dec 2026, 05:00 WIB
**Target prizes:** Best Web/Chrome App ($3,000) + Grand Prize ($10,000)
**Project:** Offline Notes AI — https://github.com/<OWNER>/offline-notes-ai (local git repo initialized 2026-11-23; push to GitHub by parent)

## What was built

- React + Vite web app using the **Firebase AI Logic SDK** (`firebase/ai`): `getAI` with `GoogleAIBackend`, `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE` (short notes → Gemini Nano on-device) and `PREFER_IN_CLOUD` (long docs → cloud Gemini 3.6 Flash), `model.initializeDeviceModel()`, and the `inferenceSource` response field.
- Every summary shows a badge proving which path answered: 🟢 On-device Gemini Nano / ☁️ Cloud Gemini / ⚙️ Local fallback.
- **Environment Check + graceful degradation:** on startup the app detects Prompt API / Gemini Nano availability and shows a status panel (browser, Prompt API, Nano, Firebase, network, what works now). If Nano is missing the app never crashes or shows a blank screen — it degrades to cloud or local fallback and says so on every badge. A one-click download button appears when the model is downloadable.
- **🧪 Simulate Offline Mode toggle:** forces every AI call to the built-in local summarizer with zero network calls, without disconnecting Wi-Fi — for demos and testing the offline path (banner + routing hint update while on).
- **Cloud model is current:** `gemini-3.6-flash`. The earlier `gemini-2.0-flash` was shut down by Google on 2026-06-01 (official deprecation page names `gemini-3.6-flash` as the recommended replacement). Model id lives in one place (`CLOUD_MODEL` in `src/ai.js`).
- App Check is wired best-effort (reCAPTCHA v3 when configured; debug token accepted for judging).
- License: Apache-2.0 (LICENSE file in repo root). All submission materials in English.

## Still needed before submitting (parent / browser steps)

1. **Create a free Firebase project** in the console and paste the config into `.env` — see FIREBASE_SETUP.md. (Browser step; cannot be done from this VM.)
2. **Create the public GitHub repo** (e.g. `offline-notes-ai`), push this directory, confirm the Apache-2.0 license is detected on the repo page.
3. **Deploy the app** to free hosting (see **DEPLOY.md** — GitHub Pages / Netlify / Vercel free tier, or Firebase Hosting) and put the live URL in the Devpost submission.
4. **Record the ≤3 min demo video** and upload it to YouTube (separate step — NOT done here).
5. **Submit on Devpost** with: live URL, public repo URL, video URL, description of the hybrid inference + Firebase AI Logic usage.

## Verification status (2026-11-23, local VM)

- `npm install` — **OK**: 110 packages added, exit 0 (firebase 12.19.0, react 19, vite 8.3.8).
- `npm run build` — **OK, 0 errors, 0 warnings**: `dist/` produced (JS 306 kB / 95.9 kB gzip). Build output verified with `npm run preview` + HTTP check (see below).
- `npm run lint` (oxlint) — **0 errors**, 1 pre-existing informational warning (React Compiler memoization note, original code).
- `vite preview` smoke test — **OK**: production build serves HTTP 200 on http://localhost:4173, `index.html` loads, JS/CSS assets resolve (200).
- **Bug found & fixed during verification:** the original code dynamically imported a standalone `initializeDeviceModel` from `firebase/ai` — that export does not exist in SDK v12 (it is a method, `model.initializeDeviceModel()`). The old code silently fell through to the Prompt API path; the download now uses the correct SDK method.
- **Cloud model check:** `gemini-2.0-flash` confirmed retired (Google deprecation page, shutdown 2026-06-01); replaced with `gemini-3.6-flash` (official recommended replacement, no shutdown announced). Cloud calls themselves cannot be tested from this VM — they need a real Firebase project (browser step, below).
- **Secret scan:** no secrets in the repo — only placeholder config (`YOUR_API_KEY` etc.) and `.env.example` with empty values. `.env` is git-ignored. Verified by grep over all tracked files.
- `git init` + initial commit — **done** (local repo only; see "Still needed" for push).
- No money was spent, no paid accounts created, no KYC/forms filled, no secrets committed.

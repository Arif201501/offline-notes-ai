# Offline Notes AI

> Private notes, summarized on-device with Gemini Nano — cloud Gemini only for long documents.

Built for **#BuildHybridAI 2026** ([Devpost](https://firebasehybridaihackathon.devpost.com/)) — targeting **Best Web/Chrome App** and the Grand Prize. The app demonstrates **hybrid inference with Firebase AI Logic**: short notes are summarized by Gemini Nano running on-device in Chrome (private, free, works offline), while long documents fall back to cloud Gemini. The UI always shows *where* each summary was computed.

## What it does

- **Write notes** — create, edit, delete, search, and filter notes by category. Notes are stored locally in your browser (localStorage), so nothing leaves your device by default.
- **✨ Summarize** — three styles: Brief (1–2 sentences), Bullet points, Action items. Every summary carries a badge:
  - 🟢 **On-device · Gemini Nano** — short note, computed locally in Chrome
  - ☁️ **Cloud · Gemini 3.6 Flash** — long document, routed to the cloud
  - ⚙️ **Local fallback** — no Firebase config / no model available; a built-in offline summarizer answers so the demo never breaks
- **Environment Check** — on startup the app detects whether Chrome's Prompt API / Gemini Nano is available and shows a clear status panel (browser, Prompt API, Nano, Firebase, network, and what works right now). If Gemini Nano is missing, the app never crashes and never shows a blank screen: it degrades to cloud or local fallback and says so on every badge. A one-click **⬇ Download Gemini Nano** button appears when the model is downloadable.
- **🧪 Simulate Offline Mode** — a toggle in the header forces every AI call to the built-in local summarizer with zero network calls, without actually disconnecting Wi-Fi — for demos and testing the offline path. A banner shows while it is on; the routing hint and status messages change accordingly. (Or turn off Wi-Fi for real: the short note still summarizes.)
- **🗂 Auto-organize** — generates a title, tags, and a category (Work / Personal / Ideas / Study / Health / Finance / Other) with the same hybrid routing.
- **Hybrid routing, visible** — a per-note character count and routing hint shows which path the next summary will take (threshold: 2,000 chars). A "How the hybrid routing works" explainer is built into the app.
- **Offline-first** — an online/offline indicator in the header; on-device summaries keep working with the network off. Try it: turn off Wi-Fi and summarize the short hiking note.
- **Gemini Nano status + one-click download** — the app checks Chrome's Prompt API availability and offers to download the on-device model (user gesture required).
- **Export / Import** — download all notes as JSON, or import a previous export.

## Cloud model note

The cloud leg uses **`gemini-3.6-flash`**. The earlier `gemini-2.0-flash` was **shut down by Google on 2026-06-01** (see the official deprecation page: https://ai.google.dev/gemini-api/docs/deprecations), which names `gemini-3.6-flash` as its recommended replacement (no shutdown date announced as of 2026-11-23). The Firebase JS SDK v12 default hybrid in-cloud model (`gemini-2.5-flash-lite`) is also still available, but `gemini-3.6-flash` is the current flagship flash model and the direct successor — so the code uses it. The model id lives in one place, `CLOUD_MODEL` in `src/ai.js`, so a future migration is a one-line change.

## Tech stack

- React 19 + Vite
- **Firebase AI Logic SDK** (`firebase/ai`): `getAI` + `GoogleAIBackend`, `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE` / `PREFER_IN_CLOUD`, `model.initializeDeviceModel()`, `inferenceSource`
- Firebase App Check (optional, best-effort; debug token accepted for judging)
- No backend server, no paid services — free tier only

## Quick start (demo mode, zero setup)

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app runs in **demo mode** with three sample notes (a short note, a checklist, and a long book note so you can see both routing paths). Summaries use the built-in offline summarizer until Firebase is configured.

## Connect Firebase (free tier) — full hybrid AI

See **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** for the step-by-step guide (create a free Firebase project in the console, enable the Gemini Developer API, paste the web config into `.env`, enable Chrome's Prompt API flag, download Gemini Nano). Summary:

```bash
cp .env.example .env
# fill in the VITE_FIREBASE_* values from your Firebase project settings
npm run dev
```

## Build & deploy

```bash
npm run build        # outputs to dist/
npm run preview      # serve the production build locally
```

Deploy the `dist/` folder to any free static host — see **[DEPLOY.md](DEPLOY.md)** for step-by-step GitHub Pages / Netlify / Vercel (free tier) and Firebase Hosting instructions.

## Demo script (for the ≤3 min video)

1. Open the app — point out the three status chips (Online, Firebase, Gemini Nano) and the **Environment check** panel: it shows exactly what this browser supports and what works right now.
2. Summarize the short "Weekend hiking plan" note → 🟢 on-device badge, note never leaves the browser.
3. Summarize the long book note → ☁️ cloud badge, with the routing hint explaining why.
4. Turn on **🧪 Simulate Offline Mode** → the banner appears and the same short note summarizes via the local fallback with zero network calls. Turn it off to restore hybrid routing.
5. Turn off the network for real (Wi-Fi off), summarize the short note again → still works. This is the demo Claude suggested: the app keeps working with no connection at all.
6. Press 🗂 Auto-organize on the launch checklist → title + tags + category appear.

**Demo talking points (narrative ideas, not extra features):** the hybrid router is a *privacy router* — short, personal notes never leave the device, only long documents go to the cloud; and on-device-first routing saves cloud tokens/quota, which is why the app prefers Nano whenever it can.

## Project structure

```
src/
  main.jsx            Entry point
  App.jsx             Notes UI (list, editor, AI panel, badges)
  App.css / index.css Styling (light + dark)
  ai.js               Hybrid router: summarizeNote / organizeNote, on-device
                      availability check, model download, offline fallback
  firebase.js         Firebase init (AI Logic + optional App Check)
  firebase-config.js  Placeholder web config / VITE_FIREBASE_* env vars
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).

# Deploy — Offline Notes AI (free hosting only)

The app is a static Vite build (`dist/`). No server, no paid service, no
build-time secrets — the Firebase config is loaded at runtime from `src/firebase-config.js`
(placeholders) or from `.env` (local only, never committed). Any free static
host works. Pick one option below.

**Before deploying:** make sure the production build passes:

```bash
npm install
npm run build   # outputs to dist/
```

## Option A — GitHub Pages (free, recommended for the hackathon)

GitHub Pages serves the repo, so the live URL and the public repo URL stay in
one place — convenient for the Devpost submission.

1. Create the public GitHub repo (e.g. `offline-notes-ai`) and push this
   directory (see `SUBMISSION.md`).
2. GitHub Pages project sites are served from a sub-path
   (`https://<OWNER>.github.io/<REPO>/`), so set the Vite base to the repo
   name. In `vite.config.js`:
   ```js
   export default defineConfig({
     plugins: [react()],
     base: '/offline-notes-ai/',   // <-- your repo name here
   })
   ```
   Then rebuild: `npm run build`.
   (A user/organization site `<OWNER>.github.io` needs no base change.)
3. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**,
   then choose the **Static HTML** workflow (or use the ready-made Vite workflow).
   When the workflow asks for the publish directory, use `dist`.
   - No-Action alternative: `npm run build`, then push the `dist/` folder to a
     `gh-pages` branch and set Pages source to that branch.
4. Wait for the Actions run to finish; the live URL is
   `https://<OWNER>.github.io/offline-notes-ai/`.

> Note: because the app reads its Firebase config from the built bundle, a
> deployed copy runs in **demo mode** (local fallback) unless the Firebase
> config is baked into the deployed build. To ship the real hybrid AI, build
> with the config present: create `.env` from `.env.example` (values from your
> free Firebase project, see `FIREBASE_SETUP.md`), run `npm run build`, and
> deploy that `dist/`. The Firebase web config (`apiKey`, `projectId`, …) is a
> client-side identifier, not a secret — but keep the real `.env` file itself
> out of git either way.

## Option B — Netlify (free tier, drag-and-drop)

1. Run `npm run build` locally.
2. Go to https://app.netlify.com/drop and drag the `dist/` folder onto the page.
   Netlify gives you a `https://<random>.netlify.app` URL instantly.
3. (Optional) Rename the site under **Site settings → Site details → Change site name**.
4. (Optional, for the real hybrid AI) Set the `VITE_FIREBASE_*` variables under
   **Site settings → Environment variables**, then trigger a redeploy — or build
   locally with `.env` and drag the fresh `dist/` again.
5. (Optional, git-connected) Connect the GitHub repo instead: **Add new site →
   Import an existing project**; build command `npm run build`, publish
   directory `dist`. Every push redeploys automatically.

## Option C — Vercel (free tier)

1. Run `npm run build` locally, or let Vercel build for you.
2. Go to https://vercel.com/new and import the GitHub repo (or use the CLI:
   `npx vercel`, then `npx vercel --prod`).
3. Framework preset: **Vite**. Build command: `npm run build`. Output
   directory: `dist`. No root-directory change needed.
4. (Optional, for the real hybrid AI) Add the `VITE_FIREBASE_*` variables under
   **Project → Settings → Environment Variables** and redeploy — or build
   locally with `.env` and deploy the `dist/` folder with `npx vercel --prod`.

## Option D — Firebase Hosting (free tier)

Useful if the Firebase project from `FIREBASE_SETUP.md` already exists:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist ; single-page app: Yes
firebase deploy
```

Live URL: `https://<PROJECT_ID>.web.app`.

## After deploying

1. Open the live URL in **Chrome 139+ on desktop** and check:
   - The three header chips (Online / Firebase / Gemini Nano) render.
   - The **Environment check** panel opens and reports the browser status.
   - Summarize the short sample note — in demo mode it shows the ⚙️ local
     fallback badge; with Firebase configured it shows 🟢 on-device (Nano
     downloaded) or ☁️ cloud.
   - Toggle **🧪 Simulate Offline Mode** — the banner appears and summaries
     still work with zero network calls.
2. Put the live URL in the Devpost submission (see `SUBMISSION.md`).
3. If anything renders blank: open DevTools → Console, copy the error, and
   check that `dist/index.html` and `dist/assets/*` all return HTTP 200
   (a wrong `base` in `vite.config.js` is the usual cause on GitHub Pages).

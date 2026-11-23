// ---------------------------------------------------------------------------
// Firebase setup for Offline Notes AI
// ---------------------------------------------------------------------------
// HOW TO CONNECT YOUR OWN (FREE) FIREBASE PROJECT — see FIREBASE_SETUP.md
// for the full step-by-step guide (it needs a browser + the Firebase console).
//
// 1. Create a free Firebase project at https://console.firebase.google.com
// 2. Register a Web app, enable the Gemini Developer API (Firebase AI Logic)
//    and App Check (a debug token is accepted for this hackathon submission).
// 3. Copy the web app config into `src/firebase-config.js` or set the
//    VITE_FIREBASE_* variables in a local `.env` file (see `.env.example`).
//    NEVER commit real keys.
//
// Without a config the app still runs in DEMO MODE: notes are stored locally
// (localStorage) and summarization uses a built-in offline extractive
// summarizer, so judges can try the full UI with zero setup.
// ---------------------------------------------------------------------------

import { initializeApp } from 'firebase/app'
import { getAI, GoogleAIBackend } from 'firebase/ai'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js'

let app = null
let ai = null

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig)

  // App Check (optional, best-effort): protects the Firebase AI Logic
  // backend from abuse. Set VITE_RECAPTCHA_SITE_KEY in `.env` to enable it
  // with reCAPTCHA v3. For local development / hackathon judging, set
  // `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in the browser console
  // before the app loads and register the printed debug token in the
  // Firebase console (App Check > Apps > Manage debug tokens).
  // If no provider is configured the app keeps working without App Check.
  try {
    const siteKey =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_RECAPTCHA_SITE_KEY
        : ''
    if (siteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      })
    }
  } catch {
    // App Check is optional for the demo; continue without it.
  }

  // Firebase AI Logic, Gemini Developer API backend.
  // Hybrid inference (on-device Gemini Nano vs cloud Gemini) is selected
  // per-request in src/ai.js via InferenceMode.
  ai = getAI(app, { backend: new GoogleAIBackend() })
}

export { app, ai, isFirebaseConfigured }

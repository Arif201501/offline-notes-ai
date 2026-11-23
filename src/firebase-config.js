// ---------------------------------------------------------------------------
// Firebase web app configuration — PLACEHOLDER.
// ---------------------------------------------------------------------------
// Replace the values below with the config of your own FREE Firebase project
// (see FIREBASE_SETUP.md), or set the VITE_FIREBASE_* variables in a local
// `.env` file (see `.env.example`). `.env` is git-ignored — never commit keys.
//
// These are client-side Firebase config values (apiKey etc.). They are NOT
// secret credentials, but they identify your project, so keep them in your
// own copy of the repo, not in a public fork you do not own.
// ---------------------------------------------------------------------------

const fromEnv = (key) => {
  // Vite exposes variables prefixed with VITE_ via import.meta.env.
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || ''
  }
  return ''
}

export const firebaseConfig = {
  apiKey: fromEnv('VITE_FIREBASE_API_KEY') || 'YOUR_API_KEY',
  authDomain: fromEnv('VITE_FIREBASE_AUTH_DOMAIN') || 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: fromEnv('VITE_FIREBASE_PROJECT_ID') || 'YOUR_PROJECT_ID',
  storageBucket: fromEnv('VITE_FIREBASE_STORAGE_BUCKET') || 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: fromEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || 'YOUR_SENDER_ID',
  appId: fromEnv('VITE_FIREBASE_APP_ID') || 'YOUR_APP_ID',
}

export function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
    firebaseConfig.appId !== 'YOUR_APP_ID'
  )
}

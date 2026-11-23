// ---------------------------------------------------------------------------
// Hybrid AI engine — Firebase AI Logic (Gemini Nano on-device + Gemini cloud)
// ---------------------------------------------------------------------------
// Routing policy (the core of the hybrid demo):
//   - Short notes (<= ~2,000 chars): PREFER_ON_DEVICE — Gemini Nano runs in
//     Chrome on the user's machine. Private, free, works offline.
//   - Long documents (> ~2,000 chars): PREFER_IN_CLOUD — cloud Gemini handles
//     the larger context the on-device model cannot.
//   - If Firebase is not configured, or the on-device model is unavailable,
//     the app falls back to a built-in offline extractive summarizer so the
//     demo always works. The UI always shows WHERE the summary came from.
//
// Firebase AI Logic API used:
//   getGenerativeModel(ai, { model, mode: InferenceMode.PREFER_ON_DEVICE })
//   getGenerativeModel(ai, { model, mode: InferenceMode.PREFER_IN_CLOUD })
//   model.generateContent(prompt) -> result.response.text(), inferenceSource
// On-device inference requires Chrome 139+ on desktop with the Prompt API
// flag enabled (chrome://flags/#prompt-api-for-gemini-nano-multimodal-input)
// and the Gemini Nano model downloaded (see FIREBASE_SETUP.md).
// ---------------------------------------------------------------------------

import { getGenerativeModel, InferenceMode } from 'firebase/ai'
import { ai, isFirebaseConfigured } from './firebase.js'

// Cloud model used when the note is too long for Gemini Nano.
// NOTE (verified 2026-11-23 against the official deprecation page
// https://ai.google.dev/gemini-api/docs/deprecations): `gemini-2.0-flash`
// was SHUT DOWN on 2026-06-01, and Google names `gemini-3.6-flash` as its
// recommended replacement (no shutdown date announced). The Firebase JS SDK
// (v12.19.0) default hybrid in-cloud model is `gemini-2.5-flash-lite`, which
// is still available, but `gemini-3.6-flash` is the current flagship flash
// model and the direct successor of the retired 2.0-flash — so we use it.
export const CLOUD_MODEL = 'gemini-3.6-flash'
// On-device model id used by Firebase AI Logic for Gemini Nano.
export const ON_DEVICE_MODEL = 'gemini-nano'

// Rough threshold where we switch from on-device to cloud.
export const ON_DEVICE_MAX_CHARS = 2000

export const INFERENCE_SOURCES = {
  ON_DEVICE: 'on-device',
  CLOUD: 'cloud',
  LOCAL_FALLBACK: 'local-fallback',
}

/**
 * Check whether Chrome's on-device model (Gemini Nano / Prompt API) is
 * available in this browser. Returns 'available' | 'downloadable' |
 * 'downloading' | 'unavailable' | 'unknown'.
 */
export async function checkOnDeviceAvailability() {
  try {
    const LM =
      typeof window !== 'undefined' ? window.LanguageModel : undefined
    if (!LM || typeof LM.availability !== 'function') return 'unknown'
    return await LM.availability()
  } catch {
    return 'unknown'
  }
}

/**
 * Trigger the on-device model download (must be called from a user gesture).
 * In Firebase JS SDK v12 the download is a method on the GenerativeModel
 * instance (`model.initializeDeviceModel()`); there is no standalone
 * `initializeDeviceModel` export (the earlier code imported one that does
 * not exist — it silently failed and fell through to the Prompt API path).
 * If Firebase is not configured we fall back to creating a LanguageModel
 * session directly, which triggers the same download in Chrome.
 */
export async function downloadOnDeviceModel() {
  try {
    if (ai && isFirebaseConfigured()) {
      const model = getGenerativeModel(ai, {
        model: ON_DEVICE_MODEL,
        mode: InferenceMode.PREFER_ON_DEVICE,
      })
      await model.initializeDeviceModel()
      return true
    }
  } catch {
    // fall through to the Prompt API path
  }
  try {
    const LM = window.LanguageModel
    if (LM && typeof LM.create === 'function') {
      const session = await LM.create()
      session.destroy()
      return true
    }
  } catch {
    return false
  }
  return false
}

function buildSummaryPrompt(text, style) {
  const styles = {
    brief: 'Summarize the following note in 1-2 short sentences.',
    bullets: 'Summarize the following note as 3-5 concise bullet points.',
    action: 'Extract the action items / to-dos from the following note as a short bullet list. If there are none, say so in one sentence.',
  }
  return `${styles[style] || styles.brief}\n\nNote:\n${text}`
}

function buildOrganizePrompt(text) {
  return (
    'Analyze the following note and reply with ONLY a JSON object, no other text:\n' +
    '{"title": "<short title, max 6 words>", "tags": ["<tag1>", "<tag2>", "<tag3>"], "category": "<one of: Work, Personal, Ideas, Study, Health, Finance, Other>"}\n\n' +
    `Note:\n${text}`
  )
}

/**
 * Offline extractive summarizer — zero-network fallback used when Firebase
 * is not configured or no model answers. Picks the most information-dense
 * sentences (simple TF scoring). Clearly labelled LOCAL FALLBACK in the UI.
 */
export function localSummarize(text, style = 'brief') {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
  if (sentences.length === 0) return ''
  if (sentences.length <= 2) return sentences.join(' ')

  const words = text.toLowerCase().match(/[a-z0-9']{3,}/g) || []
  const freq = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1
  const scored = sentences.map((s, i) => {
    const ws = s.toLowerCase().match(/[a-z0-9']{3,}/g) || []
    const score = ws.reduce((acc, w) => acc + (freq[w] || 0), 0) / Math.max(ws.length, 1)
    // Prefer early sentences slightly (notes usually lead with the point).
    return { s, score: score + (i === 0 ? 0.5 : 0), i }
  })
  scored.sort((a, b) => b.score - a.score)
  const keep = style === 'bullets' ? 4 : 2
  const picked = scored.slice(0, keep).sort((a, b) => a.i - b.i)

  if (style === 'bullets') return picked.map((p) => `• ${p.s}`).join('\n')
  if (style === 'action') {
    const todos = sentences.filter((s) => /(\bTODO\b|need to|must|should|remember to|by |deadline|follow up)/i.test(s))
    if (todos.length === 0) return 'No clear action items in this note.'
    return todos.map((s) => `• ${s}`).join('\n')
  }
  return picked.map((p) => p.s).join(' ')
}

export function localOrganize(text) {
  const lower = text.toLowerCase()
  const category =
    /\b(meeting|project|client|deadline|report|email|work|boss|team)\b/.test(lower)
      ? 'Work'
      : /\b(study|learn|course|exam|read|book|lecture)\b/.test(lower)
        ? 'Study'
        : /\b(idea|app|startup|build|invent|concept)\b/.test(lower)
          ? 'Ideas'
          : /\b(doctor|health|workout|sleep|diet|gym|medicine)\b/.test(lower)
            ? 'Health'
            : /\b(money|budget|price|pay|bank|invest|rp|idr|\$)\b/.test(lower)
              ? 'Finance'
              : /\b(family|friend|birthday|trip|home|weekend)\b/.test(lower)
                ? 'Personal'
                : 'Other'
  const words = (text.match(/[A-Za-z][A-Za-z-]{3,}/g) || [])
    .map((w) => w.toLowerCase())
    .filter((w) => !['this', 'that', 'with', 'from', 'have', 'will', 'about', 'note'].includes(w))
  const tags = [...new Set(words)].slice(0, 3)
  const title = text.split(/(?<=[.!?\n])/)[0].trim().slice(0, 48) || 'Untitled note'
  return { title, tags, category }
}

/**
 * Summarize a note with hybrid routing.
 * Returns { summary, source, model, latencyMs, error? }.
 * `source` is 'on-device' | 'cloud' | 'local-fallback' and is shown in the UI.
 * Options: { forceOffline?: boolean } — when true (Simulate Offline Mode in
 * the UI) the function never touches Firebase/network and answers with the
 * built-in local summarizer, so the offline path can be demoed and tested
 * without actually disconnecting the machine.
 */
export async function summarizeNote(text, style = 'brief', opts = {}) {
  const started = performance.now()
  const useOnDevice = text.length <= ON_DEVICE_MAX_CHARS
  const forceOffline = opts.forceOffline === true

  if (!forceOffline && isFirebaseConfigured() && ai) {
    try {
      const mode = useOnDevice
        ? InferenceMode.PREFER_ON_DEVICE
        : InferenceMode.PREFER_IN_CLOUD
      const modelName = useOnDevice ? ON_DEVICE_MODEL : CLOUD_MODEL
      const model = getGenerativeModel(ai, { model: modelName, mode })
      const result = await model.generateContent(buildSummaryPrompt(text, style))
      const response = result.response
      const summary = response.text()
      // Firebase AI Logic reports which model actually answered.
      const inferenceSource = response.inferenceSource || (useOnDevice ? 'on-device' : 'cloud')
      const source =
        String(inferenceSource).toLowerCase().includes('device')
          ? INFERENCE_SOURCES.ON_DEVICE
          : INFERENCE_SOURCES.CLOUD
      return {
        summary,
        source,
        model: modelName,
        latencyMs: Math.round(performance.now() - started),
      }
    } catch (err) {
      // Cloud/on-device failed (offline, model not downloaded, quota...):
      // fall through to the offline local summarizer instead of erroring.
      console.warn('[Offline Notes AI] AI summary failed, using local fallback:', err)
    }
  }

  return {
    summary: localSummarize(text, style),
    source: INFERENCE_SOURCES.LOCAL_FALLBACK,
    model: 'local-extractive',
    latencyMs: Math.round(performance.now() - started),
  }
}

/**
 * Auto-organize a note: title + tags + category, with the same routing.
 * Returns { title, tags, category, source, model, latencyMs }.
 * Options: { forceOffline?: boolean } — see summarizeNote.
 */
export async function organizeNote(text, opts = {}) {
  const started = performance.now()
  const useOnDevice = text.length <= ON_DEVICE_MAX_CHARS
  const forceOffline = opts.forceOffline === true

  if (!forceOffline && isFirebaseConfigured() && ai) {
    try {
      const mode = useOnDevice
        ? InferenceMode.PREFER_ON_DEVICE
        : InferenceMode.PREFER_IN_CLOUD
      const modelName = useOnDevice ? ON_DEVICE_MODEL : CLOUD_MODEL
      const model = getGenerativeModel(ai, { model: modelName, mode })
      const result = await model.generateContent(buildOrganizePrompt(text))
      const raw = result.response.text().trim()
      const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const parsed = JSON.parse(jsonText)
      const inferenceSource = result.response.inferenceSource || (useOnDevice ? 'on-device' : 'cloud')
      const source = String(inferenceSource).toLowerCase().includes('device')
        ? INFERENCE_SOURCES.ON_DEVICE
        : INFERENCE_SOURCES.CLOUD
      return {
        title: parsed.title || 'Untitled note',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        category: parsed.category || 'Other',
        source,
        model: modelName,
        latencyMs: Math.round(performance.now() - started),
      }
    } catch (err) {
      console.warn('[Offline Notes AI] AI organize failed, using local fallback:', err)
    }
  }

  return {
    ...localOrganize(text),
    source: INFERENCE_SOURCES.LOCAL_FALLBACK,
    model: 'local-extractive',
    latencyMs: Math.round(performance.now() - started),
  }
}

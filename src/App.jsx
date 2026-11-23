import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  summarizeNote,
  organizeNote,
  checkOnDeviceAvailability,
  downloadOnDeviceModel,
  ON_DEVICE_MAX_CHARS,
  INFERENCE_SOURCES,
} from './ai.js'
import { isFirebaseConfigured } from './firebase.js'
import './App.css'

const STORAGE_KEY = 'offline-notes-ai:v1'

const SAMPLE_NOTES = [
  {
    id: 'sample-short',
    title: 'Weekend hiking plan',
    body: 'Hike Mount Merbabu this Saturday. Leave Kebumen at 5am, meet Dimas at the basecamp by 7. Bring 2L water, rain jacket, and snacks. The trail takes about 5 hours up. Remember to charge the headlamp and check the weather on Friday night. If it rains, we switch to the shorter Selo route instead.',
    tags: ['hiking', 'weekend'],
    category: 'Personal',
    summary: '',
    summarySource: '',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'sample-actions',
    title: 'Q4 launch checklist',
    body: 'Launch checklist for the Q4 release. TODO: finalize the pricing page by Monday. Need to email the design team about the new hero image. Must confirm the payment gateway sandbox keys before Thursday demo. Sarah should review the onboarding flow. Remember to schedule the retrospective for next Friday and book the meeting room. Also update the changelog and notify support about the new feature flags.',
    tags: ['launch', 'work'],
    category: 'Work',
    summary: '',
    summarySource: '',
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
  },
  {
    id: 'sample-long',
    title: 'Reading notes: The Design of Everyday Things',
    body: `Don Norman's book argues that good design is invisible: when a product works well, nobody notices the design at all, and when it fails, the design is all anyone talks about. The core ideas are affordances, signifiers, constraints, mappings, and feedback. An affordance is what an object allows you to do — a chair affords sitting, a flat plate on a door affords pushing. A signifier tells you how to use the affordance: the word PUSH on that plate, or a handle that invites pulling. Constraints limit what is possible and guide correct behavior; a USB plug that only fits one way is a physical constraint, while a greyed-out button is a cultural one. Mapping connects controls to their effects: stove burners arranged in the same layout as the knobs are easier to use than a row of identical knobs. Feedback tells the user that an action happened and what changed — a click, a light, a progress bar. Norman's famous example is the "Norman door": a door you have to push but that has a handle suggesting pull, which is a failure of signifiers, not of the user. He insists that human error is usually design error. The book also introduces the gulfs of execution and evaluation: the gap between what a user wants to do and what the system allows, and the gap between what the system did and what the user understands. Good design bridges both gulfs with clear conceptual models. The seven stages of action — goal, intention, action specification, execution, perception, interpretation, evaluation — give designers a checklist for where users get stuck. Forcing functions are a strong form of constraint: an ATM that only returns your card after you take the cash prevents forgotten cards. In software, the same principles apply: visible navigation, undo, sensible defaults, and error messages that explain what went wrong and how to fix it. The takeaway for our own product: every confusing screen is a Norman door waiting to be fixed, and the fix is almost never more documentation — it is a better signifier, a clearer mapping, or faster feedback.`,
    tags: ['design', 'book'],
    category: 'Study',
    summary: '',
    summarySource: '',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
  },
]

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // corrupted storage -> reseed
  }
  return SAMPLE_NOTES
}

function uid() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const SOURCE_LABEL = {
  [INFERENCE_SOURCES.ON_DEVICE]: { icon: '🟢', text: 'On-device · Gemini Nano', cls: 'badge-device' },
  [INFERENCE_SOURCES.CLOUD]: { icon: '☁️', text: 'Cloud · Gemini 3.6 Flash', cls: 'badge-cloud' },
  [INFERENCE_SOURCES.LOCAL_FALLBACK]: { icon: '⚙️', text: 'Local fallback · no network/model', cls: 'badge-local' },
}

// Human-readable meaning of each Gemini Nano availability status, plus what
// still works in that state. Shown in the Environment Check panel so the app
// never leaves the user guessing (and never shows a blank screen / crash
// when Gemini Nano is missing — the whole point of graceful degradation).
const DEVICE_STATUS_INFO = {
  available: {
    label: 'Ready — summaries run on-device',
    detail: 'Gemini Nano is downloaded and ready. Short notes are summarized locally; nothing leaves this browser.',
  },
  downloadable: {
    label: 'Model not downloaded yet',
    detail: 'Chrome can download Gemini Nano (a few hundred MB, one time). Until then, summaries use the cloud (long notes) or the built-in local fallback.',
  },
  downloading: {
    label: 'Model is downloading…',
    detail: 'Gemini Nano is being downloaded in the background. Summaries still work via cloud or the local fallback meanwhile.',
  },
  unavailable: {
    label: 'Not available in this browser',
    detail: 'Gemini Nano needs Chrome 139+ on desktop with the Prompt API flag enabled (chrome://flags/#prompt-api-for-gemini-nano-multimodal-input). The app still works: long notes use cloud Gemini (if Firebase is configured) and everything else uses the built-in offline summarizer.',
  },
  unknown: {
    label: 'Could not be detected',
    detail: 'This browser does not expose Chrome\'s Prompt API (it may not be Chrome, or the flag is off). The app still works: summaries use cloud Gemini (if Firebase is configured) or the built-in offline summarizer.',
  },
}

function InferenceBadge({ source, model, latencyMs }) {
  if (!source) return null
  const info = SOURCE_LABEL[source] || SOURCE_LABEL[INFERENCE_SOURCES.LOCAL_FALLBACK]
  return (
    <span className={`badge ${info.cls}`} title={`Model: ${model || '—'} · ${latencyMs ?? '—'} ms`}>
      {info.icon} {info.text}
      {typeof latencyMs === 'number' ? ` · ${latencyMs} ms` : ''}
    </span>
  )
}

export default function App() {
  const [notes, setNotes] = useState(loadNotes)
  const [selectedId, setSelectedId] = useState(SAMPLE_NOTES[0].id)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [summaryStyle, setSummaryStyle] = useState('brief')
  const [isWorking, setIsWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [deviceStatus, setDeviceStatus] = useState('unknown')
  const [downloadingModel, setDownloadingModel] = useState(false)
  // Simulate Offline Mode: forces every AI call to use the built-in local
  // summarizer and makes no network calls, without actually disconnecting
  // the machine. For demos and testing the offline path. Real Wi-Fi stays on.
  const [simOffline, setSimOffline] = useState(false)
  const fileRef = useRef(null)

  const selected = notes.find((n) => n.id === selectedId) || notes[0]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    checkOnDeviceAvailability().then(setDeviceStatus)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const categories = useMemo(() => {
    const set = new Set(notes.map((n) => n.category || 'Other'))
    return ['All', ...[...set].sort()]
  }, [notes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notes
      .filter((n) => (categoryFilter === 'All' ? true : n.category === categoryFilter))
      .filter((n) =>
        q === ''
          ? true
          : `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, search, categoryFilter])

  const stats = useMemo(() => {
    const counts = { 'on-device': 0, cloud: 0, 'local-fallback': 0 }
    for (const n of notes) if (n.summarySource && counts[n.summarySource] !== undefined) counts[n.summarySource]++
    return counts
  }, [notes])

  const updateSelected = useCallback(
    (patch) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
      )
    },
    [selected?.id],
  )

  const newNote = () => {
    const note = {
      id: uid(),
      title: 'Untitled note',
      body: '',
      tags: [],
      category: 'Other',
      summary: '',
      summarySource: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
    setStatus('New note created. Type, then press Summarize.')
  }

  const deleteSelected = () => {
    if (!selected) return
    if (!window.confirm(`Delete "${selected.title}"?`)) return
    setNotes((prev) => prev.filter((n) => n.id !== selected.id))
    setSelectedId(() => {
      const rest = notes.filter((n) => n.id !== selected.id)
      return rest[0]?.id || ''
    })
    setStatus('Note deleted.')
  }

  const runSummarize = async () => {
    if (!selected || !selected.body.trim()) {
      setStatus('Write something in the note first.')
      return
    }
    setIsWorking(true)
    setStatus('Summarizing…')
    const route = simOffline
      ? 'simulated offline → using the local fallback, no network call'
      : selected.body.length <= ON_DEVICE_MAX_CHARS
        ? 'short note → trying on-device Gemini Nano first'
        : 'long document → routing to cloud Gemini'
    setStatus(`Summarizing… (${route})`)
    const result = await summarizeNote(selected.body, summaryStyle, { forceOffline: simOffline })
    updateSelected({
      summary: result.summary,
      summarySource: result.source,
      summaryModel: result.model,
      summaryLatencyMs: result.latencyMs,
    })
    setStatus(
      simOffline
        ? 'Simulated offline — summary generated by the local fallback (no network call was made).'
        : result.source === INFERENCE_SOURCES.ON_DEVICE
          ? 'Summary generated on-device — your note never left this browser.'
          : result.source === INFERENCE_SOURCES.CLOUD
            ? 'Summary generated in the cloud (note too long for on-device).'
            : 'Summary generated by the local fallback (Firebase not configured or model unavailable).',
    )
    setIsWorking(false)
  }

  const runOrganize = async () => {
    if (!selected || !selected.body.trim()) {
      setStatus('Write something in the note first.')
      return
    }
    setIsWorking(true)
    setStatus('Organizing… (title, tags, category)')
    const result = await organizeNote(selected.body, { forceOffline: simOffline })
    updateSelected({ title: result.title, tags: result.tags, category: result.category })
    setStatus(
      simOffline
        ? 'Simulated offline — organized by the local fallback (no network call was made).'
        : `Organized via ${result.source === 'on-device' ? 'Gemini Nano on-device' : result.source === 'cloud' ? 'cloud Gemini' : 'local fallback'}.`,
    )
    setIsWorking(false)
  }

  const handleDownloadModel = async () => {
    setDownloadingModel(true)
    setStatus('Downloading Gemini Nano on-device model… (one-time, a few hundred MB)')
    const ok = await downloadOnDeviceModel()
    setDeviceStatus(await checkOnDeviceAvailability())
    setStatus(ok ? 'On-device model ready.' : 'Could not start the download — check Chrome 139+ and the Prompt API flag (see Setup).')
    setDownloadingModel(false)
  }

  const exportNotes = () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'offline-notes-ai-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importNotes = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!Array.isArray(data)) throw new Error('not an array')
        setNotes(data)
        setSelectedId(data[0]?.id || '')
        setStatus(`Imported ${data.length} notes.`)
      } catch {
        setStatus('Import failed: file is not a valid notes export.')
      }
    }
    reader.readAsText(file)
  }

  const routePreview = selected
    ? simOffline
      ? 'Simulated offline — will use the built-in local fallback (no network call)'
      : selected.body.length <= ON_DEVICE_MAX_CHARS
        ? 'Short note — will prefer on-device Gemini Nano'
        : 'Long document — will route to cloud Gemini'
    : ''

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>📝 Offline Notes AI</h1>
          <p className="subtitle">
            Private notes, summarized on-device with Gemini Nano — cloud Gemini only for long documents.
          </p>
        </div>
        <div className="status-chips">
          <span className={`chip ${online ? 'chip-ok' : 'chip-warn'}`}>
            {online ? '● Online' : '● Offline — on-device still works'}
          </span>
          <span className={`chip ${isFirebaseConfigured() ? 'chip-ok' : 'chip-warn'}`}>
            {isFirebaseConfigured() ? '● Firebase connected' : '● Demo mode (no Firebase config)'}
          </span>
          <span
            className={`chip ${deviceStatus === 'available' ? 'chip-ok' : 'chip-warn'}`}
            title="Chrome Prompt API / Gemini Nano availability"
          >
            ● Gemini Nano: {deviceStatus}
          </span>
          <button
            className={simOffline ? 'btn-sim-on' : 'btn-sim'}
            onClick={() => {
              const next = !simOffline
              setSimOffline(next)
              setStatus(
                next
                  ? 'Simulated Offline Mode ON — AI calls now use the local fallback only, no network. Real Wi-Fi is untouched.'
                  : 'Simulated Offline Mode OFF — normal hybrid routing restored.',
              )
            }}
            title="Force the offline path for demo/testing: AI calls use the built-in local summarizer and make no network calls, without disconnecting Wi-Fi."
            aria-pressed={simOffline}
          >
            🧪 Simulate Offline Mode: {simOffline ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {simOffline && (
        <div className="notice sim-banner" role="status">
          <span>
            <strong>Simulated Offline Mode is ON.</strong> Summaries and auto-organize now use the
            built-in local summarizer and make <strong>no network calls</strong> — your real Wi-Fi
            stays on. Turn it off above to restore normal hybrid routing.
          </span>
          <button onClick={() => setSimOffline(false)}>Turn off</button>
        </div>
      )}

      {deviceStatus === 'available' ? (
        <div className="notice notice-ok">
          <span>
            ✅ <strong>Gemini Nano is ready.</strong> Short notes are summarized on-device — your
            notes never leave this browser. Long documents still route to cloud Gemini.
          </span>
        </div>
      ) : (
        <div className="notice">
          <span>
            On-device Gemini Nano is <strong>{deviceStatus}</strong> in this browser —{' '}
            {DEVICE_STATUS_INFO[deviceStatus]?.detail || DEVICE_STATUS_INFO.unknown.detail}{' '}
            {(deviceStatus === 'downloadable' || deviceStatus === 'downloading') && (
              <>Use the button to download the model (one-time, a few hundred MB):</>
            )}
            {(deviceStatus === 'unavailable' || deviceStatus === 'unknown') && (
              <>No download is possible from here — use Chrome 139+ on desktop with the Prompt API flag enabled.</>
            )}
          </span>
          {(deviceStatus === 'downloadable' || deviceStatus === 'downloading') && (
            <button onClick={handleDownloadModel} disabled={downloadingModel}>
              {downloadingModel ? 'Downloading…' : '⬇ Download Gemini Nano'}
            </button>
          )}
        </div>
      )}

      <details className="how env-check">
        <summary>Environment check — what this browser supports</summary>
        <ul>
          <li>
            <strong>Browser:</strong>{' '}
            {typeof navigator !== 'undefined' && /Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent)
              ? 'Chrome (desktop) — the only browser that runs Gemini Nano'
              : 'Not Chrome, or Chrome version unknown — Gemini Nano needs Chrome 139+ on desktop'}
          </li>
          <li>
            <strong>Prompt API (window.LanguageModel):</strong>{' '}
            {typeof window !== 'undefined' && window.LanguageModel ? 'exposed' : 'not exposed in this browser'}
          </li>
          <li>
            <strong>Gemini Nano:</strong> {deviceStatus} — {DEVICE_STATUS_INFO[deviceStatus]?.label || DEVICE_STATUS_INFO.unknown.label}
          </li>
          <li>
            <strong>Firebase / cloud:</strong>{' '}
            {isFirebaseConfigured()
              ? 'connected — long documents route to cloud Gemini 3.6 Flash'
              : 'not configured (demo mode) — no cloud calls; the built-in local summarizer answers instead'}
          </li>
          <li>
            <strong>Network:</strong> {online ? 'online' : 'offline (on-device + local fallback still work)'}
            {simOffline ? ' · simulated offline is ON (local fallback forced)' : ''}
          </li>
          <li>
            <strong>What works right now:</strong> short notes →{' '}
            {deviceStatus === 'available' ? 'Gemini Nano on-device' : 'built-in local fallback'} · long
            documents →{' '}
            {isFirebaseConfigured() && !simOffline ? 'cloud Gemini 3.6 Flash' : 'built-in local fallback'}
          </li>
        </ul>
        <p>
          If Gemini Nano is missing, the app does <strong>not</strong> crash and never shows a blank
          screen — it degrades to cloud or local fallback and says so on every summary badge.
        </p>
      </details>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-actions">
            <button className="btn-primary" onClick={newNote}>+ New note</button>
            <button onClick={exportNotes} title="Download all notes as JSON">Export</button>
            <button onClick={() => fileRef.current?.click()} title="Import a notes JSON export">Import</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => e.target.files?.[0] && importNotes(e.target.files[0])}
            />
          </div>
          <input
            className="search"
            type="search"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="categories">
            {categories.map((c) => (
              <button
                key={c}
                className={categoryFilter === c ? 'cat active' : 'cat'}
                onClick={() => setCategoryFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <ul className="note-list">
            {filtered.map((n) => (
              <li
                key={n.id}
                className={selected?.id === n.id ? 'selected' : ''}
                onClick={() => setSelectedId(n.id)}
              >
                <strong>{n.title || 'Untitled note'}</strong>
                <small>{n.body.slice(0, 90) || 'Empty note'}{n.body.length > 90 ? '…' : ''}</small>
                <span className="meta">
                  {n.category} · {n.body.length} chars
                  {n.summarySource ? ` · ${SOURCE_LABEL[n.summarySource]?.icon || ''}` : ''}
                </span>
              </li>
            ))}
            {filtered.length === 0 && <li className="empty">No notes match.</li>}
          </ul>
          <p className="stats">
            {notes.length} notes · summaries: 🟢 {stats['on-device']} on-device · ☁️ {stats.cloud} cloud · ⚙️{' '}
            {stats['local-fallback']} local
          </p>
        </aside>

        <main className="editor">
          {!selected ? (
            <p className="empty">Create a note to get started.</p>
          ) : (
            <>
              <input
                className="title-input"
                value={selected.title}
                onChange={(e) => updateSelected({ title: e.target.value })}
                placeholder="Note title"
              />
              <textarea
                className="body-input"
                value={selected.body}
                onChange={(e) => updateSelected({ body: e.target.value })}
                placeholder="Write your note here…"
                rows={14}
              />
              <p className="route-hint">
                {selected.body.length} characters · {routePreview} (threshold: {ON_DEVICE_MAX_CHARS} chars)
              </p>
              <div className="tag-row">
                {(selected.tags || []).map((t) => (
                  <span key={t} className="tag">#{t}</span>
                ))}
                <span className="tag tag-cat">{selected.category}</span>
              </div>

              <div className="ai-panel">
                <div className="ai-controls">
                  <label>
                    Summary style:{' '}
                    <select value={summaryStyle} onChange={(e) => setSummaryStyle(e.target.value)}>
                      <option value="brief">Brief (1–2 sentences)</option>
                      <option value="bullets">Bullet points</option>
                      <option value="action">Action items</option>
                    </select>
                  </label>
                  <button className="btn-primary" onClick={runSummarize} disabled={isWorking}>
                    {isWorking ? 'Working…' : '✨ Summarize'}
                  </button>
                  <button onClick={runOrganize} disabled={isWorking}>
                    🗂 Auto-organize
                  </button>
                  <button className="btn-danger" onClick={deleteSelected}>Delete</button>
                </div>

                {selected.summary && (
                  <div className="summary">
                    <div className="summary-head">
                      <strong>Summary</strong>
                      <InferenceBadge
                        source={selected.summarySource}
                        model={selected.summaryModel}
                        latencyMs={selected.summaryLatencyMs}
                      />
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selected.summary}</p>
                  </div>
                )}
              </div>

              {status && <p className="status" role="status">{status}</p>}

              <details className="how">
                <summary>How the hybrid routing works</summary>
                <ol>
                  <li><strong>Short note (≤ {ON_DEVICE_MAX_CHARS} chars):</strong> Firebase AI Logic runs Gemini Nano on-device in Chrome — private, free, works offline.</li>
                  <li><strong>Long document (&gt; {ON_DEVICE_MAX_CHARS} chars):</strong> the same SDK call falls back to cloud Gemini (gemini-3.6-flash) for the bigger context.</li>
                  <li><strong>No Firebase config / no model:</strong> a built-in offline summarizer answers, so the demo never breaks. The badge above always shows which path answered.</li>
                  <li><strong>No Gemini Nano in this browser:</strong> the app does not crash — check the “Environment check” panel above for exactly what works here, and why.</li>
                  <li><strong>Simulate Offline Mode (🧪 button in the header):</strong> forces the local fallback with zero network calls, without touching your Wi-Fi — for demos and testing. Or turn off Wi-Fi for real: the short note still summarizes.</li>
                  <li>Try it: summarize the short hiking note (on-device path), then the long book note (cloud path). Toggle your network off — the short one still works.</li>
                </ol>
              </details>
            </>
          )}
        </main>
      </div>

      <footer>
        Offline Notes AI · Built for #BuildHybridAI 2026 · Firebase AI Logic (Gemini Nano on-device + Gemini cloud) ·
        Notes never leave your device unless a long document is routed to the cloud. Apache-2.0.
      </footer>
    </div>
  )
}

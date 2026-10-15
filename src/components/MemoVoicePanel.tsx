import { useCallback, useEffect, useRef, useState } from 'react'
import { listen, emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { SETTINGS_KEYS } from '../lib/settingsKeys'
import { type EditorRef } from './Editor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
declare global {
  interface Window {
    webkitSpeechRecognition?: { new (): SpeechRecognitionInstance }
    SpeechRecognition?: { new (): SpeechRecognitionInstance }
  }
}

type PanelState = 'idle' | 'recording' | 'processing' | 'done'

interface DonePayload {
  audioPath: string
  rawTranscript: string
  interpreted: string
  isInterpreting?: boolean
}

// ─── System prompt for interpretation ─────────────────────────────────────────

const INTERPRET_SYSTEM_PROMPT = `You are a command interpreter for PaperCache, a Markdown note-taking app with a custom slash-command DSL.
Convert the user's voice input into well-structured PaperCache Markdown. Output ONLY the converted content — no explanations, no surrounding quotes, no code fences.

Available commands and syntax:
- /check <item>              → interactive checkbox (use for todo items, shopping lists, etc.)
- /checked <item>            → pre-checked checkbox
- /task <desc> @<time>       → task with optional due date (time formats: 1d2h, tmrw, YYYY-MM-DD HH:MM)
- /var name = value          → define a local variable
- /globvar name = value      → define a global variable (available across all notes)
- /file <note name>          → link to another note
- /ai <prompt>               → inline AI query
- # / ## / ###               → headings (h1 / h2 / h3)
- - or *                     → bullet list items
- **bold**, *italic*         → text formatting
- \`code\`                    → inline code

Rules:
- For shopping lists or checklists: use /check for each item.
- For to-dos or action items: prefer /task.
- For structured information: use appropriate headings and bullets.
- For numeric data or formulas: write them as math expressions followed by =
- Preserve the user's intent closely; restructure only enough to be useful.
- Output clean, minimal Markdown — do not pad with extra blank lines.`

// ─── Helper: read audio blob → base64 ─────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ─── Audio Pillbox with Waveform Visualizer ───────────────────────────────────

function AudioWaveformPill({ audioSrc }: { audioSrc: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  return (
    <div className="memo-audio-pillbox" aria-label="Audio playback pillbox">
      <button
        className="memo-play-pause-btn"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div className={`memo-waveform-visual ${isPlaying ? 'memo-waveform--playing' : ''}`}>
        {[...Array(18)].map((_, i) => (
          <span key={i} className={`memo-wave-bar memo-wave-bar--${(i % 5) + 1}`} />
        ))}
      </div>
      <audio
        ref={audioRef}
        src={audioSrc}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MemoVoicePanel({
  editorRef,
  isOverlay = false,
}: {
  editorRef: React.RefObject<EditorRef | null>
  isOverlay?: boolean
}) {
  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [donePayload, setDonePayload] = useState<DonePayload | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const speechRef = useRef<SpeechRecognitionInstance | null>(null)
  const liveTranscriptRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdStartRef = useRef<number>(0)

  const panelStateRef = useRef<PanelState>(panelState)
  const isRecordingRequestedRef = useRef<boolean>(false)

  useEffect(() => {
    panelStateRef.current = panelState
  }, [panelState])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      speechRef.current?.stop()
    }
  }, [])

  // Tick the elapsed timer using chained setTimeout (project rule: no setInterval).
  const tickTimer = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setElapsed((prev) => prev + 1)
      if (mediaRecorderRef.current?.state === 'recording') {
        timerRef.current = setTimeout(function tick() {
          setElapsed((prev) => prev + 1)
          if (mediaRecorderRef.current?.state === 'recording') {
            timerRef.current = setTimeout(tick, 1000)
          }
        }, 1000)
      }
    }, 1000)
  }, [])

  const startRecording = useCallback(async () => {
    if (panelStateRef.current !== 'idle') return
    isRecordingRequestedRef.current = true
    liveTranscriptRef.current = ''
    chunksRef.current = []
    setLiveTranscript('')
    setElapsed(0)
    setDonePayload(null)
    setAudioSrc(null)

    if (isOverlay) {
      try {
        await getCurrentWindow().show()
        await getCurrentWindow().setFocus()
      } catch {
        /* ignore */
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPanelState('recording')

      // Start Web Speech API for live transcription
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRec) {
        try {
          const rec = new SpeechRec()
          rec.continuous = true
          rec.interimResults = true
          rec.lang = 'en-US'
          rec.onresult = (event: SpeechRecognitionEvent) => {
            let transcript = ''
            for (let i = 0; i < Object.keys(event.results).length; i++) {
              const res = event.results[i]
              if (res?.[0]?.transcript) {
                transcript += res[0].transcript + ' '
              }
            }
            liveTranscriptRef.current = transcript.trim()
            setLiveTranscript(transcript.trim())
          }
          rec.onerror = null
          rec.start()
          speechRef.current = rec
        } catch {
          // ignore speech recognition init failures
        }
      }

      // Start MediaRecorder for the audio file
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        try {
          speechRef.current?.stop()
        } catch {
          /* ignore */
        }
        setPanelState('processing')
        if (isOverlay) {
          try {
            await getCurrentWindow().show()
          } catch {
            /* ignore */
          }
        }

        const finalMime = recorder.mimeType || 'audio/webm'
        const ext = finalMime.includes('mp4') || finalMime.includes('m4a') ? 'm4a' : 'webm'
        const blob = new Blob(chunksRef.current, { type: finalMime })

        try {
          const base64 = await blobToBase64(blob)
          const savedPath = await window.electronAPI.saveAsset(base64, ext, '.audio')

          const audioDataUrl = await window.electronAPI.readAsset(savedPath)
          setAudioSrc(audioDataUrl)

          // Step 1 — Use Web Speech API live transcription directly
          let rawTranscript = liveTranscriptRef.current.trim()
          const hasApiKey = await window.electronAPI.getApiKeyStatus()

          // Only attempt backend Whisper transcription if Web Speech API captured nothing
          if (!rawTranscript && hasApiKey) {
            try {
              const baseUrl =
                localStorage.getItem(SETTINGS_KEYS.API_BASE_URL) || 'https://api.openai.com/v1'
              const whisperText = await window.electronAPI.openaiTranscribe(savedPath, baseUrl)
              if (whisperText?.trim()) rawTranscript = whisperText.trim()
            } catch (err: unknown) {
              // Ignore Whisper failures if endpoint is incompatible (e.g. OpenRouter key)
              // eslint-disable-next-line no-console
              console.warn('[MemoVoicePanel] Whisper transcribe fallback failed:', err)
            }
          }

          // Show direct transcript instantly while AI formats reply
          setDonePayload({
            audioPath: savedPath,
            rawTranscript: rawTranscript || 'Voice note recorded (no speech detected)',
            interpreted: 'Formatting with AI...',
            isInterpreting: true,
          })
          setPanelState('done')

          // Step 2 — interpret transcript with the configured model
          let interpreted = rawTranscript || 'Voice note recorded (no speech detected)'
          if (hasApiKey && rawTranscript && !rawTranscript.startsWith('[')) {
            try {
              const model =
                localStorage.getItem(SETTINGS_KEYS.API_MODEL) ||
                'nvidia/nemotron-3-super-120b-a12b:free'
              const baseUrl =
                localStorage.getItem(SETTINGS_KEYS.API_BASE_URL) || 'https://openrouter.ai/api/v1'

              const result = await window.electronAPI.openAIChat({
                model,
                baseUrl,
                messages: [
                  { role: 'system', content: INTERPRET_SYSTEM_PROMPT },
                  {
                    role: 'user',
                    content: `Convert this voice note to PaperCache markdown:\n\n"${rawTranscript}"`,
                  },
                ],
              })
              const content = result?.choices?.[0]?.message?.content
              if (content?.trim()) interpreted = content.trim()
            } catch (err: unknown) {
              // eslint-disable-next-line no-console
              console.error('[MemoVoicePanel] AI interpretation failed:', err)
              const aiErr =
                typeof err === 'string' ? err : (err as Error)?.message || 'AI request failed'
              interpreted = `${rawTranscript}\n\n[AI Formatting Error: ${aiErr}]`
            }
          }

          setDonePayload({
            audioPath: savedPath,
            rawTranscript: rawTranscript || 'Voice note recorded',
            interpreted,
            isInterpreting: false,
          })
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[MemoVoicePanel] Failed to process recording:', err)
          const errMsg =
            typeof err === 'string' ? err : (err as Error)?.message || 'Processing error'
          setDonePayload({
            audioPath: '',
            rawTranscript: `[Error processing voice note: ${errMsg}]`,
            interpreted: `[Error processing voice note: ${errMsg}]`,
            isInterpreting: false,
          })
          setPanelState('done')
        }
      }

      recorder.start()
      tickTimer()

      if (!isRecordingRequestedRef.current) {
        const elapsedMs = Date.now() - holdStartRef.current
        const delay = Math.max(0, 400 - elapsedMs)
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
        }, delay)
      }
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('[MemoVoicePanel] Microphone access failed:', err)
      isRecordingRequestedRef.current = false
      const errMsg =
        typeof err === 'string' ? err : (err as Error)?.message || 'Microphone access denied'
      setDonePayload({
        audioPath: '',
        rawTranscript: `[Microphone Access Failed: ${errMsg}. Please grant microphone permission in System Settings → Privacy & Security → Microphone.]`,
        interpreted: `[Microphone Access Failed: ${errMsg}. Please grant microphone permission in System Settings → Privacy & Security → Microphone.]`,
        isInterpreting: false,
      })
      setPanelState('done')
      if (isOverlay) {
        try {
          await getCurrentWindow().show()
        } catch {
          /* ignore */
        }
      }
    }
  }, [isOverlay, tickTimer])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    try {
      speechRef.current?.stop()
    } catch {
      /* ignore */
    }
  }, [])

  const stopRecordingSafe = useCallback(() => {
    isRecordingRequestedRef.current = false
    if (panelStateRef.current === 'recording') {
      const elapsedMs = Date.now() - holdStartRef.current
      if (elapsedMs < 400) {
        setTimeout(() => {
          stopRecording()
        }, 400 - elapsedMs)
      } else {
        stopRecording()
      }
    }
  }, [stopRecording])

  // Cmd+Shift+M capture handler for hold-to-record
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        e.stopPropagation()
        if (!e.repeat && panelStateRef.current === 'idle') {
          holdStartRef.current = Date.now()
          startRecording()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'm' ||
        e.key === 'Shift' ||
        e.key === 'Meta' ||
        e.key === 'Control'
      ) {
        stopRecordingSafe()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
    }
  }, [startRecording, stopRecordingSafe])

  // Listen for global shortcut trigger from Rust
  useEffect(() => {
    let unlistenPress: (() => void) | undefined
    let unlistenRelease: (() => void) | undefined
    let unlistenLegacy: (() => void) | undefined

    listen('trigger-voice-memo-press', () => {
      if (panelStateRef.current === 'idle') {
        holdStartRef.current = Date.now()
        startRecording()
      }
    })
      .then((fn) => {
        unlistenPress = fn
      })
      .catch(() => {})

    listen('trigger-voice-memo-release', () => {
      stopRecordingSafe()
    })
      .then((fn) => {
        unlistenRelease = fn
      })
      .catch(() => {})

    listen('trigger-voice-memo', () => {
      if (panelStateRef.current === 'idle') {
        holdStartRef.current = Date.now()
        startRecording()
      } else {
        stopRecordingSafe()
      }
    })
      .then((fn) => {
        unlistenLegacy = fn
      })
      .catch(() => {})

    return () => {
      if (unlistenPress) unlistenPress()
      if (unlistenRelease) unlistenRelease()
      if (unlistenLegacy) unlistenLegacy()
    }
  }, [startRecording, stopRecordingSafe])

  const insertIntoNote = useCallback(async () => {
    if (!donePayload) return
    if (isOverlay) {
      await emit('insert-voice-note', { text: donePayload.interpreted })
      try {
        await getCurrentWindow().hide()
      } catch {
        /* ignore */
      }
    } else if (editorRef.current?.view) {
      const view = editorRef.current.view
      const { from } = view.state.selection.main
      const insertText = '\n' + donePayload.interpreted + '\n'
      view.dispatch({ changes: { from, to: from, insert: insertText } })
      view.focus()
    } else {
      await emit('insert-voice-note', { text: donePayload.interpreted })
    }
    setDonePayload(null)
    setAudioSrc(null)
    setPanelState('idle')
  }, [donePayload, editorRef, isOverlay])

  const discard = useCallback(async () => {
    if (isOverlay) {
      try {
        await getCurrentWindow().hide()
      } catch {
        /* ignore */
      }
    }
    setDonePayload(null)
    setAudioSrc(null)
    setPanelState('idle')
  }, [isOverlay])

  const copyInterpreted = useCallback(() => {
    if (!donePayload) return
    navigator.clipboard.writeText(donePayload.interpreted).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }, [donePayload])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (panelState === 'idle') return null

  return (
    <div
      className={`memo-panel ${isOverlay ? 'memo-panel--overlay' : ''}`}
      aria-label="Memo voice notes panel"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {panelState === 'recording' && (
        <div className="memo-pillbox memo-pillbox--recording">
          <span className="memo-pulse-dot" aria-hidden="true" />
          <span className="memo-elapsed">{formatTime(elapsed)}</span>
          <span className="memo-recording-label">
            {liveTranscript ? `“${liveTranscript}”` : 'Recording…'}
          </span>
        </div>
      )}

      {panelState === 'processing' && (
        <div className="memo-pillbox memo-pillbox--processing">
          <span className="memo-spinner" aria-hidden="true" />
          <span className="memo-processing-text">Transcribing audio…</span>
        </div>
      )}

      {panelState === 'done' && donePayload && (
        <div className="memo-result" aria-label="Voice note result">
          {audioSrc && <AudioWaveformPill audioSrc={audioSrc} />}

          {donePayload.rawTranscript && (
            <div className="memo-raw-transcript" aria-label="Direct transcription">
              <em className="memo-gray-slanted">"{donePayload.rawTranscript}"</em>
            </div>
          )}

          <div className="memo-interpreted-block">
            <div className="memo-interpreted-header">
              <span className="memo-interpreted-icon" aria-hidden="true">
                {donePayload.isInterpreting ? '⏳' : '✨'}
              </span>
              <span className="memo-interpreted-label">
                {donePayload.isInterpreting ? 'Formatting with AI…' : 'AI Reply'}
              </span>
              {!donePayload.isInterpreting && (
                <div className="memo-interpreted-actions">
                  <button
                    id="memo-copy-btn"
                    className="memo-action-btn memo-action-btn--secondary"
                    onClick={copyInterpreted}
                    aria-label="Copy interpreted text"
                    title="Copy to clipboard"
                  >
                    {copyFeedback ? '✓ Copied' : '⎘ Copy'}
                  </button>
                </div>
              )}
            </div>
            {donePayload.isInterpreting ? (
              <div className="memo-ai-shimmer">Structuring your notes with PaperCache DSL...</div>
            ) : (
              <pre className="memo-interpreted-pre">{donePayload.interpreted}</pre>
            )}
            <div className="memo-insert-row">
              <button
                id="memo-discard-btn"
                className="memo-action-btn memo-action-btn--ghost"
                onClick={discard}
                aria-label="Discard voice note result"
              >
                Discard
              </button>
              <button
                id="memo-insert-btn"
                className="memo-action-btn memo-action-btn--primary"
                onClick={insertIntoNote}
                disabled={donePayload.isInterpreting}
                aria-label="Insert interpreted text into note"
              >
                Insert into Note ↓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

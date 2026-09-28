import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  Gauge,
  Home,
  Loader2,
  Lock,
  Play,
  Pause,
  Settings as SettingsIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { loadPdf } from '../lib/pdf'
import PageCanvas, { type PageDims } from './PageCanvas'
import SettingsPanel from './SettingsPanel'
import CameraPanel from './CameraPanel'
import GazeOverlays from './GazeOverlays'
import type { EyeTrackingHandle } from '../hooks/useEyeTracking'
import type { InputMode, LoadedDocument, ReaderSettings } from '../types'

interface PDFReaderProps {
  doc: LoadedDocument
  tracker: EyeTrackingHandle
  mode: InputMode
  settings: ReaderSettings
  onSettingsChange: (patch: Partial<ReaderSettings>) => void
  onRecalibrate: () => void
  onSwitchMode: (m: InputMode) => void
  onExit: () => void
}

interface SpanMeta {
  x: number
  y: number
  w: number
  h: number
  el: HTMLElement
}

interface TextIndexEntry {
  token: number
  div: HTMLDivElement
  spans: SpanMeta[]
}

type LoadPhase =
  | { kind: 'loading'; progress: number }
  | { kind: 'password' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' }

const MAX_SCROLL_SPEED = 760 // px/s at sensitivity 1
const PAGE_GAP_PADDING = 40

const PDFReader: React.FC<PDFReaderProps> = ({
  doc,
  tracker,
  mode,
  settings,
  onSettingsChange,
  onRecalibrate,
  onSwitchMode,
  onExit,
}) => {
  // ---------------- document loading ----------------
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [phase, setPhase] = useState<LoadPhase>({ kind: 'loading', progress: 0 })
  const [defaultDims, setDefaultDims] = useState<PageDims>({ w: 612, h: 792 })
  const passwordRef = useRef<((pw: string) => void) | null>(null)
  const [passwordInput, setPasswordInput] = useState('')

  useEffect(() => {
    let alive = true
    let loaded: PDFDocumentProxy | null = null
    setPhase({ kind: 'loading', progress: 0 })
    setPdf(null)
    setNumPages(0)
    document.title = `${doc.name} — Oculis`

    loadPdf(doc.file, {
      onProgress: (f) => {
        if (alive) setPhase({ kind: 'loading', progress: f })
      },
      onPassword: (update) => {
        passwordRef.current = update
        if (alive) setPhase({ kind: 'password' })
      },
    })
      .then(async ({ pdf }) => {
        if (!alive) {
          pdf.destroy()
          return
        }
        loaded = pdf
        setPdf(pdf)
        setNumPages(pdf.numPages)
        try {
          const first = await pdf.getPage(1)
          const v = first.getViewport({ scale: 1 })
          if (alive) setDefaultDims({ w: v.width, h: v.height })
        } catch {
          /* keep default letter dims */
        }
        setPhase({ kind: 'ready' })
      })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : String(err)
        if (/password/i.test(msg)) {
          setPhase({ kind: 'password' })
        } else {
          setPhase({ kind: 'error', message: msg })
        }
      })

    return () => {
      alive = false
      loaded?.destroy()
      document.title = 'Oculis — Eye-Tracking PDF Reader'
    }
  }, [doc])

  // ---------------- layout ----------------
  const containerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)
  const [zoomMul, setZoomMul] = useState(1)
  const [layoutToken, setLayoutToken] = useState(0)
  const pageDimsRef = useRef<Map<number, PageDims>>(new Map())

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth))
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [phase.kind])

  const baseWidth = Math.max(320, Math.min(containerW - PAGE_GAP_PADDING * 2, 980))
  const targetWidth = Math.round(baseWidth * zoomMul)

  // keep scroll ratio stable across zoom changes
  const ratioRef = useRef<number | null>(null)
  const applyZoom = useCallback(
    (mul: number | ((m: number) => number)) => {
      const c = containerRef.current
      if (c) {
        const denom = c.scrollHeight - c.clientHeight
        ratioRef.current = denom > 0 ? c.scrollTop / denom : 0
      }
      setZoomMul(mul)
    },
    [],
  )
  useLayoutEffect(() => {
    const c = containerRef.current
    if (c && ratioRef.current !== null) {
      const denom = c.scrollHeight - c.clientHeight
      c.scrollTop = ratioRef.current * denom
      ratioRef.current = null
    }
  }, [targetWidth])

  // ---------------- virtualization ----------------
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set())
  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const ioRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root || numPages === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev)
          for (const e of entries) {
            const pn = Number((e.target as HTMLElement).dataset.page)
            if (e.isIntersecting) next.add(pn)
            else next.delete(pn)
          }
          return next
        })
      },
      { root, rootMargin: '130% 0px' },
    )
    ioRef.current = io
    pageElsRef.current.forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      ioRef.current = null
    }
  }, [numPages, phase.kind])

  const registerEl = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageElsRef.current.set(pageNum, el)
      ioRef.current?.observe(el)
    } else {
      pageElsRef.current.delete(pageNum)
    }
  }, [])

  const onDims = useCallback((pageNum: number, dims: PageDims) => {
    pageDimsRef.current.set(pageNum, dims)
    setLayoutToken((t) => t + 1)
  }, [])

  useEffect(() => {
    setLayoutToken((t) => t + 1)
  }, [targetWidth])

  // ---------------- text index / word highlight ----------------
  const textIndexRef = useRef<Map<number, TextIndexEntry>>(new Map())
  const layoutTokenRef = useRef(layoutToken)
  layoutTokenRef.current = layoutToken
  const lastHighlightRef = useRef<HTMLElement | null>(null)
  const lastGazePosRef = useRef<{ top: number; page: number } | null>(null)
  const wordTimesRef = useRef<number[]>([])
  const [wpm, setWpm] = useState(0)

  const buildEntry = useCallback((pageNum: number, div: HTMLDivElement): TextIndexEntry => {
    const spans: SpanMeta[] = []
    div.querySelectorAll<HTMLElement>('span').forEach((el) => {
      const text = el.textContent?.trim()
      if (!text || el.offsetWidth === 0) return
      spans.push({
        x: el.offsetLeft,
        y: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
        el,
      })
    })
    const entry = { token: layoutTokenRef.current, div, spans }
    textIndexRef.current.set(pageNum, entry)
    return entry
  }, [])

  const onTextReady = useCallback(
    (pageNum: number, div: HTMLDivElement) => {
      requestAnimationFrame(() => buildEntry(pageNum, div))
    },
    [buildEntry],
  )

  const onTextGone = useCallback(
    (pageNum: number) => {
      const entry = textIndexRef.current.get(pageNum)
      if (entry) {
        entry.spans.forEach((s) => s.el.classList.remove('gaze-word'))
        if (lastHighlightRef.current && entry.spans.some((s) => s.el === lastHighlightRef.current)) {
          lastHighlightRef.current = null
        }
        textIndexRef.current.delete(pageNum)
      }
    },
    [],
  )

  const clearHighlight = useCallback(() => {
    lastHighlightRef.current?.classList.remove('gaze-word')
    lastHighlightRef.current = null
  }, [])

  // word-under-gaze highlighter
  useEffect(() => {
    if (!settings.highlightWord) {
      clearHighlight()
      return
    }
    const interval = setInterval(() => {
      const g = tracker.gazeRef.current
      const col = columnRef.current
      if (!g || !col) {
        clearHighlight()
        return
      }
      const rect = col.getBoundingClientRect()
      if (g.x < rect.left || g.x > rect.right || g.y < rect.top - 40 || g.y > rect.bottom + 40) {
        clearHighlight()
        return
      }
      const lx = g.x - rect.left
      const ly = g.y - rect.top

      // locate the page under the gaze
      let pageEl: HTMLDivElement | null = null
      let pageNum = 0
      for (const [pn, el] of pageElsRef.current) {
        if (ly >= el.offsetTop && ly <= el.offsetTop + el.offsetHeight) {
          pageEl = el
          pageNum = pn
          break
        }
      }
      if (!pageEl) {
        clearHighlight()
        return
      }

      let entry = textIndexRef.current.get(pageNum)
      if (!entry) {
        clearHighlight()
        return
      }
      if (entry.token !== layoutTokenRef.current) {
        entry = buildEntry(pageNum, entry.div)
      }

      const fx = lx - pageEl.offsetLeft
      const fy = ly - pageEl.offsetTop
      let best: SpanMeta | null = null
      let bestScore = Infinity
      for (const s of entry.spans) {
        // generous hit-box: one full line tall, small horizontal padding
        if (fy < s.y - s.h * 0.6 || fy > s.y + s.h * 1.8) continue
        if (fx < s.x - 10 || fx > s.x + s.w + 10) continue
        const score =
          Math.abs(fy - (s.y + s.h / 2)) / s.h +
          Math.abs(fx - (s.x + s.w / 2)) / Math.max(s.w, 1) * 0.5
        if (score < bestScore) {
          bestScore = score
          best = s
        }
      }

      if (!best) {
        clearHighlight()
        return
      }
      if (lastHighlightRef.current !== best.el) {
        lastHighlightRef.current?.classList.remove('gaze-word')
        best.el.classList.add('gaze-word')
        lastHighlightRef.current = best.el
        wordTimesRef.current.push(performance.now())
      }
      lastGazePosRef.current = { top: pageEl.offsetTop + best.y, page: pageNum }
    }, 60)

    return () => {
      clearInterval(interval)
      clearHighlight()
    }
  }, [settings.highlightWord, tracker.gazeRef, buildEntry, clearHighlight])

  // wpm + elapsed ticker
  const [elapsed, setElapsed] = useState(0)
  const startedAtRef = useRef(Date.now())
  useEffect(() => {
    startedAtRef.current = Date.now()
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
      const cutoff = performance.now() - 60_000
      const arr = wordTimesRef.current
      while (arr.length && arr[0] < cutoff) arr.shift()
      const mins = Math.max((Date.now() - startedAtRef.current) / 60000, 0.25)
      setWpm(Math.round(Math.min(arr.length, 60 * mins * 900) / Math.min(mins, 1)))
    }, 2000)
    return () => clearInterval(iv)
  }, [doc])

  // ---------------- current page + progress ----------------
  const [currentPage, setCurrentPage] = useState(1)
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage
  const progressBarRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef(0)

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const onScroll = () => {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = requestAnimationFrame(() => {
        const denom = c.scrollHeight - c.clientHeight
        if (progressBarRef.current) {
          progressBarRef.current.style.transform = `scaleX(${denom > 0 ? c.scrollTop / denom : 0})`
        }
        // current page = page covering the 1/3 line of the viewport
        const probe = c.scrollTop + c.clientHeight / 3
        let page = 1
        pageElsRef.current.forEach((el, pn) => {
          if (el.offsetTop <= probe) page = Math.max(page, pn)
        })
        setCurrentPage(page)
      })
    }
    c.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      c.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(scrollRafRef.current)
    }
  }, [numPages, phase.kind])

  // ---------------- autoscroll engine ----------------
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const lastManualRef = useRef(0)
  const statusRef = useRef(tracker.status)
  statusRef.current = tracker.status

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const markManual = () => {
      lastManualRef.current = performance.now()
    }
    c.addEventListener('wheel', markManual, { passive: true })
    c.addEventListener('touchmove', markManual, { passive: true })
    return () => {
      c.removeEventListener('wheel', markManual)
      c.removeEventListener('touchmove', markManual)
    }
  }, [phase.kind])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const c = containerRef.current
      if (!c || pausedRef.current) return
      const s = settingsRef.current
      let v = 0

      if (s.autoscroll) {
        const g = tracker.gazeRef.current
        const trackingOk = mode === 'camera' ? statusRef.current === 'running' : g !== null
        if (g && trackingOk) {
          const r = c.getBoundingClientRect()
          const rel = (g.y - r.top) / r.height
          const zone = s.edgeZone
          const max = MAX_SCROLL_SPEED * s.sensitivity
          if (rel > 1 - zone) {
            v += Math.pow(Math.min((rel - (1 - zone)) / zone, 1.5), 1.4) * max
          } else if (rel < zone) {
            v -= Math.pow(Math.min((zone - rel) / zone, 1.5), 1.4) * max
          }
        }
      }

      if (s.steadyScroll && now - lastManualRef.current > 2500) {
        v += s.steadySpeed
      }

      if (v !== 0) {
        c.scrollTop += v * dt
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [tracker.gazeRef, mode, phase.kind])

  // ---------------- navigation helpers ----------------
  const scrollToPage = useCallback(
    (n: number) => {
      const clamped = Math.min(Math.max(1, n), numPages)
      const el = pageElsRef.current.get(clamped)
      const c = containerRef.current
      if (el && c) {
        c.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' })
        setCurrentPage(clamped)
      }
    },
    [numPages],
  )

  const resumeReadingPosition = useCallback(() => {
    const pos = lastGazePosRef.current
    const c = containerRef.current
    if (pos && c) {
      c.scrollTo({ top: pos.top - c.clientHeight * 0.35, behavior: 'smooth' })
    }
  }, [])

  // ---------------- keyboard shortcuts ----------------
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          setPaused((p) => !p)
          break
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault()
          scrollToPageRef.current(currentPageRef.current + 1)
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          scrollToPageRef.current(currentPageRef.current - 1)
          break
        case '+':
        case '=':
          applyZoom((m) => Math.min(2.5, m + 0.15))
          break
        case '-':
          applyZoom((m) => Math.max(0.5, m - 0.15))
          break
        case '0':
        case 'f':
        case 'F':
          applyZoom(1)
          break
        case 'r':
        case 'R':
          resumeReadingPosition()
          break
        case 'c':
        case 'C':
          onRecalibrate()
          break
        case 'g':
        case 'G':
          onSettingsChange({ guideLine: !settingsRef.current.guideLine })
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyZoom, onRecalibrate, onSettingsChange, resumeReadingPosition])
  const scrollToPageRef = useRef(scrollToPage)
  scrollToPageRef.current = scrollToPage

  // ---------------- stats formatting ----------------
  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, '0')
  const sizeMb = (doc.size / (1024 * 1024)).toFixed(1)

  const [pageJump, setPageJump] = useState('')
  const trackingBanner = useMemo(() => {
    if (mode !== 'camera') return null
    if (tracker.status === 'denied')
      return 'Camera permission denied. Eye tracking is off.'
    if (tracker.status === 'error') return tracker.error ?? 'Eye tracking failed to start.'
    return null
  }, [mode, tracker.status, tracker.error])

  // --------------------------------------------------------

  const themeBg =
    settings.theme === 'sepia'
      ? 'bg-[#e8dfc9]'
      : settings.theme === 'light'
        ? 'bg-[#d7dbe4]'
        : 'bg-[#0b0f1a]'

  return (
    <div className="flex h-full flex-col bg-[#0b0f1a]">
      {/* toolbar */}
      <div className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0d1220]/95 px-3 backdrop-blur">
        <button
          onClick={onExit}
          title="Back to home (Esc)"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-300 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-white">{doc.name}</h1>
            <span className="hidden shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 md:inline">
              {sizeMb} MB · {numPages || '…'} pages{doc.isSample ? ' · sample' : ''}
            </span>
          </div>
        </div>

        {/* stats */}
        <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 lg:flex">
          <span className="flex items-center gap-1" title="Reading time">
            <Clock className="h-3 w-3 text-cyan-300" />
            {mm}:{ss}
          </span>
          <span className="flex items-center gap-1" title="Approx. words per minute (gaze-based)">
            <Gauge className="h-3 w-3 text-indigo-300" />
            {wpm} wpm
          </span>
        </div>

        {/* page jump */}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            const n = parseInt(pageJump, 10)
            if (!Number.isNaN(n)) scrollToPage(n)
            setPageJump('')
          }}
        >
          <input
            value={pageJump}
            onChange={(e) => setPageJump(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={String(currentPage)}
            aria-label="Go to page"
            className="h-8 w-14 rounded-lg border border-white/10 bg-white/5 px-2 text-center text-sm text-white outline-none placeholder:text-slate-400 focus:border-indigo-400"
          />
          <span className="text-xs text-slate-400">/ {numPages || '—'}</span>
        </form>

        {/* zoom */}
        <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            onClick={() => applyZoom((m) => Math.max(0.5, m - 0.15))}
            className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/10"
            title="Zoom out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => applyZoom(1)}
            className="w-12 text-center text-xs font-medium text-slate-200 transition hover:text-white"
            title="Reset zoom (0)"
          >
            {Math.round(zoomMul * 100)}%
          </button>
          <button
            onClick={() => applyZoom((m) => Math.min(2.5, m + 0.15))}
            className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/10"
            title="Zoom in (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* steady scroll toggle */}
        <button
          onClick={() => onSettingsChange({ steadyScroll: !settings.steadyScroll })}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${
            settings.steadyScroll
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-300 hover:bg-white/10'
          }`}
          title="Teleprompter mode — scrolls at a constant pace"
        >
          {settings.steadyScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="hidden xl:inline">Auto</span>
        </button>

        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className={`rounded-lg p-2 transition ${
            settingsOpen ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10'
          }`}
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* progress bar */}
      <div className="relative z-10 h-[3px] shrink-0 bg-white/5">
        <div
          ref={progressBarRef}
          className="h-full origin-left bg-gradient-to-r from-indigo-400 to-cyan-400 transition-transform duration-150"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      {/* tracking problem banner */}
      {trackingBanner && (
        <div className="flex items-center gap-3 border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{trackingBanner}</span>
          <button
            onClick={tracker.retry}
            className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium transition hover:bg-white/20"
          >
            Retry
          </button>
          <button
            onClick={() => onSwitchMode('mouse')}
            className="rounded-md bg-amber-400/20 px-2.5 py-1 text-xs font-medium transition hover:bg-amber-400/30"
          >
            Use mouse instead
          </button>
        </div>
      )}

      {/* body */}
      <div className="relative flex min-h-0 flex-1">
        <div
          ref={containerRef}
          className={`min-w-0 flex-1 overflow-y-auto ${themeBg}`}
        >
          {phase.kind === 'loading' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm">
                Loading PDF…{' '}
                {phase.progress > 0 ? `${Math.round(phase.progress * 100)}%` : ''}
              </p>
            </div>
          )}

          {phase.kind === 'password' && (
            <form
              className="flex h-full flex-col items-center justify-center gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                passwordRef.current?.(passwordInput)
                setPhase({ kind: 'loading', progress: 0 })
              }}
            >
              <Lock className="h-8 w-8 text-indigo-300" />
              <p className="text-sm text-slate-300">This PDF is password protected</p>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="h-10 w-64 rounded-xl border border-white/10 bg-white/5 px-3 text-center text-white outline-none focus:border-indigo-400"
              />
              <button className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110">
                Unlock
              </button>
            </form>
          )}

          {phase.kind === 'error' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="h-8 w-8 text-rose-400" />
              <p className="text-sm font-medium text-rose-200">Could not open this PDF</p>
              <p className="max-w-md text-xs text-slate-400">{phase.message}</p>
              <button
                onClick={onExit}
                className="mt-2 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
              >
                <Home className="h-4 w-4" /> Choose another file
              </button>
            </div>
          )}

          {phase.kind === 'ready' && pdf && numPages > 0 && containerW > 0 && (
            <div ref={columnRef} className="relative mx-auto flex w-fit flex-col items-center py-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <PageCanvas
                  key={n}
                  pdf={pdf}
                  pageNum={n}
                  width={targetWidth}
                  defaultDims={pageDimsRef.current.get(n) ?? defaultDims}
                  shouldRender={visiblePages.has(n)}
                  onDims={onDims}
                  onTextReady={onTextReady}
                  onTextGone={onTextGone}
                  registerEl={registerEl}
                />
              ))}
            </div>
          )}
        </div>

        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettingsChange={onSettingsChange}
          mode={mode}
          onSwitchMode={onSwitchMode}
          onRecalibrate={onRecalibrate}
          trackerStatus={tracker.status}
          wpm={wpm}
          onResume={resumeReadingPosition}
        />
      </div>

      {/* paused chip */}
      {paused && (
        <button
          onClick={() => setPaused(false)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur transition hover:bg-black/90"
        >
          <Pause className="h-3.5 w-3.5 text-amber-300" />
          Auto-scroll paused — Space to resume
        </button>
      )}

      <GazeOverlays
        gazeRef={tracker.gazeRef}
        showCursor={settings.showGazeCursor}
        showGuide={settings.guideLine}
        active={mode === 'mouse' || tracker.status === 'running'}
      />

      {mode === 'camera' && settings.showCamera && (
        <CameraPanel stream={tracker.stream} status={tracker.status} />
      )}
    </div>
  )
}

export default PDFReader

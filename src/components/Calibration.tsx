import React, { useEffect, useRef, useState } from 'react'
import { X, RefreshCw, CheckCircle2, Loader2, Eye } from 'lucide-react'
import { gazeEngine } from '../lib/gazeEngine'
import { fitCalibration } from '../lib/regression'
import type { CalibrationModel, CalibrationSample, IrisFeatures } from '../types'

interface CalibrationProps {
  stream: MediaStream | null
  onComplete: (model: CalibrationModel) => void
  onSkip: () => void
  onCancel: () => void
}

const POINTS: { x: number; y: number; label: string }[] = [
  { x: 10, y: 10, label: 'top left' },
  { x: 90, y: 10, label: 'top right' },
  { x: 90, y: 90, label: 'bottom right' },
  { x: 10, y: 90, label: 'bottom left' },
  { x: 50, y: 10, label: 'top center' },
  { x: 50, y: 90, label: 'bottom center' },
  { x: 10, y: 50, label: 'middle left' },
  { x: 90, y: 50, label: 'middle right' },
  { x: 50, y: 50, label: 'center' },
]

const DWELL_MS = 1400
const MIN_SAMPLES = 5

function medianFeatures(samples: IrisFeatures[]): IrisFeatures {
  const xs = samples.map((s) => s.fx).sort((a, b) => a - b)
  const ys = samples.map((s) => s.fy).sort((a, b) => a - b)
  const mid = Math.floor(samples.length / 2)
  return { fx: xs[mid], fy: ys[mid] }
}

const Calibration: React.FC<CalibrationProps> = ({
  stream,
  onComplete,
  onSkip,
  onCancel,
}) => {
  const [pointIndex, setPointIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [warm, setWarm] = useState(false) // first iris data seen
  const [pointWarning, setPointWarning] = useState<string | null>(null)
  const [fitted, setFitted] = useState<CalibrationModel | null>(null)
  const samplesRef = useRef<CalibrationSample[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Attach the shared camera stream to the preview video
  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      video.srcObject = stream
      video.play().catch(() => undefined)
    }
    return () => {
      if (video) video.srcObject = null
    }
  }, [stream])

  // Warm-up: wait until the first real iris reading arrives
  useEffect(() => {
    if (warm) return
    const unsub = gazeEngine.subscribe((f) => {
      if (f.features) setWarm(true)
    })
    const timeout = setTimeout(() => setWarm(true), 20_000) // fail-safe
    return () => {
      unsub()
      clearTimeout(timeout)
    }
  }, [warm])

  // Escape to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Collect iris samples while dwelling on the current point
  useEffect(() => {
    if (!warm || fitted) return

    const buffer: IrisFeatures[] = []
    const unsub = gazeEngine.subscribe((f) => {
      if (f.features) buffer.push(f.features)
    })

    const startedAt = performance.now()
    const interval = setInterval(() => {
      const elapsed = performance.now() - startedAt
      // Grace period: don't start counting until we have data
      if (buffer.length === 0 && elapsed > 3000) {
        setPointWarning('No eyes detected — face the camera with good lighting')
        return
      }
      if (buffer.length === 0) return
      setPointWarning(null)
      const p = Math.min(1, elapsed / DWELL_MS)
      setProgress(p)
      if (p < 1) return

      clearInterval(interval)
      if (buffer.length < MIN_SAMPLES) {
        setPointWarning('Too few samples — keep looking at the dot')
        setProgress(0)
        // restart this point on next tick
        setPointIndex((i) => i)
        return
      }

      const rect = overlayRef.current?.getBoundingClientRect()
      const point = POINTS[pointIndex]
      samplesRef.current.push({
        features: medianFeatures(buffer),
        screen: rect
          ? {
              x: rect.left + (point.x / 100) * rect.width,
              y: rect.top + (point.y / 100) * rect.height,
            }
          : {
              x: (point.x / 100) * window.innerWidth,
              y: (point.y / 100) * window.innerHeight,
            },
      })

      if (pointIndex + 1 < POINTS.length) {
        setPointIndex(pointIndex + 1)
        setProgress(0)
      } else {
        const model = fitCalibration(samplesRef.current)
        setFitted(model)
      }
    }, 50)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [warm, pointIndex, fitted])

  const quality = (m: CalibrationModel): { label: string; cls: string } => {
    if (!Number.isFinite(m.fitError)) return { label: 'Estimated mapping', cls: 'text-amber-300' }
    if (m.fitError < 70) return { label: `Excellent (±${Math.round(m.fitError)}px)`, cls: 'text-emerald-300' }
    if (m.fitError < 140) return { label: `Good (±${Math.round(m.fitError)}px)`, cls: 'text-cyan-300' }
    return { label: `Rough (±${Math.round(m.fitError)}px) — recalibrate helps`, cls: 'text-amber-300' }
  }

  const R = 30
  const CIRC = 2 * Math.PI * R

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 overflow-hidden bg-[#0b0f1a]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />
      </div>

      {/* header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-white">Calibration</h2>
          <p className="text-sm text-slate-400">
            {fitted
              ? 'All points captured'
              : warm
                ? `Point ${Math.min(pointIndex + 1, POINTS.length)} of ${POINTS.length} — look at the pulsing dot (${POINTS[Math.min(pointIndex, POINTS.length - 1)].label})`
                : 'Warming up camera & models…'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>

      {/* points (fixed positioned like the reader viewport) */}
      {!fitted &&
        POINTS.map((p, i) => {
          const isActive = warm && i === pointIndex
          const isDone = i < pointIndex
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {isActive && (
                <svg width={72} height={72} className="absolute -left-9 -top-9">
                  <circle
                    cx={36}
                    cy={36}
                    r={R}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={3}
                  />
                  <circle
                    cx={36}
                    cy={36}
                    r={R}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - progress)}
                    transform="rotate(-90 36 36)"
                  />
                </svg>
              )}
              <div
                className={`h-5 w-5 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'cal-dot-active bg-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.9)]'
                    : isDone
                      ? 'bg-emerald-400'
                      : 'bg-white/15'
                }`}
              />
            </div>
          )
        })}

      {/* status messages */}
      {!fitted && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          {!warm ? (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading face model & starting camera…
            </div>
          ) : pointWarning ? (
            <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-300">
              {pointWarning}
            </div>
          ) : (
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              Keep your head still — only move your eyes
            </div>
          )}
        </div>
      )}

      {/* result */}
      {fitted && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0f1a]/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121828] p-8 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h3 className="mt-4 text-xl font-bold text-white">Calibration complete</h3>
            <p className={`mt-2 text-sm font-medium ${quality(fitted).cls}`}>
              {quality(fitted).label}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Your gaze model is saved on this device. You can recalibrate anytime with the
              <kbd className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-200">C</kbd>
              key.
            </p>
            <button
              onClick={() => onComplete(fitted)}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
            >
              Start reading
            </button>
            <button
              onClick={() => {
                samplesRef.current = []
                setFitted(null)
                setPointIndex(0)
                setProgress(0)
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" /> Redo calibration
            </button>
          </div>
        </div>
      )}

      {/* camera preview */}
      <div className="absolute bottom-6 right-6 w-52 overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full -scale-x-100 object-cover opacity-90"
          muted
          playsInline
        />
        <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 text-[11px] text-slate-300">
          <Eye className="h-3 w-3" /> Preview — mirrored
        </div>
      </div>

      {/* skip */}
      {!fitted && (
        <button
          onClick={onSkip}
          className="absolute bottom-6 left-6 rounded-lg px-3 py-2 text-xs text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
        >
          Skip calibration (less accurate)
        </button>
      )}
    </div>
  )
}

export default Calibration

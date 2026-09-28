import { useCallback, useEffect, useRef, useState } from 'react'
import { gazeEngine } from '../lib/gazeEngine'
import { OneEuroFilter, predictGaze } from '../lib/regression'
import type {
  CalibrationModel,
  GazePoint,
  InputMode,
  IrisFeatures,
  TrackerStatus,
} from '../types'

export interface EyeTrackingHandle {
  status: TrackerStatus
  /** Always-fresh smoothed gaze position in viewport pixels. Mutable — read inside rAF. */
  gazeRef: React.MutableRefObject<GazePoint | null>
  /** Latest raw iris features (for live display), mutable ref. */
  featuresRef: React.MutableRefObject<IrisFeatures | null>
  faceDetected: boolean
  error: string | null
  stream: MediaStream | null
  retry: () => void
}

/**
 * Feeds smoothed gaze points into a mutable ref at ~30 Hz.
 * Camera mode: FaceMesh iris features → calibration regression → One Euro filter.
 * Mouse mode: pointer position, lightly smoothed (demo / fallback mode).
 */
export function useEyeTracking(
  enabled: boolean,
  mode: InputMode,
  calibration: CalibrationModel | null,
): EyeTrackingHandle {
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(gazeEngine.getStream())
  const [attempt, setAttempt] = useState(0)
  const gazeRef = useRef<GazePoint | null>(null)
  const featuresRef = useRef<IrisFeatures | null>(null)
  const filterXRef = useRef(new OneEuroFilter())
  const filterYRef = useRef(new OneEuroFilter())
  const featHistRef = useRef<IrisFeatures[]>([])
  const calibrationRef = useRef(calibration)
  calibrationRef.current = calibration

  // Watch engine stream changes
  useEffect(() => {
    return gazeEngine.onChange(() => setStream(gazeEngine.getStream()))
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (mode === 'camera') gazeEngine.stop()
      setStatus('idle')
      setFaceDetected(false)
      gazeRef.current = null
      return
    }

    if (mode === 'mouse') {
      setStatus('running')
      setError(null)
      const fx = new OneEuroFilter(2.5, 0.5)
      const fy = new OneEuroFilter(2.5, 0.5)
      const onMove = (e: MouseEvent) => {
        const t = performance.now()
        gazeRef.current = { x: fx.filter(e.clientX, t), y: fy.filter(e.clientY, t) }
      }
      window.addEventListener('mousemove', onMove, { passive: true })
      return () => window.removeEventListener('mousemove', onMove)
    }

    // Camera mode
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    setStatus('starting')
    setError(null)

    gazeEngine
      .start()
      .then(() => {
        if (cancelled) return
        setStatus('running')
        unsubscribe = gazeEngine.subscribe((frame) => {
          if (!frame.features) {
            featuresRef.current = null
            setFaceDetected(false)
            setStatus((s) => (s === 'running' ? 'face-lost' : s))
            return
          }
          // Median-of-3 pre-filter: MediaPipe landmarks exhibit spiky jitter;
          // a short median kills single-frame spikes without adding lag.
          const hist = featHistRef.current
          hist.push(frame.features)
          if (hist.length > 3) hist.shift()
          const fxs = hist.map((h) => h.fx).sort((a, b) => a - b)
          const fys = hist.map((h) => h.fy).sort((a, b) => a - b)
          const mid = Math.floor(hist.length / 2)
          const smooth = { fx: fxs[mid], fy: fys[mid] }

          featuresRef.current = smooth
          setFaceDetected(true)
          setStatus((s) => (s === 'face-lost' || s === 'starting' ? 'running' : s))
          const model = calibrationRef.current
          if (!model) return
          const p = predictGaze(model, smooth)
          gazeRef.current = {
            x: filterXRef.current.filter(p.x, frame.timestamp),
            y: filterYRef.current.filter(p.y, frame.timestamp),
          }
        })
      })
      .catch((err: DOMException | Error) => {
        if (cancelled) return
        const name = (err as DOMException).name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied')
          setError('Camera permission was denied.')
        } else if (name === 'NotFoundError') {
          setStatus('error')
          setError('No camera found on this device.')
        } else {
          setStatus('error')
          setError('Could not start eye tracking. Check your connection and try again.')
        }
      })

    return () => {
      cancelled = true
      unsubscribe?.()
      filterXRef.current.reset()
      filterYRef.current.reset()
      featHistRef.current = []
      // Fully release the camera whenever the reader unmounts or tracking is disabled.
      gazeEngine.stop()
    }
  }, [enabled, mode, attempt])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  // Dev-only debug handle for e2e tests
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__gaze = gazeRef
      ;(window as unknown as Record<string, unknown>).__trackStatus = () => status
    }
  }, [status])

  return { status, gazeRef, featuresRef, faceDetected, error, stream, retry }
}

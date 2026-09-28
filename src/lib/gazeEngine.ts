import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import type {
  Face,
  FaceLandmarksDetector,
  Keypoint,
} from '@tensorflow-models/face-landmarks-detection'
import type { IrisFeatures } from '../types'

export interface GazeFrame {
  /** null when no face is visible */
  features: IrisFeatures | null
  face: Face | null
  timestamp: number
}

type Subscriber = (frame: GazeFrame) => void

// MediaPipe Face-Mesh 478-point indices (refineLandmarks = true)
const L_IRIS = 468
const R_IRIS = 473
const L_OUTER = 33
const L_INNER = 133
const L_TOP = 159
const L_BOTTOM = 145
const R_INNER = 362
const R_OUTER = 263
const R_TOP = 386
const R_BOTTOM = 374
const NOSE_TIP = 1

/**
 * Compute a head-scale-invariant iris displacement for one eye:
 * - fx: position of the iris along the corner-to-corner axis, centred at 0
 * - fy: vertical offset of the iris from the eye-lid midline, normalised by
 *       eye width (eye *height* varies a lot due to blinking)
 */
function eyeFeatures(
  iris: Keypoint,
  cA: Keypoint,
  cB: Keypoint,
  lidTop: Keypoint,
  lidBottom: Keypoint,
): IrisFeatures {
  const dx = cB.x - cA.x
  const dy = cB.y - cA.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return { fx: 0, fy: 0 }
  const eyeW = Math.sqrt(len2)
  const t = ((iris.x - cA.x) * dx + (iris.y - cA.y) * dy) / len2
  const lidMidY = (lidTop.y + lidBottom.y) / 2
  return { fx: t - 0.5, fy: (iris.y - lidMidY) / eyeW }
}

/**
 * Extract averaged features from both eyes. Blending both eyes roughly
 * doubles the signal-to-noise ratio and cancels single-eye blink noise.
 */
export function extractIrisFeatures(face: Face): IrisFeatures | null {
  const kp = face.keypoints
  if (kp.length < 478) return null
  const left = eyeFeatures(kp[L_IRIS], kp[L_INNER], kp[L_OUTER], kp[L_TOP], kp[L_BOTTOM])
  const right = eyeFeatures(kp[R_IRIS], kp[R_INNER], kp[R_OUTER], kp[R_TOP], kp[R_BOTTOM])
  // Blink guard: if one eye's vertical span collapses, trust the other eye.
  const openL = Math.abs(kp[L_BOTTOM].y - kp[L_TOP].y)
  const openR = Math.abs(kp[R_BOTTOM].y - kp[R_TOP].y)
  if (openL < 1.5 && openR < 1.5) return null // full blink — skip the frame
  if (openL < 1.5) return right
  if (openR < 1.5) return left
  return { fx: (left.fx + right.fx) / 2, fy: (left.fy + right.fy) / 2 }
}

class GazeEngine {
  private detector: FaceLandmarksDetector | null = null
  private modelPromise: Promise<FaceLandmarksDetector> | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private cameraPromise: Promise<MediaStream> | null = null
  private subscribers = new Set<Subscriber>()
  private loopHandle: number | null = null
  private running = false
  private lastFaceSeenAt = 0
  private listeners = new Set<() => void>()

  /** Tiny observable so React components can re-render on stream changes. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emitChange() {
    this.listeners.forEach((fn) => fn())
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  isRunning(): boolean {
    return this.running
  }

  /** Loads TF.js backend + face-mesh (with iris) exactly once. */
  private ensureModel(): Promise<FaceLandmarksDetector> {
    if (!this.modelPromise) {
      this.modelPromise = (async () => {
        await tf.setBackend('webgl')
        await tf.ready()
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
        this.detector = await faceLandmarksDetection.createDetector(model, {
          runtime: 'tfjs',
          refineLandmarks: true, // enables the 478-point attention mesh (iris)
          maxFaces: 1,
        })
        return this.detector
      })()
      // If the download fails, allow a later retry instead of caching a reject.
      this.modelPromise.catch(() => {
        this.modelPromise = null
      })
    }
    return this.modelPromise
  }

  /** Warms up the model ahead of time (call from the home screen). */
  preload(): Promise<unknown> {
    return this.ensureModel().catch(() => null)
  }

  private async ensureCamera(): Promise<MediaStream> {
    if (this.stream) return this.stream
    if (!this.cameraPromise) {
      this.cameraPromise = navigator.mediaDevices
        .getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 30 },
          },
          audio: false,
        })
        .then((stream) => {
          this.stream = stream
          this.emitChange()
          return stream
        })
      this.cameraPromise.catch(() => {
        this.cameraPromise = null
      })
    }
    return this.cameraPromise
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    return () => {
      this.subscribers.delete(fn)
    }
  }

  private broadcast(frame: GazeFrame) {
    this.subscribers.forEach((fn) => {
      try {
        fn(frame)
      } catch (err) {
        console.error('gaze subscriber error', err)
      }
    })
  }

  /**
   * Starts model + camera + the detection loop.
   * Idempotent: safe to call from multiple components / StrictMode remounts.
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const [detector, stream] = await Promise.all([
        this.ensureModel(),
        this.ensureCamera(),
      ])
      if (!this.running) return // stopped while warming up

      if (!this.video) {
        this.video = document.createElement('video')
        this.video.muted = true
        this.video.playsInline = true
        this.video.setAttribute('playsinline', '')
      }
      this.video.srcObject = stream
      await this.video.play().catch(() => undefined)

      const loop = async () => {
        if (!this.running) return
        const now = performance.now()
        try {
          if (this.video && this.video.readyState >= 2) {
            const faces: Face[] = await detector.estimateFaces(this.video, {
              flipHorizontal: false,
              staticImageMode: false,
            })
            if (faces.length > 0) {
              this.lastFaceSeenAt = now
              const features = extractIrisFeatures(faces[0])
              this.broadcast({ features, face: faces[0], timestamp: now })
            } else if (now - this.lastFaceSeenAt > 400) {
              this.broadcast({ features: null, face: null, timestamp: now })
            }
          }
        } catch (err) {
          console.error('face estimation failed', err)
        }
        // Schedule next frame: adaptive, capped around 30 fps.
        this.loopHandle = window.setTimeout(loop, 16)
      }
      loop()
      this.emitChange()
    } catch (err) {
      this.running = false
      throw err
    }
  }

  /** Stops the loop and releases the camera so the webcam LED goes off. */
  stop(): void {
    this.running = false
    if (this.loopHandle !== null) {
      clearTimeout(this.loopHandle)
      this.loopHandle = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.video) {
      this.video.srcObject = null
    }
    this.broadcast({ features: null, face: null, timestamp: performance.now() })
    this.emitChange()
  }
}

export const gazeEngine = new GazeEngine()
export { NOSE_TIP }

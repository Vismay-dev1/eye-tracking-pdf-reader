export interface GazePoint {
  x: number
  y: number
}

/** Normalised iris displacement inside the eye region. Roughly centred at 0. */
export interface IrisFeatures {
  fx: number
  fy: number
}

export interface CalibrationSample {
  features: IrisFeatures
  screen: GazePoint
}

/** A fitted quadratic mapping from iris features to screen coordinates. */
export interface CalibrationModel {
  kind: 'poly' | 'linear-fallback'
  coefX: number[]
  coefY: number[]
  /** Mean euclidean pixel error on the training samples (quality hint). */
  fitError: number
  createdAt: number
}

export type InputMode = 'camera' | 'mouse'

export type ReaderTheme = 'dark' | 'sepia' | 'light'

export type TrackerStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'face-lost'
  | 'denied'
  | 'error'

export interface ReaderSettings {
  autoscroll: boolean
  edgeZone: number // fraction of viewport height for scroll zones (0.05 - 0.3)
  sensitivity: number // 0.5 - 3
  steadyScroll: boolean
  steadySpeed: number // px per second, 20 - 400
  showGazeCursor: boolean
  highlightWord: boolean
  guideLine: boolean
  theme: ReaderTheme
  showCamera: boolean
}

export interface LoadedDocument {
  file: File
  name: string
  size: number
  isSample: boolean
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  autoscroll: true,
  edgeZone: 0.14,
  sensitivity: 1,
  steadyScroll: false,
  steadySpeed: 90,
  showGazeCursor: true,
  highlightWord: true,
  guideLine: false,
  theme: 'dark',
  showCamera: true,
}

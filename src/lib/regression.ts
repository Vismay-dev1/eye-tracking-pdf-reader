import type {
  CalibrationModel,
  CalibrationSample,
  GazePoint,
  IrisFeatures,
} from '../types'

/** Quadratic feature expansion: [1, fx, fy, fx^2, fy^2, fx*fy] */
export function polyFeatures(fx: number, fy: number): number[] {
  return [1, fx, fy, fx * fx, fy * fy, fx * fy]
}

/**
 * Solve (A^T A + λI) β = A^T b with Gaussian elimination + partial pivoting.
 * Works for the tiny (6×6) systems produced by calibration.
 */
function solveNormalEquations(rows: number[][], targets: number[], lambda = 1e-6): number[] | null {
  const n = rows[0].length
  const ata: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const atb: number[] = new Array(n).fill(0)

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const t = targets[r]
    for (let i = 0; i < n; i++) {
      atb[i] += row[i] * t
      for (let j = 0; j < n; j++) {
        ata[i][j] += row[i] * row[j]
      }
    }
  }
  for (let i = 0; i < n; i++) ata[i][i] += lambda

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(ata[r][col]) > Math.abs(ata[pivot][col])) pivot = r
    }
    if (Math.abs(ata[pivot][col]) < 1e-12) return null
    if (pivot !== col) {
      ;[ata[pivot], ata[col]] = [ata[col], ata[pivot]]
      ;[atb[pivot], atb[col]] = [atb[col], atb[pivot]]
    }
    const div = ata[col][col]
    for (let j = col; j < n; j++) ata[col][j] /= div
    atb[col] /= div
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = ata[r][col]
      if (factor === 0) continue
      for (let j = col; j < n; j++) ata[r][j] -= factor * ata[col][j]
      atb[r] -= factor * atb[col]
    }
  }
  return atb
}

/**
 * Fit a quadratic regression screen = f(iris features) from calibration samples.
 * Falls back to a simple linear min/max mapping when there are too few samples
 * or the system is singular.
 */
export function fitCalibration(samples: CalibrationSample[]): CalibrationModel | null {
  const usable = samples.filter(
    (s) =>
      Number.isFinite(s.features.fx) &&
      Number.isFinite(s.features.fy) &&
      Number.isFinite(s.screen.x) &&
      Number.isFinite(s.screen.y),
  )
  if (usable.length === 0) return null

  const rows = usable.map((s) => polyFeatures(s.features.fx, s.features.fy))
  const xs = usable.map((s) => s.screen.x)
  const ys = usable.map((s) => s.screen.y)

  const coefX = solveNormalEquations(rows, xs)
  const coefY = solveNormalEquations(rows, ys)

  if (!coefX || !coefY) {
    // Linear fallback: map observed feature bounds to observed screen bounds.
    const fxs = usable.map((s) => s.features.fx)
    const fys = usable.map((s) => s.features.fy)
    const minFx = Math.min(...fxs)
    const maxFx = Math.max(...fxs)
    const minFy = Math.min(...fys)
    const maxFy = Math.max(...fys)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const sx = maxFx - minFx < 1e-6 ? 0 : (maxX - minX) / (maxFx - minFx)
    const sy = maxFy - minFy < 1e-6 ? 0 : (maxY - minY) / (maxFy - minFy)
    return {
      kind: 'linear-fallback',
      coefX: [minX - sx * minFx, sx, 0, 0, 0, 0],
      coefY: [minY - sy * minFy, 0, sy, 0, 0, 0],
      fitError: NaN,
      createdAt: Date.now(),
    }
  }

  // Training error (mean euclidean distance in px) — a useful quality signal.
  let err = 0
  for (const s of usable) {
    const p = predictRaw({ kind: 'poly', coefX, coefY, fitError: 0, createdAt: 0 }, s.features)
    err += Math.hypot(p.x - s.screen.x, p.y - s.screen.y)
  }

  return {
    kind: 'poly',
    coefX,
    coefY,
    fitError: err / usable.length,
    createdAt: Date.now(),
  }
}

function predictRaw(model: CalibrationModel, f: IrisFeatures): GazePoint {
  const phi = polyFeatures(f.fx, f.fy)
  let x = 0
  let y = 0
  for (let i = 0; i < 6; i++) {
    x += model.coefX[i] * phi[i]
    y += model.coefY[i] * phi[i]
  }
  return { x, y }
}

/** Map iris features to screen pixels, clamped to the viewport with margins. */
export function predictGaze(model: CalibrationModel, f: IrisFeatures): GazePoint {
  const p = predictRaw(model, f)
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    x: Math.min(Math.max(p.x, -0.1 * w), 1.1 * w),
    y: Math.min(Math.max(p.y, -0.1 * h), 1.1 * h),
  }
}

/**
 * One Euro filter — adaptive exponential smoothing.
 * Slow movements are smoothed heavily (stable fixation), fast saccades are
 * followed with almost no lag.
 */
export class OneEuroFilter {
  private xPrev: number | null = null
  private dxPrev = 0
  private tPrev: number | null = null

  constructor(
    private minCutoff = 0.9, // Hz — lower = smoother when still
    private beta = 0.5, // higher = snappier response to fast motion
    private dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(x: number, t: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x
      this.tPrev = t
      return x
    }
    const dt = Math.max((t - this.tPrev) / 1000, 1e-4)
    const dx = (x - this.xPrev) / dt
    const aD = OneEuroFilter.alpha(this.dCutoff, dt)
    const dxHat = aD * dx + (1 - aD) * this.dxPrev
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)
    const a = OneEuroFilter.alpha(cutoff, dt)
    const xHat = a * x + (1 - a) * this.xPrev
    this.xPrev = xHat
    this.dxPrev = dxHat
    this.tPrev = t
    return xHat
  }

  reset() {
    this.xPrev = null
    this.dxPrev = 0
    this.tPrev = null
  }
}

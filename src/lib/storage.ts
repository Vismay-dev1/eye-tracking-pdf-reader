import { DEFAULT_SETTINGS, type CalibrationModel, type ReaderSettings } from '../types'

const CALIBRATION_KEY = 'oculis:calibration:v2'
const SETTINGS_KEY = 'oculis:settings:v2'

export function saveCalibration(model: CalibrationModel): void {
  try {
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(model))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadCalibration(): CalibrationModel | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CalibrationModel
    if (!Array.isArray(parsed.coefX) || parsed.coefX.length !== 6) return null
    return parsed
  } catch {
    return null
  }
}

export function clearCalibration(): void {
  try {
    localStorage.removeItem(CALIBRATION_KEY)
  } catch {
    /* ignore */
  }
}

export function saveSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

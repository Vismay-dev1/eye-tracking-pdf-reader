import { useCallback, useMemo, useState } from 'react'
import Home from './components/Home'
import Calibration from './components/Calibration'
import PDFReader from './components/PDFReader'
import { useEyeTracking } from './hooks/useEyeTracking'
import {
  loadCalibration,
  loadSettings,
  saveCalibration,
  saveSettings,
} from './lib/storage'
import type {
  CalibrationModel,
  InputMode,
  LoadedDocument,
  ReaderSettings,
} from './types'

function makeHeuristicCalibration(): CalibrationModel {
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    kind: 'linear-fallback',
    coefX: [w / 2, w / 0.32, 0, 0, 0, 0],
    coefY: [h / 2, 0, h / 0.18, 0, 0, 0],
    fitError: NaN,
    createdAt: Date.now(),
  }
}

function App() {
  const [doc, setDoc] = useState<LoadedDocument | null>(null)
  const [mode, setMode] = useState<InputMode>('camera')
  const [calibration, setCalibration] = useState<CalibrationModel | null>(() =>
    loadCalibration(),
  )
  const [calibrating, setCalibrating] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings())

  // The camera is needed while reading and while calibrating.
  const trackingEnabled =
    mode === 'camera' ? doc !== null || calibrating : doc !== null
  const tracker = useEyeTracking(trackingEnabled, mode, calibration)

  const patchSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const handleDocument = useCallback(
    (loaded: LoadedDocument, chosenMode: InputMode) => {
      setMode(chosenMode)
      setDoc(loaded)
      if (chosenMode === 'camera' && !calibration) {
        setCalibrating(true)
      }
    },
    [calibration],
  )

  const handleCalibrationComplete = useCallback((model: CalibrationModel) => {
    setCalibration(model)
    saveCalibration(model)
    setCalibrating(false)
  }, [])

  const handleCalibrationSkip = useCallback(() => {
    setCalibrating(false)
    setCalibration((prev) => prev ?? makeHeuristicCalibration())
  }, [])

  const handleCalibrationCancel = useCallback(() => {
    setCalibrating(false)
    setCalibration((prev) => prev ?? makeHeuristicCalibration())
  }, [])

  const handleSwitchMode = useCallback((m: InputMode) => {
    setMode(m)
    if (m === 'camera') {
      setCalibration((prev) => {
        if (prev) return prev
        setCalibrating(true)
        return prev
      })
    }
  }, [])

  const handleExit = useCallback(() => {
    setDoc(null)
  }, [])

  const showCalibration = calibrating && mode === 'camera'

  const reader = useMemo(() => {
    if (!doc) return null
    return (
      <PDFReader
        doc={doc}
        tracker={tracker}
        mode={mode}
        settings={settings}
        onSettingsChange={patchSettings}
        onRecalibrate={() => setCalibrating(true)}
        onSwitchMode={handleSwitchMode}
        onExit={handleExit}
      />
    )
  }, [
    doc,
    tracker,
    mode,
    settings,
    patchSettings,
    handleSwitchMode,
    handleExit,
  ])

  return (
    <div className="h-full w-full overflow-hidden bg-[#0b0f1a] text-slate-100">
      {doc ? (
        reader
      ) : (
        <Home onDocument={handleDocument} hasCalibration={calibration !== null} />
      )}
      {showCalibration && (
        <Calibration
          stream={tracker.stream}
          onComplete={handleCalibrationComplete}
          onSkip={handleCalibrationSkip}
          onCancel={handleCalibrationCancel}
        />
      )}
    </div>
  )
}

export default App

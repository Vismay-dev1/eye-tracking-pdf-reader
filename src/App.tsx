import React, { useState, useCallback } from 'react'
import EyeTracker from './components/EyeTracker'
import PDFViewer from './components/PDFViewer'
import Calibration from './components/Calibration'
import SettingsPanel from './components/SettingsPanel'

export interface GazePoint {
  x: number
  y: number
}

export interface CalibrationData {
  [key: string]: { x: number; y: number }[]
}

function App() {
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({})
  const [gazePoint, setGazePoint] = useState<GazePoint | null>(null)
  const [isEyeTrackingEnabled, setIsEyeTrackingEnabled] = useState(true)
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(true)
  const [scrollSensitivity, setScrollSensitivity] = useState(1)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const handleCalibrationComplete = useCallback((data: CalibrationData) => {
    setCalibrationData(data)
    setIsCalibrated(true)
    localStorage.setItem('eyeTrackingCalibration', JSON.stringify(data))
  }, [])

  const handleRecalibrate = useCallback(() => {
    setIsCalibrated(false)
    setCalibrationData({})
    localStorage.removeItem('eyeTrackingCalibration')
  }, [])

  const handlePdfUpload = useCallback((file: File) => {
    setPdfFile(file)
  }, [])

  React.useEffect(() => {
    const savedCalibration = localStorage.getItem('eyeTrackingCalibration')
    if (savedCalibration) {
      try {
        const data = JSON.parse(savedCalibration)
        setCalibrationData(data)
        setIsCalibrated(true)
      } catch (e) {
        console.error('Failed to load calibration data:', e)
      }
    }
  }, [])

  return (
    <div className="w-full h-screen flex bg-gray-50">
      <div className="flex-1 flex flex-col">
        {!isCalibrated ? (
          <Calibration onCalibrationComplete={handleCalibrationComplete} />
        ) : (
          <>
            <PDFViewer
              pdfFile={pdfFile}
              onPdfUpload={handlePdfUpload}
              gazePoint={gazePoint}
              isAutoscrollEnabled={isAutoscrollEnabled}
              scrollSensitivity={scrollSensitivity}
              calibrationData={calibrationData}
            />
            {isEyeTrackingEnabled && (
              <EyeTracker
                isEnabled={isEyeTrackingEnabled}
                calibrationData={calibrationData}
                onGazePointUpdate={setGazePoint}
              />
            )}
          </>
        )}
      </div>

      {isCalibrated && (
        <SettingsPanel
          isEyeTrackingEnabled={isEyeTrackingEnabled}
          isAutoscrollEnabled={isAutoscrollEnabled}
          scrollSensitivity={scrollSensitivity}
          onEyeTrackingToggle={setIsEyeTrackingEnabled}
          onAutoscrollToggle={setIsAutoscrollEnabled}
          onScrollSensitivityChange={setScrollSensitivity}
          onRecalibrate={handleRecalibrate}
          gazePoint={gazePoint}
        />
      )}
    </div>
  )
}

export default App

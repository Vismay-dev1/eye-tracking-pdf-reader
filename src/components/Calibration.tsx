import React, { useEffect, useRef, useState } from 'react'
import type { CalibrationData } from '../App'

interface CalibrationProps {
  onCalibrationComplete: (data: CalibrationData) => void
}

const Calibration: React.FC<CalibrationProps> = ({ onCalibrationComplete }) => {
  const [currentPoint, setCurrentPoint] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Get Ready')
  const timerRef = useRef<NodeJS.Timeout>()
  const calibrationDataRef = useRef<CalibrationData>({})

  const calibrationPoints = [
    { x: '10%', y: '10%', label: 'Top Left' },
    { x: '50%', y: '10%', label: 'Top Center' },
    { x: '90%', y: '10%', label: 'Top Right' },
    { x: '50%', y: '50%', label: 'Center' },
    { x: '10%', y: '90%', label: 'Bottom Left' },
    { x: '50%', y: '90%', label: 'Bottom Center' },
    { x: '90%', y: '90%', label: 'Bottom Right' },
  ]

  useEffect(() => {
    if (currentPoint >= calibrationPoints.length) {
      onCalibrationComplete(calibrationDataRef.current)
      return
    }

    if (currentPoint === 0 && !isRecording) {
      setMessage('Look at the dots. Starting in 3 seconds...')
      timerRef.current = setTimeout(() => {
        startCalibration()
      }, 3000)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentPoint, isRecording])

  useEffect(() => {
    if (!isRecording) return

    let countdown = 0
    setProgress(0)

    const interval = setInterval(() => {
      countdown++
      setProgress((countdown / 20) * 100)

      if (countdown >= 20) {
        clearInterval(interval)
        moveToNextPoint()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [isRecording])

  const startCalibration = () => {
    setIsRecording(true)
    setMessage(`Look at the dot for 2 seconds`)
    calibrationDataRef.current = {}
  }

  const moveToNextPoint = () => {
    const point = calibrationPoints[currentPoint]
    calibrationDataRef.current[`point_${currentPoint}`] = [
      {
        x: parseInt(point.x) / 100 * window.innerWidth,
        y: parseInt(point.y) / 100 * window.innerHeight,
      },
    ]

    if (currentPoint < calibrationPoints.length - 1) {
      setCurrentPoint(currentPoint + 1)
      setMessage(`Look at the dot for 2 seconds`)
      setProgress(0)
    } else {
      setIsRecording(false)
      setMessage('Calibration Complete!')
      setCurrentPoint(currentPoint + 1)
    }
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Eye Tracking Calibration</h1>
        <p className="text-gray-300">{message}</p>
      </div>

      <div className="relative w-full h-96 bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        {calibrationPoints.map((point, idx) => (
          <div
            key={idx}
            className={`absolute w-6 h-6 rounded-full transition-all duration-200 ${
              idx === currentPoint
                ? 'bg-red-500 w-8 h-8 shadow-lg'
                : idx < currentPoint
                ? 'bg-green-400 opacity-50'
                : 'bg-gray-500 opacity-50'
            }`}
            style={{
              left: point.x,
              top: point.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      <div className="w-64">
        <div className="bg-gray-700 h-2 rounded-full overflow-hidden">
          <div
            className="bg-green-500 h-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-gray-300 text-sm mt-2">
          Point {currentPoint + 1} of {calibrationPoints.length}
        </p>
      </div>

      <div className="bg-gray-800 text-gray-300 p-6 rounded-lg max-w-md text-center">
        <p className="mb-2 font-semibold">Calibration Instructions:</p>
        <ul className="text-left text-sm space-y-1">
          <li>• Look directly at the red dot</li>
          <li>• Keep your head still</li>
          <li>• Hold your gaze for 2 seconds</li>
          <li>• The dot will move automatically</li>
          <li>• Complete all 7 points for best accuracy</li>
        </ul>
      </div>
    </div>
  )
}

export default Calibration
import React, { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import * as faceapi from '@tensorflow-models/face-api'
import type { GazePoint, CalibrationData } from '../App'

interface EyeTrackerProps {
  isEnabled: boolean
  calibrationData: CalibrationData
  onGazePointUpdate: (point: GazePoint) => void
}

const EyeTracker: React.FC<EyeTrackerProps> = ({
  isEnabled,
  calibrationData,
  onGazePointUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        ])
        setIsModelLoaded(true)
      } catch (err) {
        console.error('Failed to load models:', err)
        setError('Failed to load face detection models')
      }
    }

    loadModels()
  }, [])

  useEffect(() => {
    if (!isEnabled || !isModelLoaded) return

    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err) {
        console.error('Error accessing webcam:', err)
        setError('Failed to access webcam. Please check permissions.')
      }
    }

    initWebcam()
  }, [isEnabled, isModelLoaded])

  useEffect(() => {
    if (!isEnabled || !isModelLoaded || !videoRef.current) return

    const detectGaze = async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) {
        animationRef.current = requestAnimationFrame(detectGaze)
        return
      }

      try {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()

        if (detections.length > 0 && canvasRef.current) {
          const landmarks = detections[0].landmarks

          const leftEye = landmarks.getJawOutline().slice(0, 2)
          const rightEye = landmarks.getNose()

          const gazeX =
            ((leftEye[0]?.x ?? 0) + (rightEye?.x ?? 0)) /
            2 /
            (videoRef.current?.videoWidth ?? 1)
          const gazeY =
            ((leftEye[0]?.y ?? 0) + (rightEye?.y ?? 0)) /
            2 /
            (videoRef.current?.videoHeight ?? 1)

          let calibratedX = gazeX
          let calibratedY = gazeY

          if (Object.keys(calibrationData).length > 0) {
            calibratedX = gazeX * window.innerWidth
            calibratedY = gazeY * window.innerHeight
          } else {
            calibratedX = gazeX * window.innerWidth
            calibratedY = gazeY * window.innerHeight
          }

          onGazePointUpdate({
            x: calibratedX,
            y: calibratedY,
          })

          drawDebugInfo(canvasRef.current, detections, calibratedX, calibratedY)
        }
      } catch (err) {
        console.error('Error detecting gaze:', err)
      }

      animationRef.current = requestAnimationFrame(detectGaze)
    }

    animationRef.current = requestAnimationFrame(detectGaze)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isEnabled, isModelLoaded, calibrationData, onGazePointUpdate])

  const drawDebugInfo = (canvas: HTMLCanvasElement, detections: any, gazeX: number, gazeY: number) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (detections.length > 0) {
      const detection = detections[0].detection
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.strokeRect(
        detection.box.x,
        detection.box.y,
        detection.box.width,
        detection.box.height
      )
    }

    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.arc(gazeX / window.innerWidth * canvas.width, gazeY / window.innerHeight * canvas.height, 5, 0, 2 * Math.PI)
    ctx.fill()
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded">
        {error}
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 w-80 bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-bold mb-2 text-sm">Eye Tracker</h3>
      <div className="relative bg-black rounded overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          width={320}
          height={240}
        />
      </div>
      <p className="text-xs text-gray-600 mt-2">
        {isModelLoaded ? 'Model loaded' : 'Loading model...'}
      </p>
    </div>
  )
}

export default EyeTracker
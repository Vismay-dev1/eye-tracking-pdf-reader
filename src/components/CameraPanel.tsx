import React, { useEffect, useRef } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { gazeEngine, type GazeFrame } from '../lib/gazeEngine'
import type { TrackerStatus } from '../types'

interface CameraPanelProps {
  stream: MediaStream | null
  status: TrackerStatus
}

/**
 * Small floating webcam preview with iris landmark overlay and tracking status.
 * The shared stream comes from the singleton gaze engine.
 */
const CameraPanel: React.FC<CameraPanelProps> = ({ stream, status }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<GazeFrame | null>(null)

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

  // draw iris points + face box on the overlay canvas (throttled via rAF flag)
  useEffect(() => {
    const drawing = { busy: false }
    const draw = () => {
      drawing.busy = false
      const canvas = canvasRef.current
      const video = videoRef.current
      const frame = frameRef.current
      if (!canvas || !video || video.videoWidth === 0) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!frame?.face) return
      const kp = frame.face.keypoints
      if (kp.length < 478) return
      const box = frame.face.box
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)'
      ctx.lineWidth = 2
      ctx.strokeRect(box.xMin, box.yMin, box.width + box.xMin - box.xMin, box.height + box.yMin - box.yMin)
      ctx.fillStyle = 'rgba(34, 211, 238, 1)'
      for (const idx of [468, 473]) {
        const p = kp[idx]
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      // eye corners for a bit of visual feedback
      ctx.fillStyle = 'rgba(165, 180, 252, 0.9)'
      for (const idx of [33, 133, 362, 263]) {
        ctx.beginPath()
        ctx.arc(kp[idx].x, kp[idx].y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const unsub = gazeEngine.subscribe((frame) => {
      frameRef.current = frame
      if (!drawing.busy) {
        drawing.busy = true
        requestAnimationFrame(draw)
      }
    })
    return unsub
  }, [])

  const chip =
    status === 'running'
      ? { icon: <Eye className="h-3 w-3" />, text: 'Tracking', cls: 'text-emerald-300' }
      : status === 'face-lost'
        ? { icon: <EyeOff className="h-3 w-3" />, text: 'Face lost', cls: 'text-amber-300' }
        : status === 'starting'
          ? { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: 'Starting…', cls: 'text-slate-300' }
          : status === 'error' || status === 'denied'
            ? { icon: <EyeOff className="h-3 w-3" />, text: 'Unavailable', cls: 'text-rose-300' }
            : { icon: <EyeOff className="h-3 w-3" />, text: 'Off', cls: 'text-slate-400' }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-44 overflow-hidden rounded-xl border border-white/15 bg-black/80 shadow-2xl backdrop-blur">
      <div className="relative aspect-[4/3] w-full">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
      </div>
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium ${chip.cls}`}>
        {chip.icon}
        {chip.text}
        <span className="ml-auto text-slate-500">mirrored</span>
      </div>
    </div>
  )
}

export default CameraPanel

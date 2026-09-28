import React, { useEffect, useRef } from 'react'
import type { GazePoint } from '../types'

interface GazeOverlaysProps {
  gazeRef: React.MutableRefObject<GazePoint | null>
  showCursor: boolean
  showGuide: boolean
  active: boolean
}

/**
 * Floating gaze dot + optional reading guide line.
 * Renders entirely via refs/rAF — zero React re-renders at gaze rate.
 */
const GazeOverlays: React.FC<GazeOverlaysProps> = ({
  gazeRef,
  showCursor,
  showGuide,
  active,
}) => {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const flagsRef = useRef({ showCursor, showGuide, active })
  flagsRef.current = { showCursor, showGuide, active }

  useEffect(() => {
    let raf = 0
    // trailing positions for the soft ring (springy follow)
    let rx = 0
    let ry = 0
    const step = () => {
      raf = requestAnimationFrame(step)
      const g = gazeRef.current
      const { showCursor: dot, showGuide: guide, active: on } = flagsRef.current
      const dotEl = dotRef.current
      const ringEl = ringRef.current
      const lineEl = lineRef.current
      if (!dotEl || !ringEl || !lineEl) return

      if (!g || !on) {
        dotEl.style.opacity = '0'
        ringEl.style.opacity = '0'
        lineEl.style.opacity = '0'
        return
      }
      rx += (g.x - rx) * 0.18
      ry += (g.y - ry) * 0.18

      dotEl.style.opacity = dot ? '1' : '0'
      dotEl.style.transform = `translate3d(${g.x}px, ${g.y}px, 0) translate(-50%, -50%)`

      ringEl.style.opacity = dot ? '0.85' : '0'
      ringEl.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`

      lineEl.style.opacity = guide ? '1' : '0'
      lineEl.style.transform = `translate3d(0, ${g.y}px, 0)`
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [gazeRef])

  return (
    <>
      <div
        ref={lineRef}
        className="pointer-events-none fixed left-0 right-0 top-0 z-30 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent opacity-0 transition-opacity duration-300"
        style={{ transform: 'translate3d(0,-100px,0)' }}
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-50 h-9 w-9 rounded-full border border-cyan-300/60 opacity-0"
        style={{ transform: 'translate3d(-100px,-100px,0)' }}
      />
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-50 h-2.5 w-2.5 rounded-full bg-cyan-300 opacity-0 shadow-[0_0_14px_rgba(34,211,238,0.9)]"
        style={{ transform: 'translate3d(-100px,-100px,0)' }}
      />
    </>
  )
}

export default GazeOverlays

import React, { memo, useEffect, useRef, useState } from 'react'
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist'

export interface PageDims {
  w: number
  h: number
}

interface PageCanvasProps {
  pdf: PDFDocumentProxy
  pageNum: number // 1-based
  /** target display width in CSS px */
  width: number
  defaultDims: PageDims
  /** render only when near the viewport */
  shouldRender: boolean
  onDims: (pageNum: number, dims: PageDims) => void
  onTextReady: (pageNum: number, layer: HTMLDivElement) => void
  onTextGone: (pageNum: number) => void
  registerEl: (pageNum: number, el: HTMLDivElement | null) => void
}

/**
 * One PDF page: a hi-DPI canvas plus an invisible, selectable pdf.js TextLayer
 * whose spans double as hit-targets for word-level gaze tracking.
 */
const PageCanvas: React.FC<PageCanvasProps> = ({
  pdf,
  pageNum,
  width,
  defaultDims,
  shouldRender,
  onDims,
  onTextReady,
  onTextGone,
  registerEl,
}) => {
  const [dims, setDims] = useState<PageDims>(defaultDims)
  const [rendered, setRendered] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const dimsRef = useRef(dims)
  dimsRef.current = dims

  const scale = width / dims.w
  const height = dims.h * scale

  useEffect(() => {
    if (!shouldRender) return
    let cancelled = false
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null
    let textLayer: TextLayer | null = null

    ;(async () => {
      try {
        const page = await pdf.getPage(pageNum)
        if (cancelled) return

        // Report true page dimensions once (for mixed-size documents)
        const base = page.getViewport({ scale: 1 })
        const known = dimsRef.current
        if (Math.abs(base.width - known.w) > 1 || Math.abs(base.height - known.h) > 1) {
          onDims(pageNum, { w: base.width, h: base.height })
          setDims({ w: base.width, h: base.height })
        }

        const liveScale = width / base.width
        const viewport = page.getViewport({ scale: liveScale })

        // --- canvas ---
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) return

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        await renderTask.promise
        if (cancelled) return

        // --- text layer (invisible but selectable + gaze hit-testing) ---
        const textDiv = textRef.current
        if (textDiv) {
          textDiv.innerHTML = ''
          textDiv.style.setProperty('--scale-factor', String(viewport.scale))
          textLayer = new TextLayer({
            textContentSource: page.streamTextContent({ disableNormalization: false }),
            container: textDiv,
            viewport,
          })
          await textLayer.render()
          if (cancelled) {
            textLayer.cancel()
            return
          }
          onTextReady(pageNum, textDiv)
        }
        setRendered(true)
      } catch (err) {
        const name = (err as Error)?.name
        if (name !== 'RenderingCancelledException') {
          console.error(`page ${pageNum} render failed`, err)
        }
      }
    })()

    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
      if (shouldRender) onTextGone(pageNum)
    }
  }, [pdf, pageNum, width, shouldRender, onDims, onTextReady, onTextGone])

  return (
    <div
      ref={(el) => registerEl(pageNum, el)}
      className="page-wrap relative my-2 shrink-0 shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
      style={{ width, height }}
      data-page={pageNum}
    >
      {shouldRender ? (
        <>
          <canvas ref={canvasRef} className="block bg-white" />
          <div ref={textRef} className="textLayer" />
          {!rendered && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-800/30 text-xs text-slate-500">
          Page {pageNum}
        </div>
      )}
    </div>
  )
}

export default memo(PageCanvas)

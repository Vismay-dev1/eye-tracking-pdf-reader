import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut, Upload } from 'lucide-react'
import type { GazePoint, CalibrationData } from '../App'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface PDFViewerProps {
  pdfFile: File | null
  onPdfUpload: (file: File) => void
  gazePoint: GazePoint | null
  isAutoscrollEnabled: boolean
  scrollSensitivity: number
  calibrationData: CalibrationData
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfFile,
  onPdfUpload,
  gazePoint,
  isAutoscrollEnabled,
  scrollSensitivity,
  calibrationData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!pdfFile) return

    setLoading(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer
        const loadedPdf = await pdfjsLib.getDocument(data).promise
        setPdf(loadedPdf)
        setTotalPages(loadedPdf.numPages)
        setCurrentPage(1)
      } catch (err) {
        console.error('Error loading PDF:', err)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(pdfFile)
  }, [pdfFile])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage)
        const viewport = page.getViewport({ scale: zoom })
        const canvas = canvasRef.current!
        const context = canvas.getContext('2d')!

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise
      } catch (err) {
        console.error('Error rendering page:', err)
      }
    }

    renderPage()
  }, [pdf, currentPage, zoom])

  useEffect(() => {
    if (!isAutoscrollEnabled || !gazePoint || !containerRef.current) return

    const container = containerRef.current
    const scrollThreshold = 0.3

    const gazePercentageY = gazePoint.y / window.innerHeight
    const maxScrollSpeed = 5 * scrollSensitivity

    let scrollDelta = 0

    if (gazePercentageY > 1 - scrollThreshold) {
      scrollDelta =
        ((gazePercentageY - (1 - scrollThreshold)) / scrollThreshold) *
        maxScrollSpeed
    } else if (gazePercentageY < 0.2) {
      scrollDelta =
        -((0.2 - gazePercentageY) / 0.2) * maxScrollSpeed
    }

    if (scrollDelta !== 0) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        container.scrollTop += scrollDelta
      }, 16)
    }
  }, [gazePoint, isAutoscrollEnabled, scrollSensitivity])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onPdfUpload(file)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleZoom = (direction: 'in' | 'out') => {
    const newZoom = direction === 'in' ? zoom + 0.2 : Math.max(0.5, zoom - 0.2)
    setZoom(newZoom)
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">PDF Reader</h1>
          {pdfFile && <span className="text-sm text-gray-400">{pdfFile.name}</span>}
        </div>

        {pdfFile && (
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!pdfFile ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Upload size={64} className="text-gray-400" />
            <p className="text-gray-300 text-lg">Upload a PDF to get started</p>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded cursor-pointer">
              Choose File
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-300">Loading PDF...</div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="flex-1 overflow-auto flex flex-col items-center gap-4 p-4"
          >
            <canvas
              ref={canvasRef}
              className="bg-white rounded shadow-lg"
            />
          </div>
        )}
      </div>

      {pdfFile && (
        <div className="bg-gray-800 text-white p-4 flex items-center justify-center gap-4">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronUp size={24} />
          </button>

          <button
            onClick={() => handleZoom('out')}
            className="p-2 hover:bg-gray-700 rounded"
          >
            <ZoomOut size={24} />
          </button>

          <span className="px-4 py-2 bg-gray-700 rounded">{(zoom * 100).toFixed(0)}%</span>

          <button
            onClick={() => handleZoom('in')}
            className="p-2 hover:bg-gray-700 rounded"
          >
            <ZoomIn size={24} />
          </button>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown size={24} />
          </button>

          <label className="ml-auto bg-green-600 hover:bg-green-700 px-4 py-2 rounded cursor-pointer">
            Upload New PDF
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default PDFViewer

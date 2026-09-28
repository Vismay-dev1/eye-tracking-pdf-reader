import React, { useCallback, useRef, useState } from 'react'
import {
  Eye,
  FileText,
  UploadCloud,
  Sparkles,
  MousePointer2,
  Video,
  MoveVertical,
  Highlighter,
  HandMetal,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { generateSamplePdf } from '../lib/samplePdf'
import { gazeEngine } from '../lib/gazeEngine'
import type { InputMode, LoadedDocument } from '../types'

interface HomeProps {
  onDocument: (doc: LoadedDocument, mode: InputMode) => void
  hasCalibration: boolean
}

const MAX_SIZE_MB = 150

const Home: React.FC<HomeProps> = ({ onDocument, hasCalibration }) => {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [mode, setMode] = useState<InputMode>('camera')
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        setError('That file is not a PDF. Please choose a .pdf document.')
        return
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`That PDF is larger than ${MAX_SIZE_MB} MB — try a smaller file.`)
        return
      }
      setError(null)
      onDocument({ file, name: file.name, size: file.size, isSample: false }, mode)
    },
    [mode, onDocument],
  )

  const handleSample = async () => {
    setGenerating(true)
    setError(null)
    try {
      const file = await generateSamplePdf()
      onDocument({ file, name: file.name, size: file.size, isSample: true }, mode)
    } catch (e) {
      console.error(e)
      setError('Could not generate the sample PDF.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="relative min-h-full overflow-y-auto">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col px-6 py-8">
        {/* header */}
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
            <Eye className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Oculis</h1>
            <p className="text-xs text-slate-400">Eye-tracking PDF reader</p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% on-device — no video ever leaves your browser
          </div>
        </header>

        {/* hero */}
        <div className="mt-14 text-center">
          <h2 className="bg-gradient-to-br from-white via-slate-200 to-indigo-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Read with your eyes.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-slate-400">
            Upload a PDF, calibrate once in twenty seconds, and the page scrolls itself
            as you read. A soft highlight follows the word you're looking at — hands
            completely free.
          </p>
        </div>

        {/* mode picker */}
        <div className="mx-auto mt-8 grid w-full max-w-md grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur">
          <button
            onClick={() => {
              setMode('camera')
              gazeEngine.preload()
            }}
            onMouseEnter={() => gazeEngine.preload()}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              mode === 'camera'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <Video className="h-4 w-4" />
            Eye tracking
          </button>
          <button
            onClick={() => setMode('mouse')}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              mode === 'mouse'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <MousePointer2 className="h-4 w-4" />
            Mouse (demo)
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          {mode === 'camera'
            ? hasCalibration
              ? '✓ Saved calibration found — you can recalibrate anytime'
              : 'Webcam + one-time 20 s calibration'
            : 'No camera needed — your cursor acts as your gaze'}
        </p>

        {/* dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a PDF"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            acceptFile(e.dataTransfer.files?.[0])
          }}
          className={`group mx-auto mt-8 flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-8 py-14 transition-all ${
            dragOver
              ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01]'
              : 'border-white/15 bg-white/[0.03] hover:border-indigo-400/60 hover:bg-white/[0.06]'
          }`}
        >
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all ${
              dragOver ? 'bg-cyan-400/20' : 'bg-indigo-500/15 group-hover:scale-110'
            }`}
          >
            <UploadCloud
              className={`h-8 w-8 ${dragOver ? 'text-cyan-300' : 'text-indigo-300'}`}
            />
          </div>
          <p className="mt-5 text-lg font-semibold text-white">
            {dragOver ? 'Drop it — let\'s read' : 'Drag & drop your PDF here'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            or <span className="font-medium text-indigo-300 underline underline-offset-2">browse your files</span> · up to {MAX_SIZE_MB} MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              acceptFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {error && (
          <div className="mx-auto mt-4 flex w-full max-w-2xl items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            onClick={handleSample}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-indigo-400/50 hover:bg-indigo-500/15 hover:text-white disabled:opacity-50"
          >
            <Sparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'No PDF handy? Try the sample document'}
          </button>
        </div>

        {/* how it works */}
        <div className="mt-16 grid gap-4 pb-10 sm:grid-cols-3">
          {[
            {
              icon: <Video className="h-5 w-5 text-cyan-300" />,
              title: '1 · Quick calibration',
              body: 'Follow 9 dots with your eyes for ~20 seconds. A polynomial model learns your personal gaze geometry.',
            },
            {
              icon: <MoveVertical className="h-5 w-5 text-indigo-300" />,
              title: '2 · Just read',
              body: 'Glance at the bottom edge and the page glides down; look up to go back. Speed adapts to where you look.',
            },
            {
              icon: <Highlighter className="h-5 w-5 text-amber-300" />,
              title: '3 · Never lose your place',
              body: 'The exact word under your gaze stays highlighted. Distracted? Press R to jump back to it instantly.',
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                {c.icon}
              </div>
              <h3 className="mt-3 font-semibold text-white">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>

        <footer className="mt-auto flex items-center justify-between border-t border-white/10 py-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <HandMetal className="h-3.5 w-3.5" /> Hands-free reading, on your machine
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF.js · MediaPipe FaceMesh · TensorFlow.js
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Home

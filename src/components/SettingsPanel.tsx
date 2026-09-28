import React from 'react'
import {
  X,
  MoveVertical,
  FastForward,
  Highlighter,
  CircleDot,
  Minus,
  Video,
  MousePointer2,
  RefreshCw,
  Palette,
  CornerDownRight,
  Activity,
} from 'lucide-react'
import type { InputMode, ReaderSettings, TrackerStatus } from '../types'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: ReaderSettings
  onSettingsChange: (patch: Partial<ReaderSettings>) => void
  mode: InputMode
  onSwitchMode: (m: InputMode) => void
  onRecalibrate: () => void
  trackerStatus: TrackerStatus
  wpm: number
  onResume: () => void
}

const Toggle: React.FC<{
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  icon?: React.ReactNode
}> = ({ checked, onChange, label, hint, icon }) => (
  <label className="flex cursor-pointer items-start justify-between gap-3 py-2.5">
    <span className="flex items-start gap-2.5">
      {icon && <span className="mt-0.5 text-indigo-300">{icon}</span>}
      <span>
        <span className="block text-sm font-medium text-slate-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-slate-400">{hint}</span>}
      </span>
    </span>
    <span
      className={`relative mt-0.5 inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-indigo-500' : 'bg-white/15'
      }`}
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </span>
  </label>
)

const Slider: React.FC<{
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}> = ({ label, value, min, max, step, format, onChange, disabled }) => (
  <div className={`py-2.5 ${disabled ? 'opacity-40' : ''}`}>
    <div className="mb-1.5 flex items-center justify-between text-sm">
      <span className="font-medium text-slate-100">{label}</span>
      <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-semibold text-cyan-300">
        {format(value)}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-indigo-400"
    />
  </div>
)

const THEMES = [
  { id: 'dark', label: 'Dark', swatch: 'bg-[#0b0f1a] border-white/20' },
  { id: 'sepia', label: 'Sepia', swatch: 'bg-[#e8dfc9] border-amber-900/30' },
  { id: 'light', label: 'Light', swatch: 'bg-[#d7dbe4] border-slate-400/40' },
] as const

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-b border-white/10 px-5 py-4">
    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
      {title}
    </h4>
    {children}
  </div>
)

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  open,
  onClose,
  settings,
  onSettingsChange,
  mode,
  onSwitchMode,
  onRecalibrate,
  trackerStatus,
  wpm,
  onResume,
}) => {
  return (
    <aside
      className={`flex w-80 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0d1220] transition-all duration-300 ${
        open ? 'mr-0' : '-mr-80 w-80'
      }`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h3 className="font-bold text-white">Settings</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Section title="Gaze input">
        <div className="grid grid-cols-2 gap-2 pb-1">
          <button
            onClick={() => onSwitchMode('camera')}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
              mode === 'camera'
                ? 'border-indigo-400/60 bg-indigo-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Video className="h-3.5 w-3.5" /> Camera
          </button>
          <button
            onClick={() => onSwitchMode('mouse')}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
              mode === 'mouse'
                ? 'border-indigo-400/60 bg-indigo-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" /> Mouse
          </button>
        </div>
        {mode === 'camera' && (
          <>
            <div className="flex items-center justify-between py-1 text-xs text-slate-400">
              <span>Status</span>
              <span
                className={
                  trackerStatus === 'running'
                    ? 'text-emerald-300'
                    : trackerStatus === 'face-lost'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                }
              >
                {trackerStatus === 'running'
                  ? '● Tracking'
                  : trackerStatus === 'face-lost'
                    ? '◌ Face not visible'
                    : trackerStatus === 'starting'
                      ? '◌ Starting…'
                      : trackerStatus}
              </span>
            </div>
            <button
              onClick={onRecalibrate}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110"
            >
              <RefreshCw className="h-4 w-4" /> Recalibrate (C)
            </button>
            <Toggle
              checked={settings.showCamera}
              onChange={(v) => onSettingsChange({ showCamera: v })}
              label="Camera preview"
              icon={<Video className="h-4 w-4" />}
            />
          </>
        )}
      </Section>

      <Section title="Scrolling">
        <Toggle
          checked={settings.autoscroll}
          onChange={(v) => onSettingsChange({ autoscroll: v })}
          label="Gaze edge scrolling"
          hint="Look at the bottom/top edge of the window to scroll."
          icon={<MoveVertical className="h-4 w-4" />}
        />
        <Slider
          label="Scroll zones"
          value={settings.edgeZone}
          min={0.06}
          max={0.3}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onSettingsChange({ edgeZone: v })}
          disabled={!settings.autoscroll}
        />
        <Slider
          label="Sensitivity"
          value={settings.sensitivity}
          min={0.4}
          max={3}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(v) => onSettingsChange({ sensitivity: v })}
          disabled={!settings.autoscroll}
        />
        <Toggle
          checked={settings.steadyScroll}
          onChange={(v) => onSettingsChange({ steadyScroll: v })}
          label="Teleprompter mode"
          hint="Constant-speed scrolling, pauses when you scroll manually."
          icon={<FastForward className="h-4 w-4" />}
        />
        <Slider
          label="Teleprompter speed"
          value={settings.steadySpeed}
          min={20}
          max={400}
          step={5}
          format={(v) => `${Math.round(v)} px/s`}
          onChange={(v) => onSettingsChange({ steadySpeed: v })}
          disabled={!settings.steadyScroll}
        />
      </Section>

      <Section title="Reading aids">
        <Toggle
          checked={settings.highlightWord}
          onChange={(v) => onSettingsChange({ highlightWord: v })}
          label="Highlight word under gaze"
          hint="The word you look at lights up — press R to jump back to it."
          icon={<Highlighter className="h-4 w-4" />}
        />
        <Toggle
          checked={settings.showGazeCursor}
          onChange={(v) => onSettingsChange({ showGazeCursor: v })}
          label="Gaze cursor"
          icon={<CircleDot className="h-4 w-4" />}
        />
        <Toggle
          checked={settings.guideLine}
          onChange={(v) => onSettingsChange({ guideLine: v })}
          label="Reading guide line (G)"
          hint="A horizontal line that follows your gaze vertically."
          icon={<Minus className="h-4 w-4" />}
        />
        <button
          onClick={onResume}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          <CornerDownRight className="h-4 w-4 text-cyan-300" /> Jump to last gaze position (R)
        </button>
      </Section>

      <Section title="Appearance">
        <div className="flex items-center gap-2 py-1">
          <Palette className="h-4 w-4 text-indigo-300" />
          <span className="text-sm font-medium text-slate-100">Reading theme</span>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSettingsChange({ theme: t.id })}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs transition ${
                settings.theme === t.id
                  ? 'border-indigo-400/60 bg-indigo-500/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className={`h-6 w-10 rounded-md border ${t.swatch}`} />
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <div className="px-5 py-4 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-cyan-300" />
          Live pace: <span className="font-semibold text-slate-300">{wpm} wpm</span>
        </p>
        <p className="mt-3 leading-relaxed">
          Shortcuts: <kbd className="rounded bg-white/10 px-1">Space</kbd> pause ·{' '}
          <kbd className="rounded bg-white/10 px-1">←/→</kbd> pages ·{' '}
          <kbd className="rounded bg-white/10 px-1">+/−</kbd> zoom ·{' '}
          <kbd className="rounded bg-white/10 px-1">R</kbd> resume ·{' '}
          <kbd className="rounded bg-white/10 px-1">C</kbd> calibrate
        </p>
      </div>
    </aside>
  )
}

export default SettingsPanel

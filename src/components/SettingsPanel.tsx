import React from 'react'
import { Settings, Eye, RotateCcw } from 'lucide-react'
import type { GazePoint } from '../App'

interface SettingsPanelProps {
  isEyeTrackingEnabled: boolean
  isAutoscrollEnabled: boolean
  scrollSensitivity: number
  onEyeTrackingToggle: (enabled: boolean) => void
  onAutoscrollToggle: (enabled: boolean) => void
  onScrollSensitivityChange: (sensitivity: number) => void
  onRecalibrate: () => void
  gazePoint: GazePoint | null
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isEyeTrackingEnabled,
  isAutoscrollEnabled,
  scrollSensitivity,
  onEyeTrackingToggle,
  onAutoscrollToggle,
  onScrollSensitivityChange,
  onRecalibrate,
  gazePoint,
}) => {
  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 shadow-xl overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 text-white font-bold">
          <Settings size={20} />
          <span>Settings</span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isEyeTrackingEnabled}
              onChange={(e) => onEyeTrackingToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-blue-400" />
              <span className="text-white font-medium">Eye Tracking</span>
            </div>
          </label>
          <p className="text-xs text-gray-400 ml-7 mt-1">
            {isEyeTrackingEnabled ? 'Active' : 'Disabled'}
          </p>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoscrollEnabled}
              onChange={(e) => onAutoscrollToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-white font-medium">Autoscroll</span>
          </label>
          <p className="text-xs text-gray-400 ml-7 mt-1">
            {isAutoscrollEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>

        <div>
          <label className="block text-white font-medium mb-2">Scroll Sensitivity</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scrollSensitivity}
            onChange={(e) => onScrollSensitivityChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Slow</span>
            <span className="font-bold text-blue-400">{scrollSensitivity.toFixed(1)}x</span>
            <span>Fast</span>
          </div>
        </div>

        <div className="bg-gray-800 p-3 rounded">
          <p className="text-white font-medium mb-2">Gaze Position</p>
          <div className="text-xs text-gray-400 space-y-1">
            <p>
              X:{' '}
              <span className="text-blue-400 font-mono">
                {gazePoint ? gazePoint.x.toFixed(0) : '---'}
              </span>
            </p>
            <p>
              Y:{' '}
              <span className="text-blue-400 font-mono">
                {gazePoint ? gazePoint.y.toFixed(0) : '---'}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={onRecalibrate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw size={16} />
          Recalibrate
        </button>
      </div>
    </div>
  )
}

export default SettingsPanel
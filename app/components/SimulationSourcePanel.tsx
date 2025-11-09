'use client'

import { useEffect, useState } from 'react'
import {
  SimulationSourceTracker,
  SimulationSourceStatus,
} from '@/lib/telemetry/simulation-source'
import { PhaseType } from '@/lib/types'

const TRACKED_PHASES: PhaseType[] = ['explosion', 'ecosystem']

const labels: Record<'server' | 'local', string> = {
  server: 'Server (staging)',
  local: 'Local (browser fallback)',
}

const colors: Record<'server' | 'local', string> = {
  server: 'text-green-300 border-green-500',
  local: 'text-amber-300 border-amber-500',
}

export function SimulationSourcePanel() {
  const [snapshot, setSnapshot] = useState<Record<PhaseType, SimulationSourceStatus>>({} as Record<
    PhaseType,
    SimulationSourceStatus
  >)

  useEffect(() => {
    const tracker = SimulationSourceTracker.getInstance()
    const unsubscribe = tracker.subscribe((next) => {
      setSnapshot(next)
    })
    return unsubscribe
  }, [])

  const renderRow = (phase: PhaseType) => {
    if (!TRACKED_PHASES.includes(phase)) return null
    const status = snapshot[phase]
    const mode = status?.mode ?? 'local'
    const accel = status?.accelerator
    const since =
      status && typeof performance !== 'undefined'
        ? ((performance.now() - status.lastUpdated) / 1000).toFixed(1)
        : null

    const metricsParts: string[] = []
    if (typeof status?.latencyMs === 'number') {
      metricsParts.push(`${Math.round(status.latencyMs)}ms compute`)
    }
    if (typeof status?.roundTripMs === 'number') {
      metricsParts.push(`${Math.round(status.roundTripMs)}ms RTT`)
    }
    if (typeof status?.sampleSize === 'number') {
      metricsParts.push(`${status.sampleSize} samples`)
    }
    const metricsText = metricsParts.join(' · ')

    return (
      <div
        key={phase}
        className={`text-xs font-mono border px-2 py-1 rounded ${colors[mode]}`}
      >
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-wide">{phase}</span>
          <span className="text-right">
            {labels[mode]}{accel ? ` · ${accel.toUpperCase()}` : ''}
            {since && <span className="block text-[10px] text-gray-400">updated {since}s ago</span>}
          </span>
        </div>
        {metricsText && (
          <div className="text-right text-[10px] text-gray-300 mt-1">{metricsText}</div>
        )}
      </div>
    )
  }

  return (
    <div className="absolute top-4 left-4 space-y-2 bg-black bg-opacity-50 p-3 rounded border border-gray-700 text-gray-200">
      <div className="text-[11px] uppercase tracking-widest text-gray-400">
        Physics Source Monitor
      </div>
      {TRACKED_PHASES.map((phase) => renderRow(phase))}
    </div>
  )
}

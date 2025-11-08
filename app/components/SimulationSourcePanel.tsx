'use client'

import { useEffect, useState } from 'react'
import {
  SimulationSourceTracker,
  SimulationSourceStatus,
} from '@/lib/telemetry/simulation-source'
import { PhaseType } from '@/lib/types'

const TRACKED_PHASES: PhaseType[] = ['explosion', 'ecosystem']

const labels: Record<'server' | 'local', string> = {
  server: 'Server (staging GPU)',
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
    const since =
      status && typeof performance !== 'undefined'
        ? ((performance.now() - status.lastUpdated) / 1000).toFixed(1)
        : null

    return (
      <div
        key={phase}
        className={`flex items-center justify-between text-xs font-mono border px-2 py-1 rounded ${colors[mode]}`}
      >
        <span className="uppercase tracking-wide">{phase}</span>
        <span className="text-right">
          {labels[mode]}
          {since && <span className="block text-[10px] text-gray-400">updated {since}s ago</span>}
        </span>
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

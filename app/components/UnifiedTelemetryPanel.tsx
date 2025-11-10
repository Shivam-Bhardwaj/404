'use client'

import { useEffect, useState } from 'react'
import { PhaseType } from '@/lib/types'
import { SimulationSourceStatus } from '@/lib/telemetry/simulation-source'
import { fetchGpuInfo, fetchGpuStats, GpuStats } from '@/lib/api/physics'

interface UnifiedTelemetryPanelProps {
  performance: {
    fps: number
    memoryUsage: number
    thermalState: 'normal' | 'throttling' | 'critical'
    performanceScore: number
    deviceTier: string
    memoryTrend?: string
  }
  physics: {
    currentPhase: PhaseType
    loopCount: number
    currentSourceLabel: string
    currentTelemetryLine: string
    simulationSources: Partial<Record<PhaseType, SimulationSourceStatus>>
  }
  ecosystemStats?: {
    total: number
    predators: number
    prey: number
    producers: number
    avgEnergy: number
  }
}

// Helper function for color coding
function getMetricColor(value: number, thresholds: { good: number; warning: number }): string {
  if (value >= thresholds.warning) return 'text-red-400'
  if (value >= thresholds.good) return 'text-yellow-400'
  return 'text-green-400'
}

function getThermalColor(state: 'normal' | 'throttling' | 'critical'): string {
  switch (state) {
    case 'critical': return 'text-red-400'
    case 'throttling': return 'text-yellow-400'
    default: return 'text-green-400'
  }
}

export function UnifiedTelemetryPanel({ performance, physics, ecosystemStats }: UnifiedTelemetryPanelProps) {
  const [techStack, setTechStack] = useState<{ gpu: string; status?: string; cudaReady: boolean } | null>(null)
  const [gpuStats, setGpuStats] = useState<GpuStats | null>(null)

  // Load tech stack info
  useEffect(() => {
    async function loadTechStack() {
      try {
        const data = await fetchGpuInfo()
        setTechStack({
          gpu: data.gpu,
          status: data.status,
          cudaReady: Boolean((data as any).cuda_context ?? false),
        })
      } catch (error) {
        console.error('Failed to load tech stack:', error)
      }
    }
    loadTechStack()
  }, [])

  // Poll GPU stats
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    async function updateGpuStats() {
      try {
        const stats = await fetchGpuStats()
        setGpuStats(stats)
      } catch (error) {
        console.error('Failed to fetch GPU stats:', error)
      }
    }

    updateGpuStats()
    intervalId = setInterval(updateGpuStats, 1500)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Get acceleration mode for current phase
  const currentSimSource = physics.simulationSources[physics.currentPhase]
  const accelerationMode = currentSimSource?.mode || 'local'
  const accelerator = currentSimSource?.accelerator

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Compact unified telemetry bar */}
      <div className="bg-black bg-opacity-90 border-t border-green-500 border-opacity-50 backdrop-blur-sm">
        <div className="px-3 py-2">
          {/* Main telemetry row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono">
            {/* Performance metrics */}
            <div className="flex items-center gap-3">
              <span className="text-green-300 font-bold">⚡ TELEMETRY</span>
              <span className="text-gray-400">FPS:</span>
              <span className={getMetricColor(performance.fps, { good: 30, warning: 20 })}>{Math.round(performance.fps)}</span>
              <span className="text-gray-400">FRAME:</span>
              <span className="text-green-400">{performance.fps > 0 ? (1000 / performance.fps).toFixed(1) : '—'}ms</span>
              <span className="text-gray-400">MEM:</span>
              <span className="text-green-400">{Math.round(performance.memoryUsage)}MB</span>
              <span className="text-gray-400">THERMAL:</span>
              <span className={getThermalColor(performance.thermalState)}>{performance.thermalState.toUpperCase()}</span>
            </div>

            {/* Physics metrics */}
            <div className="flex items-center gap-3">
              <span className="text-gray-400">PHASE:</span>
              <span className="text-blue-400">{physics.currentPhase.toUpperCase()}</span>
              <span className="text-gray-400">LOOP:</span>
              <span className="text-green-400">{physics.loopCount}</span>
              {accelerationMode === 'server' && accelerator && (
                <>
                  <span className="text-gray-400">ACC:</span>
                  <span className="text-yellow-400">{accelerator.toUpperCase()}</span>
                </>
              )}
            </div>

            {/* Ecosystem stats (if in ecosystem phase) */}
            {ecosystemStats && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">TOTAL:</span>
                <span className="text-white">{ecosystemStats.total}</span>
                <span className="text-red-400">P:{ecosystemStats.predators}</span>
                <span className="text-yellow-400">Y:{ecosystemStats.prey}</span>
                <span className="text-green-400">R:{ecosystemStats.producers}</span>
                <span className="text-gray-400">E:</span>
                <span className="text-cyan-400">{ecosystemStats.avgEnergy.toFixed(1)}</span>
              </div>
            )}

            {/* Score */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">SCORE:</span>
              <span className={getMetricColor(100 - performance.performanceScore, { good: 20, warning: 40 })}>
                {Math.round(performance.performanceScore)}%
              </span>
            </div>
          </div>

          {/* Secondary row - GPU and tech stack info */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-[8px] text-gray-500">
            {/* GPU Info */}
            <div className="flex items-center gap-2">
              {techStack && (
                <>
                  <span>GPU: {techStack.gpu}</span>
                  {techStack.cudaReady && <span className="text-blue-400">(CUDA Ready)</span>}
                </>
              )}
              {gpuStats && (
                <>
                  {gpuStats.gpu_utilization !== null && (
                    <span>UTIL: {gpuStats.gpu_utilization}%</span>
                  )}
                  {gpuStats.temperature_c !== null && (
                    <span className={
                      gpuStats.temperature_c > 85 ? 'text-red-400' :
                      gpuStats.temperature_c > 75 ? 'text-yellow-400' : 'text-gray-500'
                    }>
                      {gpuStats.temperature_c}°C
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Tech Stack */}
            <div className="flex items-center gap-2">
              <span>Rust 1.91.0</span>
              <span>•</span>
              <span>Axum + Tokio</span>
              <span>•</span>
              <span>Next.js 14</span>
              <span>•</span>
              <span>TypeScript 5.3</span>
            </div>

            {/* Physics modes */}
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 bg-green-500 bg-opacity-10 rounded">SPH</span>
              <span className="px-1 py-0.5 bg-green-500 bg-opacity-10 rounded">Boids</span>
              <span className="px-1 py-0.5 bg-green-500 bg-opacity-10 rounded">Gray-Scott</span>
              <span className="px-1 py-0.5 bg-green-500 bg-opacity-10 rounded">SDF</span>
            </div>

            {/* Device tier */}
            <div className="flex items-center gap-2">
              <span>DEVICE:</span>
              <span className="text-blue-400">{performance.deviceTier.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

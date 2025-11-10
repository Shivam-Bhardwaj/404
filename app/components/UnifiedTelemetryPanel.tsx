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

            {/* Score with explanation */}
            <div className="flex items-center gap-2" title="Performance score: FPS (50%) + Frame Time (30%) + Memory (20%)">
              <span className="text-gray-400">SCORE:</span>
              <span className={getMetricColor(100 - performance.performanceScore, { good: 20, warning: 40 })}>
                {Math.round(performance.performanceScore)}%
              </span>
              {performance.performanceScore < 50 && (
                <span className="text-red-400 text-[7px]">(LOW)</span>
              )}
            </div>
          </div>

          {/* Secondary row - GPU and tech stack info */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-[8px]">
            {/* GPU Info - Enhanced */}
            <div className="flex items-center gap-2">
              {techStack && (
                <>
                  <span className="text-gray-400">GPU:</span>
                  <span className="text-green-400">{techStack.gpu}</span>
                  {techStack.cudaReady ? (
                    <span className="text-blue-400 font-bold">[CUDA]</span>
                  ) : (
                    <span className="text-red-400">[NO CUDA]</span>
                  )}
                </>
              )}
              {gpuStats && (
                <>
                  {gpuStats.gpu_utilization !== null && (
                    <>
                      <span className="text-gray-400">GPU:</span>
                      <span className={
                        gpuStats.gpu_utilization > 80 ? 'text-green-400' :
                        gpuStats.gpu_utilization > 50 ? 'text-yellow-400' :
                        gpuStats.gpu_utilization > 0 ? 'text-orange-400' : 'text-red-400'
                      }>
                        {gpuStats.gpu_utilization}%
                      </span>
                    </>
                  )}
                  {gpuStats.memory_used_mb !== null && gpuStats.memory_total_mb !== null && (
                    <>
                      <span className="text-gray-400">VRAM:</span>
                      <span className="text-cyan-400">
                        {gpuStats.memory_used_mb}MB/{gpuStats.memory_total_mb}MB
                      </span>
                      {gpuStats.memory_utilization !== null && (
                        <span className="text-gray-500">
                          ({gpuStats.memory_utilization}%)
                        </span>
                      )}
                    </>
                  )}
                  {gpuStats.temperature_c !== null && (
                    <>
                      <span className="text-gray-400">TEMP:</span>
                      <span className={
                        gpuStats.temperature_c > 85 ? 'text-red-400' :
                        gpuStats.temperature_c > 75 ? 'text-yellow-400' : 'text-green-400'
                      }>
                        {gpuStats.temperature_c}°C
                      </span>
                    </>
                  )}
                </>
              )}
              {/* Show if no GPU stats available */}
              {!gpuStats && techStack && (
                <span className="text-red-400">[NO GPU STATS]</span>
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

            {/* Simulation source status */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">SIM:</span>
              {accelerationMode === 'server' ? (
                <>
                  <span className="text-green-400 font-bold">SERVER</span>
                  {accelerator && (
                    <span className={
                      accelerator === 'cuda' ? 'text-blue-400' :
                      accelerator === 'gpu' ? 'text-purple-400' : 'text-yellow-400'
                    }>
                      ({accelerator.toUpperCase()})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-red-400 font-bold">LOCAL (BROWSER)</span>
              )}
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

'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { TelemetryAggregator } from '@/lib/telemetry/aggregator'
import { PhaseType } from '@/lib/types'
import { SimulationSourceStatus } from '@/lib/telemetry/simulation-source'
import { MemoryStats, MemorySample } from '@/lib/performance/memory-manager'
import { fetchGpuInfo, fetchGpuStats, GpuStats } from '@/lib/api/physics'

type TabType = 'performance' | 'physics' | 'system' | 'debug'

interface TelemetryDashboardProps {
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
  debug?: {
    memoryStats?: MemoryStats
    memoryHistory: MemorySample[]
    memoryEvents: Array<{ timestamp: number; type: string; usedMB: number }>
  }
}

interface DashboardPreferences {
  collapsed: boolean
  position: { x: number; y: number }
  activeTab: TabType
  showDebug: boolean
}

const STORAGE_KEY = 'telemetry-dashboard-preferences'
const DEFAULT_POSITION = { x: 20, y: 20 }

// Sparkline component for mini graphs
function Sparkline({ data, width = 60, height = 20, color = '#39ff14' }: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// Color coding helpers
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

export function TelemetryDashboard({ performance, physics, debug }: TelemetryDashboardProps) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    if (typeof window === 'undefined') {
      return { collapsed: false, position: DEFAULT_POSITION, activeTab: 'performance', showDebug: false }
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return { ...JSON.parse(stored), position: DEFAULT_POSITION }
      } catch {
        return { collapsed: false, position: DEFAULT_POSITION, activeTab: 'performance', showDebug: false }
      }
    }
    return { collapsed: false, position: DEFAULT_POSITION, activeTab: 'performance', showDebug: false }
  })

  const [techStack, setTechStack] = useState<{ gpu: string; status?: string; cudaReady: boolean } | null>(null)
  const [gpuStats, setGpuStats] = useState<GpuStats | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const dashboardRef = useRef<HTMLDivElement>(null)

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

  // Persist preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    }
  }, [preferences])

  // Drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('button, a, input, select')) {
      return
    }
    setIsDragging(true)
    setDragStart({
      x: e.clientX - preferences.position.x,
      y: e.clientY - preferences.position.y,
    })
  }, [preferences.position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const maxX = window.innerWidth - (window.innerWidth < 640 ? 340 : 400)
      const maxY = window.innerHeight - (window.innerHeight < 768 ? 250 : 300)
      setPreferences(prev => ({
        ...prev,
        position: {
          x: Math.max(0, Math.min(maxX, e.clientX - dragStart.x)),
          y: Math.max(0, Math.min(maxY, e.clientY - dragStart.y)),
        },
      }))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  const tabs: TabType[] = ['performance', 'physics', 'system', ...(preferences.showDebug ? ['debug' as TabType] : [])]

  const fpsHistory = useMemo(() => {
    const aggregator = TelemetryAggregator.getInstance()
    aggregator.aggregatePerformance(
      performance.fps,
      performance.memoryUsage,
      performance.thermalState,
      performance.performanceScore,
      performance.deviceTier as any,
    )
    return aggregator.getFpsHistory()
  }, [performance])

  const memoryHistory = useMemo(() => {
    if (!debug?.memoryHistory) return []
    return debug.memoryHistory.slice(-30).map(s => s.usedMB)
  }, [debug?.memoryHistory])

  const simulationEntries = useMemo(() => {
    return Object.entries(physics.simulationSources ?? {})
      .filter(([, status]) => Boolean(status))
      .map(([phase, status]) => ({
        phase: phase as PhaseType,
        status: status as SimulationSourceStatus,
      }))
      .sort((a, b) => (b.status.lastUpdated ?? 0) - (a.status.lastUpdated ?? 0))
  }, [physics.simulationSources])

  const renderRelativeTime = (lastUpdated?: number) => {
    if (typeof lastUpdated !== 'number' || typeof window === 'undefined' || typeof window.performance === 'undefined') return '—'
    const delta = Math.max(0, window.performance.now() - lastUpdated)
    if (delta < 1000) return `${Math.round(delta)}ms ago`
    return `${(delta / 1000).toFixed(1)}s ago`
  }

  if (preferences.collapsed) {
    if (typeof window === 'undefined') {
      return null
    }
    return (
      <div
        className="fixed z-50 cursor-pointer touch-none"
        style={{ 
          left: Math.min(preferences.position.x, window.innerWidth - 40), 
          top: Math.min(preferences.position.y, window.innerHeight - 40) 
        }}
        onClick={() => setPreferences(prev => ({ ...prev, collapsed: false }))}
      >
        <div className="bg-black bg-opacity-80 border border-green-500 rounded p-2 text-green-400 font-mono text-xs">
          ⚡
        </div>
      </div>
    )
  }

  return (
    <div
      ref={dashboardRef}
      className="fixed z-50 bg-black bg-opacity-90 border border-green-500 rounded-lg shadow-lg font-mono text-xs text-green-400 backdrop-blur-sm"
      style={{
        left: preferences.position.x,
        top: preferences.position.y,
        width: '380px',
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: 'calc(100vh - 20px)',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-green-500 border-opacity-30">
        <div className="text-green-300 font-bold text-sm">⚡ TELEMETRY</div>
        <div className="flex gap-1">
          <button
            onClick={() => setPreferences(prev => ({ ...prev, showDebug: !prev.showDebug }))}
            className="px-2 py-1 text-[10px] border border-green-500 border-opacity-30 rounded hover:bg-green-500 hover:bg-opacity-10"
            title="Toggle debug mode"
          >
            DEBUG
          </button>
          <button
            onClick={() => setPreferences(prev => ({ ...prev, collapsed: true }))}
            className="px-2 py-1 text-[10px] border border-green-500 border-opacity-30 rounded hover:bg-green-500 hover:bg-opacity-10"
          >
            −
          </button>
        </div>
      </div>

      {/* Compact header - always visible */}
      <div className="px-2 py-1 border-b border-green-500 border-opacity-20 bg-green-500 bg-opacity-5 flex flex-wrap items-center justify-between gap-1 text-[10px]">
        <span>
          FPS: <span className={getMetricColor(performance.fps, { good: 30, warning: 20 })}>{Math.round(performance.fps)}</span>
        </span>
        <span>
          PHASE: <span className="text-blue-400">{physics.currentPhase.toUpperCase()}</span>
        </span>
        <span>
          SCORE: <span className={getMetricColor(100 - performance.performanceScore, { good: 20, warning: 40 })}>{Math.round(performance.performanceScore)}%</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-green-500 border-opacity-20 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setPreferences(prev => ({ ...prev, activeTab: tab }))}
            className={`flex-1 min-w-[80px] px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
              preferences.activeTab === tab
                ? 'bg-green-500 bg-opacity-20 text-green-300 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-green-400 hover:bg-green-500 hover:bg-opacity-5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 overflow-y-auto overflow-x-hidden" style={{ maxHeight: '450px' }}>
        {preferences.activeTab === 'performance' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                <div className="text-[10px] text-gray-400 uppercase mb-1">FPS</div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getMetricColor(performance.fps, { good: 30, warning: 20 })}`}>
                    {Math.round(performance.fps)}
                  </span>
                  {fpsHistory.length > 1 && <Sparkline data={fpsHistory.slice(-20)} color="#39ff14" />}
                </div>
              </div>
              <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                <div className="text-[10px] text-gray-400 uppercase mb-1">Frame Time</div>
                <div className="text-lg font-bold text-green-400">
                  {performance.fps > 0 ? (1000 / performance.fps).toFixed(1) : '—'}ms
                </div>
              </div>
            </div>

            <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
              <div className="text-[10px] text-gray-400 uppercase mb-1">Memory</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-green-400">{Math.round(performance.memoryUsage)} MB</span>
                {memoryHistory.length > 1 && <Sparkline data={memoryHistory} color="#4da6ff" />}
              </div>
              {performance.memoryTrend && (
                <div className="text-[10px] text-gray-400">{performance.memoryTrend}</div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                <div className="text-[10px] text-gray-400 uppercase mb-1">Thermal</div>
                <div className={`text-sm font-bold ${getThermalColor(performance.thermalState)}`}>
                  {performance.thermalState.toUpperCase()}
                </div>
              </div>
              <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                <div className="text-[10px] text-gray-400 uppercase mb-1">Device</div>
                <div className="text-sm font-bold text-blue-400">{performance.deviceTier.toUpperCase()}</div>
              </div>
            </div>
          </div>
        )}

        {preferences.activeTab === 'physics' && (
          <div className="space-y-3">
            <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
              <div className="text-[10px] text-gray-400 uppercase mb-1">Current Phase</div>
              <div className="text-lg font-bold text-blue-400 mb-2">{physics.currentPhase.toUpperCase()}</div>
              <div className="text-[10px] text-gray-400">Loop: {physics.loopCount}</div>
            </div>

            <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
              <div className="text-[10px] text-gray-400 uppercase mb-1">Physics Source</div>
              <div className="text-sm font-bold text-green-400 mb-1">{physics.currentSourceLabel}</div>
              {physics.currentTelemetryLine && (
                <div className="text-[10px] text-gray-400">{physics.currentTelemetryLine}</div>
              )}
            </div>

            {simulationEntries.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 uppercase mb-2">Active Simulations</div>
                <div className="space-y-2">
                  {simulationEntries.map(({ phase, status }) => (
                    <div
                      key={phase}
                      className={`border rounded p-2 ${
                        status.mode === 'server' ? 'border-green-500 border-opacity-30' : 'border-yellow-500 border-opacity-30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-green-300 uppercase">{phase}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          status.mode === 'server' ? 'bg-green-500 bg-opacity-20 text-green-300' : 'bg-yellow-500 bg-opacity-20 text-yellow-300'
                        }`}>
                          {status.mode}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 space-y-0.5">
                        {status.accelerator && <div>Accelerator: {status.accelerator.toUpperCase()}</div>}
                        {typeof status.latencyMs === 'number' && <div>Compute: {Math.round(status.latencyMs)}ms</div>}
                        {typeof status.roundTripMs === 'number' && <div>RTT: {Math.round(status.roundTripMs)}ms</div>}
                        {typeof status.sampleSize === 'number' && <div>Samples: {status.sampleSize}</div>}
                        <div className="text-gray-500">{renderRelativeTime(status.lastUpdated)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {preferences.activeTab === 'system' && (
          <div className="space-y-3">
            {techStack && (
              <>
                <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                  <div className="text-[10px] text-gray-400 uppercase mb-1">GPU</div>
                  <div className="text-sm font-bold text-green-400 mb-1">{techStack.gpu}</div>
                  <div className="text-[10px] text-gray-400">
                    Status: {techStack.status} {techStack.cudaReady && '(CUDA Ready)'}
                  </div>
                </div>

                {gpuStats && (
                  <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2 space-y-2">
                    <div className="text-[10px] text-gray-400 uppercase mb-1">GPU Performance</div>
                    {gpuStats.gpu_utilization !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-400">Utilization</span>
                          <span className={getMetricColor(gpuStats.gpu_utilization, { good: 80, warning: 95 })}>
                            {gpuStats.gpu_utilization}%
                          </span>
                        </div>
                        <div className="w-full h-1 bg-gray-700 rounded overflow-hidden">
                          <div
                            className={`h-full ${
                              gpuStats.gpu_utilization >= 95 ? 'bg-red-500' :
                              gpuStats.gpu_utilization >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${gpuStats.gpu_utilization}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {gpuStats.memory_utilization !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-400">Memory</span>
                          <span className={getMetricColor(gpuStats.memory_utilization, { good: 80, warning: 95 })}>
                            {gpuStats.memory_utilization}%
                          </span>
                        </div>
                        <div className="w-full h-1 bg-gray-700 rounded overflow-hidden">
                          <div
                            className={`h-full ${
                              gpuStats.memory_utilization >= 95 ? 'bg-red-500' :
                              gpuStats.memory_utilization >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${gpuStats.memory_utilization}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {gpuStats.temperature_c !== null && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Temperature</span>
                        <span className={
                          gpuStats.temperature_c > 85 ? 'text-red-400' :
                          gpuStats.temperature_c > 75 ? 'text-yellow-400' : 'text-green-400'
                        }>
                          {gpuStats.temperature_c}°C
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                  <div className="text-[10px] text-gray-400 uppercase mb-1">Backend</div>
                  <div className="text-[10px] space-y-0.5">
                    <div>Rust 1.91.0</div>
                    <div>Axum + Tokio (async)</div>
                    <div>CUDA 12.3</div>
                  </div>
                </div>

                <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                  <div className="text-[10px] text-gray-400 uppercase mb-1">Frontend</div>
                  <div className="text-[10px] space-y-0.5">
                    <div>Next.js 14</div>
                    <div>TypeScript 5.3</div>
                    <div>Tailwind CSS 3.3</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {preferences.activeTab === 'debug' && debug && (
          <div className="space-y-3">
            {debug.memoryStats && (
              <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                <div className="text-[10px] text-gray-400 uppercase mb-2">Memory Stats</div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className="text-green-400">{debug.memoryStats.status.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current</span>
                    <span className="text-green-400">{debug.memoryStats.currentUsage.toFixed(1)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Average</span>
                    <span className="text-green-400">{debug.memoryStats.averageUsage.toFixed(1)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Peak</span>
                    <span className="text-green-400">{debug.memoryStats.peakUsage.toFixed(1)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Leak Suspected</span>
                    <span className={debug.memoryStats.leakSuspected ? 'text-red-400' : 'text-green-400'}>
                      {debug.memoryStats.leakSuspected ? '⚠ YES' : 'clear'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {debug.memoryEvents.length > 0 && (
              <div className="bg-green-500 bg-opacity-5 border border-green-500 border-opacity-20 rounded p-2">
                <div className="text-[10px] text-gray-400 uppercase mb-2">Recent Events</div>
                <div className="space-y-1 text-[10px] max-h-32 overflow-y-auto">
                  {debug.memoryEvents.slice(-5).reverse().map((event, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      <span className="text-green-400">{event.type}@{event.usedMB.toFixed(1)}MB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


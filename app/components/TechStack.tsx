'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchGpuInfo, fetchGpuStats, GpuStats } from '@/lib/api/physics'
import { PhaseType, DeviceTier } from '@/lib/types'
import { SimulationSourceStatus } from '@/lib/telemetry/simulation-source'

interface TechStackInfo {
  gpu: string
  gpuStatus: string
  cudaReady: boolean
  backend: {
    language: string
    framework: string
    cudaVersion: string
  }
  frontend: {
    framework: string
    language: string
    styling: string
  }
  physics: {
    sph: boolean
    boids: boolean
    grayScott: boolean
    sdf: boolean
  }
}

interface TechStackTelemetry {
  fps: number
  currentPhase: PhaseType
  deviceTier: DeviceTier
  loopCount: number
  performanceScore: number
  memoryUsage: number
  thermalState: 'normal' | 'throttling' | 'critical'
  memoryTrend?: string
  currentSourceLabel: string
  currentTelemetryLine: string
  simulationSources: Partial<Record<PhaseType, SimulationSourceStatus>>
}

interface TechStackDisplayProps {
  telemetry: TechStackTelemetry
}

export function TechStackDisplay({ telemetry }: TechStackDisplayProps) {
  const [techStack, setTechStack] = useState<TechStackInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [gpuStats, setGpuStats] = useState<GpuStats | null>(null)
  const [gpuStatsError, setGpuStatsError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTechStack() {
      try {
        const data = await fetchGpuInfo()

        setTechStack({
          gpu: data.gpu,
          gpuStatus: data.status ?? 'unknown',
          cudaReady: Boolean((data as any).cuda_context ?? false),
          backend: {
            language: 'Rust 1.91.0',
            framework: 'Axum + Tokio (async)',
            cudaVersion: 'CUDA 12.3',
          },
          frontend: {
            framework: 'Next.js 14',
            language: 'TypeScript 5.3',
            styling: 'Tailwind CSS 3.3',
          },
          physics: {
            sph: true,
            boids: true,
            grayScott: true,
            sdf: true,
          },
        })
      } catch (error) {
        console.error('Failed to load tech stack:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTechStack()
  }, [])

  // Poll GPU stats every 1.5 seconds
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    async function updateGpuStats() {
      try {
        const stats = await fetchGpuStats()
        setGpuStats(stats)
        setGpuStatsError(null)
      } catch (error) {
        setGpuStatsError('GPU stats unavailable')
        console.error('Failed to fetch GPU stats:', error)
      }
    }

    // Initial fetch
    updateGpuStats()

    // Set up polling
    intervalId = setInterval(updateGpuStats, 1500)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  const runtimeStats = useMemo(
    () => [
      { label: 'FPS', value: `${Math.max(0, Math.round(telemetry.fps))}` },
      { label: 'Phase', value: telemetry.currentPhase.toUpperCase() },
      { label: 'Device Tier', value: telemetry.deviceTier.toUpperCase() },
      { label: 'Loop', value: `${telemetry.loopCount}` },
      { label: 'Score', value: `${Math.round(telemetry.performanceScore)}%` },
      { label: 'Thermal', value: telemetry.thermalState },
    ],
    [telemetry]
  )

  const simulationEntries = useMemo(() => {
    const entries = Object.entries(telemetry.simulationSources ?? {})
      .filter(([, status]) => Boolean(status))
      .map(([phase, status]) => ({
        phase,
        status: status as SimulationSourceStatus,
      }))

    const sorted = entries.sort((a, b) => {
      const aTime = a.status.lastUpdated ?? 0
      const bTime = b.status.lastUpdated ?? 0
      return bTime - aTime
    })

    return sorted
  }, [telemetry.simulationSources])

  const renderRelativeTime = (lastUpdated?: number) => {
    if (typeof lastUpdated !== 'number' || typeof performance === 'undefined') return '—'
    const delta = Math.max(0, performance.now() - lastUpdated)
    if (delta < 1000) return `${Math.round(delta)}ms ago`
    return `${(delta / 1000).toFixed(1)}s ago`
  }

  const getGpuStatusColor = (utilization: number | null, temp: number | null): string => {
    if (utilization === null && temp === null) return 'normal'
    if (temp !== null && temp > 85) return 'critical'
    if (temp !== null && temp > 75) return 'throttling'
    if (utilization !== null && utilization > 95) return 'throttling'
    return 'normal'
  }

  const formatGpuUtilization = (util: number | null): string => {
    if (util === null) return 'N/A'
    return `${util}%`
  }

  const formatMemory = (used: number | null, total: number | null): string => {
    if (used === null || total === null) return 'N/A'
    const usedMB = Math.round(used)
    const totalMB = Math.round(total)
    const percent = Math.round((usedMB / totalMB) * 100)
    return `${usedMB}MB / ${totalMB}MB (${percent}%)`
  }

  const getProgressBarClass = (value: number | null, threshold: number = 80): string => {
    if (value === null) return ''
    if (value >= threshold * 1.2) return 'critical'
    if (value >= threshold) return 'warning'
    return ''
  }

  if (loading) {
    return (
      <div className="tech-stack-loading">
        <div className="animate-pulse">Loading tech stack...</div>
      </div>
    )
  }

  if (!techStack) {
    return null
  }

  return (
    <div className="tech-stack-container">
      <style jsx>{`
        .tech-stack-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid #ffb84d;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #39ff14;
          max-width: 420px;
          z-index: 1000;
          backdrop-filter: blur(6px);
        }

        .tech-stack-header {
          color: #ffb84d;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 14px;
          text-align: center;
        }

        .tech-section {
          margin-bottom: 12px;
        }

        .tech-section-title {
          color: #4da6ff;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .telemetry-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .telemetry-card {
          background: rgba(57, 255, 20, 0.05);
          border: 1px solid rgba(77, 166, 255, 0.2);
          border-radius: 6px;
          padding: 6px;
        }

        .metric-label {
          color: #888;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .metric-value {
          font-size: 14px;
          color: #39ff14;
        }

        .metric-subtle {
          font-size: 10px;
          color: #4da6ff;
          opacity: 0.8;
        }

        .tech-item {
          margin-left: 8px;
          margin-bottom: 2px;
        }

        .tech-label {
          color: #888;
        }

        .tech-value {
          color: #39ff14;
        }

        .physics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-left: 8px;
        }

        .physics-item {
          display: flex;
          align-items: center;
        }

        .status-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #39ff14;
          margin-right: 6px;
          animation: pulse 2s infinite;
        }

        .telemetry-banner {
          border: 1px solid rgba(255, 184, 77, 0.4);
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 10px;
          background: rgba(255, 184, 77, 0.08);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0 6px;
          border-radius: 9999px;
          border: 1px solid currentColor;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-right: 6px;
        }

        .badge.server {
          color: #4da6ff;
        }

        .badge.local {
          color: #ffb84d;
        }

        .sim-entry {
          border: 1px solid rgba(57, 255, 20, 0.2);
          border-radius: 6px;
          padding: 6px;
          margin-bottom: 6px;
        }

        .sim-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          color: #ffb84d;
          text-transform: uppercase;
        }

        .sim-entry-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 11px;
          margin-top: 4px;
          color: #39ff14;
        }

        .sim-entry-time {
          font-size: 10px;
          color: #888;
          margin-top: 4px;
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(57, 255, 20, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 4px;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #39ff14 0%, #4da6ff 100%);
          transition: width 0.3s ease;
        }

        .progress-bar.warning {
          background: linear-gradient(90deg, #ffb84d 0%, #ff6b6b 100%);
        }

        .progress-bar.critical {
          background: linear-gradient(90deg, #ff6b6b 0%, #ff0000 100%);
        }

        .gpu-stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .gpu-stat-label {
          color: #888;
          font-size: 11px;
        }

        .gpu-stat-value {
          color: #39ff14;
          font-size: 13px;
          font-weight: bold;
        }

        .gpu-stat-value.na {
          color: #666;
          font-style: italic;
        }

        .gpu-stat-value.warning {
          color: #ffb84d;
        }

        .gpu-stat-value.critical {
          color: #ff6b6b;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div className="tech-stack-header">⚡ TECH STACK + TELEMETRY</div>

      <div className="tech-section">
        <div className="tech-section-title">GPU</div>
        <div className="tech-item">
          <span className="tech-label">Adapter: </span>
          <span className="tech-value">{techStack.gpu}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Status: </span>
          <span className="tech-value">
            {techStack.gpuStatus} {techStack.cudaReady ? '(CUDA Ready)' : '(CPU fallback)'}
          </span>
        </div>
      </div>

      {gpuStats && (
        <div className="tech-section">
          <div className="tech-section-title">GPU Performance</div>
          <div className="gpu-stat-row">
            <span className="gpu-stat-label">GPU Utilization</span>
            <span className={`gpu-stat-value ${gpuStats.gpu_utilization === null ? 'na' : ''}`}>
              {formatGpuUtilization(gpuStats.gpu_utilization)}
            </span>
          </div>
          {gpuStats.gpu_utilization !== null && (
            <div className="progress-bar-container">
              <div
                className={`progress-bar ${getProgressBarClass(gpuStats.gpu_utilization, 80)}`}
                style={{ width: `${gpuStats.gpu_utilization}%` }}
              />
            </div>
          )}
          <div className="gpu-stat-row">
            <span className="gpu-stat-label">Memory Utilization</span>
            <span className={`gpu-stat-value ${gpuStats.memory_utilization === null ? 'na' : ''}`}>
              {formatGpuUtilization(gpuStats.memory_utilization)}
            </span>
          </div>
          {gpuStats.memory_utilization !== null && (
            <div className="progress-bar-container">
              <div
                className={`progress-bar ${getProgressBarClass(gpuStats.memory_utilization, 80)}`}
                style={{ width: `${gpuStats.memory_utilization}%` }}
              />
            </div>
          )}
          <div className="gpu-stat-row">
            <span className="gpu-stat-label">Memory</span>
            <span className={`gpu-stat-value ${gpuStats.memory_used_mb === null ? 'na' : ''}`}>
              {formatMemory(gpuStats.memory_used_mb, gpuStats.memory_total_mb)}
            </span>
          </div>
          {gpuStats.memory_used_mb !== null && gpuStats.memory_total_mb !== null && (
            <div className="progress-bar-container">
              <div
                className={`progress-bar ${getProgressBarClass(
                  (gpuStats.memory_used_mb / gpuStats.memory_total_mb) * 100,
                  85
                )}`}
                style={{ width: `${(gpuStats.memory_used_mb / gpuStats.memory_total_mb) * 100}%` }}
              />
            </div>
          )}
          {gpuStats.temperature_c !== null && (
            <>
              <div className="gpu-stat-row">
                <span className="gpu-stat-label">Temperature</span>
                <span className={`gpu-stat-value ${
                  getGpuStatusColor(gpuStats.gpu_utilization, gpuStats.temperature_c) === 'critical'
                    ? 'critical'
                    : getGpuStatusColor(gpuStats.gpu_utilization, gpuStats.temperature_c) === 'throttling'
                    ? 'warning'
                    : ''
                }`}>
                  {gpuStats.temperature_c}°C
                </span>
              </div>
            </>
          )}
          {gpuStatsError && (
            <div className="tech-item" style={{ color: '#888', fontSize: '10px' }}>
              {gpuStatsError}
            </div>
          )}
        </div>
      )}

      <div className="tech-section">
        <div className="tech-section-title">Backend</div>
        <div className="tech-item">
          <span className="tech-label">Language: </span>
          <span className="tech-value">{techStack.backend.language}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Framework: </span>
          <span className="tech-value">{techStack.backend.framework}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">CUDA: </span>
          <span className="tech-value">{techStack.backend.cudaVersion}</span>
        </div>
      </div>

      <div className="tech-section">
        <div className="tech-section-title">Frontend</div>
        <div className="tech-item">
          <span className="tech-label">Framework: </span>
          <span className="tech-value">{techStack.frontend.framework}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Language: </span>
          <span className="tech-value">{techStack.frontend.language}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Styling: </span>
          <span className="tech-value">{techStack.frontend.styling}</span>
        </div>
      </div>

      <div className="tech-section">
        <div className="tech-section-title">Physics Simulations</div>
        <div className="physics-grid">
          {techStack.physics.sph && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>SPH</span>
            </div>
          )}
          {techStack.physics.boids && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>Boids</span>
            </div>
          )}
          {techStack.physics.grayScott && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>Gray-Scott</span>
            </div>
          )}
          {techStack.physics.sdf && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>SDF</span>
            </div>
          )}
        </div>
      </div>

      <div className="tech-section">
        <div className="tech-section-title">Runtime Telemetry</div>
        <div className="telemetry-grid">
          {runtimeStats.map((stat) => (
            <div key={stat.label} className="telemetry-card">
              <div className="metric-label">{stat.label}</div>
              <div className="metric-value">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tech-section">
        <div className="tech-section-title">Memory & Thermal</div>
        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="metric-label">JS Heap</div>
            <div className="metric-value">{Math.round(telemetry.memoryUsage)} MB</div>
            {telemetry.memoryTrend && <div className="metric-subtle">{telemetry.memoryTrend}</div>}
          </div>
          <div className="telemetry-card">
            <div className="metric-label">Current Feed</div>
            <div className="metric-value">{telemetry.currentSourceLabel}</div>
            {telemetry.currentTelemetryLine && (
              <div className="metric-subtle">{telemetry.currentTelemetryLine}</div>
            )}
          </div>
        </div>
      </div>

      <div className="tech-section">
        <div className="tech-section-title">Simulation Streams</div>
        {simulationEntries.length === 0 && <div className="tech-item">Awaiting telemetry...</div>}
        {simulationEntries.slice(0, 4).map(({ phase, status }) => (
          <div key={phase} className="sim-entry">
            <div className="sim-entry-header">
              <span>{phase.toUpperCase()}</span>
              <span className={`badge ${status.mode === 'server' ? 'server' : 'local'}`}>
                {status.mode}
              </span>
            </div>
            <div className="sim-entry-metrics">
              <span>{status.accelerator?.toUpperCase() ?? 'CPU'}</span>
              {typeof status.latencyMs === 'number' && (
                <span>{Math.round(status.latencyMs)}ms compute</span>
              )}
              {typeof status.roundTripMs === 'number' && (
                <span>{Math.round(status.roundTripMs)}ms RTT</span>
              )}
              {typeof status.latencyMs === 'number' && typeof status.roundTripMs === 'number' && (
                <span>
                  {Math.round(status.roundTripMs - status.latencyMs)}ms network
                </span>
              )}
              {typeof status.sampleSize === 'number' && <span>{status.sampleSize} samples</span>}
            </div>
            <div className="sim-entry-time">{renderRelativeTime(status.lastUpdated)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

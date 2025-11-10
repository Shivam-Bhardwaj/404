// Telemetry aggregation service for unified dashboard
import { PhaseType, DeviceTier } from '../types'
import { SimulationSourceStatus } from './simulation-source'
import { PerformanceMonitor } from './monitor'
import { MemoryStats, MemorySample } from '../performance/memory-manager'

export interface AggregatedTelemetry {
  performance: PerformanceMetrics
  physics: PhysicsMetrics
  system: SystemMetrics
  debug: DebugMetrics
}

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  memoryUsage: number
  memoryTrend: number[]
  thermalState: 'normal' | 'throttling' | 'critical'
  performanceScore: number
  deviceTier: DeviceTier
}

export interface PhysicsMetrics {
  currentPhase: PhaseType
  phaseProgress: number
  loopCount: number
  source: {
    mode: 'server' | 'local'
    accelerator?: 'cpu' | 'cuda'
    latencyMs?: number
    roundTripMs?: number
    sampleSize?: number
  }
  particleCount?: number
}

export interface SystemMetrics {
  gpu: {
    name: string
    status: string
    cudaReady: boolean
    utilization?: number
    memoryUtilization?: number
    memoryUsed?: number
    memoryTotal?: number
    temperature?: number
  }
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

export interface DebugMetrics {
  memoryStats?: MemoryStats
  memoryHistory: MemorySample[]
  drawCalls: number
  events: Array<{ timestamp: number; type: string; message: string }>
}

export class TelemetryAggregator {
  private static instance: TelemetryAggregator
  private fpsHistory: number[] = []
  private memoryHistory: number[] = []
  private readonly historySize = 60

  static getInstance(): TelemetryAggregator {
    if (!TelemetryAggregator.instance) {
      TelemetryAggregator.instance = new TelemetryAggregator()
    }
    return TelemetryAggregator.instance
  }

  aggregatePerformance(
    fps: number,
    memoryUsage: number,
    thermalState: 'normal' | 'throttling' | 'critical',
    performanceScore: number,
    deviceTier: DeviceTier,
    monitor?: PerformanceMonitor
  ): PerformanceMetrics {
    // Update FPS history
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > this.historySize) {
      this.fpsHistory.shift()
    }

    // Update memory history
    this.memoryHistory.push(memoryUsage)
    if (this.memoryHistory.length > this.historySize) {
      this.memoryHistory.shift()
    }

    const frameTime = fps > 0 ? 1000 / fps : 0

    return {
      fps,
      frameTime,
      memoryUsage,
      memoryTrend: [...this.memoryHistory],
      thermalState,
      performanceScore,
      deviceTier,
    }
  }

  aggregatePhysics(
    currentPhase: PhaseType,
    phaseProgress: number,
    loopCount: number,
    sourceStatus?: SimulationSourceStatus,
    particleCount?: number
  ): PhysicsMetrics {
    return {
      currentPhase,
      phaseProgress,
      loopCount,
      source: {
        mode: sourceStatus?.mode ?? 'local',
        accelerator: sourceStatus?.accelerator,
        latencyMs: sourceStatus?.latencyMs,
        roundTripMs: sourceStatus?.roundTripMs,
        sampleSize: sourceStatus?.sampleSize,
      },
      particleCount,
    }
  }

  aggregateSystem(
    gpuInfo: {
      gpu: string
      status?: string
      cudaReady: boolean
    },
    gpuStats?: {
      gpu_utilization: number | null
      memory_utilization: number | null
      memory_used_mb: number | null
      memory_total_mb: number | null
      temperature_c: number | null
    },
    physicsCapabilities?: {
      sph: boolean
      boids: boolean
      grayScott: boolean
      sdf: boolean
    }
  ): SystemMetrics {
    return {
      gpu: {
        name: gpuInfo.gpu,
        status: gpuInfo.status ?? 'unknown',
        cudaReady: gpuInfo.cudaReady,
        utilization: gpuStats?.gpu_utilization ?? undefined,
        memoryUtilization: gpuStats?.memory_utilization ?? undefined,
        memoryUsed: gpuStats?.memory_used_mb ?? undefined,
        memoryTotal: gpuStats?.memory_total_mb ?? undefined,
        temperature: gpuStats?.temperature_c ?? undefined,
      },
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
        sph: physicsCapabilities?.sph ?? true,
        boids: physicsCapabilities?.boids ?? true,
        grayScott: physicsCapabilities?.grayScott ?? true,
        sdf: physicsCapabilities?.sdf ?? true,
      },
    }
  }

  aggregateDebug(
    memoryStats?: MemoryStats,
    memoryHistory: MemorySample[] = [],
    drawCalls: number = 0,
    events: Array<{ timestamp: number; type: string; message: string }> = []
  ): DebugMetrics {
    return {
      memoryStats,
      memoryHistory,
      drawCalls,
      events,
    }
  }

  getFpsHistory(): number[] {
    return [...this.fpsHistory]
  }

  getMemoryHistory(): number[] {
    return [...this.memoryHistory]
  }

  clearHistory(): void {
    this.fpsHistory = []
    this.memoryHistory = []
  }
}


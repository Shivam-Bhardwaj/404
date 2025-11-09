import { PhaseType } from '../types'

type SimulationMode = 'server' | 'local'

export interface SimulationSourceStatus {
  phase: PhaseType
  mode: SimulationMode
  lastUpdated: number
  accelerator?: 'cpu' | 'cuda'
  latencyMs?: number
  roundTripMs?: number
  sampleSize?: number
}

export interface SimulationSourceDetails {
  accelerator?: 'cpu' | 'cuda'
  latencyMs?: number
  roundTripMs?: number
  sampleSize?: number
}

type Listener = (snapshot: Record<PhaseType, SimulationSourceStatus>) => void

export class SimulationSourceTracker {
  private static instance: SimulationSourceTracker
  private status: Record<PhaseType, SimulationSourceStatus> = {} as Record<
    PhaseType,
    SimulationSourceStatus
  >
  private listeners = new Set<Listener>()

  static getInstance(): SimulationSourceTracker {
    if (!SimulationSourceTracker.instance) {
      SimulationSourceTracker.instance = new SimulationSourceTracker()
    }
    return SimulationSourceTracker.instance
  }

  update(phase: PhaseType, mode: SimulationMode, details?: SimulationSourceDetails): void {
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.status[phase] = {
      phase,
      mode,
      lastUpdated: timestamp,
      ...(details ?? {}),
    }
    this.emit()
  }

  getStatus(phase: PhaseType): SimulationSourceStatus | undefined {
    return this.status[phase]
  }

  getSnapshot(): Record<PhaseType, SimulationSourceStatus> {
    return { ...this.status }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}

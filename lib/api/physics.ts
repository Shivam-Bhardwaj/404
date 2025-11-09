// Backend API client helpers for GPU simulations
const API_BASE = (process.env.NEXT_PUBLIC_PHYSICS_API_BASE ?? '').replace(/\/$/, '')
const DEFAULT_TIMEOUT_MS = 4000

type SimulationKind = 'sph' | 'boids' | 'grayscott'

interface SimulationResponse {
  success: boolean
  data?: number[]
  metadata?: {
    simulation_type: string
    num_particles: number
    computation_time_ms: number
    accelerator?: 'cpu' | 'cuda'
  }
  error?: string
}

export interface GpuInfo {
  gpu: string
  status?: string
  cuda_context?: boolean
}

export interface SimulationRun {
  data: number[]
  metadata?: SimulationResponse['metadata']
}

const buildUrl = (path: string): string => {
  if (path.startsWith('http')) return path
  if (!API_BASE) {
    return path.startsWith('/') ? path : `/${path}`
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalizedPath}`
}

const requestJson = async <T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  )

  try {
    const response = await fetch(buildUrl(path), {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(
        `Backend request failed: ${response.status} ${response.statusText} ${message}`
      )
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export const fetchGpuInfo = async (): Promise<GpuInfo> => {
  const data = await requestJson<GpuInfo>('/api/gpu-info')
  return data
}

const runSimulation = async (
  kind: SimulationKind,
  body: Record<string, unknown> = {}
): Promise<number[]> => {
  const payload = {
    simulation_type: kind,
    ...body,
  }

  const response = await requestJson<SimulationResponse>(`/api/simulate/${kind}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Simulation returned no data')
  }

  return response.data
}

export const fetchSphSimulation = async (options?: {
  steps?: number
}): Promise<number[]> => {
  return (await runSphSimulation(options)).data
}

export const fetchBoidsSimulation = async (options?: {
  steps?: number
  numParticles?: number
}): Promise<number[]> => {
  return runSimulation('boids', {
    steps: options?.steps ?? 6,
    num_particles: options?.numParticles ?? 180,
  })
}

export const fetchGrayScottSimulation = async (options?: {
  steps?: number
}): Promise<number[]> => {
  return runSimulation('grayscott', {
    steps: options?.steps ?? 4,
  })
}

export const runBoidsSimulation = async (options?: {
  steps?: number
  numParticles?: number
}): Promise<SimulationRun> => {
  const response = await requestJson<SimulationResponse>(`/api/simulate/boids`, {
    method: 'POST',
    body: JSON.stringify({
      simulation_type: 'boids',
      steps: options?.steps ?? 6,
      num_particles: options?.numParticles ?? 180,
    }),
  })
  if (!response.success || !response.data) throw new Error(response.error ?? 'No data')
  return { data: response.data, metadata: response.metadata }
}

export const runSphSimulation = async (options?: {
  steps?: number
}): Promise<SimulationRun> => {
  const response = await requestJson<SimulationResponse>(`/api/simulate/sph`, {
    method: 'POST',
    body: JSON.stringify({
      simulation_type: 'sph',
      steps: options?.steps ?? 6,
    }),
  })
  if (!response.success || !response.data) throw new Error(response.error ?? 'No data')
  return { data: response.data, metadata: response.metadata }
}

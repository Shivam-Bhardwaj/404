'use client'

import { useEffect, useState } from 'react'
import { fetchGpuInfo } from '@/lib/api/physics'

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

export function TechStackDisplay() {
  const [techStack, setTechStack] = useState<TechStackInfo | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return null
  }

  if (!techStack) {
    return null
  }

  return (
    <div className="bg-black bg-opacity-70 border border-orange-500 rounded p-3 font-mono text-xs text-green-400 backdrop-blur-sm">
      <div className="text-orange-400 font-bold mb-2 text-sm">⚡ TECH STACK</div>
      
      <div className="space-y-2 text-[10px]">
        <div>
          <span className="text-gray-400">GPU: </span>
          <span className="text-green-400">{techStack.gpu}</span>
          {techStack.cudaReady && <span className="text-blue-400 ml-1">(CUDA Ready)</span>}
        </div>
        
        <div>
          <span className="text-gray-400">Backend: </span>
          <span className="text-green-400">{techStack.backend.language} / {techStack.backend.framework}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Frontend: </span>
          <span className="text-green-400">{techStack.frontend.framework} / {techStack.frontend.language}</span>
        </div>
        
        <div className="flex gap-2 mt-2">
          {techStack.physics.sph && <span className="px-1.5 py-0.5 bg-green-500 bg-opacity-20 rounded text-[9px]">SPH</span>}
          {techStack.physics.boids && <span className="px-1.5 py-0.5 bg-green-500 bg-opacity-20 rounded text-[9px]">Boids</span>}
          {techStack.physics.grayScott && <span className="px-1.5 py-0.5 bg-green-500 bg-opacity-20 rounded text-[9px]">Gray-Scott</span>}
          {techStack.physics.sdf && <span className="px-1.5 py-0.5 bg-green-500 bg-opacity-20 rounded text-[9px]">SDF</span>}
        </div>
      </div>
    </div>
  )
}

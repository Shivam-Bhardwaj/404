'use client'

import { useEffect, useRef, useState } from 'react'
import { TypingPhase } from '@/lib/phases/typing-phase'
import { WhitePhase } from '@/lib/phases/white-phase'
import { CirclePhase } from '@/lib/phases/circle-phase'
import { ExplosionPhase } from '@/lib/phases/explosion-phase'
import { EcosystemPhase } from '@/lib/phases/ecosystem-phase'
import { PhaseManager } from '@/lib/phases/phase-manager'
import { HardwareDetector } from '@/lib/hardware/detection'
import { PerformanceMonitor } from '@/lib/telemetry/monitor'
import { AdaptiveQualityScaler } from '@/lib/performance/adaptive-quality'
import { MemoryManager, MemoryStats, MemoryEvent, MemorySample } from '@/lib/performance/memory-manager'
import { PhaseType, DeviceTier, AnimationPhase } from '@/lib/types'
import { UnifiedTelemetryPanel } from './components/UnifiedTelemetryPanel'
import { SimulationSourceTracker, SimulationSourceStatus } from '@/lib/telemetry/simulation-source'

export default function Error404() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('typing')
  const [fps, setFps] = useState(0)
  const [deviceTier, setDeviceTier] = useState<DeviceTier>('medium')
  const [loopCount, setLoopCount] = useState(0)
  const [performanceScore, setPerformanceScore] = useState(0)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [thermalState, setThermalState] = useState<'normal' | 'throttling' | 'critical'>('normal')
  const [memoryStatsData, setMemoryStatsData] = useState<MemoryStats | null>(null)
  const [memoryHistoryData, setMemoryHistoryData] = useState<MemorySample[]>([])
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([])
  const animationRef = useRef<number>()
  const phaseManagerRef = useRef<PhaseManager | null>(null)
  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const qualityScalerRef = useRef<AdaptiveQualityScaler | null>(null)
  const memoryManagerRef = useRef<MemoryManager | null>(null)
  const [simulationSources, setSimulationSources] = useState<Partial<Record<PhaseType, SimulationSourceStatus>>>({})
  const [ecosystemStats, setEcosystemStats] = useState<{
    total: number
    predators: number
    prey: number
    producers: number
    avgEnergy: number
  } | undefined>(undefined)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let unsubscribeMemory: (() => void) | undefined

    // Set canvas size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    // Initialize hardware detection
    const detector = new HardwareDetector()
    let detectedTier: DeviceTier = 'medium'
    detector.benchmark().then((tier) => {
      detectedTier = tier
      setDeviceTier(tier)
      const config = detector.getPerformanceConfig()
      console.log('Device tier:', tier, 'Config:', config)
      
      // Initialize performance monitoring
      const monitor = new PerformanceMonitor()
      monitorRef.current = monitor
      
      // Initialize adaptive quality scaler
      const memoryManager = memoryManagerRef.current ?? MemoryManager.getInstance()
      const qualityScaler = new AdaptiveQualityScaler(monitor, tier, memoryManager)
      qualityScalerRef.current = qualityScaler
    })
    
    // Initialize phases
    const phases = new Map<PhaseType, AnimationPhase>()
    
    phases.set('typing', new TypingPhase())
    phases.set('white', new WhitePhase())
    phases.set('circle', new CirclePhase(canvas.width, canvas.height))
    phases.set('explosion', new ExplosionPhase(canvas.width, canvas.height, canvas))
    phases.set('ecosystem', new EcosystemPhase(canvas.width, canvas.height))
    
    // Initialize memory manager and register cleanup callbacks
    const memoryManager = MemoryManager.getInstance()
    memoryManagerRef.current = memoryManager
    const registeredCallbacks: Array<() => void> = []
    phases.forEach((phase) => {
      const callback = () => {
        phase.cleanup()
      }
      memoryManager.registerCleanupCallback(callback)
      registeredCallbacks.push(callback)
    })

    const updateMemoryDebug = () => {
      setMemoryStatsData(memoryManager.getStats())
      setMemoryHistoryData(memoryManager.getHistory(60))
    }

    updateMemoryDebug()

    unsubscribeMemory = memoryManager.subscribe((event) => {
      if (event.type !== 'sample') {
        setMemoryEvents((prev) => [...prev.slice(-9), event])
      }
      updateMemoryDebug()
    })
    
    // Create phase sequence with looping
    const sequence: PhaseType[] = [
      'typing',
      'white',
      'circle',
      'explosion',
      'ecosystem',
    ]
    
    // Initialize PhaseManager with infinite looping
    const phaseManager = new PhaseManager(phases, sequence, true)
    phaseManagerRef.current = phaseManager
    
    // Start first phase
    phaseManager.reset()
    
    // Fixed-rate animation loop for constant 60 FPS across all devices
    const TARGET_FPS = 60
    const TARGET_FRAME_TIME = 1000 / TARGET_FPS // 16.67ms
    let lastTime = performance.now()
    let frameCount = 0
    let fpsTime = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let isRunning = true
    
    const animate = () => {
      if (!isRunning) return
      
      const currentTime = performance.now()
      const dt = currentTime - lastTime
      lastTime = currentTime
      
      // FPS calculation
      frameCount++
      fpsTime += dt
      if (fpsTime >= 1000) {
        setFps(frameCount)
        frameCount = 0
        fpsTime = 0
      }
      
      // Record performance metrics
      if (monitorRef.current) {
        monitorRef.current.recordFrame()
        
        // Update particle count if available
        const currentPhase = phaseManagerRef.current?.getCurrentPhase()
        if (currentPhase && 'sph' in currentPhase) {
          const sph = (currentPhase as any).sph
          if (sph && sph.particles) {
            monitorRef.current.setParticleCount(sph.particles.length)
          }
        }
        
        // Update performance score
        const score = monitorRef.current.getPerformanceScore()
        setPerformanceScore(Math.round(score))
        
        // Update memory and thermal state
        const metrics = monitorRef.current.getMetrics()
        setMemoryUsage(Math.round(metrics.memoryUsage))
        setThermalState(metrics.thermalState)
        
        // Update adaptive quality
        if (qualityScalerRef.current) {
          qualityScalerRef.current.update()
        }
      }
      
      // Update phase manager with fixed delta time for consistent simulation
      // Use target frame time instead of actual dt to maintain constant rate
      const fixedDt = TARGET_FRAME_TIME
      if (phaseManagerRef.current) {
        phaseManagerRef.current.update(fixedDt)
        phaseManagerRef.current.render(ctx)
        
        // Update UI state
        const currentPhaseType = phaseManagerRef.current.getCurrentPhaseType()
        if (currentPhaseType) {
          setCurrentPhase(currentPhaseType)
        }
        
        const loop = phaseManagerRef.current.getLoopCount()
        if (loop !== loopCount) {
          setLoopCount(loop)
        }

        // Get ecosystem stats if in ecosystem phase
        if (currentPhaseType === 'ecosystem') {
          const ecosystemPhase = phases.get('ecosystem') as EcosystemPhase
          if (ecosystemPhase && 'getStats' in ecosystemPhase) {
            const stats = (ecosystemPhase as any).getStats()
            setEcosystemStats(stats || undefined)
          }
        } else {
          setEcosystemStats(undefined)
        }
      }
      
      // Calculate next frame time with precise timing
      const frameStart = performance.now()
      const frameDuration = frameStart - currentTime
      const delay = Math.max(0, TARGET_FRAME_TIME - frameDuration)
      
      // Schedule next frame
      timeoutId = setTimeout(animate, delay)
    }
    
    // Start animation loop
    animate()
    
    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      
      // Resize WebGL renderer if chemical phase exists
      const chemicalPhase = phases.get('chemical') as ChemicalPhase
      if (chemicalPhase && (chemicalPhase as any).webglRenderer) {
        (chemicalPhase as any).webglRenderer.resize()
      }
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      isRunning = false
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', handleResize)
      
      // Cleanup phases
      phases.forEach((phase) => {
        phase.cleanup()
      })
      registeredCallbacks.forEach((callback) => memoryManager.unregisterCleanupCallback(callback))
      qualityScalerRef.current?.dispose()
      unsubscribeMemory?.()
      memoryManagerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const tracker = SimulationSourceTracker.getInstance()
    const unsubscribe = tracker.subscribe((snapshot) => {
      setSimulationSources(snapshot)
    })
    return unsubscribe
  }, [])

  const memoryTrend = memoryHistoryData.length
    ? memoryHistoryData
        .slice(-6)
        .map((sample) => Math.round(sample.usedMB))
        .join(' → ')
    : ''
  const currentStatus = simulationSources[currentPhase]
  const currentSourceLabel =
    currentStatus?.mode === 'server'
      ? `SERVER${currentStatus.accelerator ? ` (${currentStatus.accelerator.toUpperCase()})` : ''}`
      : 'LOCAL (browser)'
  const telemetryParts: string[] = []
  if (typeof currentStatus?.latencyMs === 'number') {
    telemetryParts.push(`${Math.round(currentStatus.latencyMs)}ms compute`)
  }
  if (typeof currentStatus?.roundTripMs === 'number') {
    telemetryParts.push(`${Math.round(currentStatus.roundTripMs)}ms RTT`)
  }
  if (typeof currentStatus?.sampleSize === 'number') {
    telemetryParts.push(`${currentStatus.sampleSize} samples`)
  }
  const currentTelemetryLine = telemetryParts.join(' / ')

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* 404 Message - TOP CENTER */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-red-500 font-mono text-lg font-bold opacity-90 z-50 tracking-wide">
        ERROR 404: The page you seek has evolved beyond existence
      </div>
      
      {/* Unified Compact Telemetry Panel - Bottom */}
      <UnifiedTelemetryPanel
        performance={{
          fps,
          memoryUsage,
          thermalState,
          performanceScore,
          deviceTier,
          memoryTrend,
        }}
        physics={{
          currentPhase,
          loopCount,
          currentSourceLabel,
          currentTelemetryLine,
          simulationSources,
        }}
        ecosystemStats={ecosystemStats}
      />
    </div>
  )
}

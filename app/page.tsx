'use client'

import { useEffect, useRef, useState } from 'react'
import { TypingPhase } from '@/lib/phases/typing-phase'
import { ChemicalPhase } from '@/lib/phases/chemical-phase'
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
import { TechStackDisplay } from './components/TechStack'

export default function Error404() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('typing')
  const [fps, setFps] = useState(0)
  const [deviceTier, setDeviceTier] = useState<DeviceTier>('medium')
  const [loopCount, setLoopCount] = useState(0)
  const [performanceScore, setPerformanceScore] = useState(0)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [thermalState, setThermalState] = useState<'normal' | 'throttling' | 'critical'>('normal')
  const [showMemoryDebug, setShowMemoryDebug] = useState(false)
  const [memoryStatsData, setMemoryStatsData] = useState<MemoryStats | null>(null)
  const [memoryHistoryData, setMemoryHistoryData] = useState<MemorySample[]>([])
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([])
  const animationRef = useRef<number>()
  const phaseManagerRef = useRef<PhaseManager | null>(null)
  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const qualityScalerRef = useRef<AdaptiveQualityScaler | null>(null)
  const memoryManagerRef = useRef<MemoryManager | null>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const debugMemory = new URLSearchParams(window.location.search).get('debug') === 'memory'
    setShowMemoryDebug(debugMemory)
    
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
    phases.set('chemical', new ChemicalPhase(canvas))
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
      'chemical',
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
    
    let lastTime = performance.now()
    let frameCount = 0
    let fpsTime = 0
    
    const animate = (currentTime: number) => {
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
      
      // Update phase manager
      if (phaseManagerRef.current) {
        phaseManagerRef.current.update(dt)
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
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate(performance.now())
    
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

  const handleToggleMemoryDebug = () => {
    const next = !showMemoryDebug
    setShowMemoryDebug(next)
    if (next && memoryManagerRef.current) {
      const manager = memoryManagerRef.current
      setMemoryStatsData(manager.getStats())
      setMemoryHistoryData(manager.getHistory(60))
    }
  }

  const memoryTrend = memoryHistoryData.length
    ? memoryHistoryData
        .slice(-6)
        .map((sample) => Math.round(sample.usedMB))
        .join(' → ')
    : ''

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Performance Overlay */}
      <div className="absolute top-4 right-4 text-green-400 font-mono text-xs bg-black bg-opacity-50 p-2 rounded">
        <div>FPS: {fps}</div>
        <div>Phase: {currentPhase}</div>
        <div>Device: {deviceTier}</div>
        <div>Loop: {loopCount}</div>
        <div>Score: {performanceScore}%</div>
        <div>Memory: {memoryUsage}MB</div>
        <div>Thermal: {thermalState}</div>
      </div>

      <button
        type="button"
        onClick={handleToggleMemoryDebug}
        className={`absolute bottom-4 right-4 px-3 py-1 border rounded text-xs font-mono uppercase tracking-wide transition-colors ${showMemoryDebug ? 'border-cyan-500 text-cyan-300' : 'border-gray-600 text-gray-300 hover:text-white hover:border-white'}`}
      >
        for_nerds {showMemoryDebug ? '▲' : '▼'}
      </button>

      {showMemoryDebug && memoryStatsData && (
        <div className="absolute bottom-16 right-4 w-72 text-cyan-300 font-mono text-xs bg-black bg-opacity-70 backdrop-blur-sm p-3 rounded border border-cyan-500 border-opacity-30 space-y-1">
          <div className="text-cyan-100 uppercase tracking-widest text-[10px]">Memory Debug</div>
          <div className="flex justify-between"><span>Status</span><span>{memoryStatsData.status.toUpperCase()}</span></div>
          <div className="flex justify-between"><span>Current</span><span>{memoryStatsData.currentUsage.toFixed(1)} MB</span></div>
          <div className="flex justify-between"><span>Average</span><span>{memoryStatsData.averageUsage.toFixed(1)} MB</span></div>
          <div className="flex justify-between"><span>Peak</span><span>{memoryStatsData.peakUsage.toFixed(1)} MB</span></div>
          <div className="flex justify-between"><span>Warnings</span><span>{memoryStatsData.warningCount}</span></div>
          <div className="flex justify-between"><span>Critical</span><span>{memoryStatsData.criticalCount}</span></div>
          <div className="flex justify-between"><span>Cleanups</span><span>{memoryStatsData.cleanupCount}</span></div>
          <div className="flex justify-between"><span>Leak</span><span>{memoryStatsData.leakSuspected ? '⚠ suspected' : 'clear'}</span></div>
          {memoryTrend && (
            <div className="pt-1 text-[10px] text-cyan-200">Recent: {memoryTrend} MB</div>
          )}
          {memoryEvents.length > 0 && (
            <div className="pt-2 border-t border-cyan-700 border-opacity-40">
              <div className="text-cyan-100 mb-1">Events</div>
              {memoryEvents.slice(-3).reverse().map((event) => (
                <div key={event.timestamp} className="flex justify-between text-[10px]">
                  <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span>{event.type}@{event.usedMB.toFixed(1)}MB</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 404 Message */}
      <div className="absolute bottom-4 left-4 text-red-500 font-mono text-sm opacity-50">
        ERROR 404: The page you seek has evolved beyond existence
      </div>
      
      {/* Tech Stack Display */}
      <TechStackDisplay />
    </div>
  )
}


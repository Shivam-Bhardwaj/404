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
import { PhaseType, DeviceTier, AnimationPhase } from '@/lib/types'

export default function Error404() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('typing')
  const [fps, setFps] = useState(0)
  const [deviceTier, setDeviceTier] = useState<DeviceTier>('medium')
  const [loopCount, setLoopCount] = useState(0)
  const [performanceScore, setPerformanceScore] = useState(0)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [thermalState, setThermalState] = useState<'normal' | 'throttling' | 'critical'>('normal')
  const animationRef = useRef<number>()
  const phaseManagerRef = useRef<PhaseManager | null>(null)
  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const qualityScalerRef = useRef<AdaptiveQualityScaler | null>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
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
      const qualityScaler = new AdaptiveQualityScaler(monitor, tier)
      qualityScalerRef.current = qualityScaler
    })
    
    // Initialize phases
    const phases = new Map<PhaseType, AnimationPhase>()
    
    phases.set('typing', new TypingPhase())
    phases.set('chemical', new ChemicalPhase(canvas))
    phases.set('white', new WhitePhase())
    phases.set('circle', new CirclePhase(canvas.width, canvas.height))
    phases.set('explosion', new ExplosionPhase(canvas.width, canvas.height))
    phases.set('ecosystem', new EcosystemPhase(canvas.width, canvas.height))
    
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
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
      
      {/* 404 Message */}
      <div className="absolute bottom-4 left-4 text-red-500 font-mono text-sm opacity-50">
        ERROR 404: The page you seek has evolved beyond existence
      </div>
    </div>
  )
}


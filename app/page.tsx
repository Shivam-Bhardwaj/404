'use client'

import { useEffect, useRef, useState } from 'react'
import { TypingPhase } from '@/lib/phases/typing-phase'
import { WhitePhase } from '@/lib/phases/white-phase'
import { CirclePhase } from '@/lib/phases/circle-phase'
import { ExplosionPhase } from '@/lib/phases/explosion-phase'
import { EcosystemPhase } from '@/lib/phases/ecosystem-phase'
import { HardwareDetector } from '@/lib/hardware/detection'
import { PhaseType, DeviceTier } from '@/lib/types'

export default function Error404() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('typing')
  const [fps, setFps] = useState(0)
  const [deviceTier, setDeviceTier] = useState<DeviceTier>('medium')
  const animationRef = useRef<number>()
  const phasesRef = useRef<Map<PhaseType, any>>(new Map())
  
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
    detector.benchmark().then((tier) => {
      setDeviceTier(tier)
      const config = detector.getPerformanceConfig()
      console.log('Device tier:', tier, 'Config:', config)
    })
    
    // Initialize phases
    const typing = new TypingPhase()
    const white = new WhitePhase()
    const circle = new CirclePhase(canvas.width, canvas.height)
    const explosion = new ExplosionPhase(canvas.width, canvas.height)
    const ecosystem = new EcosystemPhase(canvas.width, canvas.height)
    
    phasesRef.current.set('typing', typing)
    phasesRef.current.set('white', white)
    phasesRef.current.set('circle', circle)
    phasesRef.current.set('explosion', explosion)
    phasesRef.current.set('ecosystem', ecosystem)
    
    // Start first phase
    typing.init()
    
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
      
      // Update current phase
      const phase = phasesRef.current.get(currentPhase)
      if (phase) {
        phase.update(dt)
        phase.render(ctx)
        
        // Transition to next phase
        if (phase.isComplete) {
          phase.cleanup()
          
          if (currentPhase === 'typing') {
            setCurrentPhase('white')
            const nextPhase = phasesRef.current.get('white')
            nextPhase?.init()
          } else if (currentPhase === 'white') {
            setCurrentPhase('circle')
            const nextPhase = phasesRef.current.get('circle')
            nextPhase?.init()
          } else if (currentPhase === 'circle') {
            setCurrentPhase('explosion')
            const nextPhase = phasesRef.current.get('explosion')
            nextPhase?.init()
          } else if (currentPhase === 'explosion') {
            setCurrentPhase('ecosystem')
            const nextPhase = phasesRef.current.get('ecosystem')
            nextPhase?.init()
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate(performance.now())
    
    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [currentPhase])
  
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Performance Overlay */}
      <div className="absolute top-4 right-4 text-green-400 font-mono text-xs">
        <div>FPS: {fps}</div>
        <div>Phase: {currentPhase}</div>
        <div>Device: {deviceTier}</div>
      </div>
      
      {/* 404 Message */}
      <div className="absolute bottom-4 left-4 text-red-500 font-mono text-sm opacity-50">
        ERROR 404: The page you seek has evolved beyond existence
      </div>
    </div>
  )
}


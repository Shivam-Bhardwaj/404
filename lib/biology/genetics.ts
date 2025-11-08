// Genetic Algorithm System
import { GeneSequence } from '../types'
import { clamp, randomRange } from '../utils/math'

export class GeneticsEngine {
  mutationRate = 0.1
  mutationIntensity = 0.2
  
  createGene(): GeneSequence {
    return {
      hue: Math.random() * 360,
      saturation: 0.5 + Math.random() * 0.5,
      brightness: 0.4 + Math.random() * 0.4,
      size: 0.5 + Math.random() * 1.5,
      speed: 0.5 + Math.random() * 1.5,
      aggression: Math.random(),
      efficiency: Math.random(),
    }
  }
  
  mutate(gene: GeneSequence): GeneSequence {
    const mutated: GeneSequence = { ...gene }
    
    if (Math.random() < this.mutationRate) {
      mutated.hue = (gene.hue + randomRange(-30, 30) + 360) % 360
    }
    
    if (Math.random() < this.mutationRate) {
      mutated.saturation = clamp(gene.saturation + randomRange(-0.1, 0.1), 0, 1)
    }
    
    if (Math.random() < this.mutationRate) {
      mutated.brightness = clamp(gene.brightness + randomRange(-0.1, 0.1), 0, 1)
    }
    
    if (Math.random() < this.mutationRate) {
      mutated.size = clamp(gene.size + randomRange(-0.2, 0.2), 0.5, 2.0)
    }
    
    if (Math.random() < this.mutationRate) {
      mutated.speed = clamp(gene.speed + randomRange(-0.2, 0.2), 0.5, 2.0)
    }
    
    if (Math.random() < this.mutationRate) {
      mutated.aggression = clamp(gene.aggression + randomRange(-0.1, 0.1), 0, 1)
    }
    
    if (Math.random() < this.mutationRate) {
      mutated.efficiency = clamp(gene.efficiency + randomRange(-0.1, 0.1), 0, 1)
    }
    
    return mutated
  }
  
  crossover(parent1: GeneSequence, parent2: GeneSequence): GeneSequence {
    return {
      hue: Math.random() < 0.5 ? parent1.hue : parent2.hue,
      saturation: (parent1.saturation + parent2.saturation) / 2,
      brightness: (parent1.brightness + parent2.brightness) / 2,
      size: Math.random() < 0.5 ? parent1.size : parent2.size,
      speed: Math.random() < 0.5 ? parent1.speed : parent2.speed,
      aggression: (parent1.aggression + parent2.aggression) / 2,
      efficiency: Math.random() < 0.5 ? parent1.efficiency : parent2.efficiency,
    }
  }
  
  geneToColor(gene: GeneSequence): string {
    const h = gene.hue
    const s = gene.saturation * 100
    const l = gene.brightness * 100
    return `hsl(${h}, ${s}%, ${l}%)`
  }
  
  calculateFitness(gene: GeneSequence, energy: number, age: number): number {
    const survivalBonus = energy * gene.efficiency
    const reproductionBonus = gene.size * gene.speed
    const agePenalty = age / 1000
    
    return survivalBonus + reproductionBonus - agePenalty
  }
  
  shouldReproduce(gene: GeneSequence, energy: number, populationDensity: number): boolean {
    const energyThreshold = 60 + (1 - gene.efficiency) * 40
    const densityPenalty = Math.min(1, populationDensity / 100)
    
    return energy > energyThreshold && Math.random() > densityPenalty
  }
}


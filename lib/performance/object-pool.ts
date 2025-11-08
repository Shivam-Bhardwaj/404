// Object Pool for Memory Management
export class ObjectPool<T> {
  private available: T[] = []
  private inUse = new Set<T>()
  private factory: () => T
  private reset: (obj: T) => void
  private maxSize: number
  
  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 10, maxSize = 1000) {
    this.factory = factory
    this.reset = reset
    this.maxSize = maxSize
    
    // Pre-allocate initial objects
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory())
    }
  }
  
  acquire(): T {
    let obj: T
    
    if (this.available.length > 0) {
      obj = this.available.pop()!
    } else if (this.inUse.size < this.maxSize) {
      obj = this.factory()
    } else {
      // Pool exhausted, reuse oldest
      obj = Array.from(this.inUse)[0]
      this.inUse.delete(obj)
    }
    
    this.inUse.add(obj)
    return obj
  }
  
  release(obj: T): void {
    if (!this.inUse.has(obj)) return
    
    this.inUse.delete(obj)
    this.reset(obj)
    
    if (this.available.length < this.maxSize / 2) {
      this.available.push(obj)
    }
  }
  
  releaseAll(): void {
    this.inUse.forEach((obj) => {
      this.reset(obj)
      if (this.available.length < this.maxSize / 2) {
        this.available.push(obj)
      }
    })
    this.inUse.clear()
  }
  
  clear(): void {
    this.available = []
    this.inUse.clear()
  }
  
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize,
    }
  }
}


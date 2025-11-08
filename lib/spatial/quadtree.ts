// Quadtree for Efficient Spatial Indexing
import { Vec2 } from '../types'

export interface QuadTreeNode<T extends Vec2> {
  x: number
  y: number
  width: number
  height: number
  capacity: number
  items: T[]
  divided: boolean
  northwest?: QuadTreeNode<T>
  northeast?: QuadTreeNode<T>
  southwest?: QuadTreeNode<T>
  southeast?: QuadTreeNode<T>
}

export class QuadTree<T extends Vec2> {
  private root: QuadTreeNode<T>
  
  constructor(x: number, y: number, width: number, height: number, capacity = 4) {
    this.root = {
      x,
      y,
      width,
      height,
      capacity,
      items: [],
      divided: false,
    }
  }
  
  private subdivide(node: QuadTreeNode<T>): void {
    const x = node.x
    const y = node.y
    const w = node.width / 2
    const h = node.height / 2
    const cap = node.capacity
    
    node.northwest = {
      x,
      y,
      width: w,
      height: h,
      capacity: cap,
      items: [],
      divided: false,
    }
    
    node.northeast = {
      x: x + w,
      y,
      width: w,
      height: h,
      capacity: cap,
      items: [],
      divided: false,
    }
    
    node.southwest = {
      x,
      y: y + h,
      width: w,
      height: h,
      capacity: cap,
      items: [],
      divided: false,
    }
    
    node.southeast = {
      x: x + w,
      y: y + h,
      width: w,
      height: h,
      capacity: cap,
      items: [],
      divided: false,
    }
    
    node.divided = true
  }
  
  private contains(node: QuadTreeNode<T>, item: T): boolean {
    return (
      item.x >= node.x &&
      item.x < node.x + node.width &&
      item.y >= node.y &&
      item.y < node.y + node.height
    )
  }
  
  private insertIntoNode(node: QuadTreeNode<T>, item: T): boolean {
    if (!this.contains(node, item)) {
      return false
    }
    
    if (node.items.length < node.capacity) {
      node.items.push(item)
      return true
    }
    
    if (!node.divided) {
      this.subdivide(node)
    }
    
    return (
      this.insertIntoNode(node.northwest!, item) ||
      this.insertIntoNode(node.northeast!, item) ||
      this.insertIntoNode(node.southwest!, item) ||
      this.insertIntoNode(node.southeast!, item)
    )
  }
  
  insert(item: T): boolean {
    return this.insertIntoNode(this.root, item)
  }
  
  private queryRangeNode(
    node: QuadTreeNode<T>,
    x: number,
    y: number,
    width: number,
    height: number,
    found: T[]
  ): void {
    // Check if range intersects with node
    if (
      x > node.x + node.width ||
      x + width < node.x ||
      y > node.y + node.height ||
      y + height < node.y
    ) {
      return
    }
    
    // Check items in this node
    for (const item of node.items) {
      if (item.x >= x && item.x < x + width && item.y >= y && item.y < y + height) {
        found.push(item)
      }
    }
    
    // Recursively search children
    if (node.divided) {
      this.queryRangeNode(node.northwest!, x, y, width, height, found)
      this.queryRangeNode(node.northeast!, x, y, width, height, found)
      this.queryRangeNode(node.southwest!, x, y, width, height, found)
      this.queryRangeNode(node.southeast!, x, y, width, height, found)
    }
  }
  
  queryRange(x: number, y: number, width: number, height: number): T[] {
    const found: T[] = []
    this.queryRangeNode(this.root, x, y, width, height, found)
    return found
  }
  
  queryRadius(x: number, y: number, radius: number): T[] {
    const found = this.queryRange(x - radius, y - radius, radius * 2, radius * 2)
    
    // Filter by actual distance
    return found.filter((item) => {
      const dx = item.x - x
      const dy = item.y - y
      return dx * dx + dy * dy <= radius * radius
    })
  }
  
  clear(): void {
    this.root.items = []
    this.root.divided = false
    this.root.northwest = undefined
    this.root.northeast = undefined
    this.root.southwest = undefined
    this.root.southeast = undefined
  }
  
  getNodeCount(): number {
    return this.countNodes(this.root)
  }
  
  private countNodes(node: QuadTreeNode<T>): number {
    if (!node.divided) return 1
    
    return (
      1 +
      this.countNodes(node.northwest!) +
      this.countNodes(node.northeast!) +
      this.countNodes(node.southwest!) +
      this.countNodes(node.southeast!)
    )
  }
}


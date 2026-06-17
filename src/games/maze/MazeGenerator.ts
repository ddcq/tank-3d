export interface MazeData {
  width: number
  height: number
  startCol: number
  startRow: number
  endCol: number
  endRow: number
  vWalls: Uint8Array
  hWalls: Uint8Array
}

class UnionFind {
  parent: Int32Array
  rank: Uint8Array

  constructor(n: number) {
    this.parent = new Int32Array(n)
    this.rank = new Uint8Array(n)
    for (let i = 0; i < n; i++) this.parent[i] = i
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]
      x = this.parent[x]
    }
    return x
  }

  union(a: number, b: number): boolean {
    let ra = this.find(a), rb = this.find(b)
    if (ra === rb) return false
    if (this.rank[ra] < this.rank[rb]) {
      [ra, rb] = [rb, ra]
    }
    this.parent[rb] = ra
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++
    return true
  }
}

interface WallEdge {
  x: number
  y: number
  dir: 'v' | 'h'
}

export function generateMaze(w: number, h: number): MazeData {
  const vWalls = new Uint8Array(h * (w - 1)).fill(1)
  const hWalls = new Uint8Array((h - 1) * w).fill(1)

  const edges: WallEdge[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      edges.push({ x, y, dir: 'v' })
    }
  }
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      edges.push({ x, y, dir: 'h' })
    }
  }

  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[edges[i], edges[j]] = [edges[j], edges[i]]
  }

  const uf = new UnionFind(w * h)

  for (const edge of edges) {
    const { x, y, dir } = edge
    if (dir === 'v') {
      const idA = y * w + x
      const idB = y * w + (x + 1)
      if (uf.union(idA, idB)) {
        vWalls[y * (w - 1) + x] = 0
      }
    } else {
      const idA = y * w + x
      const idB = (y + 1) * w + x
      if (uf.union(idA, idB)) {
        hWalls[y * w + x] = 0
      }
    }
  }

  function countOpenDirs(c: number, r: number): number {
    let open = 0
    if (c > 0 && vWalls[r * (w - 1) + (c - 1)] === 0) open++
    if (c < w - 1 && vWalls[r * (w - 1) + c] === 0) open++
    if (r > 0 && hWalls[(r - 1) * w + c] === 0) open++
    if (r < h - 1 && hWalls[r * w + c] === 0) open++
    return open
  }

  const bottomRow = h - 1
  const intersections: number[] = []
  for (let x = 0; x < w; x++) {
    if (countOpenDirs(x, bottomRow) >= 3) intersections.push(x)
  }
  const startCol = intersections.length > 0
    ? intersections[Math.floor(Math.random() * intersections.length)]
    : Math.floor(Math.random() * w)
  const startRow = bottomRow

  const topCandidates: number[] = []
  for (let x = 0; x < w; x++) topCandidates.push(x)
  const endCol = topCandidates[Math.floor(Math.random() * topCandidates.length)]

  return {
    width: w,
    height: h,
    startCol,
    startRow,
    endCol,
    endRow: 0,
    vWalls,
    hWalls,
  }
}

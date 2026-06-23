export interface FakeWall {
  col: number
  row: number
  dir: 'v' | 'h'
}

export interface MazeData {
  width: number
  height: number
  startCol: number
  startRow: number
  endCol: number
  endRow: number
  vWalls: Uint8Array
  hWalls: Uint8Array
  fakeWalls: FakeWall[]
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

function findPath(
  startCol: number, startRow: number,
  endCol: number, endRow: number,
  w: number, h: number,
  vWalls: Uint8Array, hWalls: Uint8Array,
): [number, number][] {
  const visited = new Set<number>()
  const parent = new Map<number, [number, number]>()
  const queue: [number, number][] = [[startCol, startRow]]
  visited.add(startRow * w + startCol)

  while (queue.length > 0) {
    const [col, row] = queue.shift()!
    if (col === endCol && row === endRow) {
      const path: [number, number][] = []
      let cur: [number, number] = [col, row]
      path.push(cur)
      while (parent.has(cur[1] * w + cur[0])) {
        cur = parent.get(cur[1] * w + cur[0])!
        path.unshift(cur)
      }
      return path
    }

    const dirs: { dx: number; dz: number; canMove: (c: number, r: number) => boolean }[] = [
      { dx: 1, dz: 0, canMove: (c, r) => c < w - 1 && vWalls[r * (w - 1) + c] === 0 },
      { dx: -1, dz: 0, canMove: (c, r) => c > 0 && vWalls[r * (w - 1) + (c - 1)] === 0 },
      { dx: 0, dz: 1, canMove: (c, r) => r < h - 1 && hWalls[r * w + c] === 0 },
      { dx: 0, dz: -1, canMove: (c, r) => r > 0 && hWalls[(r - 1) * w + c] === 0 },
    ]

    for (const { dx, dz, canMove } of dirs) {
      const nc = col + dx
      const nr = row + dz
      const key = nr * w + nc
      if (nc >= 0 && nc < w && nr >= 0 && nr < h && !visited.has(key) && canMove(col, row)) {
        visited.add(key)
        parent.set(key, [col, row])
        queue.push([nc, nr])
      }
    }
  }
  return []
}

function isPureCorridor(
  c: number, r: number,
  w: number, h: number,
  vWalls: Uint8Array, hWalls: Uint8Array,
): boolean {
  const leftWall  = c <= 0     || vWalls[r * (w - 1) + (c - 1)] !== 0
  const rightWall = c >= w - 1 || vWalls[r * (w - 1) + c]      !== 0
  const upWall    = r <= 0     || hWalls[(r - 1) * w + c]      !== 0
  const downWall  = r >= h - 1 || hWalls[r * w + c]            !== 0

  return (leftWall && rightWall && !upWall && !downWall) ||
         (upWall && downWall && !leftWall && !rightWall)
}

function placeFakeWalls(
  path: [number, number][],
  w: number, h: number,
  vWalls: Uint8Array, hWalls: Uint8Array,
): FakeWall[] {
  const fakeWalls: FakeWall[] = []

  const corridors: { index: number; col: number; row: number; nextCol: number; nextRow: number }[] = []
  for (let i = 2; i < path.length - 2; i++) {
    const [col, row] = path[i]
    const [nextCol, nextRow] = path[i + 1]
    if (isPureCorridor(col, row, w, h, vWalls, hWalls)) {
      corridors.push({ index: i, col, row, nextCol, nextRow })
    }
  }

  const count = Math.min(4, corridors.length)
  if (count === 0) return fakeWalls

  const step = (corridors.length - 1) / Math.max(count - 1, 1)
  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * step)
    const corridor = corridors[idx]
    const { col, row, nextCol, nextRow } = corridor
    const dc = nextCol - col
    const dr = nextRow - row

    let fakeCol: number
    let fakeRow: number
    let fakeDir: 'v' | 'h'

    if (dc === 1) {
      fakeCol = col
      fakeRow = row
      fakeDir = 'v'
    } else if (dc === -1) {
      fakeCol = col - 1
      fakeRow = row
      fakeDir = 'v'
    } else if (dr === 1) {
      fakeCol = col
      fakeRow = row
      fakeDir = 'h'
    } else {
      fakeCol = col
      fakeRow = row - 1
      fakeDir = 'h'
    }

    fakeWalls.push({ col: fakeCol, row: fakeRow, dir: fakeDir })
  }

  return fakeWalls
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

  const path = findPath(startCol, startRow, endCol, 0, w, h, vWalls, hWalls)
  const fakeWalls = placeFakeWalls(path, w, h, vWalls, hWalls)

  return {
    width: w,
    height: h,
    startCol,
    startRow,
    endCol,
    endRow: 0,
    vWalls,
    hWalls,
    fakeWalls,
  }
}

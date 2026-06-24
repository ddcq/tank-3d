import type { MazeData } from './MazeGenerator'
import type { MazePlayerController } from './MazePlayerController'

const CELL_PX = 11
const PADDING = 8
const DEFAULT_RADIUS = 3

export class MazeMinimap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private visibilityRadius = DEFAULT_RADIUS
  private guidePath: [number, number][] | null = null
  private wallsCanvas: HTMLCanvasElement
  private wallsCtx: CanvasRenderingContext2D
  private wallsCacheDirty = true

  constructor(private readonly maze: MazeData) {
    const w = maze.width * CELL_PX + PADDING * 2
    const h = maze.height * CELL_PX + PADDING * 2

    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.cssText = [
      'position:fixed',
      'right:12px',
      'top:50%',
      'transform:translateY(-50%)',
      `width:${w}px`,
      `height:${h}px`,
      'z-index:50',
      'pointer-events:none',
      'background:transparent',
      'border:1px solid rgba(255,255,255,0.15)',
      'border-radius:6px',
      'box-shadow:0 0 20px rgba(0,0,0,0.5)',
    ].join(';')

    this.ctx = this.canvas.getContext('2d')!

    // Create offscreen canvas for caching wall rendering
    this.wallsCanvas = document.createElement('canvas')
    this.wallsCanvas.width = maze.width * CELL_PX
    this.wallsCanvas.height = maze.height * CELL_PX
    this.wallsCtx = this.wallsCanvas.getContext('2d')!
  }

  get element(): HTMLCanvasElement {
    return this.canvas
  }

  setVisibilityRadius(r: number): void {
    this.visibilityRadius = r
  }

  setGuidePath(cells: [number, number][]): void {
    this.guidePath = cells
  }

  clearGuidePath(): void {
    this.guidePath = null
  }

  removeFakeWall(key: string): void {
    const idx = this.maze.fakeWalls.findIndex(fw => `${fw.dir}:${fw.row}:${fw.col}` === key)
    if (idx !== -1) {
      this.maze.fakeWalls.splice(idx, 1)
      this.wallsCacheDirty = true
    }
  }

  private renderWallsToCache(): void {
    const { width, height, vWalls, hWalls, fakeWalls } = this.maze
    const ctx = this.wallsCtx

    ctx.clearRect(0, 0, this.wallsCanvas.width, this.wallsCanvas.height)

    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth = 2

    ctx.beginPath()
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width - 1; col++) {
        if (vWalls[row * (width - 1) + col] === 1) {
          const x = (col + 1) * CELL_PX
          const y = row * CELL_PX
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + CELL_PX)
        }
      }
    }
    ctx.stroke()

    ctx.beginPath()
    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width; col++) {
        if (hWalls[row * width + col] === 1) {
          const x = col * CELL_PX
          const y = (row + 1) * CELL_PX
          ctx.moveTo(x, y)
          ctx.lineTo(x + CELL_PX, y)
        }
      }
    }
    ctx.stroke()

    for (const fw of fakeWalls) {
      const { col, row, dir } = fw
      if (dir === 'v') {
        const x = (col + 1) * CELL_PX
        const y = row * CELL_PX
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + CELL_PX)
        ctx.stroke()
      } else {
        const x = col * CELL_PX
        const y = (row + 1) * CELL_PX
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + CELL_PX, y)
        ctx.stroke()
      }
    }

    ctx.strokeRect(0, 0, width * CELL_PX, height * CELL_PX)

    this.wallsCacheDirty = false
  }

  update(player: MazePlayerController): void {
    const ctx = this.ctx
    const cw = this.canvas.width
    const ch = this.canvas.height

    ctx.clearRect(0, 0, cw, ch)

    ctx.save()
    ctx.translate(PADDING, PADDING)

    ctx.fillStyle = '#141414'
    ctx.fillRect(0, 0, this.maze.width * CELL_PX, this.maze.height * CELL_PX)

    ctx.fillStyle = '#1a2a1a'
    for (let row = 0; row < this.maze.height; row++) {
      for (let col = 0; col < this.maze.width; col++) {
        ctx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX, CELL_PX)
      }
    }

    // Render walls to cache if needed (first time or if walls changed)
    if (this.wallsCacheDirty) {
      this.renderWallsToCache()
    }

    // Composite the cached walls onto the main canvas
    ctx.drawImage(this.wallsCanvas, 0, 0)

    if (this.guidePath && this.guidePath.length > 1) {
      ctx.save()
      ctx.strokeStyle = '#4488ff'
      ctx.lineWidth = 2.5
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(this.guidePath[0][0] * CELL_PX + CELL_PX / 2, this.guidePath[0][1] * CELL_PX + CELL_PX / 2)
      for (let i = 1; i < this.guidePath.length; i++) {
        ctx.lineTo(this.guidePath[i][0] * CELL_PX + CELL_PX / 2, this.guidePath[i][1] * CELL_PX + CELL_PX / 2)
      }
      ctx.stroke()
      ctx.restore()
    }

    const sx = this.maze.startCol * CELL_PX
    const sy = this.maze.startRow * CELL_PX
    ctx.fillStyle = '#00ff88'
    ctx.fillRect(sx + 2, sy + 2, CELL_PX - 4, CELL_PX - 4)

    const ex = this.maze.endCol * CELL_PX
    const ey = this.maze.endRow * CELL_PX
    ctx.fillStyle = '#ffcc00'
    ctx.beginPath()
    ctx.arc(ex + CELL_PX / 2, ey + CELL_PX / 2, CELL_PX * 0.35, 0, Math.PI * 2)
    ctx.fill()

    const px = player.col * CELL_PX + CELL_PX / 2
    const py = player.row * CELL_PX + CELL_PX / 2
    ctx.save()
    ctx.translate(px, py)

    const angle = player.rotation
    ctx.rotate(angle)

    ctx.fillStyle = '#44ffaa'
    ctx.beginPath()
    ctx.moveTo(0, -CELL_PX * 0.5)
    ctx.lineTo(-CELL_PX * 0.25, CELL_PX * 0.3)
    ctx.lineTo(0, CELL_PX * 0.1)
    ctx.lineTo(CELL_PX * 0.25, CELL_PX * 0.3)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
    ctx.restore()

    const cx = px + PADDING
    const cy = py + PADDING
    const vr = this.visibilityRadius * CELL_PX
    const blurPx = Math.min(CELL_PX * 1.5, vr * 0.4)

    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    const gradient = ctx.createRadialGradient(cx, cy, vr - blurPx, cx, cy, vr)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cw, ch)
    ctx.restore()
  }

  dispose(): void {
    this.canvas.remove()
  }
}

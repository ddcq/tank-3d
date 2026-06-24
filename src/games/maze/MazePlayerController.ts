import type { MazeData } from './MazeGenerator'

const CELL = 2
const MOVE_SPEED = 1.6
const TURN_DURATION = 0.4
const DEAD_END_DURATION = 0.9
const PITCH_VELOCITY_THRESHOLD = 2.5

export const enum PlayerState {
  MOVING,
  TURNING,
  INTERSECTION,
  DEAD_END_TURN,
  SURPRISE,
  TELEPORTING,
  WIN,
}

interface Dir {
  dx: number
  dz: number
}

const DIRS: Dir[] = [
  { dx: 0, dz: -1 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: -1, dz: 0 },
]

function cellToWorld(col: number, row: number, w: number): { x: number; z: number } {
  return {
    x: col * CELL + CELL / 2 - w * CELL / 2,
    z: row * CELL + CELL / 2,
  }
}

export interface DeadEndInfo {
  col: number
  row: number
  forwardDir: Dir
  isBoundary: boolean
}

export class MazePlayerController {
  col: number
  row: number
  dirIndex = 0
  state: PlayerState = PlayerState.MOVING

  hasGun = false
  bullets = 0
  maxBullets = 6

  worldX = 0
  worldZ = 0
  worldY = 0
  rotation = 0
  stateTimer = 0
  targetRotation = 0
  startRotation = 0

  availableDirs: Dir[] = []
  selectedDirIndex = 0
  headLookAngle = 0
  confirmRequested = false
  cycleDirection = 0

  onStep?: () => void
  onTurn?: () => void
  onDeadEnd?: () => void
  onConfirm?: () => void
  onWin?: () => void
  onDeadEndEntry?: (info: DeadEndInfo) => boolean

  private fromX = 0
  private fromZ = 0
  private toX = 0
  private toZ = 0
  private moveProgress = 1
  private teleportFromX = 0
  private teleportFromZ = 0
  private teleportToX = 0
  private teleportToZ = 0
  private teleportProgress = 0
  private wallPassSpeed = 0
  private skipNextSurprise = false
  private justConfirmed = false
  private lastPitch = 0
  private readonly vWalls: Uint8Array
  private readonly hWalls: Uint8Array
  private readonly w: number
  private readonly h: number
  private readonly endCol: number
  private readonly endRow: number

  constructor(maze: MazeData) {
    this.vWalls = maze.vWalls
    this.hWalls = maze.hWalls
    this.w = maze.width
    this.h = maze.height
    this.col = maze.startCol
    this.row = maze.startRow
    this.endCol = maze.endCol
    this.endRow = maze.endRow

    // Find first available direction
    let foundDir = false
    for (let i = 0; i < 4; i++) {
      const dir = DIRS[i]
      const nc = this.col + dir.dx
      const nr = this.row + dir.dz
      if (this.canMoveTo(nc, nr)) {
        this.dirIndex = i
        foundDir = true
        break
      }
    }

    if (!foundDir) {
      this.dirIndex = 0
    }

    this.rotation = this.dirIndex * Math.PI / 2

    const pos = cellToWorld(this.col, this.row, this.w)
    this.worldX = pos.x
    this.worldZ = pos.z
    this.fromX = pos.x
    this.fromZ = pos.z

    const dir = DIRS[this.dirIndex]
    const nc = this.col + dir.dx
    const nr = this.row + dir.dz
    if (this.canMoveTo(nc, nr)) {
      const tgt = cellToWorld(nc, nr, this.w)
      this.toX = tgt.x
      this.toZ = tgt.z
      this.col = nc
      this.row = nr
      this.moveProgress = 0
    } else {
      this.toX = pos.x
      this.toZ = pos.z
    }
  }

  get mazeWidth(): number { return this.w }
  get mazeHeight(): number { return this.h }

  get direction(): Dir {
    return DIRS[this.dirIndex]
  }

  private canMoveTo(col: number, row: number): boolean {
    if (col < 0 || col >= this.w || row < 0 || row >= this.h) return false
    const dc = col - this.col
    const dr = row - this.row
    if (dc === 1) return this.vWalls[this.row * (this.w - 1) + this.col] === 0
    if (dc === -1) return this.vWalls[this.row * (this.w - 1) + (this.col - 1)] === 0
    if (dr === 1) return this.hWalls[this.row * this.w + this.col] === 0
    if (dr === -1) return this.hWalls[(this.row - 1) * this.w + this.col] === 0
    return false
  }

  private beginStep(col: number, row: number): void {
    this.fromX = this.worldX
    this.fromZ = this.worldZ
    const pos = cellToWorld(col, row, this.w)
    this.toX = pos.x
    this.toZ = pos.z
    this.moveProgress = 0
    this.col = col
    this.row = row
  }

  resumeTurning(): void {
    this.state = PlayerState.DEAD_END_TURN
    this.onDeadEnd?.()
    this.stateTimer = 0
    this.startRotation = this.rotation
    this.targetRotation = this.rotation + Math.PI
    this.dirIndex = (this.dirIndex + 2) % 4
  }

  resumeForward(): void {
    const dir = this.direction
    const nc = this.col + dir.dx
    const nr = this.row + dir.dz
    this.beginStep(nc, nr)
    this.state = PlayerState.MOVING
  }

  teleportTo(col: number, row: number): void {
    this.teleportFromX = this.worldX
    this.teleportFromZ = this.worldZ
    this.col = col
    this.row = row
    const pos = cellToWorld(col, row, this.w)
    this.teleportToX = pos.x
    this.teleportToZ = pos.z
    this.teleportProgress = 0
    this.state = PlayerState.TELEPORTING
  }

  beginWallStep(col: number, row: number): void {
    this.fromX = this.worldX
    this.fromZ = this.worldZ
    const pos = cellToWorld(col, row, this.w)
    this.toX = pos.x
    this.toZ = pos.z
    this.moveProgress = 0
    this.col = col
    this.row = row
    this.wallPassSpeed = 0.6
    this.skipNextSurprise = true
  }

  applyGunPickup(): void {
    if (!this.hasGun) {
      this.hasGun = true
      this.bullets = 1
    } else if (this.bullets < this.maxBullets) {
      this.bullets++
    }
  }

  private finishStep(): void {
    this.worldX = this.toX
    this.worldZ = this.toZ
    this.moveProgress = 1
    this.onStep?.()
    if (this.col === this.endCol && this.row === this.endRow) {
      this.state = PlayerState.WIN
      this.onWin?.()
    }
  }

  private updateTeleporting(dt: number): void {
    const duration = 1.0
    this.teleportProgress += dt
    const t = Math.min(this.teleportProgress / duration, 1)
    const ease = t * t * (3 - 2 * t)
    this.worldX = this.teleportFromX + (this.teleportToX - this.teleportFromX) * ease
    this.worldZ = this.teleportFromZ + (this.teleportToZ - this.teleportFromZ) * ease
    this.worldY = Math.sin(Math.PI * t) * 4.5
    if (t >= 1) {
      this.worldX = this.teleportToX
      this.worldZ = this.teleportToZ
      this.worldY = 0
      this.moveProgress = 1
      this.state = PlayerState.MOVING
    }
  }

  update(dt: number, headYaw: number, headPitch: number): void {
    switch (this.state) {
      case PlayerState.MOVING:
        this.updateMoving(dt)
        break
      case PlayerState.TURNING:
      case PlayerState.DEAD_END_TURN:
        this.updateTurning(dt)
        break
      case PlayerState.INTERSECTION:
        this.updateIntersection(dt, headYaw, headPitch)
        break
      case PlayerState.TELEPORTING:
        this.updateTeleporting(dt)
        break
    }

    if (this.wallPassSpeed > 0 && this.moveProgress < 1) {
      this.moveProgress = Math.min(this.moveProgress + dt * this.wallPassSpeed, 1)
      const t = this.moveProgress
      this.worldX = this.fromX + (this.toX - this.fromX) * t
      this.worldZ = this.fromZ + (this.toZ - this.fromZ) * t
      if (this.moveProgress >= 1) {
        this.worldX = this.toX
        this.worldZ = this.toZ
        this.moveProgress = 1
        this.wallPassSpeed = 0
        this.onStep?.()
        this.state = PlayerState.MOVING
      }
      return
    }

    if (this.state !== PlayerState.INTERSECTION && this.state !== PlayerState.WIN && this.state !== PlayerState.SURPRISE && this.state !== PlayerState.TELEPORTING) {
      if (this.moveProgress < 1) {
        this.moveProgress = Math.min(this.moveProgress + dt * MOVE_SPEED, 1)
        const t = this.moveProgress
        this.worldX = this.fromX + (this.toX - this.fromX) * t
        this.worldZ = this.fromZ + (this.toZ - this.fromZ) * t
        if (this.moveProgress >= 1) {
          this.finishStep()
        }
      }
    }
  }

  private updateMoving(_dt: number): void {
    if (this.moveProgress < 1) return
    const suppressSurprise = this.skipNextSurprise
    this.skipNextSurprise = false

    const dir = this.direction
    const fwd: Dir = dir
    const back: Dir = { dx: -dir.dx, dz: -dir.dz }
    const left: Dir = { dx: dir.dz, dz: -dir.dx }
    const right: Dir = { dx: -dir.dz, dz: dir.dx }

    const openForward = this.canMoveTo(this.col + fwd.dx, this.row + fwd.dz)
    const openLeft  = this.canMoveTo(this.col + left.dx, this.row + left.dz)
    const openRight = this.canMoveTo(this.col + right.dx, this.row + right.dz)
    const openBack  = this.canMoveTo(this.col + back.dx, this.row + back.dz)

    const openCount = (openForward ? 1 : 0) + (openLeft ? 1 : 0) +
                      (openRight ? 1 : 0) + (openBack ? 1 : 0)
    const wallCount = 4 - openCount

    if (wallCount <= 1) {
      this.state = PlayerState.INTERSECTION
      this.stateTimer = 0
      this.availableDirs = []
      if (openForward) this.availableDirs.push(fwd)
      if (openLeft) this.availableDirs.push(left)
      if (openRight) this.availableDirs.push(right)
      if (openBack) this.availableDirs.push(back)

      // Initialize selectedDirIndex to forward direction if available, otherwise 0
      const fwdIdx = this.availableDirs.findIndex(d => d.dx === fwd.dx && d.dz === fwd.dz)
      this.selectedDirIndex = fwdIdx >= 0 ? fwdIdx : 0
      this.headLookAngle = 0
    } else if (wallCount === 2) {
      if (openForward) {
        this.beginStep(this.col + fwd.dx, this.row + fwd.dz)
      } else if (openLeft) {
        const targetIdx = DIRS.findIndex(d => d.dx === left.dx && d.dz === left.dz)
        this.state = PlayerState.TURNING
        this.onTurn?.()
        this.stateTimer = 0
        this.startRotation = this.rotation
        this.targetRotation = this.rotation - Math.PI / 2
        this.dirIndex = targetIdx >= 0 ? targetIdx : this.dirIndex
      } else if (openRight) {
        const targetIdx = DIRS.findIndex(d => d.dx === right.dx && d.dz === right.dz)
        this.state = PlayerState.TURNING
        this.onTurn?.()
        this.stateTimer = 0
        this.startRotation = this.rotation
        this.targetRotation = this.rotation + Math.PI / 2
        this.dirIndex = targetIdx >= 0 ? targetIdx : this.dirIndex
      } else {
        this.state = PlayerState.DEAD_END_TURN
        this.onDeadEnd?.()
        this.stateTimer = 0
        this.startRotation = this.rotation
        this.targetRotation = this.rotation + Math.PI
        this.dirIndex = (this.dirIndex + 2) % 4
      }
    } else {
      if (openForward) {
        this.beginStep(this.col + fwd.dx, this.row + fwd.dz)
        return
      } else if (suppressSurprise) {
        // Just arrived through a wall pass → no surprise, turn around
      } else if (this.onDeadEndEntry) {
        const forwardDir = this.direction
        const nc = this.col + forwardDir.dx
        const nr = this.row + forwardDir.dz
        const isBoundary = nc < 0 || nc >= this.w || nr < 0 || nr >= this.h
        if (this.onDeadEndEntry({ col: this.col, row: this.row, forwardDir, isBoundary })) {
          if (this.state === PlayerState.MOVING) {
            this.state = PlayerState.SURPRISE
          }
          return
        }
        // callback returned false → no surprise, fall through to DEAD_END_TURN
      }
      this.state = PlayerState.DEAD_END_TURN
      this.onDeadEnd?.()
      this.stateTimer = 0
      this.startRotation = this.rotation
      this.targetRotation = this.rotation + Math.PI
      this.dirIndex = (this.dirIndex + 2) % 4
    }
  }

  private updateIntersection(dt: number, headYaw: number, headPitch: number): void {
    this.stateTimer += dt
    this.headLookAngle = headYaw

    let bestDir: Dir

    if (this.cycleDirection !== 0) {
      const len = this.availableDirs.length
      if (len > 0) {
        this.selectedDirIndex = (this.selectedDirIndex + this.cycleDirection + len) % len
        bestDir = this.availableDirs[this.selectedDirIndex]
      } else {
        bestDir = this.availableDirs[0]
      }
      this.cycleDirection = 0
    } else {
      const headAngle = this.rotation + headYaw * Math.PI * 0.4
      const lookX = Math.sin(headAngle)
      const lookZ = -Math.cos(headAngle)

      bestDir = this.availableDirs[0]
      let bestDot = -Infinity
      for (const d of this.availableDirs) {
        const dot = d.dx * lookX + d.dz * lookZ
        if (dot > bestDot) {
          bestDot = dot
          bestDir = d
        }
      }

      const targetIdx = this.availableDirs.findIndex(d => d.dx === bestDir.dx && d.dz === bestDir.dz)
      if (targetIdx >= 0) this.selectedDirIndex = targetIdx
    }

    const pitchVel = (headPitch - this.lastPitch) / Math.max(dt, 0.001)
    this.lastPitch = headPitch

    const shouldConfirm = this.confirmRequested ||
      (pitchVel > PITCH_VELOCITY_THRESHOLD && this.stateTimer > 0.25)
    this.confirmRequested = false

    if (shouldConfirm && this.stateTimer > 0.3) {
      this.onConfirm?.()
      const currentDir = this.direction
      if (bestDir.dx !== currentDir.dx || bestDir.dz !== currentDir.dz) {
        this.justConfirmed = true
        this.state = PlayerState.TURNING
        this.onTurn?.()
        this.stateTimer = 0
        this.startRotation = this.rotation + headYaw * Math.PI * 0.4
        const currentIdx = this.dirIndex
        const chosenIdx = DIRS.findIndex(d => d.dx === bestDir.dx && d.dz === bestDir.dz)
        let diff = chosenIdx - currentIdx
        if (diff > 2) diff -= 4
        if (diff < -2) diff += 4
        this.targetRotation = this.rotation + diff * Math.PI / 2
        this.dirIndex = chosenIdx >= 0 ? chosenIdx : this.dirIndex
      } else {
        this.beginStep(this.col + bestDir.dx, this.row + bestDir.dz)
        this.state = PlayerState.MOVING
        this.stateTimer = 0
      }
    }
  }

  private updateTurning(dt: number): void {
    const duration = this.state === PlayerState.DEAD_END_TURN ? DEAD_END_DURATION : TURN_DURATION
    this.stateTimer += dt
    const t = Math.min(this.stateTimer / duration, 1)
    const smooth = t * t * (3 - 2 * t)
    this.rotation = this.startRotation + (this.targetRotation - this.startRotation) * smooth
    if (t >= 1) {
      this.rotation = this.targetRotation
      this.stateTimer = 0
      if (this.justConfirmed) {
        this.justConfirmed = false
        this.beginStep(this.col + this.direction.dx, this.row + this.direction.dz)
        this.state = PlayerState.MOVING
      } else {
        this.state = PlayerState.MOVING
      }
    }
  }
}

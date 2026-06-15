import * as THREE from 'three'
import type { MazeData } from './MazeGenerator'

const CELL = 2
const WALL_H = 3
const HALF = CELL / 2
const WALL_THICK = 0.15
const LAMP_DIST = 5.5
const LAMP_RANGE = 3

export class MazeRenderer {
  readonly group = new THREE.Group()
  private wallMat: THREE.MeshStandardMaterial[] = []
  private floorMat!: THREE.MeshStandardMaterial
  private startMarker!: THREE.Mesh
  private endMarker!: THREE.Mesh
  private exitGlow!: THREE.PointLight
  private lampPhase = 0
  private lampSpeed = 3
  private lampSlots: {
    col: number
    row: number
    x: number
    y: number
    z: number
    light: THREE.PointLight | null
  }[] = []

  constructor(private readonly scene: THREE.Scene, private readonly maze: MazeData) {}

  async init(): Promise<void> {
    const loader = new THREE.TextureLoader()

    const [brickA, brickB, brickC, brickD, concrete] = await Promise.all([
      loader.loadAsync('/textures/brick_156.jpg'),
      loader.loadAsync('/textures/brick_159.jpg'),
      loader.loadAsync('/textures/brick_171.jpg'),
      loader.loadAsync('/textures/brick_172.jpg'),
      loader.loadAsync('/textures/concrete.jpg'),
    ]);

    [brickA, brickB, brickC, brickD].forEach(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1, 1.5)
      t.anisotropy = 4
    })

    this.wallMat = [brickA, brickB, brickC, brickD].map(t => new THREE.MeshStandardMaterial({
      map: t,
      roughness: 0.85,
      metalness: 0.05,
    }))

    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping
    concrete.repeat.set(5, 15)
    concrete.anisotropy = 4

    this.floorMat = new THREE.MeshStandardMaterial({
      map: concrete,
      roughness: 0.95,
    })

    this.buildGeometry()
    this.buildLamps()
    this.buildLighting()
  }

  private buildGeometry(): void {
    const { width, height, vWalls, hWalls } = this.maze

    const wallGeoV = new THREE.BoxGeometry(WALL_THICK, WALL_H, CELL)
    const wallGeoH = new THREE.BoxGeometry(CELL, WALL_H, WALL_THICK)
    const floorGeo = new THREE.BoxGeometry(CELL, 0.15, CELL)

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * CELL + HALF - width * HALF
        const z = row * CELL + HALF

        const floor = new THREE.Mesh(floorGeo.clone(), this.floorMat)
        floor.position.set(x, 0, z)
        floor.receiveShadow = true
        this.group.add(floor)
      }
    }

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width - 1; col++) {
        if (vWalls[row * (width - 1) + col] === 0) continue
        const x = (col + 1) * CELL - width * HALF
        const z = row * CELL + HALF
        const mat = this.wallMat[Math.floor(Math.random() * this.wallMat.length)]
        const wall = new THREE.Mesh(wallGeoV.clone(), mat)
        wall.position.set(x, WALL_H / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.group.add(wall)
      }
    }

    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width; col++) {
        if (hWalls[row * width + col] === 0) continue
        const x = col * CELL + HALF - width * HALF
        const z = (row + 1) * CELL
        const mat = this.wallMat[Math.floor(Math.random() * this.wallMat.length)]
        const wall = new THREE.Mesh(wallGeoH.clone(), mat)
        wall.position.set(x, WALL_H / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.group.add(wall)
      }
    }

    this.buildStartMarker()
    this.buildEndMarker()
    this.buildPerimeterWalls()
  }

  private buildLamps(): void {
    const { width, height, vWalls, hWalls } = this.maze

    const bulbGeo = new THREE.SphereGeometry(0.1, 8, 8)
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffddaa })

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        let openCount = 0
        if (col > 0 && vWalls[row * (width - 1) + (col - 1)] === 0) openCount++
        if (col < width - 1 && vWalls[row * (width - 1) + col] === 0) openCount++
        if (row > 0 && hWalls[(row - 1) * width + col] === 0) openCount++
        if (row < height - 1 && hWalls[row * width + col] === 0) openCount++
        if (openCount < 3) continue

        const x = col * CELL + HALF - width * HALF
        const z = row * CELL + HALF
        const y = WALL_H - 0.15

        const bulb = new THREE.Mesh(bulbGeo, bulbMat)
        bulb.position.set(x, y, z)
        this.group.add(bulb)

        this.lampSlots.push({ col, row, x, y, z, light: null })
      }
    }
  }

  private buildLighting(): void {
    const hemi = new THREE.HemisphereLight(0x446688, 0x222244, 1.2)
    this.group.add(hemi)
  }

  private buildPerimeterWalls(): void {
    const { width, height } = this.maze
    const w = width * CELL
    const h = height * CELL
    const geoTop = new THREE.BoxGeometry(w + CELL * 2, WALL_H, CELL)
    const geoLeft = new THREE.BoxGeometry(CELL, WALL_H, h + CELL * 2)

    const mat = this.wallMat[0]

    const top = new THREE.Mesh(geoTop, mat)
    top.position.set(0, WALL_H / 2, -CELL / 2)
    top.castShadow = true
    this.group.add(top)

    const bottom = top.clone()
    bottom.position.set(0, WALL_H / 2, h + CELL / 2)
    this.group.add(bottom)

    const left = new THREE.Mesh(geoLeft, mat)
    left.position.set(-w / 2 - CELL / 2, WALL_H / 2, h / 2)
    left.castShadow = true
    this.group.add(left)

    const right = left.clone()
    right.position.set(w / 2 + CELL / 2, WALL_H / 2, h / 2)
    this.group.add(right)
  }

  private buildStartMarker(): void {
    const { startCol, startRow, width } = this.maze
    const x = startCol * CELL + HALF - width * HALF
    const z = startRow * CELL + HALF

    const geo = new THREE.BoxGeometry(CELL * 0.4, 0.02, CELL * 0.4)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x224422,
      transparent: true,
      opacity: 0.3,
    })
    this.startMarker = new THREE.Mesh(geo, mat)
    this.startMarker.position.set(x, 0.01, z)
    this.group.add(this.startMarker)
  }

  private buildEndMarker(): void {
    const { endCol, endRow, width } = this.maze
    const x = endCol * CELL + HALF - width * HALF
    const z = endRow * CELL + HALF

    const geo = new THREE.BoxGeometry(CELL * 0.6, 0.1, CELL * 0.6)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.7,
    })
    this.endMarker = new THREE.Mesh(geo, mat)
    this.endMarker.position.set(x, 0.05, z)
    this.endMarker.userData.phase = 0
    this.group.add(this.endMarker)

    this.exitGlow = new THREE.PointLight(0xff4400, 1.5, 12, 2)
    this.exitGlow.position.set(x, 1.5, z)
    this.group.add(this.exitGlow)
  }

  updatePlayerPosition(playerCol: number, playerRow: number): void {
    for (const slot of this.lampSlots) {
      const dist = Math.max(Math.abs(slot.col - playerCol), Math.abs(slot.row - playerRow))
      const shouldBeOn = dist <= LAMP_RANGE

      if (shouldBeOn && !slot.light) {
        const light = new THREE.PointLight(0xffddaa, 2, LAMP_DIST, 2)
        light.position.set(slot.x, slot.y, slot.z)
        this.group.add(light)
        slot.light = light
      } else if (!shouldBeOn && slot.light) {
        this.group.remove(slot.light)
        slot.light.dispose?.()
        slot.light = null
      }
    }
  }

  updateLamps(dt: number): void {
    this.lampPhase += dt * this.lampSpeed
    const flicker = 0.85 + Math.sin(this.lampPhase) * 0.15
    const intensity = 1.2 * flicker
    for (const slot of this.lampSlots) {
      if (slot.light) slot.light.intensity = intensity
    }
  }

  updateExit(dt: number): void {
    const phase = (this.endMarker.userData.phase as number) + dt * 3
    this.endMarker.userData.phase = phase
    const pulse = 0.5 + Math.sin(phase) * 0.4
    const mat = this.endMarker.material as THREE.MeshBasicMaterial
    mat.opacity = pulse
    this.exitGlow.intensity = 0.3 + Math.sin(phase) * 0.25
  }

  gridToWorld(col: number, row: number): { x: number; z: number } {
    const x = col * CELL + HALF - this.maze.width * HALF
    const z = row * CELL + HALF
    return { x, z }
  }

  get cellSize(): number { return CELL }
  get wallHeight(): number { return WALL_H }

  dispose(): void {
    for (const slot of this.lampSlots) {
      if (slot.light) {
        this.group.remove(slot.light)
        slot.light = null
      }
    }
    this.scene.remove(this.group)
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}

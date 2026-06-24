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
  private hemiLight!: THREE.HemisphereLight
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
  private wallMeshes = new Map<string, THREE.Mesh>()
  private fadingWall: {
    mesh: THREE.Mesh
    origTransparent: boolean
    origOpacity: number
    stage: 'out' | 'in'
    progress: number
  } | null = null
  private readonly FADE_DURATION = 0.5
  private effectMeshes: THREE.Mesh[] = []
  private effectLights: THREE.PointLight[] = []
  private winActive = false
  private winParticles: THREE.Mesh[] = []


  constructor(private readonly scene: THREE.Scene, private readonly maze: MazeData) { }

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
    this.buildFakeWalls()
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

        const floor = new THREE.Mesh(floorGeo, this.floorMat)
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
        const wall = new THREE.Mesh(wallGeoV, mat)
        wall.position.set(x, WALL_H / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.group.add(wall)
        this.wallMeshes.set(`v:${row}:${col}`, wall)
      }
    }

    for (let row = 0; row < height - 1; row++) {
      for (let col = 0; col < width; col++) {
        if (hWalls[row * width + col] === 0) continue
        const x = col * CELL + HALF - width * HALF
        const z = (row + 1) * CELL
        const mat = this.wallMat[Math.floor(Math.random() * this.wallMat.length)]
        const wall = new THREE.Mesh(wallGeoH, mat)
        wall.position.set(x, WALL_H / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.group.add(wall)
        this.wallMeshes.set(`h:${row}:${col}`, wall)
      }
    }

    this.buildStartMarker()
    this.buildEndMarker()
    this.buildPerimeterWalls()
  }

  private buildFakeWalls(): void {
    const { width, fakeWalls } = this.maze
    const wallGeoV = new THREE.BoxGeometry(WALL_THICK, WALL_H, CELL)
    const wallGeoH = new THREE.BoxGeometry(CELL, WALL_H, WALL_THICK)

    for (const fw of fakeWalls) {
      const { col, row, dir } = fw
      const mat = this.wallMat[Math.floor(Math.random() * this.wallMat.length)]
      const key = `${dir}:${row}:${col}`

      if (dir === 'v') {
        const x = (col + 1) * CELL - width * HALF
        const z = row * CELL + HALF
        const wall = new THREE.Mesh(wallGeoV, mat)
        wall.position.set(x, WALL_H / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.group.add(wall)
        this.wallMeshes.set(key, wall)
      } else {
        const x = col * CELL + HALF - width * HALF
        const z = (row + 1) * CELL
        const wall = new THREE.Mesh(wallGeoH, mat)
        wall.position.set(x, WALL_H / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.group.add(wall)
        this.wallMeshes.set(key, wall)
      }
    }
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
    this.hemiLight = new THREE.HemisphereLight(0x446688, 0x222244, 1.2)
    this.group.add(this.hemiLight)
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

  startWallFadeOut(col: number, row: number, dir: { dx: number; dz: number }): void {
    let key: string | null = null
    if (dir.dx === 1) {
      key = `v:${row}:${col}`
    } else if (dir.dx === -1) {
      key = `v:${row}:${col - 1}`
    } else if (dir.dz === 1) {
      key = `h:${row}:${col}`
    } else if (dir.dz === -1) {
      key = `h:${row - 1}:${col}`
    }
    if (!key) return
    const mesh = this.wallMeshes.get(key)
    if (!mesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    this.fadingWall = {
      mesh,
      origTransparent: mat.transparent,
      origOpacity: mat.opacity,
      stage: 'out',
      progress: 0,
    }
    mat.transparent = true
  }

  startWallFadeIn(): void {
    if (this.fadingWall) {
      this.fadingWall.stage = 'in'
      this.fadingWall.progress = 0
    }
  }

  updateWallFade(dt: number): boolean {
    if (!this.fadingWall) return true
    const w = this.fadingWall
    w.progress += dt
    const t = Math.min(w.progress / this.FADE_DURATION, 1)
    const mat = w.mesh.material as THREE.MeshStandardMaterial
    mat.opacity = w.stage === 'out' ? 1 - t : t
    return t >= 1
  }

  resetWallFade(): void {
    if (this.fadingWall) {
      const mat = this.fadingWall.mesh.material as THREE.MeshStandardMaterial
      mat.transparent = this.fadingWall.origTransparent
      mat.opacity = this.fadingWall.origOpacity
      this.fadingWall = null
    }
  }

  showGunPickup(col: number, row: number): void {
    const pos = this.gridToWorld(col, row)
    const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(pos.x, 0.15, pos.z)
    mesh.rotation.x = Math.PI / 2
    this.group.add(mesh)
    this.effectMeshes.push(mesh)

    const light = new THREE.PointLight(0xffd700, 2, 4, 2)
    light.position.set(pos.x, 0.5, pos.z)
    this.group.add(light)
    this.effectLights.push(light)
  }

  showMonster(col: number, row: number, dir: { dx: number; dz: number }, imageIndex: number): void {
    const pos = this.gridToWorld(col, row)
    const faceX = pos.x + dir.dx * HALF
    const faceZ = pos.z + dir.dz * HALF

    let rotationY = 0
    if (dir.dx === 1) {
      rotationY = -Math.PI / 2
    } else if (dir.dx === -1) {
      rotationY = Math.PI / 2
    } else if (dir.dz === 1) {
      rotationY = Math.PI
    } else {
      rotationY = 0
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const s = 0.5
      const cw = Math.round(img.naturalWidth * s)
      const ch = Math.round(img.naturalHeight * s)
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')!
      ctx.filter = 'contrast(2) brightness(0.5)'
      ctx.drawImage(img, 0, 0, cw, ch)
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      mat.map = texture
      mat.needsUpdate = true
    }
    img.src = `/images/monster${imageIndex}.webp`

    const plane = new THREE.PlaneGeometry(CELL * 0.5, WALL_H * 0.5)
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true })
    const mesh = new THREE.Mesh(plane, mat)
    const pullback = WALL_THICK / 2 + 0.02
    mesh.position.set(faceX - dir.dx * pullback, WALL_H / 2 * 0.75, faceZ - dir.dz * pullback)
    mesh.rotation.y = rotationY
    this.group.add(mesh)
    this.effectMeshes.push(mesh)
  }

  showDeathEffect(col: number, row: number): void {
    const pos = this.gridToWorld(col, row)
    const light = new THREE.PointLight(0xff0000, 4, 6, 2)
    light.position.set(pos.x, 1, pos.z)
    this.group.add(light)
    this.effectLights.push(light)
    setTimeout(() => {
      this.group.remove(light)
      this.effectLights = this.effectLights.filter(l => l !== light)
      light.dispose()
    }, 800)
  }

  teleportEffect(col: number, row: number): void {
    const pos = this.gridToWorld(col, row)
    const light = new THREE.PointLight(0x00aaff, 3, 5, 2)
    light.position.set(pos.x, 1, pos.z)
    this.group.add(light)
    this.effectLights.push(light)
    setTimeout(() => {
      this.group.remove(light)
      this.effectLights = this.effectLights.filter(l => l !== light)
      light.dispose()
    }, 600)
  }

  clearEffects(): void {
    this.winActive = false
    this.winParticles = []
    for (const mesh of this.effectMeshes) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose())
      } else {
        mesh.material.dispose()
      }
    }
    this.effectMeshes = []
    for (const light of this.effectLights) {
      this.group.remove(light)
      light.dispose()
    }
    this.effectLights = []
  }

  getExitWorldPosition(): { x: number; z: number } {
    return this.gridToWorld(this.maze.endCol, this.maze.endRow)
  }

  triggerWinEffect(): void {
    this.winActive = true
    const pos = this.getExitWorldPosition()

    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.15, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffd700,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        }),
      )
      const angle = (i / 8) * Math.PI * 2
      ring.position.set(pos.x + Math.cos(angle) * 0.3, 0.1, pos.z + Math.sin(angle) * 0.3)
      ring.rotation.x = -Math.PI / 2
      ring.userData.phase = 0
      this.group.add(ring)
      this.winParticles.push(ring)
      this.effectMeshes.push(ring)
    }

    const goldLight = new THREE.PointLight(0xffdd44, 0, 20, 2)
    goldLight.position.set(pos.x, 2, pos.z)
    this.group.add(goldLight)
    this.effectLights.push(goldLight)
  }

  updateWinEffect(dt: number): void {
    if (!this.winActive) return
    const elapsed = performance.now() * 0.001
    const pos = this.getExitWorldPosition()

    const mat = this.endMarker.material as THREE.MeshBasicMaterial
    mat.color.setHSL(0.1, 1, 0.6)
    mat.opacity = 0.9
    const scale = 1 + Math.sin(elapsed * 3) * 0.2
    this.endMarker.scale.set(scale, 1, scale)

    this.exitGlow.color.setHSL(0.12, 1, 0.5)
    this.exitGlow.intensity = 3 + Math.sin(elapsed * 5) * 2

    for (let i = 0; i < this.winParticles.length; i++) {
      const ring = this.winParticles[i]
      const phase = ring.userData.phase as number + dt * 0.4
      ring.userData.phase = phase
      const angle = (i / this.winParticles.length) * Math.PI * 2 + Math.sin(phase) * 0.5
      const radius = 0.3 + phase * 0.15
      ring.position.x = pos.x + Math.cos(angle) * radius
      ring.position.z = pos.z + Math.sin(angle) * radius
      const ringMat = ring.material as THREE.MeshBasicMaterial
      ringMat.opacity = Math.min(0.6, phase * 0.15)
      ring.scale.setScalar(1 + phase * 0.1)
    }

    const light = this.effectLights[this.effectLights.length - 1]
    if (light) {
      light.intensity = 4 + Math.sin(elapsed * 4) * 2
    }
  }

  gridToWorld(col: number, row: number): { x: number; z: number } {
    const x = col * CELL + HALF - this.maze.width * HALF
    const z = row * CELL + HALF
    return { x, z }
  }

  get cellSize(): number { return CELL }
  get wallHeight(): number { return WALL_H }

  removeWall(key: string): void {
    const mesh = this.wallMeshes.get(key)
    if (!mesh) return
    this.group.remove(mesh)
    mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose())
    } else {
      mesh.material.dispose()
    }
    this.wallMeshes.delete(key)
    if (this.fadingWall && this.fadingWall.mesh === mesh) {
      this.fadingWall = null
    }
  }

  dispose(): void {
    this.resetWallFade()
    this.clearEffects()
    for (const slot of this.lampSlots) {
      if (slot.light) {
        this.group.remove(slot.light)
        slot.light = null
      }
    }
    this.wallMeshes.clear()
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

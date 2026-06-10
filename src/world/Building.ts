import * as THREE from 'three'

const CONCRETE = [0x7a7a7a, 0x8a8a8a, 0x6a6a6a, 0x9a9994, 0x727272]
const BURNT = [0x3a2a1a, 0x4a3322, 0x553322, 0x443322, 0x332211, 0x2a1a0a]
const RUBBLE = [0x6a5a4a, 0x7a6a5a, 0x5a4a3a, 0x8a7a6a, 0x4a3a2a]

export class Building {
  readonly mesh: THREE.Group
  readonly depth: number

  constructor(side: 'left' | 'right', _index: number) {
    const w = 4 + Math.random() * 5
    const d = 5 + Math.random() * 4
    const h = 4 + Math.random() * 20
    this.depth = d

    const group = new THREE.Group()
    const damage = Math.random()

    const isBurnt = damage > 0.55
    const color = isBurnt
      ? BURNT[Math.floor(Math.random() * BURNT.length)]
      : CONCRETE[Math.floor(Math.random() * CONCRETE.length)]
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 })

    if (damage > 0.7) {
      this.buildRuined(group, w, d, h, bodyMat, color)
    } else if (damage > 0.35) {
      this.buildDamaged(group, w, d, h, bodyMat, color)
    } else {
      this.buildIntact(group, w, d, h, bodyMat, color)
    }

    this.addRubble(group, w, d, damage > 0.7 ? h * 0.3 : h)

    const xPos = side === 'left'
      ? -9 - w / 2 - Math.random() * 2
      : 9 + w / 2 + Math.random() * 2

    group.position.set(xPos, 0, 0)
    this.mesh = group
  }

  private buildIntact(g: THREE.Group, w: number, d: number, h: number, mat: THREE.MeshStandardMaterial, _color: number): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    body.position.y = h / 2
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)
    this.addWindows(g, w, h, d, 0.4)
  }

  private buildDamaged(g: THREE.Group, w: number, d: number, h: number, mat: THREE.MeshStandardMaterial, _color: number): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    body.position.y = h / 2
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)

    if (Math.random() > 0.4) {
      const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 })
      const hole = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.25, h * (0.1 + Math.random() * 0.15), d * 0.3),
        holeMat
      )
      hole.position.set(
        (Math.random() - 0.5) * w * 0.6,
        h * (0.3 + Math.random() * 0.5),
        (Math.random() - 0.5) * d * 0.5
      )
      g.add(hole)
    }

    this.addWindows(g, w, h, d, 0.7)
    g.rotation.z = (Math.random() - 0.5) * 0.08
  }

  private buildRuined(g: THREE.Group, w: number, d: number, h: number, mat: THREE.MeshStandardMaterial, color: number): void {
    const remainH = h * (0.15 + Math.random() * 0.25)

    const body = new THREE.Mesh(new THREE.BoxGeometry(w * (0.7 + Math.random() * 0.3), remainH, d * (0.5 + Math.random() * 0.5)), mat)
    body.position.y = remainH / 2
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)

    const spikeCount = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < spikeCount; i++) {
      const sMat = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? color : RUBBLE[Math.floor(Math.random() * RUBBLE.length)],
        roughness: 0.95
      })
      const spike = new THREE.Mesh(
        new THREE.BoxGeometry(w * (0.1 + Math.random() * 0.2), 0.3 + Math.random() * 1.5, d * (0.1 + Math.random() * 0.2)),
        sMat
      )
      spike.position.set(
        (Math.random() - 0.5) * w * 0.6,
        remainH + 0.15 + Math.random() * 0.5,
        (Math.random() - 0.5) * d * 0.5
      )
      spike.rotation.z = (Math.random() - 0.5) * 0.4
      spike.rotation.x = (Math.random() - 0.5) * 0.3
      g.add(spike)
    }

    g.rotation.z = (Math.random() - 0.5) * 0.2
    g.rotation.x = (Math.random() - 0.5) * 0.12
  }

  private addWindows(g: THREE.Group, bW: number, bH: number, bD: number, brokenChance: number): void {
    const rowsY = Math.max(1, Math.floor(bH / 3))
    const colsX = Math.max(1, Math.floor(bW / 2))

    for (let r = 0; r < rowsY; r++) {
      const yOff = 1.5 + r * 3

      for (let c = 0; c < colsX; c++) {
        if (Math.random() > 0.7) continue
        const xOff = -bW / 2 + 1.1 + c * ((bW - 2.2) / Math.max(1, colsX - 1))

        const isDark = Math.random() < brokenChance
        const wMat = new THREE.MeshStandardMaterial({
          color: isDark ? 0x111111 : 0x223344,
          roughness: 0.9,
          metalness: isDark ? 0 : 0.3,
        })

        const geo = new THREE.PlaneGeometry(0.7, 1.0)
        const front = new THREE.Mesh(geo, wMat)
        front.position.set(xOff, yOff - bH / 2, bD / 2 + 0.01)
        g.add(front)

        if (Math.random() > (isDark ? 0.6 : 0.2)) {
          const back = new THREE.Mesh(geo.clone(), wMat)
          back.position.set(xOff, yOff - bH / 2, -bD / 2 - 0.01)
          back.rotation.y = Math.PI
          g.add(back)
        }
      }
    }
  }

  private addRubble(g: THREE.Group, w: number, d: number, _baseH: number): void {
    const count = 3 + Math.floor(Math.random() * 6)
    for (let i = 0; i < count; i++) {
      const rMat = new THREE.MeshStandardMaterial({
        color: RUBBLE[Math.floor(Math.random() * RUBBLE.length)],
        roughness: 0.95
      })
      const size = 0.1 + Math.random() * 0.4
      const rubble = new THREE.Mesh(new THREE.BoxGeometry(size, size * (0.3 + Math.random() * 0.7), size), rMat)
      rubble.position.set(
        (Math.random() - 0.5) * w * 0.9,
        size * 0.3 + Math.random() * 0.1,
        (Math.random() - 0.5) * d * 0.8 + (Math.random() > 0.5 ? d * 0.5 : -d * 0.5)
      )
      rubble.rotation.set(
        (Math.random() - 0.5) * 0.5,
        0,
        (Math.random() - 0.5) * 0.5
      )
      g.add(rubble)
    }
  }
}

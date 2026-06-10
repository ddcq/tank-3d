import * as THREE from 'three'
import { Entity } from './Entity'
import { Bullet } from './Bullet'

const SOLDIER_HAIR = 0xb8860b
const SOLDIER_SKIN = 0xc49a6c
const RUSSIAN_WHITE = 0xffffff
const RUSSIAN_BLUE = 0x0039a6
const RUSSIAN_RED = 0xd52b1e

export class EnemySoldier extends Entity {
  isEnemy: boolean = true
  row: number
  col: number
  shootCooldown = 3 + Math.random() * 4
  shootInterval = 6 + Math.random() * 8
  moveDir = 1 as number
  bobOffset = Math.random() * Math.PI * 2

  private DEATH_DURATION = 0.8
  private _isDying = false
  private deathTimer = 0

  constructor(x: number, z: number, row: number, col: number) {
    const group = new THREE.Group()
    super(group)
    this.position.x = x
    this.position.z = z
    // Position soldiers so that their feet are at y=0 (on road surface)
    this.position.y = -0.33
    this.row = row
    this.col = col

    // Add a debug line to visualize soldier position (red vertical line)
    const debugLineGeo = new THREE.BufferGeometry()
    const debugLineMat = new THREE.LineBasicMaterial({ color: 0xff0000 })
    const debugLinePoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2, 0)
    ]
    debugLineGeo.setFromPoints(debugLinePoints)
    const debugLine = new THREE.Line(debugLineGeo, debugLineMat)
    group.add(debugLine)

    // Legs
    for (const side of [-0.18, 0.18]) {
      const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22)
      const legMat = new THREE.MeshStandardMaterial({ color: 0x4a5d23 })
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(side, 0.33, 0)
      group.add(leg)
    }

    // Body (military uniform - Russian green)
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.7, 0.35)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x546a4b })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 1
    body.castShadow = true
    group.add(body)

    // Russian flag stripe on shoulder (white-blue-red)
    for (let i = 0; i < 3; i++) {
      const colors = [RUSSIAN_WHITE, RUSSIAN_BLUE, RUSSIAN_RED] as const
      const cGeo = new THREE.BoxGeometry(0.57, 0.04, 0.37)
      const cMat = new THREE.MeshStandardMaterial({ color: colors[i] })
      const stripe = new THREE.Mesh(cGeo, cMat)
      stripe.position.y = 1.28 - i * 0.06
      group.add(stripe)
    }

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.38, 0.35)
    const headMat = new THREE.MeshStandardMaterial({ color: SOLDIER_SKIN })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.52
    group.add(head)

    // Helmet (winter hat / ushanka style)
    for (const side of [-0.22, 0.22]) {
      const flapGeo = new THREE.BoxGeometry(0.18, 0.22, 0.36)
      const flapMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0 })
      const flap = new THREE.Mesh(flapGeo, flapMat)
      flap.position.set(side, 1.58, 0)
      group.add(flap)
    }
    const hatTopGeo = new THREE.BoxGeometry(0.42, 0.12, 0.42)
    const hatTopMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0 })
    const hatTop = new THREE.Mesh(hatTopGeo, hatTopMat)
    hatTop.position.y = 1.79
    group.add(hatTop)

    // Gun (AK-style rifle held forward)
    for (const side of [-0.32, 0.32]) {
      const gunBarrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.6)
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
      const gunBarrel = new THREE.Mesh(gunBarrelGeo, gunMat)
      gunBarrel.position.set(side, 1, -0.45)
      group.add(gunBarrel)

      const gunStockGeo = new THREE.BoxGeometry(0.08, 0.12, 0.3)
      const gunStock = new THREE.Mesh(gunStockGeo, gunMat)
      gunStock.position.set(side, 0.9, -0.15)
      group.add(gunStock)
    }

    // Sand boots
    for (const side of [-0.18, 0.18]) {
      const bootGeo = new THREE.BoxGeometry(0.24, 0.15, 0.3)
      const bootMat = new THREE.MeshStandardMaterial({ color: SOLDIER_HAIR })
      const boot = new THREE.Mesh(bootGeo, bootMat)
      boot.position.set(side, 0.075, 0.04)
      group.add(boot)
    }

    // Rifle tip indicator for shooting
    this.rifleTip = group.children[group.children.length - 1]
  }

  private rifleTip: THREE.Object3D | undefined

  get isDying(): boolean { return this._isDying }

  hit(): void {
    this._isDying = true
    this.deathTimer = this.DEATH_DURATION
  }

  getRifleTipPosition(): THREE.Vector3 {
    const tip = new THREE.Vector3()
    if (this.rifleTip) {
      this.rifleTip.getWorldPosition(tip)
    } else {
      this.mesh.getWorldPosition(tip)
      tip.z -= 0.5
    }
    return tip
  }

  private onFireBullet?: (bullet: Bullet) => void
  
  set onFireCallback(fn: ((b: Bullet) => void) | undefined) {
    this.onFireBullet = fn
  }

  update(dt: number, time: number = 0): void {
    if (this._isDying) {
      this.deathTimer -= dt
      const t = 1 - this.deathTimer / this.DEATH_DURATION
      const scaleY = 1 - t * 0.7
      this.mesh.scale.y = scaleY
      this.mesh.position.y = -0.33 * scaleY
      if (this.deathTimer <= 0) {
        this.active = false
      }
      return
    }

    const bob = Math.sin(time * 3 + this.bobOffset) * 0.03
    this.mesh.position.y = bob

    this.shootCooldown -= dt
    if (this.shootCooldown <= 0 && this.onFireBullet) {
      this.shootCooldown = this.shootInterval
      const tipPos = this.getRifleTipPosition()
      this.onFireBullet(new Bullet(tipPos, new THREE.Vector3(0, 0, 1), false))
    }
  }

  moveX(delta: number): void {
    this.mesh.position.x += delta * this.moveDir
  }

  dropDown(steps: number = 5): void {
    this.mesh.position.z += steps * 0.4
  }
}

import * as THREE from 'three'
import { Entity } from './Entity'
import { Bullet } from './Bullet'

const SOLDIER_HAIR = 0xb8860b
const SOLDIER_SKIN = 0xc49a6c
const RUSSIAN_WHITE = 0xffffff
const RUSSIAN_BLUE = 0x0039a6
const RUSSIAN_RED = 0xd52b1e

export enum SoldierType {
  Standard = 'standard',
  Heavy = 'heavy',
  Rapid = 'rapid',
}

export class EnemySoldier extends Entity {
  isEnemy: boolean = true
  row: number
  col: number
  shootCooldown = 3 + Math.random() * 4
  shootInterval = 6 + Math.random() * 8
  moveDir = 1 as number
  bobOffset = Math.random() * Math.PI * 2

  hp: number = 1
  maxHp: number = 1
  soldierType: SoldierType = SoldierType.Standard
  speedMultiplier: number = 1
  targetX: number = 0
  isFlanker: boolean = false

  private DEATH_DURATION = 0.8
  private _isDying = false
  private deathTimer = 0

  private flashMaterials: THREE.MeshStandardMaterial[] = []
  private hitFlashTimer = 0
  private readonly HIT_FLASH_DURATION = 0.15
  private hpBarBg: THREE.Mesh | null = null
  private hpBarFg: THREE.Mesh | null = null

  constructor(x: number, z: number, row: number, col: number, maxHp: number = 1, type: SoldierType = SoldierType.Standard) {
    const group = new THREE.Group()
    super(group)
    this.position.x = x
    this.position.z = z
    this.position.y = -0.33
    this.row = row
    this.col = col
    this.soldierType = type

    switch (type) {
      case SoldierType.Heavy:
        this.speedMultiplier = 0.6
        this.hp = maxHp + 2
        this.maxHp = maxHp + 2
        break
      case SoldierType.Rapid:
        this.speedMultiplier = 1.5
        this.hp = 1
        this.maxHp = 1
        break
      default:
        this.hp = maxHp
        this.maxHp = maxHp
    }

    const debugLineGeo = new THREE.BufferGeometry()
    const debugLineMat = new THREE.LineBasicMaterial({ color: 0xff0000 })
    const debugLinePoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 2, 0)
    ]
    debugLineGeo.setFromPoints(debugLinePoints)
    const debugLine = new THREE.Line(debugLineGeo, debugLineMat)
    group.add(debugLine)

    for (const side of [-0.18, 0.18]) {
      const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22)
      const legMat = new THREE.MeshStandardMaterial({ color: 0x4a5d23 })
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(side, 0.33, 0)
      group.add(leg)
    }

    let bodyColor = 0x546a4b
    let bodyWidth = 0.55
    if (type === SoldierType.Heavy) {
      bodyColor = 0x3d2b1f
      bodyWidth = 0.7
    } else if (type === SoldierType.Rapid) {
      bodyColor = 0x8a9ba8
      bodyWidth = 0.42
    }

    const bodyGeo = new THREE.BoxGeometry(bodyWidth, 0.7, 0.35)
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 1
    body.castShadow = true
    group.add(body)
    this.flashMaterials.push(bodyMat)

    for (let i = 0; i < 3; i++) {
      const colors = [RUSSIAN_WHITE, RUSSIAN_BLUE, RUSSIAN_RED] as const
      const cGeo = new THREE.BoxGeometry(bodyWidth + 0.02, 0.04, 0.37)
      const cMat = new THREE.MeshStandardMaterial({ color: colors[i] })
      const stripe = new THREE.Mesh(cGeo, cMat)
      stripe.position.y = 1.28 - i * 0.06
      group.add(stripe)
    }

    const headGeo = new THREE.BoxGeometry(0.35, 0.38, 0.35)
    const headMat = new THREE.MeshStandardMaterial({ color: SOLDIER_SKIN })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.52
    group.add(head)
    this.flashMaterials.push(headMat)

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

    for (const side of [-0.18, 0.18]) {
      const bootGeo = new THREE.BoxGeometry(0.24, 0.15, 0.3)
      const bootMat = new THREE.MeshStandardMaterial({ color: SOLDIER_HAIR })
      const boot = new THREE.Mesh(bootGeo, bootMat)
      boot.position.set(side, 0.075, 0.04)
      group.add(boot)
    }

    this.rifleTip = group.children[group.children.length - 1]

    if (this.maxHp > 1) {
      const barBgGeo = new THREE.BoxGeometry(0.4, 0.04, 0.05)
      const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333 })
      this.hpBarBg = new THREE.Mesh(barBgGeo, barBgMat)
      this.hpBarBg.position.y = 2.05
      group.add(this.hpBarBg)

      const barFgGeo = new THREE.BoxGeometry(0.38, 0.03, 0.04)
      const barFgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      this.hpBarFg = new THREE.Mesh(barFgGeo, barFgMat)
      this.hpBarFg.position.y = 2.05
      group.add(this.hpBarFg)
    }
  }

  private rifleTip: THREE.Object3D | undefined

  get isDying(): boolean { return this._isDying }

  hit(): boolean {
    this.hp--
    if (this.hp <= 0) {
      this._isDying = true
      this.deathTimer = this.DEATH_DURATION
      return true
    }
    this.hitFlashTimer = this.HIT_FLASH_DURATION
    for (const mat of this.flashMaterials) {
      mat.emissive.setHex(0xff0000)
      mat.emissiveIntensity = 0.5
    }
    return false
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
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt
      if (this.hitFlashTimer <= 0) {
        for (const mat of this.flashMaterials) {
          mat.emissive.setHex(0x000000)
          mat.emissiveIntensity = 0
        }
      }
    }

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

    if (this.hpBarFg && this.maxHp > 1) {
      const ratio = Math.max(0, this.hp / this.maxHp)
      this.hpBarFg.scale.x = ratio
      const color = ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000
      ;(this.hpBarFg.material as THREE.MeshBasicMaterial).color.setHex(color)
    }

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

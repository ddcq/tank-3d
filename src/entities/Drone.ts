import * as THREE from 'three'
import { EnemySoldier } from './EnemySoldier'

const FIRE_INTERVAL = 1.5
const TARGET_RANGE = 35
const ORBIT_RADIUS = 1.5
const ORBIT_SPEED = 1.5

export class DroneProjectile {
  readonly mesh: THREE.Mesh
  private target: EnemySoldier
  private readonly SPEED = 15
  private readonly LIFE = 3
  private age = 0
  active = true
  hitEnemy: EnemySoldier | null = null

  constructor(pos: THREE.Vector3, target: EnemySoldier) {
    const geo = new THREE.SphereGeometry(0.12, 8, 8)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x44ddff,
      emissive: 0x0088cc,
      emissiveIntensity: 1.0,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(pos)
    this.target = target
  }

  update(dt: number): void {
    if (!this.active) return
    this.age += dt
    if (this.age > this.LIFE || !this.target.active || this.target.isDying) {
      this.active = false
      return
    }

    const toTarget = new THREE.Vector3()
      .copy(this.target.mesh.position)
      .sub(this.mesh.position)
    const dist = toTarget.length()
    if (dist < 0.5) {
      this.active = false
      this.hitEnemy = this.target
      return
    }

    const dir = toTarget.normalize()
    this.mesh.position.addScaledVector(dir, this.SPEED * dt)
  }
}

export class Drone {
  readonly group: THREE.Group
  private readonly laserLine: THREE.Line
  private target: EnemySoldier | null = null
  private fireCooldown = 0
  private orbitAngle: number

  constructor(
    private readonly getEnemies: () => readonly EnemySoldier[],
    index: number,
    scene: THREE.Scene,
  ) {
    this.orbitAngle = (index / 3) * Math.PI * 2

    this.group = new THREE.Group()

    const coreGeo = new THREE.IcosahedronGeometry(0.2, 1)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00ddcc,
      emissive: 0x00aa88,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.6,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    this.group.add(core)

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44eedd,
      transparent: true,
      opacity: 0.5,
    })
    const ringGeo = new THREE.TorusGeometry(0.3, 0.025, 8, 24)

    const ringH = new THREE.Mesh(ringGeo.clone(), ringMat)
    ringH.rotation.x = Math.PI / 2
    this.group.add(ringH)

    const ringV = new THREE.Mesh(ringGeo.clone(), ringMat)
    ringV.rotation.z = Math.PI / 2
    this.group.add(ringV)

    const laserGeo = new THREE.BufferGeometry()
    const laserPos = new Float32Array(6)
    laserGeo.setAttribute('position', new THREE.BufferAttribute(laserPos, 3))
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x44eedd,
      transparent: true,
      opacity: 0.3,
    })
    this.laserLine = new THREE.Line(laserGeo, laserMat)
    scene.add(this.laserLine)
  }

  update(dt: number, tankPos: THREE.Vector3): DroneProjectile | null {
    this.orbitAngle += dt * ORBIT_SPEED
    const phase = Date.now() * 0.002
    this.group.position.set(
      tankPos.x + Math.cos(this.orbitAngle) * ORBIT_RADIUS,
      2.5 + Math.sin(phase) * 0.3,
      tankPos.z + Math.sin(this.orbitAngle) * ORBIT_RADIUS,
    )

    this.group.rotation.y += dt * 2
    this.group.rotation.x += dt * 0.5

    this.target = null
    let nearestDistSq = TARGET_RANGE * TARGET_RANGE
    const enemies = this.getEnemies()
    for (const enemy of enemies) {
      if (!enemy.active || enemy.isDying) continue
      const dx = enemy.mesh.position.x - this.group.position.x
      const dz = enemy.mesh.position.z - this.group.position.z
      const distSq = dx * dx + dz * dz
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq
        this.target = enemy
      }
    }

    if (this.target) {
      const pos = this.laserLine.geometry.attributes.position as THREE.BufferAttribute
      const array = pos.array as Float32Array
      array[0] = this.group.position.x
      array[1] = this.group.position.y
      array[2] = this.group.position.z
      array[3] = this.target.mesh.position.x
      array[4] = this.target.mesh.position.y
      array[5] = this.target.mesh.position.z
      pos.needsUpdate = true
      this.laserLine.visible = true
    } else {
      this.laserLine.visible = false
    }

    this.fireCooldown -= dt
    if (this.target && this.fireCooldown <= 0) {
      this.fireCooldown = FIRE_INTERVAL
      return new DroneProjectile(this.group.position.clone(), this.target)
    }

    return null
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.laserLine)
    this.laserLine.geometry.dispose()
    ;(this.laserLine.material as THREE.Material).dispose()
  }
}

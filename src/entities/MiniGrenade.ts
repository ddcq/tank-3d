import * as THREE from 'three'

const FUSE_TIME = 0.4
const DAMAGE_RADIUS = 2.5
const MOVE_SPEED = 4

export class MiniGrenade {
  readonly mesh: THREE.Mesh
  private velocity: THREE.Vector3
  private age = 0
  exploded = false
  readonly damageRadius = DAMAGE_RADIUS

  constructor(pos: THREE.Vector3) {
    const angle = Math.random() * Math.PI * 2
    this.velocity = new THREE.Vector3(
      Math.cos(angle) * MOVE_SPEED,
      0.5,
      Math.sin(angle) * MOVE_SPEED,
    )

    const geo = new THREE.SphereGeometry(0.1, 8, 8)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff4400,
      emissiveIntensity: 1.0,
      roughness: 0.4,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(pos)
    this.mesh.position.y = 0.5
  }

  update(dt: number): void {
    if (this.exploded) return
    this.age += dt

    this.velocity.y -= 12 * dt
    this.mesh.position.addScaledVector(this.velocity, dt)
    if (this.mesh.position.y < 0.05) {
      this.mesh.position.y = 0.05
      this.velocity.y *= -0.4
      this.velocity.x *= 0.85
      this.velocity.z *= 0.85
    }

    const scale = 1 + Math.sin(this.age * 30) * 0.15
    this.mesh.scale.setScalar(scale)

    if (this.age >= FUSE_TIME) {
      this.exploded = true
    }
  }
}

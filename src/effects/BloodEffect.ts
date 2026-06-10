import * as THREE from 'three'

const PARTICLE_COUNT = 50
const GRAVITY = 15
const LIFETIME = 0.9

export class BloodEffect {
  private points: THREE.Points
  private velocities: THREE.Vector3[]
  private positions: Float32Array
  private geometry: THREE.BufferGeometry
  private age = 0
  private _done = false
  private origin: THREE.Vector3

  constructor(scene: THREE.Scene, origin: THREE.Vector3) {
    this.origin = origin.clone()
    this.positions = new Float32Array(PARTICLE_COUNT * 3)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const mat = new THREE.PointsMaterial({
      color: 0xcc0000,
      size: 0.18,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1,
    })
    this.points = new THREE.Points(this.geometry, mat)
    scene.add(this.points)

    this.velocities = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 7,
        Math.random() * 6 + 3,
        (Math.random() - 0.5) * 7,
      ))
      const j = i * 3
      this.positions[j] = origin.x + (Math.random() - 0.5) * 0.3
      this.positions[j + 1] = origin.y + (Math.random() - 0.5) * 0.3
      this.positions[j + 2] = origin.z + (Math.random() - 0.5) * 0.3
    }
    this.geometry.attributes.position.needsUpdate = true
  }

  get done(): boolean { return this._done }

  update(dt: number): void {
    if (this._done) return
    this.age += dt
    if (this.age >= LIFETIME) {
      this._done = true
      return
    }

    const fadeStart = LIFETIME * 0.6
    if (this.age > fadeStart) {
      const mat = this.points.material as THREE.PointsMaterial
      mat.opacity = 1 - (this.age - fadeStart) / (LIFETIME - fadeStart)
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = this.velocities[i]
      v.y -= GRAVITY * dt
      if (this.origin.y + v.y * this.age + 0.5 * -GRAVITY * this.age * this.age < 0) {
        v.set(0, 0, 0)
      }
      const j = i * 3
      this.positions[j] += v.x * dt
      this.positions[j + 1] += v.y * dt
      this.positions[j + 2] += v.z * dt
    }
    this.geometry.attributes.position.needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}

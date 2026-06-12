import * as THREE from 'three'

const DURATION = 0.6
const MAX_RADIUS = 12

export class ShockwaveRing {
  readonly mesh: THREE.Mesh
  private age = 0
  done = false

  constructor(pos: THREE.Vector3) {
    const geo = new THREE.RingGeometry(0.1, 0.4, 48)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(pos.x, 0.15, pos.z)
    this.mesh.rotation.x = -Math.PI / 2
  }

  update(dt: number): void {
    this.age += dt
    const t = this.age / DURATION
    if (t >= 1) {
      this.done = true
      return
    }
    const s = 1 + t * (MAX_RADIUS / 0.4)
    this.mesh.scale.setScalar(s)
    ;(this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

import * as THREE from 'three'

const DURATION = 0.6

export class ExplosionEffect {
  private group: THREE.Group
  private age = 0
  private _done = false
  private maxRadius: number

  constructor(scene: THREE.Scene, origin: THREE.Vector3, radius: number) {
    this.maxRadius = radius
    this.group = new THREE.Group()
    this.group.position.set(origin.x, 0.02, origin.z)

    const diskGeo = new THREE.CircleGeometry(1, 32)
    diskGeo.rotateX(-Math.PI / 2)
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
    const disk = new THREE.Mesh(diskGeo, diskMat)
    this.group.add(disk)

    const coreGeo = new THREE.CircleGeometry(0.5, 24)
    coreGeo.rotateX(-Math.PI / 2)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    this.group.add(core)

    const ringGeo = new THREE.RingGeometry(0.85, 1, 32)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    this.group.add(ring)

    this.group.scale.set(0.01, 0.01, 0.01)
    scene.add(this.group)
  }

  get done(): boolean { return this._done }

  update(dt: number): void {
    if (this._done) return
    this.age += dt
    if (this.age >= DURATION) {
      this._done = true
      return
    }
    const t = this.age / DURATION
    const s = Math.sin(t * Math.PI) * this.maxRadius
    this.group.scale.set(s, s, s)

    const diskMat = (this.group.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    diskMat.opacity = 0.7 * (1 - t)
    const coreMat = (this.group.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial
    coreMat.opacity = Math.max(0, 0.9 * (1 - t * 1.2))
    const ringMat = (this.group.children[2] as THREE.Mesh).material as THREE.MeshBasicMaterial
    ringMat.opacity = 1 - t * t
  }

  dispose(): void {
    for (const child of this.group.children) {
      const mesh = child as THREE.Mesh
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  }
}

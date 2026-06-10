import * as THREE from 'three'

export abstract class Entity {
  readonly mesh: THREE.Object3D
  active = true

  constructor(mesh?: THREE.Object3D) {
    this.mesh = mesh ?? new THREE.Group()
  }

  abstract update(dt: number): void

  get position(): THREE.Vector3 {
    return this.mesh.position
  }
}

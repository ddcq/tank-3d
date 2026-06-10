import * as THREE from 'three'
import { EntityManager } from '../entities/EntityManager'
import { Entity } from './Entity'

export class EnemyBullet extends Entity {
  isPlayerBullet = false
  bulletSpeed: number = -8
  radius: number = 0.3
  lifeTime: number = 2.5
  private age: number = 0

  constructor(x: number, z: number, em: EntityManager) {
    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8)
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xff4444,
      emissive: 0xff0000,
      emissiveIntensity: 0.5
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(x, 1, z)
    
    super(mesh)
    
    em.add(this)
  }

  update(dt: number): void {
    if (!this.active) return
    
    this.age += dt
    if (this.age > this.lifeTime) {
      this.active = false
      return
    }
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion)
    this.mesh.position.add(forward.multiplyScalar(-this.bulletSpeed * dt))
    
    if (this.mesh.position.z < -10) {
      this.active = false
    }
  }
}

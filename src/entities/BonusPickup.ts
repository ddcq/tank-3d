import * as THREE from 'three'
import { Entity } from './Entity'
import { BONUS_SPEED_Z, BONUS_MAX_Z } from '../utils/constants'

export type BonusType = 'radius' | 'multishoot' | 'attraction' | 'shield'

export class BonusPickup extends Entity {
  readonly bonusType: BonusType
  private spinSpeed = 2 + Math.random() * 1.5
  private core: THREE.Mesh
  private ring: THREE.Mesh
  private ringGroup: THREE.Group

  constructor(pos: THREE.Vector3, type: BonusType) {
    const group = new THREE.Group()
    group.position.set(pos.x, 1, pos.z)
    super(group)
    this.bonusType = type

    const coreColor = type === 'multishoot' ? 0x00ccff : type === 'attraction' ? 0x44ff44 : type === 'shield' ? 0xaa44ff : 0xffd700
    const emissiveColor = type === 'multishoot' ? 0x0088cc : type === 'attraction' ? 0x22aa22 : type === 'shield' ? 0x6622cc : 0xffa500
    const ringColor = type === 'multishoot' ? 0x44ddff : type === 'attraction' ? 0x66ff66 : type === 'shield' ? 0xcc66ff : 0xffaa00

    const coreGeo = new THREE.IcosahedronGeometry(0.2, 0)
    const coreMat = new THREE.MeshStandardMaterial({
      color: coreColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    })
    this.core = new THREE.Mesh(coreGeo, coreMat)
    group.add(this.core)

    this.ringGroup = new THREE.Group()
    const ringGeo = new THREE.RingGeometry(0.3, 0.38, 24)
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    })
    this.ring = new THREE.Mesh(ringGeo, ringMat)
    this.ring.rotation.x = Math.PI / 2
    this.ringGroup.add(this.ring)
    group.add(this.ringGroup)
  }

  update(dt: number): void {
    this.mesh.position.z += BONUS_SPEED_Z * dt
    this.core.rotation.y += dt * 3
    this.core.rotation.x += dt * 1.5
    this.ringGroup.rotation.y += dt * this.spinSpeed
    this.ringGroup.rotation.x += dt * 0.3

    if (this.mesh.position.z > BONUS_MAX_Z) {
      this.active = false
    }
  }
}

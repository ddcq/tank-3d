import * as THREE from 'three'
import { Entity } from './Entity'

export const PLAYER_BULLET_SPEED = 30
const ENEMY_BULLET_SPEED = -12
const BULLET_RADIUS = 0.15
export const GRAVITY = 20

export class Bullet extends Entity {
  velocity: THREE.Vector3
  isPlayerBullet: boolean
  hitGround = false
  private life = 8
  readonly radius: number
  attractionLevel = 0

  constructor(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    isPlayerBullet: boolean,
  ) {
    const geo = new THREE.CylinderGeometry(BULLET_RADIUS * 0.6, BULLET_RADIUS, 0.8, 6)
    geo.rotateX(Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({
      color: isPlayerBullet ? 0xffdd44 : 0xff3333,
      emissive: isPlayerBullet ? 0x886600 : 0x661100,
      roughness: 0.3,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)

    super(mesh)
    this.isPlayerBullet = isPlayerBullet
    this.velocity = direction.clone().multiplyScalar(isPlayerBullet ? PLAYER_BULLET_SPEED : ENEMY_BULLET_SPEED)
    this.radius = BULLET_RADIUS
  }

  update(dt: number): void {
    if (this.hitGround) return
    this.velocity.y -= GRAVITY * dt
    this.mesh.position.addScaledVector(this.velocity, dt)
    this.life -= dt
    if (this.life <= 0 || Math.abs(this.mesh.position.z) > 80) {
      this.active = false
    }
    if (this.mesh.position.y < 0) {
      this.mesh.position.y = 0
      this.hitGround = true
    }
  }
}

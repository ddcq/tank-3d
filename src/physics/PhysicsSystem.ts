import * as THREE from 'three'
import { EntityManager } from '../entities/EntityManager'
import { Bullet } from '../entities/Bullet'
import { EnemySoldier } from '../entities/EnemySoldier'
import { EXPLOSION_RADIUS_INCREASE } from '../utils/constants'

const BASE_EXPLOSION_RADIUS = 5

export class PhysicsSystem {
  private radiusBonus = 0

  get currentRadius(): number { return BASE_EXPLOSION_RADIUS + this.radiusBonus }
  private get currentRadiusSq(): number { return this.currentRadius * this.currentRadius }

  addRadiusBonus(): void {
    this.radiusBonus += EXPLOSION_RADIUS_INCREASE
  }

  resetRadius(): void {
    this.radiusBonus = 0
  }

  update(_dt: number, em: EntityManager, formation: EnemySoldier[], onHit?: (pos: THREE.Vector3) => void, onExplosion?: (pos: THREE.Vector3) => void): void {
    const all = em.getAll()
    const bullets = all.filter((e): e is Bullet => e instanceof Bullet)
    const aliveBullets = bullets.filter(b => b.active)
    const aliveEnemies = formation.filter(e => e.active && !e.isDying)

    for (const bullet of aliveBullets) {
      if (!bullet.active) continue
      const bp = bullet.mesh.position
      let explosionPos: THREE.Vector3 | null = null

      if (bullet.isPlayerBullet && bullet.hitGround) {
        explosionPos = bp.clone()
      }

      if (!explosionPos) {
        for (const enemy of aliveEnemies) {
          const ep = enemy.mesh.position
          const dx = bp.x - ep.x
          const dy = bp.y - ep.y
          const dz = bp.z - ep.z
          if (dx * dx + dy * dy + dz * dz < 1.0) {
            explosionPos = ep.clone()
            break
          }
        }
      }

      if (explosionPos) {
        onExplosion?.(explosionPos.clone())
        for (const enemy of formation) {
          if (!enemy.active || enemy.isDying) continue
          const ep = enemy.mesh.position
          const dx2 = explosionPos.x - ep.x
          const dy2 = explosionPos.y - ep.y
          const dz2 = explosionPos.z - ep.z
          if (dx2 * dx2 + dy2 * dy2 + dz2 * dz2 < this.currentRadiusSq) {
            const died = enemy.hit()
            if (died) onHit?.(ep.clone())
          }
        }
        bullet.active = false
      }
    }
  }
}

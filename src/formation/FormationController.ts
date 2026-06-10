import { EntityManager } from '../entities/EntityManager'
import { EnemySoldier, SoldierType } from '../entities/EnemySoldier'
import { EnemyBullet } from '../entities/EnemyBullet'

export class FormationController {
  public dir: number = -1
  public dropDownAmount: number = 0.5
  public moveSpeed: number = 2.0
  public moveSpeedZ: number = 3.0
  public fireInterval: number = 1.0
  public bulletSpeed: number = -8
  public formationBroken: boolean = false
  private timerAccumulator: number = 0

  constructor() {
    this.dir = -1
  }

  update(dt: number, formation: EnemySoldier[], em: EntityManager): void {
    this.timerAccumulator += dt

    const alive = formation.filter(s => !s.isDying)

    let shouldDropDown = false

    if (!this.formationBroken && alive.length > 0 && alive.length <= this.totalEnemies * 0.5) {
      this.formationBroken = true
      for (const s of alive) {
        s.targetX = (Math.random() - 0.5) * 14
      }
    }

    for (const soldier of formation) {
      if (soldier.isDying) continue

      if (soldier.isFlanker) {
        soldier.mesh.position.z += this.moveSpeedZ * 1.5 * dt
        const dx = -soldier.mesh.position.x
        soldier.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), this.moveSpeed * 1.2 * dt)
        continue
      }

      if (this.formationBroken) {
        soldier.mesh.position.z += this.moveSpeedZ * soldier.speedMultiplier * 1.5 * dt
        const dx = soldier.targetX - soldier.mesh.position.x
        soldier.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), this.moveSpeed * 1.5 * dt)
        continue
      }

      soldier.mesh.position.x += this.dir * this.moveSpeed * dt
      soldier.mesh.position.z += this.moveSpeedZ * soldier.speedMultiplier * dt

      if (soldier.mesh.position.x > 10.5 || soldier.mesh.position.x < -10.5) {
        shouldDropDown = true
      }
    }

    if (shouldDropDown) {
      for (const soldier of formation) {
        if (soldier.isDying || soldier.isFlanker) continue
        soldier.mesh.position.z += this.dropDownAmount
      }
      this.dir *= -1
    }

    const interval = Math.max(0.2, this.fireInterval - (this.totalEnemies - alive.length) * 0.06)
    if (this.timerAccumulator >= interval && alive.length > 0) {
      this.timerAccumulator = 0
      
      const shooterIndex = Math.floor(Math.random() * alive.length)
      const shooter = alive[shooterIndex]
      
      if (shooter.soldierType === SoldierType.Rapid) {
        const offsets = [-0.4, 0, 0.4]
        for (const offset of offsets) {
          new EnemyBullet(
            shooter.mesh.position.x + offset,
            shooter.mesh.position.z - 1.5,
            em,
            SoldierType.Rapid,
            this.bulletSpeed
          )
        }
      } else {
        new EnemyBullet(
          shooter.mesh.position.x,
          shooter.mesh.position.z - 1.5,
          em,
          shooter.soldierType,
          this.bulletSpeed
        )
      }
    }
  }

  private _totalEnemies: number = 15

  get totalEnemies(): number {
    return this._totalEnemies
  }

  set totalEnemies(value: number) {
    this._totalEnemies = value
  }

  clearFormation() {
    this.dir = -1
    this.timerAccumulator = 0
    this.formationBroken = false
  }
}

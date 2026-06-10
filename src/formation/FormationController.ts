import { EntityManager } from '../entities/EntityManager'
import { EnemySoldier } from '../entities/EnemySoldier'
import { EnemyBullet } from '../entities/EnemyBullet'

export class FormationController {
  public dir: number = -1
  public dropDownAmount: number = 0.5
  public moveSpeed: number = 2.0
  public moveSpeedZ: number = 3.0
  public fireInterval: number = 1.0
  private timerAccumulator: number = 0

  constructor() {
    this.dir = -1
  }

  update(dt: number, formation: EnemySoldier[], em: EntityManager): void {
    this.timerAccumulator += dt
    
    let shouldDropDown = false
    for (const soldier of formation) {
      if (soldier.isDying) continue
      soldier.mesh.position.x += this.dir * this.moveSpeed * dt
      
      // Keep soldiers moving toward the player on z-axis (tank is at z=0)
      // They should get closer to tank (which is at z=0) over time, not move away
      soldier.mesh.position.z += this.moveSpeedZ * dt
      
      if (soldier.mesh.position.x > 8.5 || soldier.mesh.position.x < -8.5) {
        shouldDropDown = true
      }
    }

    if (shouldDropDown) {
      for (const soldier of formation) {
        soldier.mesh.position.z += this.dropDownAmount
      }
      this.dir *= -1
    }

    const alive = formation.filter(s => !s.isDying)
    const interval = Math.max(0.2, this.fireInterval - (this.totalEnemies - alive.length) * 0.06)
    if (this.timerAccumulator >= interval && alive.length > 0) {
      this.timerAccumulator = 0
      
      const shooterIndex = Math.floor(Math.random() * alive.length)
      const shooter = alive[shooterIndex]
      
      new EnemyBullet(
        shooter.mesh.position.x,
        shooter.mesh.position.z - 1.5,
        em
      )
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
  }
}

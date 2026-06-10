import { Entity } from './Entity'

export class EntityManager {
  private entities: Entity[] = []
  private _time = 0

  add(entity: Entity): void {
    this.entities.push(entity)
  }

  remove(entity: Entity): void {
    const idx = this.entities.indexOf(entity)
    if (idx !== -1) this.entities.splice(idx, 1)
  }

  clearInactive(): void {
    this.entities = this.entities.filter(e => e.active)
  }

  clear(): void {
    for (const entity of this.entities) {
      entity.active = false
    }
    this.entities = []
  }

  update(dt: number): void {
    this._time += dt
    for (const entity of this.entities) {
      if (entity.active) {
        const updatable = entity as any
        if (typeof updatable.update === 'function') {
          updatable.update(dt, this._time)
        } else {
          entity.update(dt)
        }
      }
    }
  }

  getAll(): readonly Entity[] {
    return this.entities
  }
}

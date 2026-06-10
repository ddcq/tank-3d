export interface InputState {
  left: boolean
  right: boolean
  fire: boolean
  accelerate: boolean
  aimLeft: boolean
  aimRight: boolean
  aimUp: boolean
  aimDown: boolean
}

export class InputManager {
  private keys = new Set<string>()
  private _fireDown = false

  init(): void {
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
  }

  update(): InputState {
    const fire = this._fireDown && this.keys.has('Space')
    if (!this._fireDown && !fire) this._fireDown = false

    return {
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      fire,
      accelerate: this.keys.has('Space'),
      aimLeft: this.keys.has('KeyQ'),
      aimRight: this.keys.has('KeyE'),
      aimUp: this.keys.has('KeyR'),
      aimDown: this.keys.has('KeyF'),
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space') this._fireDown = true
    this.keys.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
  }
}

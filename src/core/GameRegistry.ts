import type { GameBase } from './GameBase'
import type { MenuButton } from '../ui/MainMenu'

interface GameEntry {
  id: string
  label: string
  ctor: new (container: HTMLElement) => GameBase
}

export class GameRegistry {
  private static entries: GameEntry[] = []

  static register(id: string, label: string, ctor: new (container: HTMLElement) => GameBase): void {
    this.entries.push({ id, label, ctor })
  }

  static getMenuButtons(): MenuButton[] {
    return this.entries.map(e => ({ id: e.id, label: e.label }))
  }

  static async launch(id: string, container: HTMLElement): Promise<void> {
    const entry = this.entries.find(e => e.id === id)
    if (!entry) throw new Error(`No game registered with id "${id}"`)
    const game = new entry.ctor(container)
    await game.init()
    game.start()

    await new Promise<void>(resolve => {
      const onExit = () => {
        window.removeEventListener('headgame-exit', onExit)
        game.stop()
        game.dispose()
        resolve()
      }
      window.addEventListener('headgame-exit', onExit)
    })
  }
}

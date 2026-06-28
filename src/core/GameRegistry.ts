import type { GameBase } from './GameBase'
import type { MenuButton } from '../ui/MainMenu'

type GameLoader = () => Promise<{ default: new (container: HTMLElement) => GameBase }>

interface GameEntry {
  id: string
  label: string
  loader: GameLoader
}

export class GameRegistry {
  private static entries: GameEntry[] = []

  static register(id: string, label: string, loader: GameLoader): void {
    this.entries.push({ id, label, loader })
  }

  static getMenuButtons(): MenuButton[] {
    return this.entries.map(e => ({ id: e.id, label: e.label }))
  }

  static async launch(id: string, container: HTMLElement): Promise<void> {
    const entry = this.entries.find(e => e.id === id)
    if (!entry) throw new Error(`No game registered with id "${id}"`)
    const mod = await entry.loader()
    const game = new mod.default(container)
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

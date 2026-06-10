import './ui/styles.css'
import { Game } from './engine/Game'

async function main(): Promise<void> {
  const container = document.getElementById('game')!
  const game = new Game(container)
  await game.init()
  game.start()
}

main().catch(console.error)

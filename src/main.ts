import './ui/styles.css'
import { CalibrationScreen } from './ui/CalibrationScreen'
import { MainMenu } from './ui/MainMenu'
import { HeadTrackingSystemImpl } from './systems/headTracking/HeadTrackingSystem'
import { Game } from './engine/Game'
import { MazeGame } from './maze/MazeGame'

async function runCalibration(): Promise<{ noseX: number; noseY: number }> {
  const screen = new CalibrationScreen()
  return screen.calibrate()
}

async function launchMazeGame(container: HTMLElement): Promise<void> {
  const mazeGame = new MazeGame(container)
  await mazeGame.init()
  mazeGame.start()

  await new Promise<void>(resolve => {
    const onExit = () => {
      window.removeEventListener('maze-exit', onExit)
      resolve()
    }
    window.addEventListener('maze-exit', onExit)
  })
}

async function main(): Promise<void> {
  let { noseX, noseY } = await runCalibration()

  const headTracking = HeadTrackingSystemImpl.getInstance()
  headTracking.setCalibrationOffset(noseX, noseY)
  await headTracking.initialize({ enabled: true, maxFPS: 30 })

  let choice: string
  do {
    const menu = new MainMenu()
    choice = await menu.show(headTracking, [
      { id: 'play', label: 'Lancer le jeu' },
      { id: 'recalibrate', label: 'Recalibrer' },
      { id: 'game2', label: 'Labyrinthe 3D' },
    ])

    if (choice === 'recalibrate') {
      const result = await runCalibration()
      noseX = result.noseX
      noseY = result.noseY
      headTracking.setCalibrationOffset(noseX, noseY)
    }
  } while (choice === 'recalibrate')

  const container = document.getElementById('game')!

  if (choice === 'game2') {
    await launchMazeGame(container)
    location.reload()
    return
  }

  const game = new Game(container)
  await game.init()
  game.start()
}

main().catch(console.error)

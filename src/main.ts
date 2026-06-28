import './ui/styles.css'
import { GameRegistry } from './core/GameRegistry'
import { CalibrationScreen } from './ui/CalibrationScreen'
import { MainMenu } from './ui/MainMenu'
import { HeadTrackingSystemImpl } from './systems/headTracking/HeadTrackingSystem'

GameRegistry.register('maze', 'Labyrinthe 3D', () => import('./games/maze/MazeGame'))
GameRegistry.register('tank', 'Tank Shooter', () => import('./games/tank-shooter/TankGame'))

async function runCalibration(): Promise<{ noseX: number; noseY: number }> {
  const screen = new CalibrationScreen()
  return screen.calibrate()
}

async function main(): Promise<void> {
  let { noseX, noseY } = await runCalibration()

  const headTracking = HeadTrackingSystemImpl.getInstance()
  headTracking.setCalibrationOffset(noseX, noseY)
  await headTracking.initialize({ enabled: true, maxFPS: 30 })

  let choice: string
  do {
    const menu = new MainMenu()
    const buttons = [
      ...GameRegistry.getMenuButtons(),
      { id: 'recalibrate', label: 'Recalibrer' },
    ]
    choice = await menu.show(headTracking, buttons)

    if (choice === 'recalibrate') {
      const result = await runCalibration()
      noseX = result.noseX
      noseY = result.noseY
      headTracking.setCalibrationOffset(noseX, noseY)
    }
  } while (choice === 'recalibrate')

  const container = document.getElementById('game')!
  await GameRegistry.launch(choice, container)
  location.reload()
}

main().catch(console.error)

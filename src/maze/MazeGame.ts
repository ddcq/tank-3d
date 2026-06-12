import * as THREE from 'three'
import { generateMaze } from './MazeGenerator'
import { MazeRenderer } from './MazeRenderer'
import { MazePlayerController, PlayerState } from './MazePlayerController'
import { MazeMinimap } from './MazeMinimap'
import { HeadTrackingSystemImpl } from '../systems/headTracking/HeadTrackingSystem'
import { AudioManager } from '../effects/AudioManager'
import { MainMenu } from '../ui/MainMenu'

export class MazeGame {
  private readonly container: HTMLElement
  private scene!: THREE.Scene
  private renderer!: THREE.WebGLRenderer
  private camera!: THREE.PerspectiveCamera
  private mazeRenderer!: MazeRenderer
  private player!: MazePlayerController
  private minimap!: MazeMinimap
  private headTracking!: HeadTrackingSystemImpl
  private rafId = 0
  private running = false
  private clock = new THREE.Clock()
  private winHandled = false
  private keysDown = new Set<string>()
  private audio = new AudioManager()
  private audioInitialized = false
  private smoothLookX = 0
  private smoothLookZ = 0

  constructor(container: HTMLElement) {
    this.container = container
  }

  async init(): Promise<void> {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x111118)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100)

    const mazeData = generateMaze(10, 30)

    this.mazeRenderer = new MazeRenderer(this.scene, mazeData)
    await this.mazeRenderer.init()
    this.scene.add(this.mazeRenderer.group)

    this.player = new MazePlayerController(mazeData)
    this.player.onStep = () => this.audio.playStep()
    this.player.onTurn = () => this.audio.playTurn()
    this.player.onDeadEnd = () => this.audio.playBlocked()
    this.player.onConfirm = () => this.audio.playConfirm()
    this.player.onWin = () => this.audio.playWin()

    this.smoothLookX = this.player.worldX
    this.smoothLookZ = this.player.worldZ

    this.minimap = new MazeMinimap(mazeData)
    document.body.appendChild(this.minimap.element)

    this.headTracking = HeadTrackingSystemImpl.getInstance()
    try {
      await this.headTracking.initialize({ enabled: true, maxFPS: 30 })
    } catch {
      console.warn('Head tracking unavailable — use keyboard fallback')
    }

    window.addEventListener('resize', this.onResize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  private initAudio(): void {
    this.audio.init()
    this.audio.startAmbient()
  }

  start(): void {
    this.running = true
    this.clock.start()
    this.tick()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.minimap.dispose()
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.audio.stopAmbient()
    this.audio.dispose()
    this.renderer.dispose()
  }

  private tick = (): void => {
    if (!this.running) return
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.update(dt)
    this.rafId = requestAnimationFrame(this.tick)
  }

  private update(dt: number): void {
    if (this.player.state === PlayerState.WIN && !this.winHandled) {
      this.winHandled = true
      this.running = false
      cancelAnimationFrame(this.rafId)
      this.showWinMenu()
      return
    }

    const yaw = this.headTracking.getIsTracking() ? -this.headTracking.getHeadYaw() : 0
    const pitch = this.headTracking.getIsTracking() ? this.headTracking.getHeadPitch() : 0

    if (this.keysDown.has('ArrowLeft') || this.keysDown.has('a')) {
      this.player.cycleDirection = -1
    }
    if (this.keysDown.has('ArrowRight') || this.keysDown.has('d')) {
      this.player.cycleDirection = 1
    }
    if (this.keysDown.has('ArrowUp') || this.keysDown.has(' ') || this.keysDown.has('Enter')) {
      this.player.confirmRequested = true
      this.keysDown.delete('ArrowUp')
      this.keysDown.delete(' ')
      this.keysDown.delete('Enter')
    }

    this.player.update(dt, yaw, pitch)

    this.camera.position.set(
      this.player.worldX,
      1.5,
      this.player.worldZ,
    )

    const camYawOffset = this.player.state === PlayerState.INTERSECTION ? yaw * Math.PI * 0.4 : 0
    const targetLookX = this.player.worldX + Math.sin(this.player.rotation + camYawOffset)
    const targetLookZ = this.player.worldZ - Math.cos(this.player.rotation + camYawOffset)

    const lerpFactor = Math.min(1, dt * 6)
    this.smoothLookX += (targetLookX - this.smoothLookX) * lerpFactor
    this.smoothLookZ += (targetLookZ - this.smoothLookZ) * lerpFactor

    this.camera.lookAt(this.smoothLookX, 1.5, this.smoothLookZ)

    this.mazeRenderer.updateLamps(dt)
    this.mazeRenderer.updateExit(dt)
    this.minimap.update(this.player)

    this.renderer.render(this.scene, this.camera)
  }

  private async showWinMenu(): Promise<void> {
    this.minimap.dispose()
    this.audio.stopAmbient()

    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)

    const menu = new MainMenu()
    const choice = await menu.show(this.headTracking, [
      { id: 'replay', label: 'Rejouer' },
      { id: 'menu', label: 'Menu principal' },
    ])

    if (choice === 'replay') {
      this.resetGame()
    } else {
      this.renderer.dispose()
      this.audio.dispose()
      this.container.innerHTML = ''
      window.dispatchEvent(new CustomEvent('maze-exit'))
    }
  }

  private resetGame(): void {
    this.running = false
    this.winHandled = false
    cancelAnimationFrame(this.rafId)

    this.scene.remove(this.mazeRenderer.group)
    this.mazeRenderer.dispose()
    this.container.innerHTML = ''

    this.init().then(() => {
      this.clock = new THREE.Clock()
      this.clock.start()
      this.start()
    })
  }

  private onResize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.audioInitialized) {
      this.initAudio()
      this.audioInitialized = true
    }
    this.keysDown.add(e.key)

    if (e.key === 'r' || e.key === 'R') {
      this.audio.playReset()
      this.resetGame()
      return
    }

    if (e.key === 'Escape') {
      this.stop()
      this.container.innerHTML = ''
      window.dispatchEvent(new CustomEvent('maze-exit'))
      return
    }

    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd' ||
        e.key === 'Enter') {
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key)
  }
}

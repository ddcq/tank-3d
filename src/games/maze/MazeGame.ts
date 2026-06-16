import * as THREE from 'three'
import { GameBase } from '../../core/GameBase'
import { generateMaze, type MazeData } from './MazeGenerator'
import { MazeRenderer } from './MazeRenderer'
import { MazePlayerController, PlayerState, type DeadEndInfo } from './MazePlayerController'
import { MazeMinimap } from './MazeMinimap'
import { HeadTrackingSystemImpl } from '../../systems/headTracking/HeadTrackingSystem'
import { AudioManager } from '../../systems/audio/AudioManager'
import { MainMenu } from '../../ui/MainMenu'

type SurpriseType = 'gun' | 'monster' | 'transparent_wall' | 'teleport'

export class MazeGame extends GameBase {
  readonly id = 'maze'
  readonly label = 'Labyrinthe 3D'

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
  private surpriseTimer = 0
  private mazeData!: MazeData
  private currentSurprise: SurpriseType | null = null
  private deadEndInfo: DeadEndInfo | null = null
  private wallFadePhase: 'fade_out' | 'walk' | 'fade_in' | null = null
  private visitedDeadEnds = new Map<string, SurpriseType>()
  private hudSurprise = document.createElement('div')
  private hudWeapon = document.createElement('div')

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

    this.mazeData = generateMaze(10, 30)

    this.mazeRenderer = new MazeRenderer(this.scene, this.mazeData)
    await this.mazeRenderer.init()
    this.scene.add(this.mazeRenderer.group)

    this.player = new MazePlayerController(this.mazeData)
    this.player.onStep = () => this.audio.playStep()
    this.player.onTurn = () => this.audio.playTurn()
    this.player.onDeadEnd = () => this.audio.playBlocked()
    this.player.onConfirm = () => this.audio.playConfirm()
    this.player.onWin = () => this.audio.playWin()
    this.player.onDeadEndEntry = (info) => this.handleDeadEndSurprise(info)

    this.smoothLookX = this.player.worldX
    this.smoothLookZ = this.player.worldZ

    this.minimap = new MazeMinimap(this.mazeData)
    document.body.appendChild(this.minimap.element)

    this.initHUD()

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

  private initHUD(): void {
    const style = document.createElement('style')
    style.id = 'maze-hud-styles'
    style.textContent = `
      .maze-hud-surprise {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
        color: #ffdd44; font-size: 32px; font-weight: bold; text-align: center;
        text-shadow: 0 0 16px rgba(255,200,0,.6), 0 2px 8px rgba(0,0,0,.8);
        z-index: 20; pointer-events: none; transition: opacity .3s;
        font-family: monospace;
      }
      .maze-hud-weapon {
        position: fixed; right: 12px; top: calc(50% + 185px);
        color: #ccc; font-size: 13px; text-align: center;
        text-shadow: 0 0 8px rgba(0,0,0,.8);
        background: rgba(0,0,0,.5); padding: 5px 14px; border-radius: 6px;
        z-index: 20; pointer-events: none; font-family: monospace;
        border: 1px solid rgba(255,255,255,0.1);
      }
    `
    document.head.appendChild(style)

    this.hudSurprise.className = 'maze-hud-surprise'
    this.hudSurprise.style.display = 'none'
    document.body.appendChild(this.hudSurprise)

    this.hudWeapon.className = 'maze-hud-weapon'
    document.body.appendChild(this.hudWeapon)
  }

  private updateHUD(): void {
    if (this.currentSurprise) {
      const names: Record<SurpriseType, string> = {
        gun: 'Pistolet',
        monster: 'Monstre',
        transparent_wall: 'Mur transparent',
        teleport: 'Téléportation',
      }
      this.hudSurprise.textContent = names[this.currentSurprise]
      this.hudSurprise.style.display = 'block'
    } else {
      this.hudSurprise.style.display = 'none'
    }

    this.hudWeapon.textContent = this.player.hasGun
      ? `Armé · ${this.player.bullets} balle${this.player.bullets > 1 ? 's' : ''}`
      : 'Non armé'
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
  }

  dispose(): void {
    this.stop()
    this.minimap.dispose()
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.audio.stopAmbient()
    this.audio.dispose()
    this.renderer.dispose()
    this.hudSurprise.remove()
    this.hudWeapon.remove()
    document.getElementById('maze-hud-styles')?.remove()
  }

  private tick = (): void => {
    if (!this.running) return
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.update(dt)
    this.rafId = requestAnimationFrame(this.tick)
  }

  private handleDeadEndSurprise(info: DeadEndInfo): boolean {
    const key = `${info.col}:${info.row}`
    const visited = this.visitedDeadEnds.get(key)

    if (visited) {
      switch (visited) {
        case 'gun':
        case 'monster':
          return false
        case 'teleport':
          this.currentSurprise = 'teleport'
          this.deadEndInfo = info
          this.surpriseTimer = this.getSurpriseDuration('teleport')
          this.audio.playTeleport()
          this.doTeleport()
          return true
        case 'transparent_wall':
          this.currentSurprise = 'transparent_wall'
          this.deadEndInfo = info
          this.wallFadePhase = 'fade_out'
          this.mazeRenderer.startWallFadeOut(info.col, info.row, info.forwardDir)
          this.audio.playConfirm()
          return true
      }
    }

    const type = this.pickSurprise(info)
    this.visitedDeadEnds.set(key, type)
    this.deadEndInfo = info
    this.currentSurprise = type

    if (type === 'transparent_wall') {
      this.wallFadePhase = 'fade_out'
      this.mazeRenderer.startWallFadeOut(info.col, info.row, info.forwardDir)
      this.audio.playConfirm()
    } else {
      this.surpriseTimer = this.getSurpriseDuration(type)
      this.executeSurpriseEffect(type, info)
    }
    return true
  }

  private pickSurprise(info: DeadEndInfo): SurpriseType {
    const types: SurpriseType[] = ['teleport']
    if (!this.player.hasGun) {
      types.push('gun', 'gun')
    } else {
      types.push('gun')
    }
    if (!info.isBoundary) {
      types.push('transparent_wall')
    }
    types.push('monster')
    return types[Math.floor(Math.random() * types.length)]
  }

  private getSurpriseDuration(type: SurpriseType): number {
    switch (type) {
      case 'gun': return 0.6
      case 'monster': return 1.2
      case 'transparent_wall': return 0.5
      case 'teleport': return 1.2
    }
  }

  private executeSurpriseEffect(type: SurpriseType, info: DeadEndInfo): void {
    switch (type) {
      case 'gun':
        this.audio.playGunPickup()
        this.mazeRenderer.showGunPickup(info.col, info.row)
        break
      case 'monster':
        this.audio.playMonster()
        this.mazeRenderer.showMonster(info.col, info.row)
        break
      case 'teleport':
        this.audio.playTeleport()
        this.doTeleport()
        break
    }
  }

  private finishSurprise(): void {
    const type = this.currentSurprise
    const info = this.deadEndInfo
    if (!type || !info) return

    this.currentSurprise = null
    this.deadEndInfo = null

    switch (type) {
      case 'gun':
        this.player.applyGunPickup()
        this.mazeRenderer.clearEffects()
        this.player.resumeTurning()
        break
      case 'monster':
        if (this.player.hasGun) {
          this.audio.playGunShot()
          if (this.player.bullets > 0) this.player.bullets--
          this.mazeRenderer.showMonsterDeath()
          this.player.resumeTurning()
        } else {
          this.audio.playDeath()
          this.mazeRenderer.clearEffects()
          this.mazeRenderer.showDeathEffect(info.col, info.row)
          this.deathTimerActive = true
          this.deathTimer = 1.5
        }
        break
      case 'transparent_wall':
        this.mazeRenderer.resetWallFade()
        this.mazeRenderer.clearEffects()
        this.player.resumeForward()
        break
      case 'teleport':
        this.mazeRenderer.clearEffects()
        break
    }
  }

  private doTeleport(): void {
    const { width: w, height: h, vWalls, hWalls } = this.mazeData
    const intersections: { col: number; row: number }[] = []
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        if (col === this.player.col && row === this.player.row) continue
        let open = 0
        if (col > 0 && vWalls[row * (w - 1) + (col - 1)] === 0) open++
        if (col < w - 1 && vWalls[row * (w - 1) + col] === 0) open++
        if (row > 0 && hWalls[(row - 1) * w + col] === 0) open++
        if (row < h - 1 && hWalls[row * w + col] === 0) open++
        if (open >= 3) intersections.push({ col, row })
      }
    }
    if (intersections.length === 0) {
      let col: number, row: number
      do {
        col = Math.floor(Math.random() * w)
        row = Math.floor(Math.random() * h)
      } while (col === this.player.col && row === this.player.row)
      this.mazeRenderer.teleportEffect(col, row)
      this.player.teleportTo(col, row)
      return
    }
    const cell = intersections[Math.floor(Math.random() * intersections.length)]
    this.mazeRenderer.teleportEffect(cell.col, cell.row)
    this.player.teleportTo(cell.col, cell.row)
  }

  private update(dt: number): void {
    if (this.player.state === PlayerState.WIN && !this.winHandled) {
      this.winHandled = true
      this.running = false
      cancelAnimationFrame(this.rafId)
      this.showWinMenu()
      return
    }

    if (this.currentSurprise && this.surpriseTimer > 0) {
      this.surpriseTimer -= dt
      if (this.surpriseTimer <= 0) {
        this.finishSurprise()
      }
    }

    this.updateDeathTimer(dt)

    if (this.player.state === PlayerState.WIN) return

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
      1.5 + this.player.worldY,
      this.player.worldZ,
    )

    const camYawOffset = this.player.state === PlayerState.INTERSECTION ? yaw * Math.PI * 0.4 : 0
    const targetLookX = this.player.worldX + Math.sin(this.player.rotation + camYawOffset)
    const targetLookZ = this.player.worldZ - Math.cos(this.player.rotation + camYawOffset)

    const lerpFactor = Math.min(1, dt * 6)
    this.smoothLookX += (targetLookX - this.smoothLookX) * lerpFactor
    this.smoothLookZ += (targetLookZ - this.smoothLookZ) * lerpFactor

    this.camera.lookAt(this.smoothLookX, 1.5 + this.player.worldY, this.smoothLookZ)

    if (this.wallFadePhase === 'fade_out') {
      const done = this.mazeRenderer.updateWallFade(dt)
      if (done && this.deadEndInfo) {
        const info = this.deadEndInfo
        const nc = info.col + info.forwardDir.dx
        const nr = info.row + info.forwardDir.dz
        if (nc >= 0 && nc < this.mazeData.width && nr >= 0 && nr < this.mazeData.height) {
          this.player.beginWallStep(nc, nr)
        }
        this.wallFadePhase = 'walk'
      }
    } else if (this.wallFadePhase === 'walk') {
      if (this.player.state !== PlayerState.SURPRISE) {
        this.wallFadePhase = 'fade_in'
        this.mazeRenderer.startWallFadeIn()
      }
    } else if (this.wallFadePhase === 'fade_in') {
      const done = this.mazeRenderer.updateWallFade(dt)
      if (done) {
        this.mazeRenderer.resetWallFade()
        this.wallFadePhase = null
        this.currentSurprise = null
        this.deadEndInfo = null
        this.mazeRenderer.clearEffects()
      }
    }

    this.mazeRenderer.updatePlayerPosition(this.player.col, this.player.row)
    this.mazeRenderer.updateLamps(dt)
    this.mazeRenderer.updateExit(dt)
    this.minimap.update(this.player)
    this.updateHUD()

    this.renderer.render(this.scene, this.camera)
  }

  private deathTimer = 0
  private deathTimerActive = false

  private updateDeathTimer(dt: number): void {
    if (!this.deathTimerActive) return
    this.deathTimer -= dt
    if (this.deathTimer <= 0) {
      this.deathTimerActive = false
      this.running = false
      cancelAnimationFrame(this.rafId)
      this.showDeathMenu()
    }
  }

  private async showDeathMenu(): Promise<void> {
    this.minimap.dispose()
    this.audio.stopAmbient()

    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)

    const menu = new MainMenu()
    const choice = await menu.show(this.headTracking, [
      { id: 'replay', label: 'Recommencer' },
      { id: 'menu', label: 'Menu principal' },
    ])

    if (choice === 'replay') {
      this.resetGame()
    } else {
      this.dispose()
      this.container.innerHTML = ''
      window.dispatchEvent(new CustomEvent('headgame-exit'))
    }
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
      this.dispose()
      this.container.innerHTML = ''
      window.dispatchEvent(new CustomEvent('headgame-exit'))
    }
  }

  private resetGame(): void {
    this.running = false
    this.winHandled = false
    this.deathTimerActive = false
    this.currentSurprise = null
    this.deadEndInfo = null
    this.surpriseTimer = 0
    this.wallFadePhase = null
    this.visitedDeadEnds.clear()
    cancelAnimationFrame(this.rafId)

    this.scene.remove(this.mazeRenderer.group)
    this.mazeRenderer.dispose()
    this.container.innerHTML = ''
    this.hudSurprise.remove()
    this.hudWeapon.remove()
    document.getElementById('maze-hud-styles')?.remove()

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
      this.dispose()
      this.container.innerHTML = ''
      window.dispatchEvent(new CustomEvent('headgame-exit'))
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

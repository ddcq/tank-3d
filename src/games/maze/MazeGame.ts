import * as THREE from 'three'
import { GameBase } from '../../core/GameBase'
import { generateMaze, type MazeData } from './MazeGenerator'
import { MazeRenderer } from './MazeRenderer'
import { MazePlayerController, PlayerState, type DeadEndInfo } from './MazePlayerController'
import { MazeMinimap } from './MazeMinimap'
import { HeadTrackingSystemImpl } from '../../systems/headTracking/HeadTrackingSystem'
import { AudioManager } from '../../systems/audio/AudioManager'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MainMenu } from '../../ui/MainMenu'

type SurpriseType = 'gun' | 'monster' | 'transparent_wall' | 'teleport' | 'lantern' | 'path'

const ROT180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)

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
  private readonly WIN_ANIM_DURATION = 2.5
  private winAnimTimer = 0
  private winStartCamY = 0
  private keysDown = new Set<string>()
  private audio = new AudioManager()

  private gunModel: THREE.Group | null = null
  private gunMixer: THREE.AnimationMixer | null = null
  private gunClips = new Map<string, THREE.AnimationClip>()
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
  private visibilityRadius = 2
  private guidePath: [number, number][] | null = null
  private guideTimer = 0
  private readonly GUN_APPROACH_DURATION = 0.5
  private gunApproachPhase: 'none' | 'approaching' = 'none'
  private approachGun: THREE.Group | null = null

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

    this.renderer.domElement.addEventListener('click', () => this.audio.userGesture())
    this.renderer.domElement.addEventListener('touchstart', () => this.audio.userGesture())

    this.initAudio()

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100)

    this.loadGunModel()

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
        lantern: 'Lanterne',
        path: 'Itinéraire',
      }
      this.hudSurprise.textContent = names[this.currentSurprise]
      this.hudSurprise.style.display = 'block'
    } else {
      this.hudSurprise.style.display = 'none'
    }

    this.hudWeapon.textContent = this.player.hasGun
      ? `Armé · ${this.player.bullets} balle${this.player.bullets > 1 ? 's' : ''}`
      : 'Non armé'

    if (this.gunModel) {
      this.gunModel.visible = this.player.bullets > 0
    }
  }

  private initAudio(): void {
    this.audio.init()
    this.audio.preloadMonster()
    this.audio.preloadGunshoot()
    this.audio.preloadReload()
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
    if (this.gunModel) {
      this.scene.remove(this.gunModel)
      this.gunModel = null
    }
    if (this.gunMixer) {
      this.gunMixer.stopAllAction()
      this.gunMixer = null
    }
    if (this.approachGun) {
      this.scene.remove(this.approachGun)
      this.approachGun.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
      this.approachGun = null
    }
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

  private isFakeWall(col: number, row: number, dir: { dx: number; dz: number }): boolean {
    let key: string
    if (dir.dx === 1) {
      key = `v:${row}:${col}`
    } else if (dir.dx === -1) {
      key = `v:${row}:${col - 1}`
    } else if (dir.dz === 1) {
      key = `h:${row}:${col}`
    } else {
      key = `h:${row - 1}:${col}`
    }

    for (const fw of this.mazeData.fakeWalls) {
      const fwKey = `${fw.dir}:${fw.row}:${fw.col}`
      if (fwKey === key) return true
    }
    return false
  }

  private removeFakeWall(): void {
    if (!this.deadEndInfo) return
    const info = this.deadEndInfo
    const { col, row, forwardDir } = info
    const { dx, dz } = forwardDir

    let key: string
    if (dx === 1) {
      key = `v:${row}:${col}`
    } else if (dx === -1) {
      key = `v:${row}:${col - 1}`
    } else if (dz === 1) {
      key = `h:${row}:${col}`
    } else {
      key = `h:${row - 1}:${col}`
    }

    this.mazeRenderer.removeWall(key)
    this.minimap.removeFakeWall(key)
  }

  private handleDeadEndSurprise(info: DeadEndInfo): boolean {
    const key = `${info.col}:${info.row}`

    if (!info.isBoundary && this.isFakeWall(info.col, info.row, info.forwardDir)) {
      this.visitedDeadEnds.set(key, 'transparent_wall')
      this.currentSurprise = 'transparent_wall'
      this.deadEndInfo = info
      this.wallFadePhase = 'fade_out'
      this.mazeRenderer.startWallFadeOut(info.col, info.row, info.forwardDir)
      this.audio.playConfirm()
      return true
    }

    const visited = this.visitedDeadEnds.get(key)

    if (visited) {
      switch (visited) {
        case 'gun':
        case 'monster':
        case 'lantern':
          return false
        case 'teleport':
          this.currentSurprise = 'teleport'
          this.deadEndInfo = info
          this.surpriseTimer = this.getSurpriseDuration('teleport')
          this.audio.playTeleport()
          this.doTeleport()
          return true
      }
    }

    const type = this.pickSurprise(info)
    this.visitedDeadEnds.set(key, type)
    this.deadEndInfo = info
    this.currentSurprise = type

    this.surpriseTimer = this.getSurpriseDuration(type)
    this.executeSurpriseEffect(type, info)
    return true
  }

  private pickSurprise(_info: DeadEndInfo): SurpriseType {
    const types: SurpriseType[] = ['teleport', 'lantern']
    if (!this.player.hasGun) {
      types.push('gun', 'gun')
    } else {
      types.push('gun')
    }
    types.push('monster', 'path')
    return types[Math.floor(Math.random() * types.length)]
  }

  private getSurpriseDuration(type: SurpriseType): number {
    switch (type) {
      case 'gun': return this.player.bullets === 0 ? this.GUN_APPROACH_DURATION : 0.6
      case 'monster': return 1.2
      case 'transparent_wall': return 0.5
      case 'teleport': return 1.2
      case 'lantern': return 1.5
      case 'path': return 2
    }
  }

  private executeSurpriseEffect(type: SurpriseType, info: DeadEndInfo): void {
    switch (type) {
      case 'gun':
        this.audio.playGunPickup()
        this.mazeRenderer.showGunPickup(info.col, info.row)
        if (this.player.bullets === 0 && this.approachGun && this.gunModel) {
          this.gunApproachPhase = 'approaching'
          this.approachGun.visible = true
          this.gunModel.visible = false
        }
        break
      case 'monster':
        if (!this.player.hasGun) {
          this.audio.playMonster()
        }
        {
          const idx = Math.floor(Math.random() * 7) + 1
          this.mazeRenderer.showMonster(info.col, info.row, info.forwardDir, idx)
        }
        if (!this.player.hasGun) {
          this.audio.playMonsterApproach()
        }
        break
      case 'teleport':
        this.audio.playTeleport()
        this.doTeleport()
        break
      case 'lantern':
        this.audio.playConfirm()
        this.applyLantern()
        break
      case 'path':
        this.audio.playConfirm()
        this.applyGuidePath()
        break
    }
  }

  private loadGunModel(): void {
    const loader = new GLTFLoader()
    loader.load(
      '/models/fps_animations_lowpoly_mp5.glb',
      (gltf) => {
        const model = gltf.scene
        model.scale.setScalar(0.6)
        model.visible = false
        this.scene.add(model)
        this.gunModel = model
        this.gunMixer = new THREE.AnimationMixer(model)
        for (const clip of gltf.animations) {
          this.gunClips.set(clip.name, clip)
        }
        this.createApproachGun()
      },
      undefined,
      () => { },
    )
  }

  private createApproachGun(): void {
    const group = new THREE.Group()
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.3 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.2 })
    const magMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.4 })

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.28), bodyMat)
    body.position.set(0, 0, 0)
    group.add(body)

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.22, 8), darkMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.02, -0.24)
    group.add(barrel)

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.04), bodyMat)
    handle.position.set(0, -0.065, 0.09)
    handle.rotation.x = 0.3
    group.add(handle)

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.07), magMat)
    mag.position.set(0, -0.06, 0.01)
    group.add(mag)

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.06), darkMat)
    stock.position.set(0, -0.01, 0.16)
    group.add(stock)

    group.scale.setScalar(0.6)
    group.visible = false
    this.scene.add(group)
    this.approachGun = group
  }

  private playGunAnim(name: string): void {
    const clip = this.gunClips.get(name)
    if (!this.gunMixer || !clip) return
    const action = this.gunMixer.clipAction(clip)
    action.stop().reset()
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)
    action.play()
  }

  private finishSurprise(): void {
    const type = this.currentSurprise
    const info = this.deadEndInfo
    if (!type || !info) return

    this.currentSurprise = null
    this.deadEndInfo = null

    switch (type) {
      case 'gun':
        {
          const wasEmpty = this.player.bullets === 0
          this.player.applyGunPickup()
          this.audio.playReload()
          if (this.gunApproachPhase !== 'none') {
            this.gunApproachPhase = 'none'
            if (this.approachGun) this.approachGun.visible = false
            if (this.gunModel) this.gunModel.visible = true
          }
          this.playGunAnim(wasEmpty ? 'Arms_fullreload' : 'Arms_notfullreload')
          this.mazeRenderer.clearEffects()
          this.player.resumeTurning()
        }
        break
      case 'monster':
        if (this.player.hasGun) {
          this.audio.playGunShotFromFile()
          this.playGunAnim('Arms_Fire')
          this.mazeRenderer.clearEffects()
          if (this.player.bullets > 0) {
            this.player.bullets--
            if (this.player.bullets === 0) this.player.hasGun = false
          }
          this.player.resumeTurning()
        } else {
          this.audio.playDeath()
          this.deathTimerActive = true
          this.deathTimer = 1.5
        }
        break
      case 'transparent_wall':
        this.removeFakeWall()
        this.mazeRenderer.clearEffects()
        this.player.resumeForward()
        break
      case 'teleport':
        this.mazeRenderer.clearEffects()
        break
      case 'lantern':
        this.mazeRenderer.clearEffects()
        this.player.resumeTurning()
        break
      case 'path':
        this.mazeRenderer.clearEffects()
        this.player.resumeTurning()
        break
    }
  }

  private applyLantern(): void {
    this.visibilityRadius = Math.min(this.visibilityRadius + 3, 8)
    this.minimap.setVisibilityRadius(this.visibilityRadius)
  }

  private applyGuidePath(): void {
    const path = this.findPathToExit(this.player.col, this.player.row)
    this.guidePath = path.length > 0 ? path : null
    this.guideTimer = this.guidePath ? 30 : 0
    if (this.guidePath) {
      this.minimap.setGuidePath(this.guidePath)
    }
  }

  private findPathToExit(fromCol: number, fromRow: number): [number, number][] {
    const { width: w, height: h, vWalls, hWalls, endCol, endRow } = this.mazeData
    const visited = new Set<number>()
    const parent = new Map<number, [number, number]>()
    const queue: [number, number][] = [[fromCol, fromRow]]
    visited.add(fromRow * w + fromCol)

    while (queue.length > 0) {
      const [col, row] = queue.shift()!
      if (col === endCol && row === endRow) {
        const path: [number, number][] = []
        let cur: [number, number] = [col, row]
        path.push(cur)
        while (parent.has(cur[1] * w + cur[0])) {
          cur = parent.get(cur[1] * w + cur[0])!
          path.unshift(cur)
        }
        return path
      }

      const dirs: { dx: number; dz: number; canMove: (c: number, r: number) => boolean }[] = [
        { dx: 1, dz: 0, canMove: (c, r) => c < w - 1 && (vWalls[r * (w - 1) + c] === 0 || this.isFakeWall(c, r, { dx: 1, dz: 0 })) },
        { dx: -1, dz: 0, canMove: (c, r) => c > 0 && (vWalls[r * (w - 1) + (c - 1)] === 0 || this.isFakeWall(c, r, { dx: -1, dz: 0 })) },
        { dx: 0, dz: 1, canMove: (c, r) => r < h - 1 && (hWalls[r * w + c] === 0 || this.isFakeWall(c, r, { dx: 0, dz: 1 })) },
        { dx: 0, dz: -1, canMove: (c, r) => r > 0 && (hWalls[(r - 1) * w + c] === 0 || this.isFakeWall(c, r, { dx: 0, dz: -1 })) },
      ]

      for (const { dx, dz, canMove } of dirs) {
        const nc = col + dx
        const nr = row + dz
        const key = nr * w + nc
        if (nc >= 0 && nc < w && nr >= 0 && nr < h && !visited.has(key) && canMove(col, row)) {
          visited.add(key)
          parent.set(key, [col, row])
          queue.push([nc, nr])
        }
      }
    }

    return []
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
      this.winAnimTimer = this.WIN_ANIM_DURATION
      this.winStartCamY = this.camera.position.y
      this.mazeRenderer.triggerWinEffect()
      this.mazeRenderer.updateWinEffect(0)
      this.audio.playWin()
      if (this.gunModel) this.gunModel.visible = false
    }

    if (this.player.state === PlayerState.WIN) {
      if (this.winAnimTimer > 0) {
        this.winAnimTimer -= dt
        const t = 1 - this.winAnimTimer / this.WIN_ANIM_DURATION
        const eased = t * t * (3 - 2 * t)
        this.camera.position.y = this.winStartCamY + 2.0 * eased
        this.camera.position.y += Math.sin(t * Math.PI) * 0.3
        const exitPos = this.mazeRenderer.getExitWorldPosition()
        this.camera.lookAt(exitPos.x, 0, exitPos.z)
        this.mazeRenderer.updateWinEffect(dt)
        this.hudSurprise.textContent = 'Victoire !'
        this.hudSurprise.style.display = 'block'
        this.hudSurprise.style.color = '#ffdd44'
        this.hudSurprise.style.fontSize = '48px'
        this.hudWeapon.textContent = this.player.hasGun
          ? `Armé · ${this.player.bullets} balle${this.player.bullets > 1 ? 's' : ''}`
          : 'Non armé'
        if (this.gunModel) this.gunModel.visible = false
        this.mazeRenderer.updateLamps(dt)
        this.renderer.render(this.scene, this.camera)
        return
      } else {
        this.running = false
        cancelAnimationFrame(this.rafId)
        this.showWinMenu()
        return
      }
    }

    if (this.currentSurprise && this.surpriseTimer > 0) {
      this.surpriseTimer -= dt
      if (this.surpriseTimer <= 0) {
        this.finishSurprise()
      }
    }

    this.updateDeathTimer(dt)

    if (this.guideTimer > 0) {
      this.guideTimer -= dt
      if (this.guideTimer <= 0) {
        this.guidePath = null
        this.minimap.clearGuidePath()
      }
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

    if (this.gunApproachPhase === 'approaching' && this.approachGun) {
      const t = 1 - Math.max(0, this.surpriseTimer) / this.GUN_APPROACH_DURATION
      const eased = t * t * (3 - 2 * t)
      const startOffset = new THREE.Vector3(0, -0.3, -1.5)
      const endOffset = new THREE.Vector3(0, -0.9, 0.1)
      const offset = new THREE.Vector3().lerpVectors(startOffset, endOffset, eased)
      offset.applyQuaternion(this.camera.quaternion)
      this.approachGun.position.copy(this.camera.position).add(offset)
      const startRel = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, -0.15))
      const rel = new THREE.Quaternion().slerpQuaternions(startRel, ROT180, eased)
      this.approachGun.quaternion.copy(this.camera.quaternion).multiply(rel)
    } else if (this.gunModel) {
      const offset = new THREE.Vector3(0, -0.9, 0.1)
      offset.applyQuaternion(this.camera.quaternion)
      this.gunModel.position.copy(this.camera.position).add(offset)
      this.gunModel.quaternion.copy(this.camera.quaternion)
      this.gunModel.quaternion.multiply(ROT180)
    }
    if (this.gunMixer) {
      this.gunMixer.update(dt)
    }

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
        this.removeFakeWall()
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
    this.guidePath = null
    this.guideTimer = 0
    this.gunApproachPhase = 'none'
    if (this.approachGun) this.approachGun.visible = false
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
    this.audio.userGesture()
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

import * as THREE from 'three'
import { Renderer } from './Renderer'
import { WorldManager } from '../world/WorldManager'
import { Player } from '../player/Player'
import { InputManager } from '../player/InputManager'
import { CameraController } from '../player/CameraController'
import { EntityManager } from '../entities/EntityManager'
import { PhysicsSystem } from '../physics/PhysicsSystem'
import { HUD } from '../ui/HUD'
import { FormationController } from '../formation/FormationController'
import { EnemySoldier } from '../entities/EnemySoldier'
import { HeadTrackingSystemImpl } from '../systems/headTracking/HeadTrackingSystem'
import { BloodEffect } from '../effects/BloodEffect'
import { ExplosionEffect } from '../effects/ExplosionEffect'

interface GameState {
  score: number
  lives: number
  wave: number
  enemyFormation: EnemySoldier[]
  gameActive: boolean
  gameOver: boolean
}

export class Game {
  public readonly scene: THREE.Scene
  public readonly renderer: Renderer
  public readonly camera: THREE.PerspectiveCamera
  public readonly input: InputManager
  public readonly entities: EntityManager
  public readonly physics: PhysicsSystem
  private readonly formationCtrl: FormationController

  private readonly player: Player
  private readonly cameraCtrl: CameraController
  private readonly world: WorldManager
  private readonly hud: HUD
  private readonly headTracking: HeadTrackingSystemImpl
  private state: GameState

  private clock = new THREE.Clock()
  private running = false
  private rafId = 0
  private bloodEffects: BloodEffect[] = []
  private explosionEffects: ExplosionEffect[] = []

  private bloodPools: { mesh: THREE.Mesh; age: number; done: boolean }[] = []

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.renderer = new Renderer(container)
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.input = new InputManager()
    this.entities = new EntityManager()
    this.physics = new PhysicsSystem()
    this.formationCtrl = new FormationController()

    this.player = new Player(this.scene)
    this.cameraCtrl = new CameraController(this.camera, this.player)
    this.world = new WorldManager(this.scene)
    this.hud = new HUD()
    this.headTracking = HeadTrackingSystemImpl.getInstance()
    
    this.state = {
      score: 0,
      lives: 3,
      wave: 1,
      enemyFormation: [],
      gameActive: false,
      gameOver: false
    }
  }

  async init(): Promise<void> {
    this.input.init()
    this.cameraCtrl.init()

    const onResize = () => this.renderer.resize()
    window.addEventListener('resize', onResize)

    await this.world.init()
    this.scene.add(this.player.tank.group)

    // Initialize head tracking system after WebGL context is ready
    try {
      await this.headTracking.initialize({
        enabled: true,
        maxFPS: 30
      })
    } catch (error) {
      console.warn('Head tracking initialization failed:', error)
    }

    this.spawnWave(1)
    this.hud.show()
    this.state.gameActive = true
    
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (!this.state.gameActive || this.state.gameOver) {
          this.resetGame()
        }
      }
      
      // Head tracking hotkeys
      if (e.key === 't' || e.key === 'T') {
        // Toggle head tracking
        if (this.headTracking) {
          if (this.headTracking.getIsTracking()) {
            this.headTracking.disable();
          } else {
            this.headTracking.enable();
          }
        }
      }
      
      if (e.key === 'c' || e.key === 'C') {
        // Calibrate head tracking
        if (this.headTracking) {
          this.headTracking.calibrate();
        }
      }
      
      if (e.key === 'h' || e.key === 'H') {
        // Recenter head tracking
        if (this.headTracking) {
          this.headTracking.recenter();
        }
      }
    })
  }

  start(): void {
    this.running = true
    this.clock.start()
    this.tick()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.player.dispose()
    this.headTracking.dispose()
  }

  spawnWave(waveIndex: number): void {
    this.state.wave = waveIndex
    this.hud.update(this.state.score, this.state.wave, this.state.lives)

    const cols = Math.min(12, 3 + waveIndex)
    const rows = Math.min(8, 2 + Math.floor(waveIndex / 2))
    const spacing = 1.2
    const startX = -(cols - 1) * spacing / 2
    
    this.formationCtrl.totalEnemies = cols * rows
    this.state.enemyFormation = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing
        // Spawn enemies far away, on the road surface, facing tank (z=0)
        const z = -60 - row * spacing * 1.5
        
        const soldier = new EnemySoldier(
          x,
          z,
          row,
          col
        )
        
        // Make soldiers face towards player (tank position is at z=0)  
        soldier.mesh.rotation.y = Math.PI
        
        this.scene.add(soldier.mesh)
        this.state.enemyFormation.push(soldier)
      }
    }

    this.formationCtrl.moveSpeed = 2.0 + waveIndex * 0.5
    this.formationCtrl.moveSpeedZ = 3.0 + waveIndex * 0.5
    this.formationCtrl.fireInterval = Math.max(0.2, 1.0 - waveIndex * 0.1)
  }

  update(dt: number): void {
    if (!this.state.gameActive || this.state.gameOver) return

    const input = this.input.update()
    this.player.input = input
    const headYaw = this.headTracking.getHeadYaw()
    const headPitch = this.headTracking.getHeadPitch()
    this.player.update(dt, headYaw, headPitch, (b) => {
      this.entities.add(b)
      this.scene.add(b.mesh)
    })
    
    this.world.update(dt, this.player.position)
    
    this.entities.update(dt)

    const time = this.clock.getElapsedTime()
    for (const s of this.state.enemyFormation) {
      s.update(dt, time)
    }
    
    this.physics.update(dt, this.entities, this.state.enemyFormation, (pos) => {
      this.state.score++
      this.hud.update(this.state.score, this.state.wave, this.state.lives)
      this.bloodEffects.push(new BloodEffect(this.scene, pos))
      const poolGeo = new THREE.CircleGeometry(0.5, 12)
      poolGeo.rotateX(-Math.PI / 2)
      const poolMat = new THREE.MeshStandardMaterial({
        color: 0x660000,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      })
      const pool = new THREE.Mesh(poolGeo, poolMat)
      pool.position.set(pos.x, 0.015, pos.z)
      this.scene.add(pool)
      this.bloodPools.push({ mesh: pool, age: 0, done: false })
    }, (pos) => {
      this.explosionEffects.push(new ExplosionEffect(this.scene, pos, 5))
    })

    for (const entity of this.entities.getAll()) {
      if (!entity.active) {
        this.scene.remove(entity.mesh)
      }
    }
    this.entities.clearInactive()

    const deadEnemies = this.state.enemyFormation.filter(e => !e.active)
    for (const e of deadEnemies) {
      this.scene.remove(e.mesh)
    }
    this.state.enemyFormation = this.state.enemyFormation.filter(e => e.active)

    for (let i = this.bloodEffects.length - 1; i >= 0; i--) {
      const effect = this.bloodEffects[i]
      effect.update(dt)
      if (effect.done) {
        effect.dispose()
        this.bloodEffects.splice(i, 1)
      }
    }

    for (let i = this.explosionEffects.length - 1; i >= 0; i--) {
      const effect = this.explosionEffects[i]
      effect.update(dt)
      if (effect.done) {
        effect.dispose()
        this.explosionEffects.splice(i, 1)
      }
    }

    const FADE_START = 1
    const POOL_LIFETIME = 2
    for (let i = this.bloodPools.length - 1; i >= 0; i--) {
      const pool = this.bloodPools[i]
      pool.age += dt
      if (pool.age >= POOL_LIFETIME) {
        pool.done = true
      } else if (pool.age > FADE_START) {
        const mat = pool.mesh.material as THREE.MeshStandardMaterial
        mat.opacity = 0.6 * (1 - (pool.age - FADE_START) / (POOL_LIFETIME - FADE_START))
      }
      if (pool.done) {
        this.scene.remove(pool.mesh)
        pool.mesh.geometry.dispose()
        ;(pool.mesh.material as THREE.Material).dispose()
        this.bloodPools.splice(i, 1)
      }
    }

    if (this.state.enemyFormation.length === 0) {
      this.state.wave++
      this.spawnWave(this.state.wave)
    }

    this.formationCtrl.update(dt, this.state.enemyFormation, this.entities)
    
    this.cameraCtrl.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  resetGame(): void {
    for (const e of this.state.enemyFormation) {
      this.scene.remove(e.mesh)
    }
    this.state = {
      score: 0,
      lives: 3,
      wave: 1,
      enemyFormation: [],
      gameActive: true,
      gameOver: false
    }
    
    for (const effect of this.bloodEffects) {
      effect.dispose()
    }
    this.bloodEffects = []
    for (const effect of this.explosionEffects) {
      effect.dispose()
    }
    this.explosionEffects = []
    for (const pool of this.bloodPools) {
      this.scene.remove(pool.mesh)
      pool.mesh.geometry.dispose()
      ;(pool.mesh.material as THREE.Material).dispose()
    }
    this.bloodPools = []
    this.entities.clear()
    this.formationCtrl.clearFormation()
    
    this.spawnWave(1)
    this.hud.update(this.state.score, this.state.wave, this.state.lives)
  }

  private tick = (): void => {
    if (!this.running) return
    
    const dt = Math.min(this.clock.getDelta(), 0.05)
    
    this.update(dt)
    
    this.rafId = requestAnimationFrame(this.tick)
  }
}

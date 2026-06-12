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
import { EnemySoldier, SoldierType } from '../entities/EnemySoldier'
import { HeadTrackingSystemImpl } from '../systems/headTracking/HeadTrackingSystem'
import { BloodEffect } from '../effects/BloodEffect'
import { ExplosionEffect } from '../effects/ExplosionEffect'
import { ShockwaveRing } from '../effects/ShockwaveRing'
import { BonusPickup, BonusType } from '../entities/BonusPickup'
import { Bullet } from '../entities/Bullet'
import { EnemyBullet } from '../entities/EnemyBullet'
import { MiniGrenade } from '../entities/MiniGrenade'
import { Drone, DroneProjectile } from '../entities/Drone'
import { BONUS_SPAWN_CHANCE, BONUS_COLLECT_RADIUS } from '../utils/constants'

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
  private invincibleTimer = 0
  private readonly INVINCIBLE_DURATION = 1.0
  private bloodEffects: BloodEffect[] = []
  private explosionEffects: ExplosionEffect[] = []

  private bloodPools: { mesh: THREE.Mesh; age: number; done: boolean }[] = []
  private bonusPickups: BonusPickup[] = []
  private miniGrenades: MiniGrenade[] = []
  private drones: Drone[] = []
  private droneProjectiles: DroneProjectile[] = []
  private shockwaveRings: ShockwaveRing[] = []

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
    await this.player.init()

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
    
    this.state.enemyFormation = []

    const soldierHp = 1 + Math.floor(waveIndex / 3)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing
        const z = -60 - row * spacing * 1.5

        let type = SoldierType.Standard
        const rand = Math.random()
        if (waveIndex >= 7) {
          if (rand < 0.25) type = SoldierType.Rapid
          else if (rand < 0.5) type = SoldierType.Heavy
          else type = SoldierType.Standard
        } else if (waveIndex >= 4) {
          if (rand < 0.3) type = SoldierType.Heavy
        }

        const soldier = new EnemySoldier(
          x,
          z,
          row,
          col,
          soldierHp,
          type
        )
        
        soldier.mesh.rotation.y = Math.PI
        
        this.scene.add(soldier.mesh)
        this.state.enemyFormation.push(soldier)
      }
    }

    if (waveIndex >= 3) {
      const flankCount = Math.min(4, Math.floor(waveIndex / 2))
      for (let i = 0; i < flankCount; i++) {
        const side = i % 2 === 0 ? 1 : -1
        const fx = side * (12 + Math.random() * 3)
        const fz = -50 - i * 5
        let fType = SoldierType.Standard
        if (waveIndex >= 7 && Math.random() < 0.3) fType = SoldierType.Rapid
        const flanker = new EnemySoldier(fx, fz, -1, -1, soldierHp, fType)
        flanker.isFlanker = true
        flanker.mesh.rotation.y = Math.PI
        this.scene.add(flanker.mesh)
        this.state.enemyFormation.push(flanker)
      }
    }

    this.formationCtrl.totalEnemies = this.state.enemyFormation.length
    this.formationCtrl.formationBroken = false
    this.formationCtrl.moveSpeed = Math.min(8, 2.0 + waveIndex * 0.5)
    this.formationCtrl.moveSpeedZ = Math.min(10, 3.0 + waveIndex * 0.5)
    this.formationCtrl.fireInterval = Math.max(0.2, Math.min(1.0, 1.0 - waveIndex * 0.1))
    this.formationCtrl.bulletSpeed = Math.max(-15, -(8 + waveIndex * 0.5))
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

    for (const entity of this.entities.getAll()) {
      if (!(entity instanceof Bullet) || !entity.isPlayerBullet || entity.hitGround) continue
      const level = entity.attractionLevel
      if (level <= 0) continue

      let nearest: EnemySoldier | null = null
      let nearestDistSq = Infinity
      const bp = entity.mesh.position
      for (const enemy of this.state.enemyFormation) {
        if (!enemy.active || enemy.isDying) continue
        const ep = enemy.mesh.position
        const dx = bp.x - ep.x
        const dz = bp.z - ep.z
        const distSq = dx * dx + dz * dz
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq
          nearest = enemy
        }
      }

      if (nearest) {
        const toTarget = new THREE.Vector3()
          .copy(nearest.mesh.position)
          .sub(bp)
        toTarget.y = 0
        toTarget.normalize()
        const strength = level * 3 * dt
        entity.velocity.x += toTarget.x * strength
        entity.velocity.z += toTarget.z * strength
      }
    }

    const time = this.clock.getElapsedTime()
    for (const s of this.state.enemyFormation) {
      s.update(dt, time)
    }
    
    this.physics.update(dt, this.entities, this.state.enemyFormation, (pos) => {
      this.state.score++
      this.hud.update(this.state.score, this.state.wave, this.state.lives)

      if (Math.random() < BONUS_SPAWN_CHANCE) {
        const types: BonusType[] = ['radius', 'multishoot', 'attraction', 'shield', 'scatter', 'drone', 'shockwave']
        const type = types[Math.floor(Math.random() * types.length)]
        const bonus = new BonusPickup(pos, type)
        this.scene.add(bonus.mesh)
        this.bonusPickups.push(bonus)
      }

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
      this.explosionEffects.push(new ExplosionEffect(this.scene, pos, this.physics.currentRadius))
      const scatter = this.player.scatterLevel
      if (scatter > 0) {
        const count = 2 + scatter
        for (let i = 0; i < count; i++) {
          const g = new MiniGrenade(pos)
          this.scene.add(g.mesh)
          this.miniGrenades.push(g)
        }
      }
    })

    const tPos = this.player.position
    for (const entity of this.entities.getAll()) {
      if (!(entity instanceof EnemyBullet) || !entity.active) continue
      const bp = entity.mesh.position
      const dx = bp.x - tPos.x
      const dz = bp.z - tPos.z
      if (dx * dx + dz * dz < 1.5 * 1.5) {
        entity.active = false
        if (this.invincibleTimer <= 0) {
          if (this.player.shieldActive) {
            this.player.shieldActive = false
            this.explosionEffects.push(new ExplosionEffect(this.scene, tPos.clone(), 1.5))
          } else {
            this.state.lives--
            this.hud.update(this.state.score, this.state.wave, this.state.lives)
            this.invincibleTimer = this.INVINCIBLE_DURATION
            this.explosionEffects.push(new ExplosionEffect(this.scene, tPos.clone(), this.physics.currentRadius * 0.5))
            if (this.state.lives <= 0) {
              this.state.gameOver = true
              this.hud.showGameOver()
            }
          }
        }
      }
    }

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

    const tankPos = this.player.position
    for (let i = this.bonusPickups.length - 1; i >= 0; i--) {
      const bonus = this.bonusPickups[i]
      bonus.update(dt)

      const dx = bonus.mesh.position.x - tankPos.x
      const dz = bonus.mesh.position.z - tankPos.z
      if (dx * dx + dz * dz < BONUS_COLLECT_RADIUS * BONUS_COLLECT_RADIUS) {
        if (bonus.bonusType === 'radius') {
          this.physics.addRadiusBonus()
        } else if (bonus.bonusType === 'multishoot') {
          this.player.multishootLevel++
        } else if (bonus.bonusType === 'shield') {
          this.player.shieldActive = true
        } else if (bonus.bonusType === 'scatter') {
          this.player.scatterLevel++
        } else if (bonus.bonusType === 'drone') {
          this.player.droneCount++
          const drone = new Drone(
            () => this.state.enemyFormation,
            this.drones.length,
            this.scene,
          )
          this.scene.add(drone.group)
          this.drones.push(drone)
        } else if (bonus.bonusType === 'shockwave') {
          this.player.shockwaveLevel++
          this.player.shockwaveTimer = 0
        } else {
          this.player.attractionLevel++
        }
        bonus.active = false
      }

      if (!bonus.active) {
        this.scene.remove(bonus.mesh)
        this.bonusPickups.splice(i, 1)
      }
    }

    for (let i = this.miniGrenades.length - 1; i >= 0; i--) {
      const g = this.miniGrenades[i]
      g.update(dt)
      if (g.exploded) {
        this.scene.remove(g.mesh)
        g.mesh.geometry.dispose()
        ;(g.mesh.material as THREE.Material).dispose()
        this.explosionEffects.push(new ExplosionEffect(this.scene, g.mesh.position, g.damageRadius))

        for (const enemy of this.state.enemyFormation) {
          if (!enemy.active || enemy.isDying) continue
          const ep = enemy.mesh.position
          const dx = g.mesh.position.x - ep.x
          const dz = g.mesh.position.z - ep.z
          if (dx * dx + dz * dz < g.damageRadius * g.damageRadius) {
            const died = enemy.hit()
            if (died) {
              this.state.score++
              this.hud.update(this.state.score, this.state.wave, this.state.lives)
              this.bloodEffects.push(new BloodEffect(this.scene, ep.clone()))
              const poolGeo = new THREE.CircleGeometry(0.5, 12)
              poolGeo.rotateX(-Math.PI / 2)
              const poolMat = new THREE.MeshStandardMaterial({
                color: 0x660000,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
              })
              const pool = new THREE.Mesh(poolGeo, poolMat)
              pool.position.set(ep.x, 0.015, ep.z)
              this.scene.add(pool)
              this.bloodPools.push({ mesh: pool, age: 0, done: false })
            }
          }
        }
        this.miniGrenades.splice(i, 1)
      }
    }

    const tankPosDrone = this.player.position
    for (const drone of this.drones) {
      const proj = drone.update(dt, tankPosDrone)
      if (proj) {
        this.scene.add(proj.mesh)
        this.droneProjectiles.push(proj)
      }
    }

    for (let i = this.droneProjectiles.length - 1; i >= 0; i--) {
      const p = this.droneProjectiles[i]
      p.update(dt)
      if (p.hitEnemy) {
        const died = p.hitEnemy.hit()
        if (died) {
          this.state.score++
          this.hud.update(this.state.score, this.state.wave, this.state.lives)
          this.bloodEffects.push(new BloodEffect(this.scene, p.hitEnemy.mesh.position.clone()))

          if (Math.random() < BONUS_SPAWN_CHANCE) {
            const types: BonusType[] = ['radius', 'multishoot', 'attraction', 'shield', 'scatter', 'drone', 'shockwave']
            const type = types[Math.floor(Math.random() * types.length)]
            const bonus = new BonusPickup(p.hitEnemy.mesh.position.clone(), type)
            this.scene.add(bonus.mesh)
            this.bonusPickups.push(bonus)
          }
        }
      }
      if (!p.active) {
        this.scene.remove(p.mesh)
        p.mesh.geometry.dispose()
        ;(p.mesh.material as THREE.Material).dispose()
        this.droneProjectiles.splice(i, 1)
      }
    }

    if (this.player.shockwaveLevel > 0) {
      this.player.shockwaveTimer += dt
      const interval = Math.max(3, 6 - this.player.shockwaveLevel)
      if (this.player.shockwaveTimer >= interval) {
        this.player.shockwaveTimer = 0
        const tPos = this.player.position
        const ring = new ShockwaveRing(tPos)
        this.scene.add(ring.mesh)
        this.shockwaveRings.push(ring)

        const pushRadius = 12
        for (const enemy of this.state.enemyFormation) {
          if (!enemy.active || enemy.isDying) continue
          const dx = enemy.mesh.position.x - tPos.x
          const dz = enemy.mesh.position.z - tPos.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < pushRadius && dist > 0.01) {
            const strength = 4 * (1 - dist / pushRadius)
            const nx = dx / dist
            const nz = dz / dist
            enemy.mesh.position.x += nx * strength
            enemy.mesh.position.z += nz * strength
            enemy.shootCooldown = Math.max(enemy.shootCooldown, 1.5)
          }
        }
      }
    }

    for (let i = this.shockwaveRings.length - 1; i >= 0; i--) {
      const ring = this.shockwaveRings[i]
      ring.update(dt)
      if (ring.done) {
        this.scene.remove(ring.mesh)
        ring.dispose()
        this.shockwaveRings.splice(i, 1)
      }
    }

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt
      this.player.tank.group.visible = Math.floor(this.invincibleTimer * 10) % 2 === 0
      if (this.invincibleTimer <= 0) {
        this.player.tank.group.visible = true
      }
    }

    if (this.state.enemyFormation.length === 0) {
      this.state.wave++
      this.spawnWave(this.state.wave)
    }

    this.formationCtrl.update(dt, this.state.enemyFormation)
    
    this.cameraCtrl.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  resetGame(): void {
    this.invincibleTimer = 0
    this.player.tank.group.visible = true
    this.hud.hideGameOver()

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
    for (const bonus of this.bonusPickups) {
      this.scene.remove(bonus.mesh)
    }
    this.bonusPickups = []
    for (const g of this.miniGrenades) {
      this.scene.remove(g.mesh)
      g.mesh.geometry.dispose()
      ;(g.mesh.material as THREE.Material).dispose()
    }
    this.miniGrenades = []
    for (const p of this.droneProjectiles) {
      this.scene.remove(p.mesh)
      p.mesh.geometry.dispose()
      ;(p.mesh.material as THREE.Material).dispose()
    }
    this.droneProjectiles = []
    for (const drone of this.drones) {
      this.scene.remove(drone.group)
      drone.dispose(this.scene)
    }
    this.drones = []
    for (const ring of this.shockwaveRings) {
      this.scene.remove(ring.mesh)
      ring.dispose()
    }
    this.shockwaveRings = []
    this.player.multishootLevel = 0
    this.player.attractionLevel = 0
    this.player.scatterLevel = 0
    this.player.droneCount = 0
    this.player.shockwaveLevel = 0
    this.player.shockwaveTimer = 0
    this.player.shieldActive = false
    this.physics.resetRadius()
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

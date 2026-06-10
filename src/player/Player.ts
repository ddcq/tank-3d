import * as THREE from 'three'
import { InputState } from './InputManager'
import { PlayerTank } from './Tank'
import { Bullet, PLAYER_BULLET_SPEED, GRAVITY } from '../entities/Bullet'
import { TrajectoryPreview } from '../entities/TrajectoryPreview'

const MOVE_SPEED = 12
const BULLET_COOLDOWN = 0.33
const TOWER_LEFT_X = -7.2
const TOWER_RIGHT_X = 7.2

const YAW_SENSITIVITY = 4.0
const PITCH_SENSITIVITY = 1.5
const NEUTRAL_PITCH_OFFSET = 0.26
const KEYBOARD_YAW = 0.8
const KEYBOARD_PITCH = 0.35
const MAX_YAW = 1.4
const MAX_PITCH_UP = 1.0
const MAX_PITCH_DOWN = -0.3

export class Player {
  readonly tank: PlayerTank
  input: InputState | null = null
  private bulletCooldown = 0
  private trajectoryPreview: TrajectoryPreview

  get position(): THREE.Vector3 { return this.tank.group.position }

  constructor(scene: THREE.Scene) {
    this.tank = new PlayerTank()
    this.tank.group.position.set(0, 0, 12)
    scene.add(this.tank.group)
    this.trajectoryPreview = new TrajectoryPreview(scene)
  }

  update(dt: number, headYaw: number = 0, headPitch: number = 0, onFireBullet?: (b: Bullet) => void): void {
    if (!this.input) return

    const move = new THREE.Vector3()
    if (this.input.left) move.x = 1
    if (this.input.right) move.x = -1

    if (Math.abs(headYaw) > 0.15) {
      move.x = -headYaw
    }

    this.tank.group.position.x += move.x * MOVE_SPEED * dt
    this.tank.group.position.x = Math.max(TOWER_LEFT_X, Math.min(TOWER_RIGHT_X, this.tank.group.position.x))
    this.tank.group.position.y = 0

    const yawAngle = -headYaw * YAW_SENSITIVITY
      + (this.input.aimLeft ? KEYBOARD_YAW : this.input.aimRight ? -KEYBOARD_YAW : 0)
    const pitchAngle = NEUTRAL_PITCH_OFFSET + headPitch * PITCH_SENSITIVITY
      + (this.input.aimUp ? KEYBOARD_PITCH : this.input.aimDown ? -KEYBOARD_PITCH : 0)

    const clampedYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, yawAngle))
    const clampedPitch = Math.max(MAX_PITCH_DOWN, Math.min(MAX_PITCH_UP, pitchAngle))

    const cp = Math.cos(clampedPitch)
    const aimDir = new THREE.Vector3(
      cp * Math.sin(clampedYaw),
      Math.sin(clampedPitch),
      -cp * Math.cos(clampedYaw),
    )

    const barrelPos = new THREE.Vector3()
    this.tank.barrel!.getWorldPosition(barrelPos)
    this.trajectoryPreview.update(barrelPos, aimDir, PLAYER_BULLET_SPEED, GRAVITY)

    this.bulletCooldown -= dt
    if (this.bulletCooldown < 0) this.bulletCooldown = 0

    if (onFireBullet && this.bulletCooldown <= 0) {
      const bullet = new Bullet(barrelPos, aimDir, true)
      onFireBullet(bullet)
      this.bulletCooldown = BULLET_COOLDOWN
    }
  }

  dispose(): void {
    this.trajectoryPreview.dispose()
  }
}

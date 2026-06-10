import * as THREE from 'three'

const CAMERA_HEIGHT = 12
const CAMERA_DISTANCE = 20
const CAMERA_ANGLE = -Math.PI / 4 // Top-down view (facing the road)

export class CameraController {
  private lookTarget = new THREE.Vector3()
  private smoothedPos = new THREE.Vector3()

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: { get position(): THREE.Vector3 },
  ) {}

  init(): void {
    // Set camera to top-down perspective, directly above the tank
    this.camera.position.set(0, CAMERA_HEIGHT, 0)
    this.camera.rotation.set(CAMERA_ANGLE, 0, 0) // Point directly down at the road
    this.smoothedPos.copy(this.camera.position)
    this.lookTarget.copy(this.player.position)
    this.lookTarget.y = 0; // Keep looking at ground level (z-axis)
    this.camera.lookAt(this.lookTarget)
  }

  update(dt: number): void {
    const p = this.player.position
    const ahead = new THREE.Vector3(p.x, 0, p.z - 90)
    this.lookTarget.lerp(ahead, 1 - Math.exp(-8 * dt))
    this.smoothedPos.lerp(
      new THREE.Vector3(p.x, CAMERA_HEIGHT, p.z + CAMERA_DISTANCE),
      1 - Math.exp(-5 * dt),
    )
    this.camera.position.copy(this.smoothedPos)
    this.camera.lookAt(this.lookTarget)
  }
}

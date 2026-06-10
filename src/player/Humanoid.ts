import * as THREE from 'three'

const BODY_COLOR = 0x4a90d9
const HEAD_COLOR = 0xffccaa
const LIMB_COLOR = 0x3a7bc8
const SHOE_COLOR = 0x333333
const EYE_COLOR = 0x222222

export class Humanoid {
  readonly group: THREE.Group

  private leftArmPivot: THREE.Group
  private rightArmPivot: THREE.Group
  private leftLegPivot: THREE.Group
  private rightLegPivot: THREE.Group
  private animTime = 0

  constructor() {
    this.group = new THREE.Group()

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.28),
      new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.6 }),
    )
    torso.position.y = 0.85
    torso.castShadow = true
    this.group.add(torso)

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: HEAD_COLOR, roughness: 0.4 }),
    )
    head.position.y = 1.25
    head.castShadow = true
    this.group.add(head)

    // Eyes (facing -Z, Three.js forward convention)
    const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_COLOR })
    const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02)
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
    leftEye.position.set(-0.07, 1.3, -0.17)
    this.group.add(leftEye)
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
    rightEye.position.set(0.07, 1.3, -0.17)
    this.group.add(rightEye)

    // Arms
    this.leftArmPivot = this.createLimb(
      new THREE.Vector3(-0.32, 1.05, 0),
      new THREE.Vector3(0.1, 0.38, 0.1),
      LIMB_COLOR,
    )
    this.rightArmPivot = this.createLimb(
      new THREE.Vector3(0.32, 1.05, 0),
      new THREE.Vector3(0.1, 0.38, 0.1),
      LIMB_COLOR,
    )

    // Legs
    this.leftLegPivot = this.createLimb(
      new THREE.Vector3(-0.15, 0.6, 0),
      new THREE.Vector3(0.12, 0.42, 0.12),
      LIMB_COLOR,
      true,
    )
    this.rightLegPivot = this.createLimb(
      new THREE.Vector3(0.15, 0.6, 0),
      new THREE.Vector3(0.12, 0.42, 0.12),
      LIMB_COLOR,
      true,
    )
  }

  private createLimb(
    pivotPos: THREE.Vector3,
    size: THREE.Vector3,
    color: number,
    hasShoe = false,
  ): THREE.Group {
    const pivot = new THREE.Group()
    pivot.position.copy(pivotPos)
    this.group.add(pivot)

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    )
    mesh.position.y = -size.y / 2
    mesh.castShadow = true
    pivot.add(mesh)

    if (hasShoe) {
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(size.x * 0.9, 0.05, size.z * 1.5),
        new THREE.MeshStandardMaterial({ color: SHOE_COLOR, roughness: 0.8 }),
      )
      shoe.position.set(0, -size.y - 0.025, -0.04)
      pivot.add(shoe)
    }

    return pivot
  }

  updateAnimation(dt: number, speed: number): void {
    if (speed > 0.05) {
      this.animTime += dt * speed * 3.5
      const swing = Math.sin(this.animTime)
      const armSwing = swing * 0.6
      const legSwing = swing * 0.5

      this.leftArmPivot.rotation.x = armSwing
      this.rightArmPivot.rotation.x = -armSwing
      this.leftLegPivot.rotation.x = -legSwing
      this.rightLegPivot.rotation.x = legSwing
    } else {
      this.animTime = 0
      const damping = 1 - Math.exp(-10 * dt)
      this.leftArmPivot.rotation.x *= 1 - damping
      this.rightArmPivot.rotation.x *= 1 - damping
      this.leftLegPivot.rotation.x *= 1 - damping
      this.rightLegPivot.rotation.x *= 1 - damping
    }
  }

  get position(): THREE.Vector3 {
    return this.group.position
  }
}

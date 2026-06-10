import * as THREE from 'three'

const DOT_INTERVAL = 0.08
const MAX_DOTS = 60

export class TrajectoryPreview {
  private dots: THREE.Points
  private dotPositions: Float32Array
  private dotGeometry: THREE.BufferGeometry
  private crosshair: THREE.Group

  constructor(scene: THREE.Scene) {
    this.dotPositions = new Float32Array(MAX_DOTS * 3)
    this.dotGeometry = new THREE.BufferGeometry()
    this.dotGeometry.setAttribute('position', new THREE.BufferAttribute(this.dotPositions, 3))
    this.dotGeometry.setDrawRange(0, 0)
    const dotMat = new THREE.PointsMaterial({
      color: 0xffdd44,
      size: 0.35,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    })
    this.dots = new THREE.Points(this.dotGeometry, dotMat)
    scene.add(this.dots)

    this.crosshair = new THREE.Group()
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0xff0000,
      emissiveIntensity: 0.6,
    })
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.1), crossMat)
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.9), crossMat)
    this.crosshair.add(bar1, bar2)

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.005
    this.crosshair.add(ring)

    this.crosshair.position.y = 0.01
    scene.add(this.crosshair)

    this.hide()
  }

  update(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, gravity: number): void {
    const a = -0.5 * gravity
    const b = dir.y * speed
    const c = origin.y

    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) {
      this.hide()
      return
    }

    const sqrtD = Math.sqrt(discriminant)
    const t1 = (-b + sqrtD) / (2 * a)
    const t2 = (-b - sqrtD) / (2 * a)
    const impactT = Math.max(t1, t2)

    if (impactT <= 0) {
      this.hide()
      return
    }

    const maxTime = Math.min(impactT, MAX_DOTS * DOT_INTERVAL)
    let count = 0
    for (let t = 0; t <= maxTime && count < MAX_DOTS; t += DOT_INTERVAL, count++) {
      const i = count * 3
      this.dotPositions[i] = origin.x + dir.x * speed * t
      this.dotPositions[i + 1] = origin.y + dir.y * speed * t + a * t * t
      this.dotPositions[i + 2] = origin.z + dir.z * speed * t
    }

    this.dotGeometry.attributes.position.needsUpdate = true
    this.dotGeometry.setDrawRange(0, count)
    this.dots.visible = true

    this.crosshair.position.x = origin.x + dir.x * speed * impactT
    this.crosshair.position.z = origin.z + dir.z * speed * impactT
    this.crosshair.visible = true
  }

  show(): void {
    this.dots.visible = true
    this.crosshair.visible = true
  }

  hide(): void {
    this.dots.visible = false
    this.crosshair.visible = false
  }

  dispose(): void {
    this.dotGeometry.dispose()
    ;(this.dots.material as THREE.Material).dispose()
    this.crosshair.children.forEach(c => {
      const m = c as THREE.Mesh
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    })
  }
}

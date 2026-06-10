import * as THREE from 'three'

const TANK_HULL = 0x4b6f2f
const TANK_TURRET = 0x3a5a1f
const TANK_TRACK = 0x2a2a2a
const UKRAINE_YELLOW = 0xffd500

export class PlayerTank {
  readonly group: THREE.Group
  private turretGroup: THREE.Group
  private barrelMesh: THREE.Mesh | undefined

  constructor() {
    this.group = new THREE.Group()
    this.turretGroup = new THREE.Group()

    const trackGeo = new THREE.BoxGeometry(0.4, 0.35, 3.2)
    const trackMat = new THREE.MeshStandardMaterial({ color: TANK_TRACK, roughness: 0.9 })
    for (const side of [-1, 1]) {
      const track = new THREE.Mesh(trackGeo, trackMat)
      track.position.set(side * 1.15, 0.175, 0)
      track.castShadow = true
      this.group.add(track)
      for (let i = -1; i <= 1; i += 0.67) {
        const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 8)
        const wheelMat = new THREE.MeshStandardMaterial({ color: TANK_TRACK })
        const wheel = new THREE.Mesh(wheelGeo, wheelMat)
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(side * 1.15, 0.175, i * 1.2)
        this.group.add(wheel)
      }
    }

    const hullGeo = new THREE.BoxGeometry(2.4, 0.6, 3.6)
    const hullMat = new THREE.MeshStandardMaterial({ color: TANK_HULL, roughness: 0.7 })
    const hull = new THREE.Mesh(hullGeo, hullMat)
    hull.position.y = 0.5
    hull.castShadow = true
    this.group.add(hull)

    const fPlateGeo = new THREE.BoxGeometry(2.2, 0.3, 0.6)
    const fPlateMat = new THREE.MeshStandardMaterial({ color: TANK_HULL, roughness: 0.7 })
    const fPlate = new THREE.Mesh(fPlateGeo, fPlateMat)
    fPlate.position.set(0, 0.95, -1.6)
    fPlate.rotation.x = -0.2
    fPlate.castShadow = true
    this.group.add(fPlate)

    for (const side of [-1, 1]) {
      const yellowGeo = new THREE.PlaneGeometry(1.4, 0.15)
      const yellowMat = new THREE.MeshStandardMaterial({ color: UKRAINE_YELLOW })
      const ys = new THREE.Mesh(yellowGeo, yellowMat)
      ys.position.set(side * 1.21, 0.4, -0.8)
      ys.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
      this.group.add(ys)
      const blueGeo = new THREE.PlaneGeometry(1.4, 0.15)
      const blueMat = new THREE.MeshStandardMaterial({ color: 0x005bbb })
      const bs = new THREE.Mesh(blueGeo, blueMat)
      bs.position.set(side * 1.21, 0.22, -0.8)
      bs.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2
      this.group.add(bs)
    }

    const turretGeo = new THREE.BoxGeometry(1.8, 0.5, 1.6)
    const turretMat = new THREE.MeshStandardMaterial({ color: TANK_TURRET, roughness: 0.7 })
    const turret = new THREE.Mesh(turretGeo, turretMat)
    turret.position.y = 1.05
    this.turretGroup.add(turret)

    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.12, 3, 8)
    const barrelMat = new THREE.MeshStandardMaterial({ color: TANK_TURRET, roughness: 0.6 })
    this.barrelMesh = new THREE.Mesh(barrelGeo, barrelMat)
    this.barrelMesh.rotation.x = Math.PI / 2
    this.barrelMesh.position.set(0, 0, -1.8)
    this.turretGroup.add(this.barrelMesh)

    const hatchGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8)
    const hatchMat = new THREE.MeshStandardMaterial({ color: TANK_TURRET })
    const hatch = new THREE.Mesh(hatchGeo, hatchMat)
    hatch.position.set(-0.4, 1.35, 0.2)
    this.turretGroup.add(hatch)

    const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8)
    const antMat = new THREE.MeshStandardMaterial({ color: TANK_TRACK })
    this.turretGroup.add(new THREE.Mesh(antGeo, antMat).translateX(0.7).translateY(1.5).translateZ(0.4))

    this.group.add(this.turretGroup)
  }

  get barrel(): THREE.Mesh | undefined { return this.barrelMesh }
}

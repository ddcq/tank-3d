import * as THREE from 'three'

export class Environment {
  constructor(private readonly scene: THREE.Scene) {}

  init(): void {
    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    this.scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.8)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffeedd, 1.5)
    sun.position.set(50, 80, 30)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 150
    sun.shadow.camera.left = -60
    sun.shadow.camera.right = 60
    sun.shadow.camera.top = 60
    sun.shadow.camera.bottom = -60
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0x8888ff, 0.3)
    fill.position.set(-30, 40, -20)
    this.scene.add(fill)

    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008)

    this.scene.background = new THREE.Color(0x87ceeb)
  }
}

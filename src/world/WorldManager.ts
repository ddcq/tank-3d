import * as THREE from 'three'
import { Environment } from './Environment'
import { Terrain } from './Terrain'
import { Building } from './Building'

const BUILDING_SPAN = 200

export class WorldManager {
  readonly terrain: Terrain

  constructor(private readonly scene: THREE.Scene) {
    this.terrain = new Terrain()
  }

  async init(): Promise<void> {
    const env = new Environment(this.scene)
    env.init()
    this.scene.add(this.terrain.mesh)
    this.createGround()
    this.createBuildings()
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, BUILDING_SPAN),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  private createBuildings(): void {
    const startZ = -BUILDING_SPAN / 2
    const endZ = BUILDING_SPAN / 2
    this.buildRow('left', startZ, endZ)
    this.buildRow('right', startZ, endZ)
  }

  private buildRow(side: 'left' | 'right', startZ: number, endZ: number): void {
    let z = startZ
    while (z < endZ) {
      const b = new Building(side, 0)
      const halfD = b.depth / 2
      b.mesh.position.z = z + halfD
      this.scene.add(b.mesh)
      z += b.depth + 0.3
    }
  }

  update(_dt: number, _playerPosition: THREE.Vector3): void {
  }
}

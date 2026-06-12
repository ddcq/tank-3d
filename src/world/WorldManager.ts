import * as THREE from 'three'
import { Environment } from './Environment'
import { Terrain } from './Terrain'
import { Building } from './Building'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

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
    await this.createBuildings()
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

  private async createBuildings(): Promise<void> {
    const loader = new OBJLoader()
    const model = await loader.loadAsync('/models/building.obj')
    const src = model.children[0] as THREE.Mesh
    if (!src || !src.geometry) {
      console.warn('Failed to load building model, using fallback')
      return
    }
    const geom = src.geometry

    const texLoader = new THREE.TextureLoader()
    const brickTextures = await Promise.all([
      texLoader.loadAsync('/textures/brick_156.jpg'),
      texLoader.loadAsync('/textures/brick_159.jpg'),
      texLoader.loadAsync('/textures/brick_171.jpg'),
      texLoader.loadAsync('/textures/brick_172.jpg'),
    ])

    const startZ = -BUILDING_SPAN / 2
    const endZ = BUILDING_SPAN / 2
    this.buildRow('left', startZ, endZ, geom, brickTextures)
    this.buildRow('right', startZ, endZ, geom, brickTextures)
  }

  private buildRow(
    side: 'left' | 'right',
    startZ: number,
    endZ: number,
    geom: THREE.BufferGeometry,
    textures: THREE.Texture[],
  ): void {
    let z = startZ
    while (z < endZ) {
      const tex = textures[Math.floor(Math.random() * textures.length)]
      const b = new Building(side, 0, geom, tex)
      const halfD = b.depth / 2
      b.mesh.position.z = z + halfD
      this.scene.add(b.mesh)
      z += b.depth + 0.3
    }
  }

  update(_dt: number, _playerPosition: THREE.Vector3): void {
  }
}

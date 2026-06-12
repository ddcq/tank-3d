import * as THREE from 'three'

const ROAD_WIDTH = 18
const ROAD_LENGTH = 200

export class Terrain {
  readonly mesh: THREE.Group

  constructor() {
    this.mesh = new THREE.Group()

    const texLoader = new THREE.TextureLoader()
    const concreteTex = texLoader.load('/textures/concrete.jpg')
    concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping
    concreteTex.repeat.set(2, 22)

    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 1, 1)
    roadGeo.rotateX(-Math.PI / 2)
    const roadMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 })
    const road = new THREE.Mesh(roadGeo, roadMat)
    road.position.y = 0
    road.receiveShadow = true
    this.mesh.add(road)

    const sidewalkHeight = 0.15
    const sidewalkGeo = new THREE.BoxGeometry(2, sidewalkHeight, ROAD_LENGTH)
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 })

    const leftSidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat)
    leftSidewalk.position.set(-ROAD_WIDTH / 2 - 1, sidewalkHeight / 2, 0)
    leftSidewalk.receiveShadow = true
    this.mesh.add(leftSidewalk)

    const rightSidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat)
    rightSidewalk.position.set(ROAD_WIDTH / 2 + 1, sidewalkHeight / 2, 0)
    rightSidewalk.receiveShadow = true
    this.mesh.add(rightSidewalk)
  }

  heightAt(_x: number, _z: number): number {
    return 0
  }

  getRoadBounds(): { left: number; right: number } {
    return { left: -ROAD_WIDTH / 2 + 1.5, right: ROAD_WIDTH / 2 - 1.5 }
  }
}

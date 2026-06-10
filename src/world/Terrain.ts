import * as THREE from 'three'

const ROAD_WIDTH = 12
const ROAD_LENGTH = 200

export class Terrain {
  readonly mesh: THREE.Group

  constructor() {
    this.mesh = new THREE.Group()

    // Road (wide avenue)
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 1, 1)
    roadGeo.rotateX(-Math.PI / 2)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.95 })
    const road = new THREE.Mesh(roadGeo, roadMat)
    road.position.y = 0
    road.receiveShadow = true
    this.mesh.add(road)

    // Road center line (dashed white) - these will be part of scrolling terrain sections now
    // We'll handle the center lines in WorldManager instead
    // The road center lines should be included within each terrain section

    // Sidewalks
    const sidewalkHeight = 0.15
    const sidewalkGeo = new THREE.BoxGeometry(2, sidewalkHeight, ROAD_LENGTH)
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.9 })

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
    // For a flat terrain, always return 0
    return 0
  }

  getRoadBounds(): { left: number; right: number } {
    return { left: -ROAD_WIDTH / 2 + 1.5, right: ROAD_WIDTH / 2 - 1.5 }
  }
}
